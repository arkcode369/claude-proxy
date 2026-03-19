// ─── API Key Auth Middleware ─────────────────────────────────────────────────

import type { MiddlewareHandler } from "hono";
import { config } from "../config";

const PUBLIC_PATHS = new Set(["/", "/health"]);

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  if (PUBLIC_PATHS.has(c.req.path)) return next();

  const authHeader = c.req.header("Authorization") ?? "";
  const xApiKey = c.req.header("x-api-key") ?? "";

  // Support both "Bearer <key>" and "x-api-key: <key>"
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : xApiKey.trim();

  if (!token) {
    return c.json(
      { error: { type: "authentication_error", message: "Missing API key" } },
      401
    );
  }

  if (config.apiKeys.length > 0 && !config.apiKeys.includes(token)) {
    return c.json(
      { error: { type: "authentication_error", message: "Invalid API key" } },
      401
    );
  }

  return next();
};
