# Security Rules (.ai/security-rules.md)

## 1. Zero-Secret Policy
- **Absolute Rule**: Never commit passwords, private keys, JWT secrets, or API keys.
- **Verification**: Ensure all credentials are loaded via `os.environ` or `.env` file (configured in `.gitignore`).
- **Gitleaks integration**: Ensure any matching pattern halts commit pipelines.

## 2. Strict Role-Based Access Control (RBAC)
- All protected endpoints must call `require_roles(...)` or equivalents in their dependencies.
- **Roles**:
  - `admin`: Full system permission.
  - `mnp`: Access to analytics and dealer oversight; forbidden from direct database/system writes.
  - `dealer`: Access to browse SKU catalog, place orders, download invoices; forbidden from viewing other dealers' analytics or data.
  - `supplier`: Access to view POs and update delivery status.

## 3. Data Sanitization & Error Handling
- Never return stack traces or raw database exceptions to the client.
- Wrap motor errors in HTTP 500/400 exceptions with sanitized messages.
- Clean MongoDB ObjectIds (`_id`) to JSON-safe string attributes before responding.
