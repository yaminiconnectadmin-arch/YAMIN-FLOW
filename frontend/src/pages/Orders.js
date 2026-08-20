import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api, fmt } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";
import { PageSection, StatusBadge, EmptyState } from "@/components/common/Common";
import { ExportButton } from "@/lib/csv";

import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/components/ui/sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Eye, Plus, Stack, Printer, FileText, CheckCircle, Clock, Truck, Package, ArrowsClockwise, Warehouse } from "@phosphor-icons/react";
import ReceiptModal from "@/components/common/ReceiptModal";
import TaxInvoiceModal from "@/components/common/TaxInvoiceModal";

export function getDeliveryCountdown(order) {
  if (!order) return null;
  const statusLower = (order.status || "").toLowerCase();
  const isDelivered = statusLower === "delivered";
  const isShipped = ["shipped", "in_transit"].includes(statusLower) || Boolean(order.tracking_no);
  
  if (!isShipped && !isDelivered) return null;

  const totalDays = Number(order.delivery_days_total) || 7;
  const dispatchDateStr = order.dispatch_date ? String(order.dispatch_date).slice(0, 10) : (order.created_at ? String(order.created_at).slice(0, 10) : new Date().toISOString().slice(0, 10));

  let targetDate;
  if (order.target_delivery_date) {
    targetDate = new Date(String(order.target_delivery_date).slice(0, 10) + "T00:00:00");
  } else {
    targetDate = new Date(dispatchDateStr + "T00:00:00");
    targetDate.setDate(targetDate.getDate() + totalDays);
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const msPerDay = 24 * 60 * 60 * 1000;
  const diffTime = targetDate.getTime() - today.getTime();
  const remainingDays = Math.ceil(diffTime / msPerDay);
  const daysPassed = Math.max(0, totalDays - Math.max(0, remainingDays));
  const progressPct = isDelivered ? 100 : Math.min(100, Math.max(10, Math.round(((totalDays - Math.max(0, remainingDays)) / totalDays) * 100)));

  return {
    isDelivered,
    totalDays,
    remainingDays: Math.max(0, remainingDays),
    daysPassed,
    progressPct,
    isDueToday: remainingDays === 0 && !isDelivered,
    isOverdue: remainingDays < 0 && !isDelivered,
    targetDateFormatted: targetDate.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" }),
    dispatchDateFormatted: new Date(dispatchDateStr + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
  };
}

const STATUS_OPTIONS = ["pending", "approved", "processing", "partially_fulfilled", "shipped", "delivered", "cancelled"];

export default function OrdersPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [invoiceModalOrder, setInvoiceModalOrder] = useState(null);

  // Fastener Order Placement Modal State
  const [newOrderModalOpen, setNewOrderModalOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [dealers, setDealers] = useState([]);
  const [cnfs, setCnfs] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  
  // Warehouse Reassignment State
  const [reassignWhId, setReassignWhId] = useState("");
  const [reassigningWh, setReassigningWh] = useState(false);

  const [targetPartyType, setTargetPartyType] = useState("dealer"); // "dealer" | "cnf"
  const [selectedPartyId, setSelectedPartyId] = useState("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  
  const [cat, setCat] = useState("CSK Drywall Screws");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [boxCount, setBoxCount] = useState(10);
  const [cart, setCart] = useState({});
  const [placing, setPlacing] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Partial Billing Modal State
  const [partialBillModalOpen, setPartialBillModalOpen] = useState(false);
  const [partialBillInputs, setPartialBillInputs] = useState({});
  const [billingInvoiceNo, setBillingInvoiceNo] = useState("");
  const [savingBilling, setSavingBilling] = useState(false);

  // Dispatch / Shipping Modal State with Live Days Configurator
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [dispatchCarrier, setDispatchCarrier] = useState("SafeXpress Logistics");
  const [dispatchTrackingNo, setDispatchTrackingNo] = useState("");
  const [dispatchDays, setDispatchDays] = useState(7);
  const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().slice(0, 10));
  const [dispatchNotes, setDispatchNotes] = useState("");
  const [isEditDeliveryMode, setIsEditDeliveryMode] = useState(false);

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const { data } = await api.get("/orders", { params: { status } });
      setOrders(data);
    } catch { 
      if (showLoading) toast.error("Failed to load orders"); 
    } finally { 
      if (showLoading) setLoading(false); 
    }
  }, [status]);

  useEffect(() => {
    load();
    const interval = setInterval(() => {
      load(false);
    }, 6000);
    return () => clearInterval(interval);
  }, [load]);

  // Load all live warehouses on component mount
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/warehouses");
        setWarehouses(data || []);
      } catch {
        // ignore
      }
    })();
  }, []);

  // Sync selected order's warehouse to reassignment selector
  useEffect(() => {
    if (selected) {
      setReassignWhId(selected.warehouse_id || (warehouses[0]?.id || ""));
    }
  }, [selected, warehouses]);

  // Load parties and warehouses when order placement modal opens
  useEffect(() => {
    if (newOrderModalOpen) {
      (async () => {
        try {
          const [prodRes, dlrRes, cnfRes, whRes] = await Promise.all([
            api.get("/products", { params: { category: cat === "All" ? "" : cat, status: "active" } }),
            api.get("/dealers").catch(() => ({ data: [] })),
            api.get("/cnf").catch(() => api.get("/mnp").catch(() => ({ data: [] }))),
            api.get("/warehouses").catch(() => ({ data: [] }))
          ]);
          setProducts(prodRes.data);
          if (prodRes.data.length > 0) setSelectedProductId(prodRes.data[0].id);
          
          setDealers(dlrRes.data || []);
          setCnfs(cnfRes.data || []);
          setWarehouses(whRes.data || []);

          setSelectedPartyId((prev) => (!prev && dlrRes.data?.length > 0 ? dlrRes.data[0].id : prev));
          setSelectedWarehouseId((prev) => (!prev && whRes.data?.length > 0 ? "" : prev));
        } catch {
          toast.error("Failed to load catalog or partner details for ordering");
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newOrderModalOpen, cat]);

  const handleReassignWarehouse = async () => {
    if (!selected || !reassignWhId) return;
    setReassigningWh(true);
    try {
      const { data } = await api.put(`/orders/${selected.id}/warehouse`, { warehouse_id: reassignWhId });
      setSelected(data);
      toast.success(`Fulfillment hub updated to ${data.warehouse_name} (${data.warehouse_code}) & inventory reallocated`);
      load(false);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to reassign warehouse");
    } finally {
      setReassigningWh(false);
    }
  };

  const updateStatus = async (orderId, newStatus, notes = "", extraFields = {}) => {
    setUpdatingStatus(true);
    try {
      const payload = { status: newStatus, notes, ...extraFields };
      const { data } = await api.patch(`/orders/${orderId}/status`, payload);
      toast.success(`Order ${data.order_no} status updated to ${newStatus.toUpperCase()}`);
      load();
      if (selected?.id === orderId) setSelected(data);
      setDispatchModalOpen(false);
    } catch (e) { 
      toast.error(e.response?.data?.detail || "Failed to update order status"); 
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDispatchSubmit = async () => {
    if (!selected) return;
    if (!dispatchTrackingNo.trim()) {
      return toast.error("Please enter a Tracking ID / LR Docket Number before confirming dispatch");
    }
    const daysNum = parseInt(dispatchDays, 10) || 7;
    const dispDate = dispatchDate || new Date().toISOString().slice(0, 10);
    const targetDt = new Date(dispDate + "T00:00:00");
    targetDt.setDate(targetDt.getDate() + daysNum);
    const targetDateStr = targetDt.toISOString().slice(0, 10);

    const payload = {
      carrier: dispatchCarrier.trim() || "SafeXpress Logistics",
      tracking_no: dispatchTrackingNo.trim(),
      dispatch_date: dispDate,
      delivery_days_total: daysNum,
      estimated_delivery_days: `${daysNum} Working Days`,
      target_delivery_date: targetDateStr,
      notes: dispatchNotes.trim() || undefined,
    };

    if (!isEditDeliveryMode) {
      payload.status = "shipped";
    }

    setUpdatingStatus(true);
    try {
      const { data } = await api.patch(`/orders/${selected.id}/status`, payload);
      toast.success(
        isEditDeliveryMode
          ? `Delivery timeframe updated: ${daysNum}-day countdown refreshed!`
          : `Order ${data.order_no} dispatched! ${daysNum}-day delivery countdown started.`
      );
      load();
      setSelected(data);
      setDispatchModalOpen(false);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to update shipment tracking");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleReallocateStock = async () => {
    if (!selected) return;
    setUpdatingStatus(true);
    try {
      let res;
      try {
        res = await api.post(`/orders/${selected.id}/reallocate`);
      } catch (err) {
        if (err.response?.status === 404) {
          res = await api.post(`/orders/${selected.id}/warehouse`, { warehouse_id: selected.warehouse_id });
        } else {
          throw err;
        }
      }
      const data = res.data;
      toast.success(`Stock re-allocated from live warehouse inventory! Status: ${(data.reservation_status || "updated").toUpperCase()}`);
      setSelected(data);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to re-allocate stock");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleRecordPartialBilling = async () => {
    if (!selected) return;
    setSavingBilling(true);
    try {
      const itemsToBill = Object.entries(partialBillInputs).map(([pid, bQty]) => {
        const itemObj = selected?.items?.find((i) => i.product_id === pid);
        const qPerBox = itemObj?.qty_per_box || 1000;
        const numBoxes = parseInt(bQty, 10) || 0;
        return {
          product_id: pid,
          boxes_to_bill: numBoxes,
          quantity_to_bill: numBoxes * qPerBox
        };
      }).filter(i => i.boxes_to_bill > 0 || i.quantity_to_bill > 0);

      if (itemsToBill.length === 0) {
        toast.error("Please enter billed quantity for at least one item");
        setSavingBilling(false);
        return;
      }

      const payload = {
        invoice_no: billingInvoiceNo.trim() || undefined,
        items: itemsToBill,
        notes: "Processed via Admin Billing & Fulfillment Manager"
      };

      const { data } = await api.post(`/orders/${selected.id}/partial-bill`, payload);
      toast.success(`Partial billing invoice saved! Order updated to ${data.status.toUpperCase()}`);
      setSelected(data);
      setPartialBillModalOpen(false);
      setPartialBillInputs({});
      setBillingInvoiceNo("");
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to record billing");
    } finally {
      setSavingBilling(false);
    }
  };

  const selectedProduct = products.find((p) => p.id === selectedProductId) || products[0];
  const qtyPerBox = selectedProduct?.qty_per_box || selectedProduct?.moq || 1000;
  const totalPcs = (boxCount || 0) * qtyPerBox;
  const wtPer1000 = selectedProduct?.wt_1000_pcs_kg || (selectedProduct?.weight_kg ? selectedProduct.weight_kg * 1000 : 1.0);
  const totalWeightKg = Number(((totalPcs / 1000.0) * wtPer1000).toFixed(3));

  const isCnfDepot = targetPartyType === "cnf";
  const ratePerBox = selectedProduct ? (isCnfDepot ? (selectedProduct.wd_landing || selectedProduct.cost || selectedProduct.price) : (selectedProduct.dealer_landing || selectedProduct.price || 0)) : 0;
  const valueBeforeTax = Number(((boxCount || 0) * ratePerBox).toFixed(2));
  const gstAmount = Number((valueBeforeTax * 0.18).toFixed(2));
  const valueAfterTax = Number((valueBeforeTax + gstAmount).toFixed(2));

  const addConfiguredToCart = () => {
    if (!selectedProduct) return;
    if (boxCount <= 0) return toast.error("Please enter a valid box quantity");

    setCart((c) => {
      const existing = c[selectedProduct.id] || {};
      const newBoxes = (existing.boxes || 0) + boxCount;
      const newTotalPcs = newBoxes * qtyPerBox;
      const newTotalWeight = Number(((newTotalPcs / 1000.0) * wtPer1000).toFixed(3));
      const newValBeforeTax = Number((newBoxes * ratePerBox).toFixed(2));
      const newGst = Number((newValBeforeTax * 0.18).toFixed(2));
      const newValAfterTax = Number((newValBeforeTax + newGst).toFixed(2));

      return {
        ...c,
        [selectedProduct.id]: {
          product: selectedProduct,
          boxes: newBoxes,
          qty: newTotalPcs,
          qty_per_box: qtyPerBox,
          size: selectedProduct.size || selectedProduct.sku,
          wt_1000_pcs_kg: wtPer1000,
          total_weight_kg: newTotalWeight,
          rate: ratePerBox,
          dealer_landing: selectedProduct.dealer_landing || selectedProduct.cost || 0,
          value_before_tax: newValBeforeTax,
          gst_amount: newGst,
          value_after_tax: newValAfterTax,
        }
      };
    });
    toast.success(`Added ${boxCount} Boxes (${totalWeightKg} KG) to cart`);
  };

  const removeCartItem = (id) => {
    setCart((c) => {
      const nc = { ...c };
      delete nc[id];
      return nc;
    });
  };

  const cartItems = Object.values(cart);
  const cartSubtotal = Number(cartItems.reduce((s, i) => s + i.value_before_tax, 0).toFixed(2));
  const cartGst = Number((cartSubtotal * 0.18).toFixed(2));
  const cartTotal = Number((cartSubtotal + cartGst).toFixed(2));
  const cartTotalWeight = Number(cartItems.reduce((s, i) => s + i.total_weight_kg, 0).toFixed(3));

  const placeOrder = async () => {
    if (cartItems.length === 0) return toast.error("Please add at least one fastener item to cart");
    setPlacing(true);
    try {
      const payload = {
        dealer_id: targetPartyType === "dealer" ? selectedPartyId : undefined,
        cnf_id: targetPartyType === "cnf" ? selectedPartyId : undefined,
        order_type: targetPartyType === "cnf" ? "cnf_stock" : "dealer_order",
        warehouse_id: selectedWarehouseId || undefined,
        items: cartItems.map((i) => ({
          product_id: i.product.id,
          quantity: i.qty,
          boxes: i.boxes,
          size: i.size,
          qty_per_box: i.qty_per_box,
          wt_1000_pcs_kg: i.wt_1000_pcs_kg,
          total_weight_kg: i.total_weight_kg,
          rate: i.rate,
          dealer_landing: i.dealer_landing,
          value_before_tax: i.value_before_tax,
          gst_amount: i.gst_amount,
          value_after_tax: i.value_after_tax,
        })),
        notes: `Fastener ${targetPartyType === "cnf" ? "CNF Depot Stock" : "Distributor"} Order (${cartTotalWeight} KG total)`
      };
      const { data } = await api.post("/orders", payload);
      toast.success(`Order ${data.order_no} placed successfully (${cartTotalWeight} KG Total • Allocation: ${data.reservation_status.toUpperCase()})`);
      setCart({});
      setNewOrderModalOpen(false);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to place order");
    } finally {
      setPlacing(false);
    }
  };

  const isAdmin = user?.role === "admin";

  return (
    <AppShell
      title={isAdmin ? "Distributor & CNF Orders" : "My Fastener Orders"}
      subtitle={isAdmin ? "Manage, track, and place size-based orders with automatic weight, tax calculation & multi-warehouse allocation" : "View your order history, delivery tracking, and live stock allocation status"}
      actions={
        isAdmin ? (
          <button
            onClick={() => { setCart({}); setNewOrderModalOpen(true); }}
            className="inline-flex items-center gap-2 px-4 h-9 rounded-md gradient-brand-accent text-white text-sm font-semibold shadow-md hover:shadow-lg hover:scale-105 transition-all"
            data-testid="new-fastener-order-button"
          >
            <Plus size={16} weight="bold" /> + Create Admin Order
          </button>
        ) : (
          <button
            onClick={() => navigate("/browse")}
            className="inline-flex items-center gap-2 px-4 h-9 rounded-md gradient-brand-accent text-white text-sm font-semibold shadow-md hover:shadow-lg hover:scale-105 transition-all"
            data-testid="new-fastener-order-button"
          >
            <Plus size={16} weight="bold" /> + Place New Fastener Order
          </button>
        )
      }
    >
      <PageSection
        title={`${orders.length} orders listed`}
        actions={
          <div className="flex items-center gap-2">
            <select value={status} onChange={(e) => setStatus(e.target.value)}
              className="h-9 px-3 rounded-md border border-[#E5E7EB] text-sm bg-white focus:border-[#F28C18] focus:ring-1 focus:ring-[#F28C18] outline-none"
              data-testid="orders-status-filter">
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace("_", " ").toUpperCase()}</option>)}
            </select>
            <button
              onClick={() => load(true)}
              title="Refresh Orders"
              className="h-9 px-3 rounded-md border border-[#E5E7EB] bg-white text-xs font-semibold text-[#5C6670] hover:text-[#06182F] hover:bg-[#F8FAFC] inline-flex items-center gap-1.5 shadow-sm transition-all"
              data-testid="orders-refresh-button"
            >
              <ArrowsClockwise size={14} weight="bold" /> Refresh
            </button>
            <ExportButton
              filename="yamini-flow-orders-{date}.csv"
              rows={orders}
              columns={[
                { key: "order_no", label: "Order No" },
                { key: "dealer_name", label: "Party Name" },
                { key: "dealer_code", label: "Party Code" },
                { key: "order_type", label: "Order Type" },
                { key: "cnf_name", label: "Assigned CNF" },
                { key: "dealer_state", label: "State" },
                { key: "items", label: "Items", format: (v) => v?.length ?? 0 },
                { key: "subtotal", label: "Value (Before Tax)" },
                { key: "gst", label: "GST (18%)" },
                { key: "total", label: "Value (After Tax)" },
                { key: "status", label: "Status" },
                { key: "reservation_status", label: "Stock Allocation" },
                { key: "created_at", label: "Created" },
              ]}
            />
          </div>
        }
      >
        {loading ? <div className="p-8 text-center text-sm text-[#5C6670]">Loading orders…</div>
          : orders.length === 0 ? (
            <div className="py-8 text-center space-y-4">
              <EmptyState
                title="No orders found"
                description={
                  isAdmin
                    ? "Click '+ Create Admin Order' to configure and submit an order on behalf of a distributor or depot."
                    : "You have not placed any fastener orders yet."
                }
              />
              {!isAdmin && (
                <button
                  onClick={() => navigate("/browse")}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md gradient-brand-accent text-white text-sm font-bold shadow-md hover:scale-105 transition-all"
                >
                  <Plus size={16} weight="bold" /> Go to Fastener Catalog & Order
                </button>
              )}
            </div>
          )
          : (
            <div className="overflow-x-auto">
              <table className="yf-table w-full">
                <thead>
                  <tr>
                    <th>Order No</th>
                    <th>Party & Code</th>
                    <th>Network Tag</th>
                    <th>Warehouse Hub</th>
                    <th>State</th>
                    <th>Configs</th>
                    <th className="text-right">Total Weight</th>
                    <th className="text-right">Value (Before Tax)</th>
                    <th className="text-right">GST (18%)</th>
                    <th className="text-right">Value (After Tax)</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => {
                    const totalWeight = o.items?.reduce((s, i) => s + (i.total_weight_kg || 0), 0) || o.total_weight_kg || 0;
                    const cCode = o.cnf_code || o.mnp_code;
                    const cName = o.cnf_name || o.mnp_name;
                    const isCnf = o.order_type === "cnf_stock" || (o.dealer_code && o.dealer_code.startsWith("C-"));
                    const canDownloadInvoice = ["approved", "processing", "shipped", "delivered"].includes(o.status?.toLowerCase());

                    return (
                      <tr key={o.id} data-testid={`order-row-${o.order_no}`}>
                        <td className="font-mono text-xs font-bold text-[#06182F] bg-[#F3F4F6] px-2 py-1 rounded w-max">
                          {o.order_no}
                        </td>
                        <td className="font-medium text-[#06182F]">
                          <div className="flex items-center gap-1.5">
                            {isCnf && (
                              <span className="bg-purple-100 text-purple-800 text-[10px] font-extrabold px-1.5 py-0.5 rounded border border-purple-200">
                                CNF DEPOT
                              </span>
                            )}
                            <span>{o.dealer_name}</span>
                          </div>
                          <div className="font-mono text-[11px] text-[#854D0E] bg-[#FEF08A] px-1.5 py-0.5 rounded font-bold w-max mt-0.5">
                            {o.dealer_code || (isCnf ? "C-DEPOT" : "D-ASSIGNED")}
                          </div>
                        </td>
                        <td>
                          {cCode && cCode !== "DIRECT" ? (
                            <span className="bg-[#BAE6FD] text-[#0369A1] px-2 py-0.5 rounded font-mono font-bold text-xs inline-flex items-center gap-1 shadow-sm" title={cName || "Regional CNF"}>
                              <span>🏷️</span> {cName ? `${cName.split(" ")[0]} (${cCode})` : cCode}
                            </span>
                          ) : (
                            <span className="bg-[#E6F4EA] text-[#137333] px-2 py-0.5 rounded font-medium text-xs border border-[#CEEAD6] inline-flex items-center gap-1">
                              <span>⚡</span> Direct HQ
                            </span>
                          )}
                        </td>
                        <td className="text-xs text-[#5C6670] font-medium">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>{o.warehouse_name ? `${o.warehouse_name}${o.warehouse_code ? ` (${o.warehouse_code})` : ''}` : (o.warehouse_code || "—")}</span>
                            {o.allocation_method === "smart_allocated" && (
                              <span className="text-[9px] bg-blue-100 text-blue-800 font-extrabold px-1.5 py-0.5 rounded border border-blue-200" title="Smart Stock Allocated: Proximity & Live Inventory Engine">
                                SMART
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="text-[#5C6670] text-xs">{o.dealer_state || "—"}</td>
                        <td className="font-mono">{o.items?.length || 0}</td>
                        <td className="text-right tabular font-mono font-bold text-[#D96B0B]">
                          {totalWeight > 0 ? `${totalWeight.toFixed(3)} KG` : "—"}
                        </td>
                        <td className="text-right tabular font-mono">{fmt.inr(o.subtotal)}</td>
                        <td className="text-right tabular font-mono text-[#3B82F6]">{fmt.inr(o.gst)}</td>
                        <td className="text-right tabular font-mono font-bold text-[#16A34A]">{fmt.inr(o.total)}</td>
                        <td>
                          <div className="space-y-0.5">
                            <StatusBadge status={o.status} />
                            {o.reservation_status === "partially_reserved" && (
                              <div className="text-[9px] font-bold text-amber-700 font-mono">Partial Stock</div>
                            )}
                            {["shipped", "in_transit"].includes(o.status?.toLowerCase()) && (() => {
                              const cd = getDeliveryCountdown(o);
                              return cd ? (
                                <div className="text-[9px] font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded w-max">
                                  ⏳ {cd.remainingDays > 0 ? `${cd.remainingDays}d left` : "Today"}
                                </div>
                              ) : null;
                            })()}
                          </div>
                        </td>
                        <td className="text-[#5C6670] text-xs">{fmt.datetime(o.created_at)}</td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {canDownloadInvoice && (
                              <button
                                onClick={() => setInvoiceModalOrder(o)}
                                title="Download / Print Official GST Tax Invoice"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold border border-amber-200 transition-all"
                                data-testid={`download-invoice-${o.order_no}`}
                              >
                                <FileText size={14} weight="bold" /> Tax Invoice
                              </button>
                            )}
                            <button
                              onClick={() => setSelected(o)}
                              className="p-1.5 rounded hover:bg-[#F4F5F7] text-[#5C6670]"
                              title="View Order Breakdown"
                              data-testid={`view-order-${o.order_no}`}
                            >
                              <Eye size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
      </PageSection>

      {/* View Existing Order Dialog */}
      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between border-b pb-3">
            <div>
              <DialogTitle className="text-lg font-bold">Order Breakdown: {selected?.order_no}</DialogTitle>
              <div className="text-xs text-slate-500 font-mono mt-0.5 flex items-center gap-2 flex-wrap">
                <span>Invoice:</span>
                {["approved", "processing", "shipped", "delivered"].includes(selected?.status?.toLowerCase()) ? (
                  <strong className="text-indigo-700 font-mono font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    {selected?.invoice_no || `INV-${selected?.order_no?.replace("ORD-", "")}`}
                  </strong>
                ) : (
                  <span className="text-amber-800 bg-amber-100 px-2 py-0.5 rounded font-semibold border border-amber-300 text-[11px]">
                    ⏳ Issued After Admin Approval
                  </span>
                )}
                <span>• Warehouse: <strong>{selected?.warehouse_name ? `${selected.warehouse_name}${selected.warehouse_code ? ` (${selected.warehouse_code})` : ''}` : "Main Warehouse"}</strong></span>
              </div>
            </div>
            {["approved", "processing", "shipped", "delivered"].includes(selected?.status?.toLowerCase()) ? (
              <button
                onClick={() => setInvoiceModalOrder(selected)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow transition-all"
              >
                <FileText size={15} weight="bold" /> Download Official GST Tax Invoice
              </button>
            ) : (
              <div className="text-xs text-slate-600 bg-slate-100 px-3 py-1 rounded border border-slate-200 font-medium">
                🔒 Tax Invoice available once Admin approves order
              </div>
            )}
          </DialogHeader>
          {selected && (() => {
            const totalOrderedPcs = selected.items?.reduce((s, i) => s + (i.quantity_ordered ?? i.quantity ?? 0), 0) || 0;
            const totalAllocatedPcs = selected.items?.reduce((s, i) => s + (i.quantity_allocated ?? 0), 0) || 0;
            const totalInvoicedPcs = selected.items?.reduce((s, i) => s + (i.quantity_invoiced ?? 0), 0) || 0;
            const totalPendingPcs = selected.items?.reduce((s, i) => s + (i.quantity_pending ?? Math.max(0, (i.quantity_ordered ?? i.quantity ?? 0) - (i.quantity_allocated ?? 0))), 0) || 0;

            const totalOrderedBoxes = selected.items?.reduce((s, i) => s + (i.boxes ?? Math.ceil((i.quantity_ordered ?? i.quantity ?? 0) / (i.qty_per_box || 1000))), 0) || 0;
            const totalAllocatedBoxes = selected.items?.reduce((s, i) => s + (i.boxes_allocated ?? Math.ceil((i.quantity_allocated ?? 0) / (i.qty_per_box || 1000))), 0) || 0;
            const totalInvoicedBoxes = selected.items?.reduce((s, i) => s + (i.boxes_invoiced ?? Math.floor((i.quantity_invoiced ?? 0) / (i.qty_per_box || 1000))), 0) || 0;
            const totalPendingBoxes = selected.items?.reduce((s, i) => s + (i.boxes_pending ?? Math.max(0, (i.boxes ?? 0) - (i.boxes_allocated ?? 0))), 0) || 0;

            const rawFulfillmentPct = totalOrderedBoxes > 0 ? ((totalAllocatedBoxes / totalOrderedBoxes) * 100) : (totalOrderedPcs > 0 ? ((totalAllocatedPcs / totalOrderedPcs) * 100) : 100);
            const fulfillmentPct = (rawFulfillmentPct > 0 && rawFulfillmentPct < 1) ? rawFulfillmentPct.toFixed(1) : Math.min(100, Math.round(rawFulfillmentPct));
            const pendingPct = ((100 - rawFulfillmentPct) > 99 && (100 - rawFulfillmentPct) < 100) ? (100 - rawFulfillmentPct).toFixed(1) : Math.max(0, Math.round(100 - rawFulfillmentPct));
            const isShippedOrDelivered = ["shipped", "delivered"].includes(selected.status?.toLowerCase()) || Boolean(selected.carrier);

            return (
              <div className="py-2 space-y-4">
                <div className="grid grid-cols-6 gap-3 text-sm bg-[#F8FAFC] p-3 rounded-lg border border-[#E5E7EB]">
                  <div>
                    <div className="text-[11px] uppercase text-[#5C6670] tracking-wider">Party / Depot</div>
                    <div className="font-bold mt-0.5 text-[#06182F]">{selected.dealer_name}</div>
                    <div className="font-mono text-[11px] text-[#854D0E] bg-[#FEF08A] px-1.5 py-0.5 rounded font-bold w-max mt-0.5">
                      {selected.dealer_code || "D-ASSIGNED"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase text-[#5C6670] tracking-wider">Assigned Under</div>
                    <div className="mt-1">
                      {selected.cnf_code && selected.cnf_code !== "DIRECT" ? (
                        <span className="bg-[#BAE6FD] text-[#0369A1] px-2 py-0.5 rounded font-mono font-bold text-xs inline-flex items-center gap-1 shadow-sm">
                          <span>🏷️</span> {selected.cnf_code}
                        </span>
                      ) : (
                        <span className="bg-[#E6F4EA] text-[#137333] px-2 py-0.5 rounded font-medium text-xs border border-[#CEEAD6] inline-flex items-center gap-1">
                          <span>⚡</span> Direct HQ
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase text-[#5C6670] tracking-wider">Warehouse Hub</div>
                    <div className="font-medium mt-0.5 text-xs">{selected.warehouse_name ? `${selected.warehouse_name}${selected.warehouse_code ? ` (${selected.warehouse_code})` : ''}` : "Main Warehouse"}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase text-[#5C6670] tracking-wider">Stock Allocation</div>
                    <div className="mt-0.5">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase font-mono ${
                        selected.reservation_status === "reserved" ? "bg-emerald-100 text-emerald-800" :
                        selected.reservation_status === "partially_reserved" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"
                      }`}>
                        {selected.reservation_status || "Pending"}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase text-[#5C6670] tracking-wider">Order Status</div>
                    <div className="mt-0.5"><StatusBadge status={selected.status} /></div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase text-[#5C6670] tracking-wider">Payment</div>
                    <div className="mt-1">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        selected.payment_status === "paid"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}>
                        {selected.payment_status || "unpaid"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Prominent Consignment In-Transit & Estimated Delivery Countdown Banner */}
                {isShippedOrDelivered && (() => {
                  const countdown = getDeliveryCountdown(selected);
                  if (!countdown) return null;
                  return (
                    <div className="bg-gradient-to-br from-slate-950 via-indigo-950 to-blue-950 text-white p-4 sm:p-5 rounded-xl border border-indigo-700/80 shadow-lg space-y-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-300 flex-shrink-0 shadow-inner">
                            <Truck size={28} weight="bold" />
                          </div>
                          <div>
                            <div className="font-extrabold text-sm sm:text-base flex items-center gap-2 flex-wrap">
                              <span>{countdown.isDelivered ? "✓ Consignment Delivered" : "📦 Order Dispatched & In-Transit"}</span>
                              <span className={`text-[10px] uppercase font-mono px-2.5 py-0.5 rounded-full font-bold shadow-sm ${
                                countdown.isDelivered ? "bg-emerald-500 text-white" : "bg-blue-500 text-white animate-pulse"
                              }`}>
                                {selected.status?.toUpperCase() || "SHIPPED"}
                              </span>
                            </div>
                            <div className="text-xs text-indigo-200 mt-1 flex items-center gap-2 flex-wrap">
                              <span>Carrier: <strong className="text-white">{selected.carrier || "SafeXpress Logistics"}</strong></span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                LR/Docket No: <strong className="text-amber-300 font-mono font-bold bg-amber-500/20 px-2 py-0.5 rounded border border-amber-400/30">{selected.tracking_no || `TRK-${selected.order_no.replace("ORD-", "")}`}</strong>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Live Countdown Display Box */}
                        <div className="bg-white/10 backdrop-blur-md border border-white/20 px-4 py-2.5 rounded-xl text-right min-w-[210px] shadow-sm">
                          <div className="text-[10px] uppercase font-bold text-amber-300 tracking-wider flex items-center justify-end gap-1">
                            <Clock size={13} weight="bold" /> Live Delivery Countdown
                          </div>
                          <div className="text-lg sm:text-xl font-black font-mono mt-0.5">
                            {countdown.isDelivered ? (
                              <span className="text-emerald-400">✓ Delivered</span>
                            ) : countdown.isDueToday ? (
                              <span className="text-emerald-400 animate-bounce">🚀 Arriving Today!</span>
                            ) : (
                              <span className="text-amber-300">⏳ {countdown.remainingDays} Days Left</span>
                            )}
                          </div>
                          <div className="text-[10px] text-indigo-200">
                            {countdown.isDelivered ? "Reached destination depot" : `Expected by: ${countdown.targetDateFormatted}`}
                          </div>
                        </div>
                      </div>

                      {/* Visual Journey Stepper & Daily Countdown Progress Bar */}
                      <div className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-2">
                        <div className="flex justify-between items-center text-[11px] font-mono flex-wrap gap-1">
                          <div className="flex items-center gap-1.5 text-emerald-300 font-semibold">
                            <span>🚀 Dispatched:</span>
                            <span className="text-white">{countdown.dispatchDateFormatted}</span>
                          </div>
                          <div className="text-center text-indigo-200 text-[10px]">
                            <span>{countdown.isDelivered ? "Delivery Complete (100%)" : `Day ${countdown.daysPassed + 1} of ${countdown.totalDays} (Updates daily at midnight)`}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-amber-300 font-semibold">
                            <span>🎯 Target Arrival:</span>
                            <span className="text-white">{countdown.targetDateFormatted}</span>
                          </div>
                        </div>

                        {/* Dynamic Progress Bar */}
                        <div className="w-full bg-slate-800/90 rounded-full h-2.5 overflow-hidden border border-indigo-900/50">
                          <div
                            className={`h-2.5 transition-all duration-500 rounded-full ${
                              countdown.isDelivered ? "bg-emerald-500" : "bg-gradient-to-r from-blue-500 via-indigo-400 to-amber-400"
                            }`}
                            style={{ width: `${countdown.progressPct}%` }}
                          />
                        </div>
                      </div>

                      {/* Admin Action Option to Change Delivery Timeframe Anytime */}
                      {isAdmin && (
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-indigo-800/80 text-xs">
                          <div className="text-[11px] text-indigo-200 font-mono">
                            Origin: <strong className="text-white">{selected.warehouse_name || "Central Warehouse"}</strong> • Destination: <strong className="text-white">{selected.dealer_state || "Registered Depot"}</strong>
                          </div>
                          <button
                            onClick={() => {
                              setDispatchTrackingNo(selected.tracking_no || `TRK-${selected.order_no.replace("ORD-", "")}`);
                              setDispatchCarrier(selected.carrier || "SafeXpress Logistics");
                              setDispatchDays(selected.delivery_days_total || 7);
                              setDispatchDate(selected.dispatch_date ? String(selected.dispatch_date).slice(0, 10) : new Date().toISOString().slice(0, 10));
                              setDispatchNotes(selected.notes || "");
                              setIsEditDeliveryMode(true);
                              setDispatchModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-indigo-500/30 hover:bg-indigo-500/50 border border-indigo-400/50 text-white font-semibold text-xs transition-all shadow-xs"
                          >
                            <Clock size={14} weight="bold" /> ✏️ Change Delivery Timeframe / Tracking
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Live Stock Allocation Status Banner */}
                {totalPendingBoxes === 0 && totalPendingPcs === 0 ? (
                  <div className="bg-emerald-50 border border-emerald-300 p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black text-base shadow-sm">
                        ✓
                      </div>
                      <div>
                        <div className="font-bold text-xs text-emerald-950 flex items-center gap-2">
                          <span>100% Stock Available & Allocated from Live Inventory</span>
                          <span className="font-mono text-[10px] bg-emerald-200/80 text-emerald-900 px-2 py-0.5 rounded-full font-black border border-emerald-300">
                            {fmt.num(totalOrderedBoxes)} Boxes ({fmt.num(totalOrderedPcs)} pcs) Billed
                          </span>
                        </div>
                        <div className="text-[11px] text-emerald-800 mt-0.5">
                          All items are fully in-stock in warehouse inventory ({selected.warehouse_name || "Main Warehouse"}) and allocated for immediate fulfillment.
                        </div>
                      </div>
                    </div>
                    <div className="text-right font-mono font-black text-sm text-emerald-700 bg-white/80 px-3 py-1.5 rounded-lg border border-emerald-200 shadow-2xs">
                      100% Fulfilled
                    </div>
                  </div>
                ) : (
                  <div className="bg-gradient-to-r from-amber-50/90 via-orange-50/70 to-amber-100/90 border border-amber-300 p-4 rounded-xl space-y-3 shadow-sm">
                    {/* Notice Header & Badges */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-amber-200/80">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold text-base shadow-sm">
                          📦
                        </div>
                        <div>
                          <div className="font-extrabold text-xs uppercase tracking-wider text-amber-950 flex items-center gap-2">
                            <span>Billing Allocation & Stock Replenishment Notice</span>
                          </div>
                          <div className="text-[11px] text-amber-800 font-medium mt-0.5">
                            Order split billing breakdown based on live warehouse inventory
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-xs">
                        <span className="bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-md border border-emerald-200 shadow-2xs">
                          ✓ {fmt.num(totalAllocatedBoxes)} Boxes Billed Now
                        </span>
                        <span className="bg-amber-100 text-amber-900 font-bold px-2.5 py-1 rounded-md border border-amber-300 shadow-2xs">
                          ⏳ {fmt.num(totalPendingBoxes)} Boxes On Replenishment
                        </span>
                      </div>
                    </div>

                    {/* Dual Highlight Stat Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Billed For You Card */}
                      <div className="bg-white/95 border border-emerald-300/90 rounded-lg p-3 shadow-xs">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                          <span>Currently Being Billed For You</span>
                        </div>
                        <div className="flex items-baseline gap-2 mt-1.5">
                          <span className="text-xl font-black font-mono text-emerald-700">
                            {fmt.num(totalAllocatedBoxes)} Boxes
                          </span>
                          <span className="text-xs text-emerald-600 font-bold font-mono">
                            ({fulfillmentPct}% fulfilled • {fmt.num(totalAllocatedPcs)} pcs)
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1 leading-snug">
                          Allocated and being billed for you from current available warehouse stock.
                        </p>
                      </div>

                      {/* Remaining Replenishment Card */}
                      <div className="bg-white/95 border border-amber-300/90 rounded-lg p-3 shadow-xs">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
                          <span>To Be Billed On Stock Replenishment</span>
                        </div>
                        <div className="flex items-baseline gap-2 mt-1.5">
                          <span className="text-xl font-black font-mono text-amber-800">
                            {fmt.num(totalPendingBoxes)} Boxes
                          </span>
                          <span className="text-xs text-amber-700 font-bold font-mono">
                            ({pendingPct}% remaining • {fmt.num(totalPendingPcs)} pcs)
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1 leading-snug">
                          The rest will be billed as per stock replenishment upon incoming inventory.
                        </p>
                      </div>
                    </div>

                    {/* Explanatory Banner Note */}
                    <div className="text-xs text-amber-950 leading-relaxed bg-amber-100/70 p-3 rounded-lg border border-amber-200/80 flex items-start gap-2.5">
                      <span className="text-base flex-shrink-0">💡</span>
                      <div>
                        <strong>{fmt.num(totalAllocatedBoxes)} Boxes ({fmt.num(totalAllocatedPcs)} pcs)</strong> is currently being billed for you from available stock, and the rest (<strong className="font-mono text-amber-900 font-bold">{fmt.num(totalPendingBoxes)} Boxes ({fmt.num(totalPendingPcs)} pcs)</strong>) will be billed as per the stock replenishment.
                      </div>
                    </div>

                    {/* Fulfillment Progress Bar */}
                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between text-[11px] font-mono font-semibold text-amber-950">
                        <span className="text-emerald-800">{fulfillmentPct}% Billed From Available Stock ({fmt.num(totalAllocatedBoxes)} Boxes)</span>
                        <span className="text-amber-800">{100 - fulfillmentPct}% Remaining For Stock Replenishment ({fmt.num(totalPendingBoxes)} Boxes)</span>
                      </div>
                      <div className="w-full bg-amber-200/80 rounded-full h-2.5 overflow-hidden flex">
                        <div className="bg-emerald-600 h-2.5 transition-all duration-300" style={{ width: `${fulfillmentPct}%` }} title={`${fulfillmentPct}% Billed Now (${fmt.num(totalAllocatedBoxes)} Boxes)`}></div>
                        <div className="bg-amber-500 h-2.5 transition-all duration-300" style={{ width: `${100 - fulfillmentPct}%` }} title={`${100 - fulfillmentPct}% Under Stock Replenishment (${fmt.num(totalPendingBoxes)} Boxes)`}></div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Admin Fulfillment Warehouse Hub Switcher */}
                {isAdmin && (
                  <div className="bg-[#0F172A] text-white p-3.5 rounded-lg border border-[#334155] flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-md bg-[#F28C18]/20 border border-[#F28C18]/40 flex items-center justify-center text-[#F28C18] flex-shrink-0">
                        <Warehouse size={18} weight="bold" />
                      </div>
                      <div>
                        <div className="font-bold text-white flex items-center gap-2">
                          <span>Fulfillment Warehouse Hub:</span>
                          <span className="text-[#FEF08A] font-mono font-semibold">{selected.warehouse_name || "Main Warehouse"} ({selected.warehouse_code || "WH-MAIN"})</span>
                          {selected.allocation_method === "smart_allocated" && (
                            <span className="text-[9px] bg-blue-500/30 text-blue-300 font-extrabold px-1.5 py-0.5 rounded border border-blue-400/40">
                              SMART ALLOCATED
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-[#94A3B8]">Admin can manually reassign the fulfillment warehouse hub anytime</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={reassignWhId}
                        onChange={(e) => setReassignWhId(e.target.value)}
                        className="h-8 px-2.5 rounded bg-[#1E293B] border border-[#475569] text-xs text-white outline-none focus:border-[#F28C18]"
                      >
                        {warehouses.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name} ({w.code}) • {w.city || w.state}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={handleReassignWarehouse}
                        disabled={reassigningWh || reassignWhId === selected.warehouse_id}
                        className="h-8 px-3 rounded bg-[#F28C18] hover:bg-[#D96B0B] text-white font-bold transition-all shadow disabled:opacity-50"
                      >
                        {reassigningWh ? "Reallocating…" : "Change Warehouse Hub"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Admin Processing & Status Controls */}
                {isAdmin && (
                  <div className="bg-slate-900 text-white p-3 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 font-semibold">
                      <span className="text-amber-400 font-bold uppercase tracking-wider text-[11px]">Admin Actions:</span>
                      <span>Update Order Lifecycle</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {isAdmin && selected.reservation_status !== "reserved" && (
                        <button
                          onClick={handleReallocateStock}
                          disabled={updatingStatus}
                          className="px-3 py-1.5 bg-purple-700 hover:bg-purple-600 text-white rounded font-bold transition-all inline-flex items-center gap-1 shadow"
                          title="Re-evaluate live warehouse inventory for newly added/replenished stock"
                        >
                          <ArrowsClockwise size={14} weight="bold" /> Re-evaluate Stock Allocation
                        </button>
                      )}
                      {selected.status === "pending" && (
                        <button
                          onClick={() => updateStatus(selected.id, "approved")}
                          disabled={updatingStatus}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold transition-all inline-flex items-center gap-1 shadow"
                        >
                          <CheckCircle size={14} weight="bold" /> Approve & Reserve Stock
                        </button>
                      )}
                      {["approved", "partially_fulfilled", "processing"].includes(selected.status) && (
                        <>
                          <button
                            onClick={() => updateStatus(selected.id, "processing")}
                            disabled={updatingStatus}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded font-bold transition-all inline-flex items-center gap-1 shadow"
                          >
                            <Clock size={14} weight="bold" /> Mark Under Processing
                          </button>
                          <button
                            onClick={() => {
                              setBillingInvoiceNo(`INV-${selected.order_no.replace("ORD-", "")}-P${(selected.invoices?.length || 0) + 1}`);
                              const init = {};
                              selected.items?.forEach(it => {
                                const qPerBox = it.qty_per_box || 1000;
                                const bOrd = it.boxes ?? Math.ceil((it.quantity_ordered || it.quantity || 0) / qPerBox);
                                const bInv = it.boxes_invoiced ?? Math.floor((it.quantity_invoiced || 0) / qPerBox);
                                init[it.product_id] = it.boxes_pending ?? Math.max(0, bOrd - bInv);
                              });
                              setPartialBillInputs(init);
                              setPartialBillModalOpen(true);
                            }}
                            className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded font-bold transition-all inline-flex items-center gap-1 shadow"
                          >
                            <FileText size={14} weight="bold" /> Record Partial Billing
                          </button>
                          <button
                            onClick={() => {
                              setDispatchTrackingNo(selected.tracking_no || `TRK-${selected.order_no.replace("ORD-", "")}`);
                              setDispatchCarrier(selected.carrier || "SafeXpress Logistics");
                              setDispatchDays(selected.delivery_days_total || 7);
                              setDispatchDate(selected.dispatch_date ? String(selected.dispatch_date).slice(0, 10) : new Date().toISOString().slice(0, 10));
                              setDispatchNotes(selected.notes || "");
                              setIsEditDeliveryMode(false);
                              setDispatchModalOpen(true);
                            }}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold transition-all inline-flex items-center gap-1 shadow"
                          >
                            <Truck size={14} weight="bold" /> Mark Shipped & Dispatch
                          </button>
                        </>
                      )}
                      {selected.status === "shipped" && (
                        <>
                          <button
                            onClick={() => {
                              setDispatchTrackingNo(selected.tracking_no || `TRK-${selected.order_no.replace("ORD-", "")}`);
                              setDispatchCarrier(selected.carrier || "SafeXpress Logistics");
                              setDispatchDays(selected.delivery_days_total || 7);
                              setDispatchDate(selected.dispatch_date ? String(selected.dispatch_date).slice(0, 10) : new Date().toISOString().slice(0, 10));
                              setDispatchNotes(selected.notes || "");
                              setIsEditDeliveryMode(true);
                              setDispatchModalOpen(true);
                            }}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold transition-all inline-flex items-center gap-1 shadow"
                          >
                            <Clock size={14} weight="bold" /> ✏️ Update Delivery Timeframe
                          </button>
                          <button
                            onClick={() => updateStatus(selected.id, "delivered")}
                            disabled={updatingStatus}
                            className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded font-bold transition-all inline-flex items-center gap-1 shadow"
                          >
                            <Package size={14} weight="bold" /> Mark Delivered
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Items Table */}
                <div className="border border-[#E5E7EB] rounded-lg overflow-hidden">
                  <table className="yf-table w-full">
                    <thead>
                      <tr>
                        <th>Product / Fastener Description</th>
                        <th>Size</th>
                        <th className="text-right">Ordered</th>
                        <th className="text-right text-emerald-700">Being Billed Now</th>
                        <th className="text-right text-blue-700">Invoiced (Tally)</th>
                        <th className="text-right text-amber-700">To Be Billed (Replenishment)</th>
                        <th className="text-right">Weight (KG)</th>
                        <th className="text-right">Before Tax</th>
                        <th className="text-right">GST (18%)</th>
                        <th className="text-right">After Tax</th>
                      </tr>
                    </thead>

                  <tbody>
                    {selected.items?.map((it, i) => {
                      const qtyPerBox = it.qty_per_box || 1000;
                      const qOrd = it.quantity_ordered ?? it.quantity ?? 0;
                      const qAlloc = it.quantity_allocated ?? (selected.reservation_status === "reserved" ? qOrd : 0);
                      const qInv = it.quantity_invoiced ?? 0;
                      const qPend = it.quantity_pending ?? Math.max(0, qOrd - qAlloc);

                      const bOrd = it.boxes ?? (Math.ceil(qOrd / qtyPerBox) || 0);
                      const bAlloc = it.boxes_allocated ?? (Math.ceil(qAlloc / qtyPerBox) || 0);
                      const bInv = it.boxes_invoiced ?? (Math.floor(qInv / qtyPerBox) || 0);
                      const bPend = it.boxes_pending ?? Math.max(0, bOrd - bAlloc);

                      return (
                        <tr key={i}>
                          <td className="font-medium text-[#06182F]">
                            <div>{it.product_name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">Box of {qtyPerBox} pcs</div>
                          </td>
                          <td className="font-mono font-bold text-xs text-[#4B5563]">{it.size || it.sku}</td>
                          <td className="text-right tabular font-mono font-semibold">
                            <div>{fmt.num(bOrd)} Boxes</div>
                            <div className="text-[10px] text-slate-400">({fmt.num(qOrd)} pcs)</div>
                          </td>
                          <td className="text-right tabular font-mono font-bold text-emerald-700">
                            <div>{fmt.num(bAlloc)} Boxes</div>
                            <div className="text-[10px] text-emerald-600 font-normal">({fmt.num(qAlloc)} pcs)</div>
                          </td>
                          <td className="text-right tabular font-mono font-bold text-blue-700">
                            <div>{fmt.num(bInv)} Boxes</div>
                            <div className="text-[10px] text-blue-600 font-normal">({fmt.num(qInv)} pcs)</div>
                          </td>
                          <td className="text-right tabular font-mono font-bold">
                            {bPend > 0 || qPend > 0 ? (
                              <div className="bg-amber-100 text-amber-900 border border-amber-200 px-2 py-0.5 rounded text-xs inline-flex flex-col items-end font-mono font-bold" title="To be billed as per stock replenishment">
                                <span>⏳ {fmt.num(bPend)} Boxes</span>
                                <span className="text-[10px] text-amber-800 font-normal">({fmt.num(qPend)} pcs)</span>
                              </div>
                            ) : (
                              <span className="text-emerald-700 font-mono text-xs font-bold">✓ 0 Boxes</span>
                            )}
                          </td>
                          <td className="text-right tabular font-mono font-bold text-[#D96B0B]">
                            {it.total_weight_kg ? `${it.total_weight_kg} kg` : "—"}
                          </td>
                          <td className="text-right tabular font-mono">{fmt.inr(it.value_before_tax || it.subtotal)}</td>
                          <td className="text-right tabular font-mono text-[#3B82F6]">{fmt.inr(it.gst_amount || (it.subtotal * 0.18))}</td>
                          <td className="text-right tabular font-mono font-bold text-[#16A34A]">{fmt.inr(it.value_after_tax || (it.subtotal * 1.18))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Tally Invoices & Partial Billing History Card */}
              {selected.invoices && selected.invoices.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <span>🧾</span> Linked Tally Tax Invoices ({selected.invoices.length})
                    </h4>
                    <span className="text-xs text-slate-500 font-mono">Synced from Tally ERP</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {selected.invoices.map((inv, idx) => (
                      <div key={idx} className="bg-white p-3 rounded border border-slate-200 flex items-center justify-between text-xs shadow-sm">
                        <div>
                          <div className="font-bold font-mono text-slate-900 flex items-center gap-1.5">
                            <span>Invoice #{inv.invoice_no || "TALLY-INV"}</span>
                            <span className="bg-emerald-50 text-emerald-700 text-[10px] px-1.5 py-0.2 rounded border border-emerald-200">
                              Synced
                            </span>
                          </div>
                          <div className="text-slate-500 text-[11px] mt-0.5">Date: {inv.date || "Today"} • Billed Items: {inv.items_billed?.length || 1}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono font-bold text-emerald-700 text-sm">{fmt.inr(inv.amount)}</div>
                          <div className="text-[10px] text-slate-400">via {inv.linked_by || "auto"}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center bg-[#1D242B] text-white p-4 rounded-lg">
                <div>
                  <div className="text-xs uppercase tracking-wider text-[#94A3B8]">Total Consignment Weight</div>
                  <div className="font-mono text-xl font-bold text-[#FEF08A]">
                    {(selected.items?.reduce((s, i) => s + (i.total_weight_kg || 0), 0) || 0).toFixed(3)} KG
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex gap-6 justify-end text-xs text-[#94A3B8]"><span>Value Before Tax:</span><span className="tabular font-mono text-white">{fmt.inr(selected.subtotal)}</span></div>
                  <div className="flex gap-6 justify-end text-xs text-[#94A3B8] mt-0.5"><span>GST (18%):</span><span className="tabular font-mono text-[#93C5FD]">{fmt.inr(selected.gst)}</span></div>
                  <div className="flex gap-6 justify-end font-display font-bold text-lg mt-1 pt-1 border-t border-[#334155] text-[#4ADE80]"><span>Value After Tax:</span><span className="tabular font-mono">{fmt.inr(selected.total)}</span></div>
                </div>
              </div>

              {/* Action Footer */}
              <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  {["approved", "processing", "shipped", "delivered"].includes((selected?.status || "").toLowerCase()) && (
                    <button
                      onClick={() => setInvoiceModalOrder(selected)}
                      className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-sm"
                    >
                      <FileText size={15} weight="bold" /> Download Official GST Tax Invoice
                    </button>
                  )}
                  {selected.payment_status === "paid" && (
                    <button
                      onClick={() => setReceiptOpen(true)}
                      className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold shadow-sm"
                    >
                      <Printer size={14} weight="bold" /> Payment Receipt
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="h-9 px-4 rounded-md border border-gray-200 text-xs font-semibold hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          );
        })()}
        </DialogContent>


      </Dialog>

      {/* Partial Billing Modal */}
      <Dialog open={partialBillModalOpen} onOpenChange={setPartialBillModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <FileText size={18} className="text-sky-600" />
              Record Partial Billing & Tally Tax Invoice
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 py-2">
              <div className="bg-slate-50 p-3 rounded-lg border text-xs text-slate-700">
                Enter the quantities to bill in this invoice batch. Remaining quantities will stay under <strong>Processing</strong>.
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Invoice Number (Tally / Manual)</label>
                <input
                  type="text"
                  value={billingInvoiceNo}
                  onChange={(e) => setBillingInvoiceNo(e.target.value)}
                  placeholder="e.g. INV-20260001-P1"
                  className="w-full h-9 px-3 rounded border text-sm font-mono"
                />
              </div>
              <div className="border rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold">
                    <tr>
                      <th className="p-2">Item Description</th>
                      <th className="p-2 text-right">Ordered (Boxes)</th>
                      <th className="p-2 text-right">Already Billed (Boxes)</th>
                      <th className="p-2 text-right">Boxes to Bill Now</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {selected.items?.map((it) => {
                      const qPerBox = it.qty_per_box || 1000;
                      const qOrd = it.quantity_ordered || it.quantity || 0;
                      const qInv = it.quantity_invoiced || 0;

                      const bOrd = it.boxes ?? (Math.ceil(qOrd / qPerBox) || 0);
                      const bInv = it.boxes_invoiced ?? (Math.floor(qInv / qPerBox) || 0);
                      const pendingBoxes = it.boxes_pending ?? Math.max(0, bOrd - bInv);

                      return (
                        <tr key={it.product_id} className="hover:bg-slate-50">
                          <td className="p-2 font-medium">
                            {it.product_name} <span className="font-mono text-slate-500">({it.size})</span>
                            <div className="text-[10px] text-slate-400 font-mono">Box of {qPerBox} pcs</div>
                          </td>
                          <td className="p-2 text-right font-mono font-semibold">
                            {bOrd} Boxes
                            <div className="text-[10px] text-slate-400 font-normal">({qOrd.toLocaleString()} pcs)</div>
                          </td>
                          <td className="p-2 text-right font-mono text-emerald-600 font-semibold">
                            {bInv} Boxes
                            <div className="text-[10px] text-emerald-600/80 font-normal">({qInv.toLocaleString()} pcs)</div>
                          </td>
                          <td className="p-2 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <input
                                type="number"
                                min="0"
                                max={pendingBoxes}
                                value={partialBillInputs[it.product_id] ?? pendingBoxes}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10) || 0;
                                  setPartialBillInputs(p => ({ ...p, [it.product_id]: val }));
                                }}
                                className="w-24 h-8 px-2 border rounded text-right font-mono font-bold text-slate-900 bg-white shadow-xs focus:ring-2 focus:ring-sky-500"
                              />
                              <span className="text-xs font-semibold text-slate-500">Boxes</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <DialogFooter>
            <button onClick={() => setPartialBillModalOpen(false)} className="h-9 px-4 rounded border text-xs font-semibold">
              Cancel
            </button>
            <button
              onClick={handleRecordPartialBilling}
              disabled={savingBilling}
              className="h-9 px-4 rounded bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow"
            >
              {savingBilling ? "Saving..." : "Generate Partial Invoice"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dispatch / Shipping Tracking Modal with Live Days Configurator */}
      <Dialog open={dispatchModalOpen} onOpenChange={setDispatchModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Truck size={22} className="text-indigo-600" />
              {isEditDeliveryMode ? "Update Delivery Timeframe & Shipment Tracking" : "Mark Order Dispatched & Start Delivery Countdown"}
            </DialogTitle>
          </DialogHeader>
          {selected && (() => {
            const daysNum = parseInt(dispatchDays, 10) || 7;
            const dispDate = dispatchDate || new Date().toISOString().slice(0, 10);
            const targetDt = new Date(dispDate + "T00:00:00");
            targetDt.setDate(targetDt.getDate() + daysNum);
            const targetDateFormatted = targetDt.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

            return (
              <div className="space-y-4 py-2 text-xs">
                <div className="bg-indigo-50 border border-indigo-200 p-3 rounded-lg text-indigo-950">
                  <div className="font-bold flex items-center gap-1.5 mb-1">
                    <span>⏱️ Live {daysNum}-Day Delivery Countdown Flow</span>
                  </div>
                  <p className="leading-relaxed">
                    Once set, the customer/dealer will see a live countdown starting from <strong>{daysNum} Days</strong>. Every midnight, it updates to 1 day less until final delivery. You can adjust this timeframe anytime.
                  </p>
                </div>

                {/* Tracking Number (Required) */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-semibold text-slate-700">Docket / LR / Tracking ID <span className="text-red-500">*</span></label>
                    {!dispatchTrackingNo && (
                      <button
                        type="button"
                        onClick={() => setDispatchTrackingNo(`TRK-${selected.order_no.replace("ORD-", "")}-${Date.now().toString().slice(-4)}`)}
                        className="text-[11px] text-indigo-600 hover:underline font-mono font-semibold"
                      >
                        + Generate Tracking ID
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={dispatchTrackingNo}
                    onChange={(e) => setDispatchTrackingNo(e.target.value)}
                    placeholder="e.g. TRK-9823140 or SFX-8829104"
                    className={`w-full h-9 px-3 rounded border text-xs font-mono font-bold ${
                      !dispatchTrackingNo.trim() ? "border-amber-400 bg-amber-50/40" : "border-slate-300"
                    }`}
                  />
                  {!dispatchTrackingNo.trim() && (
                    <div className="text-[10px] text-amber-700 mt-0.5">Please provide or generate a tracking ID for customer consignment tracking.</div>
                  )}
                </div>

                {/* Logistics Partner */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Logistics / Courier Partner</label>
                  <div className="grid grid-cols-3 gap-1.5 mb-2">
                    {["SafeXpress Logistics", "V-Trans Logistics", "DTDC Express", "Direct Fleet", "SpotOn Logistics", "TCI Express"].map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setDispatchCarrier(c)}
                        className={`p-1.5 text-[11px] rounded border text-center font-medium ${dispatchCarrier === c ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm font-bold' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'}`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={dispatchCarrier}
                    onChange={(e) => setDispatchCarrier(e.target.value)}
                    placeholder="Custom Carrier Name"
                    className="w-full h-8 px-3 rounded border text-xs font-medium"
                  />
                </div>

                {/* Delivery Days Duration Configurator */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Delivery Timeframe (Countdown Duration)</label>
                  <div className="grid grid-cols-4 gap-1.5 mb-2">
                    {[
                      { days: 3, label: "3 Days (Express)" },
                      { days: 5, label: "5 Days (Fast)" },
                      { days: 7, label: "7 Days (Standard)" },
                      { days: 10, label: "10 Days (Long)" },
                    ].map(opt => (
                      <button
                        key={opt.days}
                        type="button"
                        onClick={() => setDispatchDays(opt.days)}
                        className={`p-1.5 text-[11px] rounded border text-center font-medium ${
                          Number(dispatchDays) === opt.days ? 'bg-amber-500 text-white border-amber-600 shadow-sm font-bold' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-medium">Custom Days:</span>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={dispatchDays}
                      onChange={(e) => setDispatchDays(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-20 h-8 px-2 rounded border text-xs font-mono font-bold text-center text-amber-900 bg-amber-50"
                    />
                    <span className="text-slate-600">Days duration</span>
                  </div>
                </div>

                {/* Live Target Delivery Date Preview Box */}
                <div className="p-2.5 bg-slate-900 text-white rounded-lg border border-slate-700 flex items-center justify-between font-mono text-[11px]">
                  <div>
                    <div className="text-slate-400 text-[10px] uppercase tracking-wider">🎯 Target Expected Delivery Date</div>
                    <div className="text-amber-300 font-bold text-xs mt-0.5">{targetDateFormatted}</div>
                  </div>
                  <div className="text-right">
                    <span className="bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded border border-amber-400/30 text-[10px] font-bold">
                      {daysNum}-Day Countdown
                    </span>
                  </div>
                </div>

                {/* Dispatch Date */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Dispatch Date</label>
                  <input
                    type="date"
                    value={dispatchDate}
                    onChange={(e) => setDispatchDate(e.target.value)}
                    className="w-full h-8 px-3 rounded border text-xs font-mono"
                  />
                </div>

                {/* Remarks */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Dispatch Notes / Remarks (Optional)</label>
                  <input
                    type="text"
                    value={dispatchNotes}
                    onChange={(e) => setDispatchNotes(e.target.value)}
                    placeholder="e.g. Dispatched via Express Road Freight in sealed cartons"
                    className="w-full h-8 px-3 rounded border text-xs"
                  />
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <button onClick={() => setDispatchModalOpen(false)} className="h-9 px-4 rounded border text-xs font-semibold">
              Cancel
            </button>
            <button
              onClick={handleDispatchSubmit}
              disabled={updatingStatus}
              className="h-9 px-4 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow flex items-center gap-1.5"
            >
              <Truck size={15} weight="bold" /> {updatingStatus ? "Saving..." : (isEditDeliveryMode ? "Save Updated Timeframe" : `Confirm Dispatch & Start ${dispatchDays}-Day Countdown`)}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Tax Invoice Modal for Download / Print */}
      <TaxInvoiceModal
        isOpen={!!invoiceModalOrder}
        onClose={() => setInvoiceModalOrder(null)}
        order={invoiceModalOrder}
      />

      <ReceiptModal
        isOpen={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        order={selected}
      />

      {/* Place New Fastener Order Modal with Party & Warehouse Selection */}
      <Dialog open={newOrderModalOpen} onOpenChange={setNewOrderModalOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Stack size={22} className="text-[#F28C18]" />
              Place Fastener Order — Size, Box & Allocation Configurator
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-4 pr-1">
            {/* Party & Warehouse Selection Grid */}
            <div className="bg-slate-100 p-4 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider text-[10px]">
                  Target Ordering Party
                </label>
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTargetPartyType("dealer");
                      if (dealers.length > 0) setSelectedPartyId(dealers[0].id);
                    }}
                    className={`flex-1 py-1 rounded font-bold text-xs border ${
                      targetPartyType === "dealer" ? "bg-amber-500 text-white border-amber-600 shadow" : "bg-white text-slate-700"
                    }`}
                  >
                    📦 Distributor
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetPartyType("cnf");
                      if (cnfs.length > 0) setSelectedPartyId(cnfs[0].id);
                    }}
                    className={`flex-1 py-1 rounded font-bold text-xs border ${
                      targetPartyType === "cnf" ? "bg-purple-600 text-white border-purple-700 shadow" : "bg-white text-slate-700"
                    }`}
                  >
                    🏢 CNF Depot
                  </button>
                </div>
                <select
                  value={selectedPartyId}
                  onChange={(e) => setSelectedPartyId(e.target.value)}
                  className="w-full h-9 px-2 rounded border border-slate-300 bg-white font-medium text-xs"
                >
                  {targetPartyType === "dealer" ? (
                    dealers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.company || d.name} ({d.user_code || d.login_id || "D-ASSIGNED"}) • {d.state}
                      </option>
                    ))
                  ) : (
                    cnfs.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name || c.company} ({c.user_code || c.login_id || "C-DEPOT"}) • {c.state || c.area}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider text-[10px]">
                  Fulfillment Warehouse Hub
                </label>
                <select
                  value={selectedWarehouseId}
                  onChange={(e) => setSelectedWarehouseId(e.target.value)}
                  className="w-full h-9 px-2 rounded border border-slate-300 bg-white font-medium text-xs mt-7"
                >
                  <option value="">⚡ Auto: Smart Stock Allocation (Nearest Hub & Stock)</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code}) • {w.city || w.state}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-white p-3 rounded-lg border border-slate-200 flex flex-col justify-center">
                <div className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Smart Stock Policy</div>
                <div className="text-xs text-slate-700 mt-1">
                  Available stock will be reserved automatically. Any shortfall will be flagged for <strong>Automated PO Procurement</strong>.
                </div>
              </div>
            </div>

            {/* Category Switcher inside Modal */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {["CSK Drywall Screws", "CSK Chipboard Screws", "Electronics", "Appliances", "Hardware", "Furniture"].map((c) => (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    cat === c ? "bg-[#1D242B] text-white shadow" : "bg-[#F3F4F6] text-[#5C6670] hover:bg-[#E5E7EB]"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            {/* Interactive Configuration Box */}
            {selectedProduct && (
              <div className="bg-[#0F172A] text-white rounded-xl p-5 border border-[#334155] space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                      Select Available Size & Option
                    </label>
                    <select
                      value={selectedProductId}
                      onChange={(e) => setSelectedProductId(e.target.value)}
                      className="w-full h-11 px-3 rounded-lg bg-[#1E293B] border border-[#475569] text-white text-sm font-medium focus:border-[#F28C18]"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.size ? `${p.size} (${p.sku})` : p.name} — Rate: {fmt.inr(isCnfDepot ? (p.wd_landing || p.price) : (p.dealer_landing || p.price))} | Box of {p.qty_per_box} pcs
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                      Box Option (Quantity of Boxes)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        value={boxCount}
                        onChange={(e) => setBoxCount(parseInt(e.target.value) || 0)}
                        className="flex-1 h-11 px-3 rounded-lg bg-[#1E293B] border border-[#475569] text-white text-base font-mono font-bold focus:border-[#F28C18]"
                      />
                      <span className="text-xs font-mono text-[#FEF08A] bg-[#1E293B] px-3 py-3 rounded-lg border border-[#475569]">
                        {qtyPerBox} pcs/box
                      </span>
                    </div>
                  </div>
                </div>

                {/* Breakdown Strip */}
                <div className="bg-[#1E293B] rounded-lg p-3 grid grid-cols-4 gap-2 text-center text-xs">
                  <div>
                    <div className="text-[10px] text-[#94A3B8] uppercase font-semibold">Total Pieces</div>
                    <div className="font-mono font-bold text-sm text-white mt-0.5">{totalPcs.toLocaleString()} pcs</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#F28C18] uppercase font-semibold">Weight Specification</div>
                    <div className="font-mono font-bold text-sm text-[#FEF08A] mt-0.5">{totalWeightKg} KG</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#94A3B8] uppercase font-semibold">Value (Before Tax)</div>
                    <div className="font-mono font-bold text-sm text-white mt-0.5">{fmt.inr(valueBeforeTax)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#4ADE80] uppercase font-bold">Value (After Tax)</div>
                    <div className="font-mono font-bold text-base text-[#4ADE80] mt-0.5">{fmt.inr(valueAfterTax)}</div>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    onClick={addConfiguredToCart}
                    className="px-5 h-10 rounded-lg gradient-brand-accent text-white font-bold text-sm shadow hover:scale-[1.01] transition-all flex items-center gap-2"
                  >
                    <Plus size={16} weight="bold" /> Add Configuration to Cart
                  </button>
                </div>
              </div>
            )}

            {/* Cart Items List */}
            <div className="border border-[#E5E7EB] rounded-xl overflow-hidden bg-white">
              <div className="px-4 py-3 bg-[#F8FAFC] border-b border-[#E5E7EB] font-bold text-sm text-[#06182F] flex justify-between items-center">
                <span>Configurations in Order ({cartItems.length})</span>
                <span className="font-mono text-xs text-[#D96B0B] bg-[#FFF7ED] px-2 py-0.5 rounded font-bold">
                  Total Weight: {cartTotalWeight} KG
                </span>
              </div>
              {cartItems.length === 0 ? (
                <div className="p-8 text-center text-sm text-[#5C6670]">No items added to order yet.</div>
              ) : (
                <div className="divide-y divide-[#F1F2F4] max-h-[200px] overflow-y-auto">
                  {cartItems.map((i) => (
                    <div key={i.product.id} className="p-3 flex items-center justify-between text-sm">
                      <div>
                        <div className="font-bold text-[#06182F]">{i.product.name}</div>
                        <div className="text-xs font-mono text-[#5C6670]">
                          Size: {i.size} · {i.boxes} Boxes ({i.qty.toLocaleString()} pcs) · <span className="text-[#D96B0B] font-bold">{i.total_weight_kg} KG</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-[10px] text-[#5C6670]">After Tax</div>
                          <div className="font-mono font-bold text-[#16A34A]">{fmt.inr(i.value_after_tax)}</div>
                        </div>
                        <button onClick={() => removeCartItem(i.product.id)} className="text-xs text-red-500 hover:underline">
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {cartItems.length > 0 && (
                <div className="p-3 bg-[#F8FAFC] border-t border-[#E5E7EB] flex justify-between items-center font-bold text-sm">
                  <span>Total Order Landing (After Tax)</span>
                  <span className="font-display text-lg text-[#16A34A] font-extrabold">{fmt.inr(cartTotal)}</span>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setNewOrderModalOpen(false)} className="h-10 px-4 rounded-md border border-[#E5E7EB] text-sm">Close</button>
            <button onClick={placeOrder} disabled={placing || cartItems.length === 0} className="h-10 px-6 rounded-md gradient-brand-accent text-white font-bold text-sm disabled:opacity-50">
              {placing ? "Submitting…" : `Submit Order (${cartTotalWeight} KG)`}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
