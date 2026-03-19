// ─── POST /api/analyze — Direct pass-through endpoint ───────────────────────
// Supports both buffered and streaming responses.

import { Hono } from "hono";
import { callUpstream, streamUpstream } from "../lib/upstream";

const analyze = new Hono();

analyze.post("/api/analyze", async (c) => {
  let body: Record<string, unknown>;

  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { error: { type: "invalid_request_error", message: "Invalid JSON body" } },
      400
    );
  }

  const isStreaming = body.stream === true;

  // ─── Streaming path ───────────────────────────────────────────────────────
  if (isStreaming) {
    const result = await streamUpstream(body);

    if (!result.ok) {
      return c.json(
        { error: { type: "api_error", message: result.error } },
        502
      );
    }

    return new Response(result.body, {
      status: result.status,
      headers: {
        "Content-Type": result.contentType,
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
        "Transfer-Encoding": "chunked",
      },
    });
  }

  // ─── Buffered path ────────────────────────────────────────────────────────
  const result = await callUpstream(body);

  if (!result.ok && "error" in result) {
    return c.json(
      { error: { type: "api_error", message: result.error } },
      502
    );
  }

  return c.json(result.data, result.status as never);
});

export default analyze;
