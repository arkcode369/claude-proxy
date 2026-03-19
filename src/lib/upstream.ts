// ─── Upstream Fetch Helper ───────────────────────────────────────────────────

import { config } from "../config";

// ─── Buffered (non-streaming) ────────────────────────────────────────────────

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

// ─── Streaming ───────────────────────────────────────────────────────────────

export type StreamUpstreamResult =
  | { ok: true; status: number; body: ReadableStream<Uint8Array>; contentType: string }
  | { ok: false; status: 502; error: string };

export async function streamUpstream(body: unknown): Promise<StreamUpstreamResult> {
  let res: Response;

  try {
    res = await fetch(config.upstreamUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error("[upstream] stream fetch error:", err);
    return { ok: false, status: 502, error: "Upstream request failed" };
  }

  if (!res.body) {
    return { ok: false, status: 502, error: "Upstream returned no body" };
  }

  const contentType = res.headers.get("content-type") ?? "text/event-stream";

  return {
    ok: true,
    status: res.status,
    body: res.body,
    contentType,
  };
}
