// ─── Health Check Routes ─────────────────────────────────────────────────────

import { Hono } from "hono";
import { config } from "../config";

const health = new Hono();

health.get("/", (c) => c.json({ status: "ok", service: "claude-proxy" }));
health.get("/health", (c) => c.json({ status: "ok", service: "claude-proxy" }));

// ─── Debug: probe upstream with a specific model (no FORCE_MODEL override) ──
health.get("/debug/probe-model/:model", async (c) => {
  const model = c.req.param("model");
  const res = await fetch(config.upstreamUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      max_tokens: 200,
      messages: [{ role: "user", content: "What exact model are you? One sentence only." }],
    }),
  });
  const data = await res.json();
  return c.json({ sent_model: model, upstream_status: res.status, response: data });
});

export default health;
