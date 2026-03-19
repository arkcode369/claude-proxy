// ─── POST /v1/messages — Anthropic-compatible endpoint ──────────────────────
// Compatible with: Windsurf, RooCode, Kilo, Continue, etc.
// Note: upstream does not support streaming — "stream: true" is stripped automatically.

import { Hono } from "hono";
import { callUpstream } from "../lib/upstream";

const messages = new Hono();

messages.post("/v1/messages", async (c) => {
  let body: unknown;

  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { error: { type: "invalid_request_error", message: "Invalid JSON body" } },
      400
    );
  }

  const result = await callUpstream(body);

  if (!result.ok && "error" in result) {
    return c.json(
      { error: { type: "api_error", message: result.error } },
      502
    );
  }

  return c.json(result.data, result.status as never);
});

export default messages;
