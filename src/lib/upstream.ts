// ─── Upstream Fetch Helper ───────────────────────────────────────────────────

import { config } from "../config";

export type UpstreamResult =
  | { ok: true; status: number; data: unknown }
  | { ok: false; status: number; data: unknown }
  | { ok: false; status: 502; error: string };

export async function callUpstream(body: unknown): Promise<UpstreamResult> {
  let res: Response;

  try {
    res = await fetch(config.upstreamUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error("[upstream] fetch error:", err);
    return { ok: false, status: 502, error: "Upstream request failed" };
  }

  const data = await res.json();

  return { ok: res.ok, status: res.status, data };
}
