"""Pydantic input/output models for API endpoints."""
from typing import Optional, List, Literal
from pydantic import BaseModel, EmailStr, Field


Role = Literal["admin", "dealer", "cnf", "mnp", "supplier"]
AdminRole = Literal["super_admin", "staff"]


# ---- Auth ----
# ---- Auth ----
class LoginInput(BaseModel):
    email: Optional[str] = None
    login_id: Optional[str] = None
    user_code: Optional[str] = None
    username: Optional[str] = None
    password: str


class RegisterInput(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=8)
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


class InventorySetStockIn(BaseModel):
    warehouse_id: str
    product_id: str
    quantity: int  # Absolute stock on hand (in boxes)
    safety_stock: Optional[int] = None
    reason: Optional[str] = "admin_manual_override"


# ---- Dealer / Supplier / CNF ----
class DealerIn(BaseModel):
    name: str
    email: Optional[str] = ""
    phone: Optional[str] = ""
    company: str
    city: Optional[str] = ""
    state: str
    gstin: Optional[str] = ""
    credit_limit: float = 0
    target_monthly: float = 0
    target_quarterly: float = 0
    cnf_id: Optional[str] = None
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


class CnfIn(BaseModel):
    name: str
    email: Optional[str] = ""
    phone: Optional[str] = ""
    area: Optional[str] = ""
    state: Optional[str] = ""
    company: Optional[str] = ""
    target_monthly: float = 0
    target_quarterly: float = 0
    password: Optional[str] = "Cnf@123"
    user_code: Optional[str] = ""
    login_id: Optional[str] = ""


MnpIn = CnfIn


# ---- Order ----
class OrderItemIn(BaseModel):
    product_id: str
    quantity: int
    quantity_ordered: Optional[int] = None
    quantity_allocated: Optional[int] = None
    quantity_invoiced: Optional[int] = 0
    quantity_pending: Optional[int] = None
    boxes: Optional[int] = None
    boxes_allocated: Optional[int] = None
    boxes_invoiced: Optional[int] = 0
    boxes_pending: Optional[int] = None
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
    cnf_id: Optional[str] = None
    order_type: Optional[Literal["dealer_order", "cnf_stock"]] = "dealer_order"
    billing_type: Optional[Literal["direct", "cnf_consignment"]] = "direct"
    notes: Optional[str] = ""


class OrderStatusUpdate(BaseModel):
    status: Optional[Literal["pending", "approved", "reserved", "shipped", "delivered", "cancelled", "processing", "partially_fulfilled"]] = None
    notes: Optional[str] = ""
    carrier: Optional[str] = None
    tracking_no: Optional[str] = None
    dispatch_date: Optional[str] = None
    delivery_days_total: Optional[int] = 7
    estimated_delivery_days: Optional[str] = "7 Days"
    target_delivery_date: Optional[str] = None


class PartialBillingItem(BaseModel):
    product_id: str
    quantity_to_bill: int
    boxes_to_bill: Optional[int] = None
    rate: Optional[float] = None


class OrderPartialBillingIn(BaseModel):
    invoice_no: Optional[str] = None
    items: List[PartialBillingItem]
    notes: Optional[str] = ""


class WarehouseAssignmentIn(BaseModel):
    warehouse_id: str


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


# ---- Notifications ----

class NotificationIn(BaseModel):
    user_id: Optional[str] = None
    role: Optional[str] = None
    title: str
    body: str
    kind: Literal["info", "success", "warning", "error"] = "info"


# ---- Staff / Employee Access ----
class StaffCreateIn(BaseModel):
    name: str
    email: Optional[str] = None
    login_id: Optional[str] = None
    password: str = Field(default="Emp@123", max_length=8)
    allowed_tabs: List[str] = Field(default_factory=list)  # ["all"] = unrestricted
    is_active: bool = True


class StaffUpdateIn(BaseModel):
    name: Optional[str] = None
    allowed_tabs: Optional[List[str]] = None
    is_active: Optional[bool] = None
    new_password: Optional[str] = Field(default=None, max_length=8)


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str = Field(max_length=8)

