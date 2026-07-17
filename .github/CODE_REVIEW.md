# Yamini Flow — Automated & Human Code Review Rules

All Pull Requests (reviewed by human engineers and CodeRabbit AI) MUST strictly satisfy these 6 evaluation pillars:

1. **Security First**: Verify no hardcoded secrets, check for injection vectors, ensure strict Pydantic/Zod schema validation, and confirm RBAC checks on protected routes.
2. **Clean Architecture**: Respect boundary separation between React UI (`frontend/`) and FastAPI backend (`backend/`).
3. **DRY & Reusability**: Prevent duplicated utility code. Utilize tailwind/shadcn design system components.
4. **Performance Awareness**: Inspect database queries for missing indexes, avoid N+1 queries, and ensure frontend bundle optimizations.
5. **Proper Error Handling**: Handle all async errors gracefully. Never expose stack traces or raw database exceptions to clients.
6. **Testing Coverage**: Any new feature or bug fix must include accompanying unit, integration, or E2E Playwright tests.
