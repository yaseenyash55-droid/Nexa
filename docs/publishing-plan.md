# Nexa Production Publishing & Deployment Plan

> Planned target architecture, not execution evidence or publication approval.

## 1. Environment Architecture
- **Frontend**: React Vite SPA hosted on HTTPS CDN / static server.
- **Backend**: Express / Socket.IO Node.js cluster behind NGINX reverse proxy with WebSocket upgrade support.
- **Database**: Dedicated Oracle FREEPDB1 instance protected within private VPC (Port 1521 restricted to backend IPs).

## 2. Secrets Management
- All secrets (`DB_PASSWORD`, `JWT_SECRET`, `JAMENDO_CLIENT_ID`) loaded via environment variables (`.env`).
- Never expose port 1521, database wallets, or API keys publicly.
