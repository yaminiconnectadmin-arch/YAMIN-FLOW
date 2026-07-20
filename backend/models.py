"""Pydantic input/output models for API endpoints."""
from typing import Optional, List, Literal
from pydantic import BaseModel, EmailStr, Field


Role = Literal["admin", "dealer", "mnp", "supplier"]


# ---- Auth ----
# ---- Auth ----
class LoginInput(BaseModel):
    email: str  # can be email address or distributor login id (e.g. D-ST-MH-101)
    password: str


class RegisterInput(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str
    role: Role
    phone: Optional[str] = None
    company: Optional[str] = None


# ---- Users ----
class UserOut(BaseModel):
    id: str
    email: str
    name: str
    role: str
    user_code: Optional[str] = ""
    login_id: Optional[str] = ""
    phone: Optional[str] = None
    company: Optional[str] = None
    status: Optional[str] = "active"
    created_at: Optional[str] = None


# ---- Category ----
class CategoryIn(BaseModel):
    name: str
    description: Optional[str] = ""


# ---- Weight Matrix ----
class WeightMatrixItem(BaseModel):
    category: str  # e.g., "CSK CHIPBOARD SCREWS", "CSK DRYWALL SCREWS"
    size: str      # e.g., "4X16", "3.5X25"
    wt_1000_pcs_kg: float
    qty_per_box: int = 1000
    rate: float = 0.0
    dealer_landing: float = 0.0
    item_code: str
    wd_basic: float = 0.0
    wd_landing: float = 0.0


# ---- Product ----
class ProductIn(BaseModel):
    sku: str
    name: str
    category: str
    description: Optional[str] = ""
    unit: str = "pcs"
    weight_kg: float = 0
    wt_1000_pcs_kg: float = 0
    size: Optional[str] = ""
    item_code: Optional[str] = ""
    qty_per_box: int = 1000
    price: float = 0
    cost: float = 0
    dealer_landing: float = 0
    wd_basic: float = 0
    wd_landing: float = 0
    gst: float = 18
    hsn: Optional[str] = ""
    moq: int = 1
    safety_stock: int = 0
    primary_supplier_id: Optional[str] = None
    secondary_supplier_id: Optional[str] = None
    lead_time_days: int = 7
    status: Literal["active", "inactive"] = "active"


# ---- Warehouse ----
class WarehouseIn(BaseModel):
    code: str
    name: str
    address: Optional[str] = ""
    city: Optional[str] = ""
    state: Optional[str] = ""
    manager: Optional[str] = ""


# ---- Inventory ----
class InventoryAdjustIn(BaseModel):
    warehouse_id: str
    product_id: str
    quantity: int  # can be negative for removal
    reason: Optional[str] = "manual_adjust"


# ---- Dealer / Supplier / MNP ----
class DealerIn(BaseModel):
    name: str
    email: Optional[str] = ""
    phone: Optional[str] = ""
    company: str
    city: Optional[str] = ""
    state: str
    gstin: Optional[str] = ""
    credit_limit: float = 0
    mnp_id: Optional[str] = None
    password: Optional[str] = "Dealer@123"
    user_code: Optional[str] = ""
    login_id: Optional[str] = ""


class SupplierIn(BaseModel):
    name: str
    email: EmailStr
    phone: str
    company: str
    city: str
    state: str
    gstin: Optional[str] = ""
    lead_time_days: int = 7
    password: Optional[str] = "Supplier@123"


class MnpIn(BaseModel):
    name: str
    email: Optional[str] = ""
    phone: str
    area: str
    state: str
    company: Optional[str] = ""
    target_monthly: float = 0
    password: Optional[str] = "Mnp@123"
    user_code: Optional[str] = ""
    login_id: Optional[str] = ""


# ---- Order ----
class OrderItemIn(BaseModel):
    product_id: str
    quantity: int
    boxes: Optional[int] = None
    size: Optional[str] = ""
    qty_per_box: Optional[int] = 1000
    wt_1000_pcs_kg: Optional[float] = 0.0
    total_weight_kg: Optional[float] = 0.0
    rate: Optional[float] = 0.0
    dealer_landing: Optional[float] = 0.0
    value_before_tax: Optional[float] = 0.0
    gst_amount: Optional[float] = 0.0
    value_after_tax: Optional[float] = 0.0


class OrderIn(BaseModel):
    items: List[OrderItemIn]
    warehouse_id: Optional[str] = None
    dealer_id: Optional[str] = None
    notes: Optional[str] = ""


class OrderStatusUpdate(BaseModel):
    status: Literal["pending", "approved", "reserved", "shipped", "delivered", "cancelled", "processing"]


# ---- Purchase Order ----
class PurchaseOrderItemIn(BaseModel):
    product_id: str
    quantity: int
    quantity_kg: float = 0.0
    weight_per_1000_pcs: float = 0.0
    rate: float


class PurchaseOrderIn(BaseModel):
    supplier_id: str
    warehouse_id: str
    items: List[PurchaseOrderItemIn]
    expected_delivery: Optional[str] = None
    notes: Optional[str] = ""


class POStatusUpdate(BaseModel):
    status: Literal["draft", "sent", "confirmed", "shipped", "received", "cancelled"]


# ---- Tally ----
class TallySyncIn(BaseModel):
    module: Literal["products", "stock", "sales", "purchases", "vouchers", "warehouses", "ledgers"]
    direction: Literal["push", "pull"] = "push"


# ---- AI ----
class AiInsightIn(BaseModel):
    topic: Literal["dealer_ranking", "supplier_ranking", "demand_forecast", "procurement", "sales_summary", "dead_stock", "custom"]
    context: Optional[str] = ""


# ---- Notifications ----
class NotificationIn(BaseModel):
    user_id: Optional[str] = None
    role: Optional[str] = None
    title: str
    body: str
    kind: Literal["info", "success", "warning", "error"] = "info"
