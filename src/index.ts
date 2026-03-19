// ─── Entry Point ─────────────────────────────────────────────────────────────

import { config } from "./config";
import app from "./app";

console.log(`🚀 Claude Proxy running on port ${config.port}`);
console.log(`🔑 API Keys loaded: ${config.apiKeys.length}`);

export default {
  port: config.port,
  fetch: app.fetch,
};
