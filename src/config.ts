// ─── Environment & Config ───────────────────────────────────────────────────

const UPSTREAM_URL = Bun.env.UPSTREAM_URL;
if (!UPSTREAM_URL) throw new Error("UPSTREAM_URL is not set in .env");

const API_KEYS = (Bun.env.API_KEYS ?? "")
  .split(",")
  .map((k) => k.trim())
  .filter(Boolean);

const PORT = Number(Bun.env.PORT ?? 1111);

// Force override model — upstream only supports specific models.
// Set FORCE_MODEL in .env to lock all requests to one model.
// Leave empty to pass model as-is from the client.
const FORCE_MODEL = Bun.env.FORCE_MODEL?.trim() || null;

export const config = {
  upstreamUrl: UPSTREAM_URL,
  apiKeys: API_KEYS,
  port: PORT,
  forceModel: FORCE_MODEL,
} as const;
