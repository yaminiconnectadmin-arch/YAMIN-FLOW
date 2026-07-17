# YAMINI FLOW — System Architecture Blueprint

## 1. Technological Stack

### Frontend Client
- **Runtime**: Node.js / browser environment
- **Framework**: React 19 SPA
- **Styling**: Tailwind CSS + shadcn/ui
- **Build System**: CRA (Create React App) customized via Craco (`craco.config.js`)
- **Key Libraries**: `@phosphor-icons/react` (icons), `recharts` (analytics charting), `sonner` (toast notifications)

### Backend Engine
- **Framework**: FastAPI (Python 3.13)
- **Runtime**: Asynchronous Python (uvicorn)
- **Database Client**: Motor (AsyncIOMotorClient) + PyMongo
- **Cryptography**: `bcrypt` (password hashing), `PyJWT` (JSON Web Token signature validation)

### Database
- **Engine**: MongoDB (NoSQL)
- **Collections**: `users`, `products`, `warehouses`, `inventory_ledgers`, `orders`, `purchase_orders`, `tally_sync_logs`, `notifications`, `audit_logs`, `settings`

### Third-Party APIs
- **Tally ERP Integration**: HTTP-XML post interface on port 9000 (currently mocked with sync-log tracking).
- **AI Insights Engine**: Claude Sonnet 4.6 integrated via the `emergentintegrations` Universal LLM client library.

---

## 2. Architecture & Data Flow

```
+---------------------------------------------------------------------------------+
|                             CLIENT / USER INTERFACE                             |
|              React 19 SPA (frontend/) -- Tailwind CSS / Radix UI                |
|                      Outfit (display) & IBM Plex Sans (body)                    |
+---------------------------------------------------------------------------------+
                                         |
                                         v HTTPS REST / JWT Auth / Cookies
+---------------------------------------------------------------------------------+
|                            FASTAPI BACKEND ROUTER                               |
|                Rate Limiting, CORS Controls, Protected RBAC Guards              |
+---------------------------------------------------------------------------------+
                                         |
                     +-------------------+-------------------+
                     |                   |                   |
                     v                   v                   v
        +-------------------------+  +-----------------+ +-----------------------+
        |  MONGODB REPLICA        |  |  TALLY ERP      | |  CLAUDE LLM           |
        |  Motor client, Indexing |  |  HTTP-XML Post  | |  emergentintegrations |
        +-------------------------+  +-----------------+ +-----------------------+
```

### Authentication Architecture
- JWT-based authentication using HTTP-only `access_token` and `refresh_token` cookies.
- Fallback Bearer Authorization header support for programmatic / testing access.
- IP + Email combined login attempt rate limiting (5 attempts limit before 15-minute lock).

### Inventory & Order Engine Flow
- **Order Placement**: Automatically reserves inventory units.
- **Deficit Engine**: Evaluates safety stock thresholds and pending demand to dynamically calculate PO requisitions.
- **Voucher Linking**: Correlates Tally XML invoices with database orders either automatically (guid matches) or manually via fuzzy name matching (1% amount tolerance).
