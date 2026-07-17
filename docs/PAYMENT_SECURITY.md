# Yamini Flow — Payment Security Architecture

---

## Core Rule: Zero Client-Side Trust
**Never trust client-side payment success callbacks.** Frontend confirmation screens or query parameters (`?status=success`) are strictly ignored for billing state updates.

---

## 1. Server-Side Verification Protocol

1. **Webhook Signature Validation**: Every payment provider callback (Stripe / Razorpay / PayPal) must pass cryptographic HMAC signature verification against the gateway webhook secret (`PAYMENT_WEBHOOK_SECRET`).
2. **Idempotency Enforcement**: Every incoming webhook event ID is logged in MongoDB before execution to prevent duplicate billing processing.
3. **Transaction Logging**: All payment attempts, successful authorizations, and failures are recorded in an immutable audit ledger.
4. **Failure Recovery**: Failed webhook deliveries trigger exponential backoff retries and alert the financial ops queue.
