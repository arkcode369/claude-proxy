// ─── App Setup ───────────────────────────────────────────────────────────────

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { authMiddleware } from "./middleware/auth";
import health from "./routes/health";
import messages from "./routes/messages";
import analyze from "./routes/analyze";

const app = new Hono();

// ─── Global Middleware ───────────────────────────────────────────────────────
app.use("*", logger());
app.use("*", cors());
app.use("*", authMiddleware);

// ─── Routes ──────────────────────────────────────────────────────────────────
app.route("/", health);
app.route("/", messages);
app.route("/", analyze);

export default app;
