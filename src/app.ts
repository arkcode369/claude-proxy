// ─── App Setup ───────────────────────────────────────────────────────────────

import { Hono } from "hono";
import { cors } from "hono/cors";

import { authMiddleware } from "./middleware/auth";
import { requestLoggerMiddleware } from "./middleware/requestLogger";
import health from "./routes/health";
import messages from "./routes/messages";
import analyze from "./routes/analyze";

const app = new Hono();

// ─── Global Middleware ───────────────────────────────────────────────────────
app.use("*", cors());
app.use("*", authMiddleware);
app.use("*", requestLoggerMiddleware); // runs after auth so key is available

// ─── Routes ──────────────────────────────────────────────────────────────────
app.route("/", health);
app.route("/", messages);
app.route("/", analyze);

export default app;
