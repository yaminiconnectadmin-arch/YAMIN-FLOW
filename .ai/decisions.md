# Architectural Decisions (.ai/decisions.md)

## ADR-001: Python-based Asynchronous Backend with FastAPI
- **Context**: The product requires high concurrency for real-time inventory adjustments and high-speed PDF/invoice rendering.
- **Decision**: Adopt FastAPI with `motor` (asynchronous MongoDB client) to ensure non-blocking I/O operations.
- **Consequence**: Python 3.13 async event loops handle all routing, and connection pooling manages Mongo transactions.

## ADR-002: Session Security using HTTP-Only JWT Cookies
- **Context**: LocalStorage storage of tokens exposes the application to Cross-Site Scripting (XSS) attacks.
- **Decision**: Store JWTs in secure, HTTP-only, SameSite=None cookies with a Bearer Authorization fallback for integration tests.
- **Consequence**: Browsers automatically manage credentials, neutralizing XSS credential theft.

## ADR-003: Mocked Tally XML Sync with Integration Hooks
- **Context**: On-premise Tally ERP is not consistently available during staging/development.
- **Decision**: Provide robust mock endpoints (`/api/tally/sync`) that mimic XML schema ingestion and response behavior, preserving hooks for real XML endpoint swapping.
- **Consequence**: Tests can run deterministically without an active Tally instance, while leaving production code ready for real XML integration.
