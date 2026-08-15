# Nexa Production Deployment Readiness Guide

> Architecture guidance only. This document does not certify that Nexa is production-ready. See `artifacts/release-hardening-report.md` for the current release gate.

## 1. Local Model vs. Public Launch Boundaries

| Local Acceptance Model | Production Public Deployment Boundary |
| :--- | :--- |
| **Oracle Local PDB** (`localhost:1521/FREEPDB1`) | Managed Oracle Cloud Autonomous Database / Oracle Cloud Infrastructure (OCI) with TLS Wallet encryption. |
| **Local Disk Storage** (`uploads/`) | Amazon S3 / Google Cloud Storage object bucket with CDN endpoint. |
| **Local Socket.IO** | Multi-node Socket.IO cluster behind NGINX / Cloudflare sticky sessions with Redis Streams adapter. |
| **Local Email Provider** (`FakeEmailProvider` / SMTP) | SendGrid, AWS SES, or Mailgun with verified SPF/DKIM records. |

---

## 2. Infrastructure & Security Readiness Rules
- **Environment Variables**: Managed via AWS Secrets Manager or HashiCorp Vault. Never check secrets into `.env`.
- **Database Connection Pooling**: Configure `DB_POOL_MIN=5`, `DB_POOL_MAX=20` with Oracle Thin mode TLS.
- **WebSocket Scaling**: Deploy Redis cluster for Socket.IO event broadcasting across scaled backend pods.
