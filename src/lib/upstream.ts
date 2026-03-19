// ─── Upstream Fetch Helper ───────────────────────────────────────────────────
// NOTE: Upstream (Vercel serverless) does NOT support streaming.
// If a request comes in with "stream: true", we strip it before forwarding.

import { config } from "../config";

export type UpstreamResult =
  | { ok: true; status: number; data: unknown }
  | { ok: false; status: number; data: unknown }
  | { ok: false; status: 502; error: string };

export async function callUpstream(body: unknown): Promise<UpstreamResult> {
  const rawBody = body !== null && typeof body === "object"
    ? (body as Record<string, unknown>)
    : {};

  // Strip "stream: true" — upstream does not support SSE
  // Force model override if FORCE_MODEL is set in .env
  const safeBody = {
    ...rawBody,
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

  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}
