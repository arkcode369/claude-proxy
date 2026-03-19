#!/usr/bin/env bash
# ─── Claude Proxy - VPS Deploy Script ──────────────────────────────────────
# Run this once on your VPS to set up and start the proxy
# Usage: bash deploy.sh

set -e

echo "🚀 Claude Proxy Deploy Script"
echo "==============================="

# ─── 1. Check dependencies ────────────────────────────────────────────────────
command -v docker >/dev/null 2>&1 || {
  echo "❌ Docker not found. Installing..."
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker $USER
  echo "✅ Docker installed. You may need to re-login for group changes."
}

command -v docker-compose >/dev/null 2>&1 || docker compose version >/dev/null 2>&1 || {
  echo "❌ Docker Compose not found. Installing..."
  sudo apt-get update && sudo apt-get install -y docker-compose-plugin
}

echo "✅ Docker is ready"

# ─── 2. Set up .env ───────────────────────────────────────────────────────────
if [ ! -f .env ]; then
  echo ""
  echo "⚙️  Setting up .env..."
  read -p "Enter your upstream URL (e.g. https://yoursite.com/api/analyze): " UPSTREAM
  read -p "Enter your API key(s) (comma-separated, e.g. mykey123,key2): " USER_KEYS
  echo "PORT=1111" > .env
  echo "UPSTREAM_URL=${UPSTREAM}" >> .env
  echo "API_KEYS=${USER_KEYS}" >> .env
  echo "✅ .env created"
else
  echo "✅ .env already exists, skipping"
fi

# ─── 3. Build & Start ────────────────────────────────────────────────────────
echo ""
echo "🔨 Building Docker image..."
docker compose build

echo ""
echo "▶️  Starting Claude Proxy..."
docker compose up -d

echo ""
echo "✅ Claude Proxy is running!"
echo ""
echo "📋 Test it with:"
echo "  curl http://localhost:1111/health"
echo ""
echo "🔌 Endpoint for Windsurf/RooCode/Kilo:"
echo "  Base URL : http://YOUR_VPS_IP:1111"
echo "  API Key  : (the key you just set)"
echo ""
echo "📡 Logs: docker compose logs -f"
