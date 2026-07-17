# Database Production Architecture & Schema Blueprint

## 1. Schema Specifications

### Users Collection (`users`)
- `id` (ObjectId, Unique): Internal identifier.
- `email` (String, Unique): E-mail address.
- `password_hash` (String): Secure hashed password using bcrypt.
- `role` (String): Access tier ('admin', 'mnp', 'dealer', 'supplier').
- `name` (String): User's full name.
- `company` (String, Optional): Company/Dealer firm name.
- `city` (String, Optional): Operating city.
- `state` (String, Optional): Operating state (used for regional analytics).

### Products Collection (`products`)
- `sku` (String, Unique): Stock Keeping Unit descriptor.
- `name` (String): Product display name.
- `category` (String): Category grouping.
- `price` (Float): Selling price to dealers.
- `cost` (Float): Purchase cost from suppliers.
- `safety_stock` (Int): Threshold below which procurement alerts trigger.
- `moq` (Int): Minimum Order Quantity for PO generation.

### Warehouses Collection (`warehouses`)
- `code` (String, Unique): Short warehouse code (e.g. 'WH-MUM').
- `name` (String): Warehouse display name.
- `city` (String): Operating city.
- `state` (String): Operating state.

### Inventory Collection (`inventory`)
- `product_id` (ObjectId): Reference to `products`.
- `warehouse_id` (ObjectId): Reference to `warehouses`.
- `on_hand` (Int): Physical stock count in warehouse.
- `reserved` (Int): Stock committed to approved but undelivered orders.
- `available` (Int): Calculated stock (`on_hand - reserved`).
- `safety_status` (String): Evaluation status ('healthy', 'low', 'critical').

### Orders Collection (`orders`)
- `dealer_id` (ObjectId): Reference to `users` (dealer).
- `items` (List of dicts): Products and quantities ordered.
- `total_amount` (Float): Cumulative invoice value.
- `status` (String): Progress tier ('pending', 'approved', 'shipped', 'delivered', 'cancelled').
- `tally_voucher_no` (String, Optional): Matched invoice GUID/number from Tally ERP.

### Audit Logs Collection (`audit_logs`)
- `user_id` (ObjectId): Executing user.
- `email` (String): User email.
- `role` (String): Role of the actor.
- `action` (String): Action performed (e.g. 'order.create').
- `target` (String): Identifier of target resource.
- `details` (Dict): JSON metadata of the action.
- `created_at` (Date): Execution timestamp (uses a TTL index of 90 days).

---

## 2. Production Indexes & Performance

To optimize query execution time and enforce relational constraints, the following indexes are created on startup:
1. **Users**: Unique index on `{ "email": 1 }`.
2. **Products**: Unique index on `{ "sku": 1 }`.
3. **Warehouses**: Unique index on `{ "code": 1 }`.
4. **Inventory**: Compound unique index on `{ "warehouse_id": 1, "product_id": 1 }` to prevent duplicate records per product-warehouse mapping.
5. **Audit Logs**: TTL index on `{ "created_at": 1 }` with `expireAfterSeconds: 7776000` (90 days).

---

## 3. Backup, Migration & Rollback Strategy

### Backup
- **Atlas Backups**: Automated daily snapshot backups with 7-day retention. Point-in-time recovery (PITR) enabled on production cluster.

### Schema Migration
- Schema upgrades are managed via versioned migration scripts run on app startup (within `seed.py`). All collection and index creations are guaranteed idempotent.

### Rollback Strategy
1. **Step 1**: Halt write access on the API backend.
2. **Step 2**: Restore the latest Atlas backup snapshot.
3. **Step 3**: Revert the backend codebase release.
4. **Step 4**: Run data reconciliation for transactions created between the snapshot and write-halt.
