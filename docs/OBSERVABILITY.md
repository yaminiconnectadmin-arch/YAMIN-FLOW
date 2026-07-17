# Yamini Flow — Observability, Structured Logging & Sentry Monitoring

---

## 1. Error Monitoring & Exception Telemetry (Sentry)

Yamini Flow integrates **Sentry** across both frontend React application instances and Python FastAPI backend workers to track unhandled exceptions and performance bottlenecks in real time.

### Configuration
- **Frontend DSN**: Set via `REACT_APP_SENTRY_DSN` in `.env.production`.
- **Backend DSN**: Set via `SENTRY_DSN` in deployment environment settings.

---

## 2. Structured JSON Logging Format

All production application logs emitted by Python FastAPI middleware or server processes follow strict JSON structuring for automated ingestion into Logtail / Datadog / CloudWatch:

```json
{
  "timestamp": "2026-07-12T02:35:00.123Z",
  "level": "ERROR",
  "request_id": "req_8a7c92b4",
  "user_id": "usr_abc123",
  "path": "/api/products",
  "method": "POST",
  "status_code": 500,
  "error_details": {
    "message": "MongoDB connection lost",
    "type": "ConnectionFailure"
  }
}
```

---

## 3. Core Operational Metrics & Alerts

The observability stack monitors three critical signals:
1. **API Latency**: Alert triggered if 95th percentile (P95) latency exceeds 350ms over a 5-minute window.
2. **Sync Failures**: Alert triggered immediately upon two consecutive Tally ERP integration failures.
3. **5xx Error Rate**: Automated PagerDuty escalation if HTTP 5xx error rate exceeds 0.5% of total traffic.
