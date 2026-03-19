// ─── Upstream Fetch Helper ───────────────────────────────────────────────────
// NOTE: Upstream (Vercel serverless) does NOT support streaming.
// If a request comes in with "stream: true", we strip it before forwarding.

import { config } from "../config";

export type UpstreamResult =
  | { ok: true; status: number; data: unknown }
  | { ok: false; status: number; data: unknown }
  | { ok: false; status: 502; error: string };

export async function callUpstream(body: unknown): Promise<UpstreamResult> {
  // Strip "stream: true" — upstream does not support SSE
  const safeBody =
    body !== null && typeof body === "object"
      ? { ...(body as Record<string, unknown>), stream: false }
      : body;

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
