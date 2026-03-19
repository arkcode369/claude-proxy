// ─── Upstream Fetch Helper ───────────────────────────────────────────────────
// NOTE: Upstream (Vercel serverless) does NOT support streaming.
// If a request comes in with "stream: true", we strip it before forwarding.

import { config } from "../config";

export type UpstreamResult =
  | { ok: true; status: number; data: unknown }
  | { ok: false; status: number; data: unknown }
  | { ok: false; status: 502; error: string };

// Remove cache_control from a content block or system array item
function stripCacheControl<T extends Record<string, unknown>>(item: T): Omit<T, "cache_control"> {
  const { cache_control, ...rest } = item;
  return rest as Omit<T, "cache_control">;
}

// Strip non-standard fields from response content blocks
// e.g. upstream adds "caller" field to tool_use blocks which breaks RooCode
function sanitizeResponseContent(content: unknown[]): unknown[] {
  return content.map((block) => {
    if (block === null || typeof block !== "object") return block;
    const b = block as Record<string, unknown>;
    if (b.type === "tool_use") {
      // Only keep standard Anthropic tool_use fields
      const { id, type, name, input } = b;
      return { id, type, name, input };
    }
    return block;
  });
}

// Strip non-standard fields from upstream response
function sanitizeResponse(data: unknown): unknown {
  if (data === null || typeof data !== "object") return data;
  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.content)) return data;
  return {
    ...d,
    content: sanitizeResponseContent(d.content),
  };
}

// Recursively strip cache_control from system and messages content arrays
function sanitizeBody(raw: Record<string, unknown>): Record<string, unknown> {
  const result = { ...raw };

  // Strip thinking — not supported by upstream
  delete result.thinking;

  // Strip cache_control from system array
  if (Array.isArray(result.system)) {
    result.system = result.system.map((item: unknown) =>
      item !== null && typeof item === "object"
        ? stripCacheControl(item as Record<string, unknown>)
        : item
    );
  }

  // Strip cache_control from messages[].content arrays
  if (Array.isArray(result.messages)) {
    result.messages = result.messages.map((msg: unknown) => {
      if (msg === null || typeof msg !== "object") return msg;
      const m = msg as Record<string, unknown>;
      if (!Array.isArray(m.content)) return m;
      return {
        ...m,
        content: m.content.map((block: unknown) =>
          block !== null && typeof block === "object"
            ? stripCacheControl(block as Record<string, unknown>)
            : block
        ),
      };
    });
  }

  return result;
}

export async function callUpstream(body: unknown): Promise<UpstreamResult> {
  const rawBody = body !== null && typeof body === "object"
    ? (body as Record<string, unknown>)
    : {};

  // Sanitize + strip unsupported fields
  const sanitized = sanitizeBody(rawBody);

  // Strip stream:true, force model override if set
  const safeBody = {
    ...sanitized,
    stream: false,
    ...(config.forceModel ? { model: config.forceModel } : {}),
  };

  console.log("[upstream] → sending body:", JSON.stringify(safeBody, null, 2));

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

  const raw = await res.json();
  const data = sanitizeResponse(raw);
  console.log("[upstream] ← response status:", res.status);
  console.log("[upstream] ← response body:", JSON.stringify(data, null, 2));
  return { ok: res.ok, status: res.status, data };
}
