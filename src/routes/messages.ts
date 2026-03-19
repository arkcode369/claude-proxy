// ─── POST /v1/messages — Anthropic-compatible endpoint ──────────────────────
// Compatible with: Windsurf, RooCode, Kilo, Continue, etc.
//
// Upstream does NOT support real streaming, so:
// - If client sends stream:true  → fetch buffered, convert to SSE format
// - If client sends stream:false → return buffered JSON as-is

import { Hono } from "hono";
import { callUpstream } from "../lib/upstream";
import { toSSE } from "../lib/toSSE";

const messages = new Hono();

messages.post("/v1/messages", async (c) => {
  let body: Record<string, unknown>;

  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { error: { type: "invalid_request_error", message: "Invalid JSON body" } },
      400
    );
  }

  const wantsStream = body.stream === true;

  // Always fetch buffered from upstream (streaming not supported)
  const result = await callUpstream(body);

  if (!result.ok && "error" in result) {
    return c.json(
      { error: { type: "api_error", message: result.error } },
      502
    );
  }

  // ─── Client wants streaming → fake SSE from buffered response ────────────
  if (wantsStream) {
    const sseStream = toSSE(result.data);
    return new Response(sseStream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
        "Connection": "keep-alive",
      },
    });
  }

  // ─── Non-streaming → return JSON directly ────────────────────────────────
  return c.json(result.data, result.status as never);
});

export default messages;
