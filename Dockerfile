# ─── Build Stage ─────────────────────────────────────────────────────────────
FROM oven/bun:1.2-alpine AS builder

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

COPY src ./src

# ─── Runtime Stage ────────────────────────────────────────────────────────────
FROM oven/bun:1.2-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY package.json ./

# Create logs dir with correct ownership before switching user
RUN mkdir -p /app/logs && chown -R bun:bun /app/logs

# Non-root user for security
USER bun

EXPOSE 1111

CMD ["bun", "src/index.ts"]
