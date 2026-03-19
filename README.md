# Claude Proxy 🚀

Anthropic-compatible proxy server for Claude — deploy ke VPS dan pakai di Windsurf, RooCode, Kilo, Continue, dsb.

**Tech Stack:** Bun + Hono + Docker

---

## 🔧 Deploy ke VPS (Ubuntu)

### 1. Clone repo ke VPS
```bash
git clone https://github.com/YOUR_USERNAME/claude-proxy.git
cd claude-proxy
```

### 2. Jalankan deploy script
```bash
bash deploy.sh
```

Script akan:
- Install Docker (kalau belum ada)
- Setup API Key kamu
- Build & start container

### 3. Cek status
```bash
curl http://localhost:1111/health
# → {"status":"ok","service":"claude-proxy"}
```

---

## 🔌 Konfigurasi di Windsurf / RooCode / Kilo

| Setting | Value |
|---|---|
| **Provider** | Anthropic (atau Custom OpenAI-compatible) |
| **Base URL** | `http://YOUR_VPS_IP:1111` |
| **API Key** | key yang kamu set waktu deploy |
| **Model** | `claude-haiku-4-5-20251001` (atau model lain) |

### Contoh curl test:
```bash
curl -X POST http://YOUR_VPS_IP:1111/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "claude-haiku-4-5-20251001",
    "max_tokens": 1000,
    "messages": [
      {"role": "user", "content": "Halo! Siapa kamu?"}
    ]
  }'
```

---

## ⚙️ Endpoints

| Method | Path | Keterangan |
|---|---|---|
| `GET` | `/health` | Health check |
| `POST` | `/v1/messages` | Anthropic-compatible (untuk IDE plugins) |
| `POST` | `/api/analyze` | Pass-through ke upstream langsung |

---

## 🔑 Manajemen API Keys

Edit `.env` di VPS:
```env
API_KEYS=key1,key2,key3
PORT=1111
```

Restart setelah edit:
```bash
docker compose restart
```

---

## 📋 Commands

```bash
# Lihat logs
docker compose logs -f

# Restart
docker compose restart

# Stop
docker compose down

# Update (setelah git pull)
docker compose build && docker compose up -d
```
