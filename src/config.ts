// ─── Environment & Config ───────────────────────────────────────────────────

const UPSTREAM_URL = Bun.env.UPSTREAM_URL;
if (!UPSTREAM_URL) throw new Error("UPSTREAM_URL is not set in .env");

const API_KEYS = (Bun.env.API_KEYS ?? "")
  .split(",")
  .map((k) => k.trim())
  .filter(Boolean);

const PORT = Number(Bun.env.PORT ?? 1111);

export const config = {
  upstreamUrl: UPSTREAM_URL,
  apiKeys: API_KEYS,
  port: PORT,
} as const;
