// ─── Request Logger ──────────────────────────────────────────────────────────
// Logs every request to console + rotating daily log files under ./logs/

import { mkdirSync, appendFileSync } from "fs";
import { join } from "path";

const LOG_DIR = join(process.cwd(), "logs");

// Ensure logs directory exists
mkdirSync(LOG_DIR, { recursive: true });

function getLogFilePath(): string {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return join(LOG_DIR, `${date}.log`);
}

function maskKey(key: string): string {
  if (key.length <= 6) return "***";
  return key.slice(0, 4) + "***" + key.slice(-2);
}

export interface RequestLogEntry {
  method: string;
  path: string;
  status: number;
  durationMs: number;
  apiKey?: string;
  ip?: string;
  error?: string;
}

export function logRequest(entry: RequestLogEntry): void {
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  const maskedKey = entry.apiKey ? maskKey(entry.apiKey) : "-";
  const errorPart = entry.error ? ` | ERR: ${entry.error}` : "";

  const line = `[${now}] ${entry.method} ${entry.path} | ${entry.status} | ${entry.durationMs}ms | key: ${maskedKey} | ip: ${entry.ip ?? "-"}${errorPart}`;

  // Write to file
  try {
    appendFileSync(getLogFilePath(), line + "\n", "utf-8");
  } catch (err) {
    console.error("[logger] Failed to write log:", err);
  }

  // Also print to stdout (Docker logs)
  console.log(line);
}
