# Permanent AI Agent Operating Rules (.ai/rules.md)

Any AI Coding Agent, Autonomous Engineering Assistant, or Developer operating in the **YAMINI FLOW** repository MUST strictly adhere to these immutable operating rules:

## 1. Architectural Integrity
- **Never modify core architecture** without analyzing `/docs/ARCHITECTURE.md` and `.ai/architecture-memory.md`.
- **Never duplicate existing logic**: Always check `backend/` and `frontend/src/` utilities before creating new helper functions.

## 2. Mandatory Verification Gate
Before declaring any task complete, an AI Agent must pass the following validation gate:
1. **Compilation Check**: JavaScript/TypeScript syntax valid, Python code imports resolvable.
2. **Automated Test Run**: Unit and integration tests (`pytest`) pass.
3. **Security Check**: No exposed secrets, proper input validation via Pydantic/Zod, strict RBAC authorization checks.
4. **Documentation Sync**: Update corresponding files in `/docs/` and `.ai/decisions.md` when architectural decisions change.

## 3. Production Quality Standard
- Code must be production-ready: typed, error-handled, logged, structured, and resilient.
- Never leave `TODO` stubs or half-implemented endpoints.
