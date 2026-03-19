// ─── Upstream Fetch Helper ───────────────────────────────────────────────────
// Upstream does NOT support: streaming, thinking, cache_control, or tool_use.
// This module sanitizes requests going IN and responses coming OUT so that
// RooCode / Windsurf / Kilo receive fully Anthropic-spec-compliant responses.

import { config } from "../config";
import crypto from "crypto";

export type AnthropicMessage = {
  model: string;
  id: string;
  type: string;
  role: string;
  content: unknown[];
  stop_reason: string | null;
  stop_sequence: string | null;
  usage: Record<string, unknown>;
};

export type UpstreamResult =
  | { ok: true; status: number; data: unknown }
  | { ok: false; status: number; data: unknown }
  | { ok: false; status: 502; error: string };

// ─── Request sanitization ────────────────────────────────────────────────────

function stripCacheControl<T extends Record<string, unknown>>(item: T): Omit<T, "cache_control"> {
  const { cache_control, ...rest } = item;
  return rest as Omit<T, "cache_control">;
}

function sanitizeContentArray(content: unknown[]): unknown[] {
  return content.map((block) => {
    if (block === null || typeof block !== "object") return block;
    const b = block as Record<string, unknown>;
    // Strip cache_control from each block
    const { cache_control, ...rest } = b;
    return rest;
  });
}

function sanitizeBody(raw: Record<string, unknown>): Record<string, unknown> {
  const result = { ...raw };

  // Strip unsupported features
  delete result.thinking;

  // Normalize system: strip cache_control from each item
  if (Array.isArray(result.system)) {
    result.system = result.system.map((item: unknown) =>
      item !== null && typeof item === "object"
        ? stripCacheControl(item as Record<string, unknown>)
        : item
    );
  }

  // Strip cache_control from messages[].content
  if (Array.isArray(result.messages)) {
    result.messages = result.messages.map((msg: unknown) => {
      if (msg === null || typeof msg !== "object") return msg;
      const m = msg as Record<string, unknown>;

      // Normalize string content
      if (typeof m.content === "string") return m;

      if (Array.isArray(m.content)) {
        return { ...m, content: sanitizeContentArray(m.content) };
      }
      return m;
    });
  }

  // Strip tools and tool_choice — upstream doesn't support them
  // We handle tool injection ourselves on the response side
  delete result.tools;
  delete result.tool_choice;

  return result;
}

// ─── Response normalization ───────────────────────────────────────────────────

// When client sent tools but upstream returned plain text,
// we inject a tool_use block so RooCode can parse the response.
function injectToolUse(
  data: AnthropicMessage,
  tools: Array<{ name: string; input_schema: Record<string, unknown> }>
): AnthropicMessage {
  // Find the first tool that has a "result" or similar string field — prefer attempt_completion
  const preferredTools = ["attempt_completion", "ask_followup_question"];
  let chosenTool = tools.find((t) => preferredTools.includes(t.name)) ?? tools[0];

  // Extract text from content
  const textBlock = data.content.find(
    (b): b is { type: string; text: string } =>
      b !== null && typeof b === "object" && (b as Record<string, unknown>).type === "text"
  );
  const text = textBlock?.text ?? "";

  // Build input based on tool schema properties
  const props = (chosenTool.input_schema?.properties ?? {}) as Record<string, unknown>;
  const inputKeys = Object.keys(props);

  let toolInput: Record<string, unknown> = {};

  if (inputKeys.includes("result")) {
    toolInput = { result: text };
  } else if (inputKeys.includes("question")) {
    toolInput = { question: text, follow_up: [{ text: "Lanjutkan", mode: null }] };
  } else if (inputKeys.length > 0) {
    // Fallback: put text into first string property
    toolInput = { [inputKeys[0]]: text };
  }

  return {
    ...data,
    content: [
      {
        type: "tool_use",
        id: `toolu_${crypto.randomBytes(12).toString("hex")}`,
        name: chosenTool.name,
        input: toolInput,
      },
    ],
    stop_reason: "tool_use",
  };
}

// Strip non-standard fields added by upstream (e.g. "caller" in tool_use blocks)
function sanitizeResponseContent(content: unknown[]): unknown[] {
  return content.map((block) => {
    if (block === null || typeof block !== "object") return block;
    const b = block as Record<string, unknown>;
    if (b.type === "tool_use") {
      const { id, type, name, input } = b;
      return { id, type, name, input };
    }
    return block;
  });
}

function sanitizeResponse(data: unknown): unknown {
  if (data === null || typeof data !== "object") return data;
  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.content)) return data;
  return { ...d, content: sanitizeResponseContent(d.content) };
}

// ─── Main call ───────────────────────────────────────────────────────────────

export async function callUpstream(body: unknown): Promise<UpstreamResult> {
  const rawBody = body !== null && typeof body === "object"
    ? (body as Record<string, unknown>)
    : {};

  // Save original tools before stripping (we need them for response injection)
  const originalTools = Array.isArray(rawBody.tools)
    ? rawBody.tools as Array<{ name: string; input_schema: Record<string, unknown> }>
    : null;

  // Sanitize request
  const sanitized = sanitizeBody(rawBody);
  const safeBody = {
    ...sanitized,
    stream: false,
    ...(config.forceModel ? { model: config.forceModel } : {}),
  };

  let res: Response;
  try {
    res = await fetch(config.upstreamUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(safeBody),
    });
  } catch (err) {
    console.error("[upstream] fetch error:", err);
    return { ok: false, status: 502, error: "Upstream request failed" };
  }

  const raw = await res.json() as AnthropicMessage;

  // Sanitize response (strip non-standard fields)
  let data = sanitizeResponse(raw) as AnthropicMessage;

  // ── Tool injection ──────────────────────────────────────────────────────────
  // If the client sent tools but upstream returned plain text (stop_reason=end_turn),
  // wrap the text into a tool_use block so RooCode/Windsurf can parse it correctly.
  if (
    originalTools &&
    originalTools.length > 0 &&
    data.stop_reason === "end_turn" &&
    Array.isArray(data.content) &&
    data.content.every(
      (b) => b !== null && typeof b === "object" && (b as Record<string, unknown>).type === "text"
    )
  ) {
    console.log("[upstream] injecting tool_use for:", originalTools.map((t) => t.name).join(", "));
    data = injectToolUse(data, originalTools);
  }

  console.log("[upstream] ← status:", res.status, "| stop_reason:", data.stop_reason);
  return { ok: res.ok, status: res.status, data };
}
