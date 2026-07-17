# Coding Standards (.ai/coding-standards.md)

## Python / FastAPI Standards
- Follow PEP 8 guidelines for formatting.
- Explicitly annotate endpoint arguments and response types using Pydantic schemas.
- Use async/await for all database queries and external HTTP calls (via `httpx`).
- Keep controllers thin; isolate business/math logic (like the deficit PO engine) to utility scripts.

## React Standards
- Write modular components in standard ES6 JavaScript.
- Avoid inline styles; utilize utility classes from Tailwind CSS.
- Ensure all interactive elements include `data-testid` attributes to support end-to-end tests.
- Always clean up event listeners and intervals inside `useEffect` return hooks.
