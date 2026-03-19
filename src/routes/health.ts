// ─── Health Check Routes ─────────────────────────────────────────────────────

import { Hono } from "hono";

const health = new Hono();

health.get("/", (c) => c.json({ status: "ok", service: "claude-proxy" }));
health.get("/health", (c) => c.json({ status: "ok", service: "claude-proxy" }));

export default health;
