import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

const app = new Hono();

// ─── Config ────────────────────────────────────────────────────────────────
const UPSTREAM_URL = "https://marketriskmonitor.com/api/analyze";
const API_KEYS = (Bun.env.API_KEYS ?? "").split(",").map((k) => k.trim()).filter(Boolean);
const PORT = Number(Bun.env.PORT ?? 1111);

// ─── Middleware ─────────────────────────────────────────────────────────────
app.use("*", logger());
app.use("*", cors());

// ─── Auth Middleware ─────────────────────────────────────────────────────────
app.use("*", async (c, next) => {
  // Skip auth for health check
  if (c.req.path === "/health" || c.req.path === "/") return next();

  const authHeader = c.req.header("Authorization") ?? "";
  const xApiKey = c.req.header("x-api-key") ?? "";

  // Support both "Bearer <key>" and "x-api-key: <key>"
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : xApiKey.trim();

  if (!token) {
    return c.json({ error: { type: "authentication_error", message: "Missing API key" } }, 401);
  }

  if (API_KEYS.length > 0 && !API_KEYS.includes(token)) {
    return c.json({ error: { type: "authentication_error", message: "Invalid API key" } }, 401);
  }

  return next();
});

// ─── Health Check ───────────────────────────────────────────────────────────
app.get("/", (c) => c.json({ status: "ok", service: "claude-proxy" }));
app.get("/health", (c) => c.json({ status: "ok", service: "claude-proxy" }));

// ─── Anthropic-compatible Messages Endpoint ──────────────────────────────────
// Compatible with: Windsurf, RooCode, Kilo, Continue, etc.
app.post("/v1/messages", async (c) => {
  let body: Record<string, unknown>;

  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { type: "invalid_request_error", message: "Invalid JSON body" } }, 400);
  }

  // Forward to upstream
  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(UPSTREAM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error("[proxy] upstream fetch error:", err);
    return c.json({ error: { type: "api_error", message: "Upstream request failed" } }, 502);
  }

  const data = await upstreamRes.json();

  // If upstream returned an error status, pass it through
  if (!upstreamRes.ok) {
    return c.json(data, upstreamRes.status as never);
  }

  return c.json(data, 200);
});

// ─── Also support /api/analyze directly (pass-through) ──────────────────────
app.post("/api/analyze", async (c) => {
  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { type: "invalid_request_error", message: "Invalid JSON body" } }, 400);
  }

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(UPSTREAM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error("[proxy] upstream fetch error:", err);
    return c.json({ error: { type: "api_error", message: "Upstream request failed" } }, 502);
  }

  const data = await upstreamRes.json();
  return c.json(data, upstreamRes.status as never);
});

// ─── Start ──────────────────────────────────────────────────────────────────
console.log(`🚀 Claude Proxy running on port ${PORT}`);
console.log(`📡 Upstream: ${UPSTREAM_URL}`);
console.log(`🔑 API Keys loaded: ${API_KEYS.length}`);

export default {
  port: PORT,
  fetch: app.fetch,
};
