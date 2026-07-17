# Yamini Flow — Production Deployment Hardening & Operations Guide

---

## 1. Vercel Frontend & Edge Hardening (`frontend/`)

### 1.1 Environment Variable Governance
Set the following production environment secrets in Vercel Project Settings:
- `MONGO_URL`: Production MongoDB Atlas connection string.
- `JWT_SECRET`: High-entropy 64-character secret for HMAC token signing.
- `EMERGENT_LLM_KEY`: API key for Claude/Emergent AI service.

### 1.2 Security Headers
Every HTTP response served by edge nodes includes enterprise security headers:
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`

### 1.3 Caching & CDN Optimization
- Static React assets (`/static/*`, images, fonts) are cached at edge locations with `Cache-Control: public, max-age=31536000, immutable`.
- API endpoints (`/api/*`) specify `Cache-Control: no-store, no-cache, must-revalidate`.

---

## 2. Render Container Deployment (`backend/`)

- **Service**: `yaminiflow-backend`
- **Runtime**: Python 3.13 with Uvicorn async worker process.
- **Health Checks**: Automated HTTP probes on `/api/health` ensuring zero-downtime rolling container updates.
