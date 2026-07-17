# Architecture Memory (.ai/architecture-memory.md)

## Tech Stack Summary
- **Frontend**: React 19 SPA + Craco + Tailwind CSS + shadcn/ui + Phosphor Icons
- **Backend**: FastAPI + Python 3.13 + Uvicorn + Motor (AsyncIOMotorClient)
- **Database**: MongoDB (NoSQL)
- **AI**: Claude Sonnet 4.6 via `emergentintegrations`

## Key Directories
- `frontend/`: React single page application.
- `backend/`: FastAPI Python application.
- `backend/routers/`: Core routing logic (auth, catalog, partners, orders, procurement, ops).
- `docs/`: Canonical system documentation.
- `tests/`: Testing pyramid suites.

## Critical Endpoints
- `POST /api/auth/login`: Issue HTTP-only JWT cookies.
- `GET /api/auth/me`: Fetch current logged-in user profile.
- `POST /api/auth/logout`: Clear session cookies.
- `GET /api/products`: Read SKU catalog.
- `POST /api/orders`: Create new order and reserve stock.
- `POST /api/tally/sync`: Synchronize invoices and ledgers from Tally ERP.
- `POST /api/ops/ai-insights`: Claude LLM insights generator.
