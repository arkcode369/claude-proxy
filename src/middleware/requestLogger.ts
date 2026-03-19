// ─── Request Logger Middleware ───────────────────────────────────────────────
// Wraps every request and logs method, path, status, duration, masked API key

import type { MiddlewareHandler } from "hono";
import { logRequest } from "../lib/logger";

export const requestLoggerMiddleware: MiddlewareHandler = async (c, next) => {
  const start = Date.now();

  await next();

  const durationMs = Date.now() - start;

  // Extract masked API key from request
  const authHeader = c.req.header("Authorization") ?? "";
  const xApiKey = c.req.header("x-api-key") ?? "";
  const apiKey = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : xApiKey.trim() || undefined;

  // Get client IP
  const ip =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    c.req.header("x-real-ip") ??
    "unknown";

  logRequest({
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    durationMs,
    apiKey,
    ip,
  });
};
