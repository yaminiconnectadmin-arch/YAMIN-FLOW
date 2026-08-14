import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";
import { PageSection, StatusBadge, EmptyState } from "@/components/common/Common";
import { ExportButton } from "@/lib/csv";

import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/components/ui/sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Eye, Plus, Stack, Printer, FileText, CheckCircle, Clock, Truck, Package } from "@phosphor-icons/react";
import ReceiptModal from "@/components/common/ReceiptModal";
import TaxInvoiceModal from "@/components/common/TaxInvoiceModal";

const STATUS_OPTIONS = ["pending", "approved", "processing", "partially_fulfilled", "shipped", "delivered", "cancelled"];

export default function OrdersPage() {
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

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/orders", { params: { status } });
      setOrders(data);
    } catch { 
      toast.error("Failed to load orders"); 
    } finally { 
      setLoading(false); 
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [status]);

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
          setSelectedWarehouseId((prev) => (!prev && whRes.data?.length > 0 ? whRes.data[0].id : prev));
        } catch {
          toast.error("Failed to load catalog or partner details for ordering");
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newOrderModalOpen, cat]);

  const updateStatus = async (orderId, newStatus, notes = "") => {
    setUpdatingStatus(true);
    try {
      const { data } = await api.patch(`/orders/${orderId}/status`, { status: newStatus, notes });
      toast.success(`Order ${data.order_no} status updated to ${newStatus.toUpperCase()}`);
      load();
      if (selected?.id === orderId) setSelected(data);
    } catch (e) { 
      toast.error(e.response?.data?.detail || "Failed to update order status"); 
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleRecordPartialBilling = async () => {
    if (!selected) return;
    setSavingBilling(true);
    try {
      const itemsToBill = Object.entries(partialBillInputs).map(([pid, qty]) => ({
        product_id: pid,
        quantity_to_bill: parseInt(qty, 10) || 0
      })).filter(i => i.quantity_to_bill > 0);

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
      title="Distributor & CNF Orders"
      subtitle="Manage, track, and place size-based orders with automatic weight, tax calculation & multi-warehouse allocation"
      actions={
        <button
          onClick={() => { setCart({}); setNewOrderModalOpen(true); }}
          className="inline-flex items-center gap-2 px-4 h-9 rounded-md gradient-brand-accent text-white text-sm font-semibold shadow-md hover:shadow-lg hover:scale-105 transition-all"
          data-testid="new-fastener-order-button"
        >
          <Plus size={16} weight="bold" /> + Place Fastener Order (Select Size & Boxes)
        </button>
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
          : orders.length === 0 ? <EmptyState title="No orders found" description="Click '+ Place Fastener Order' to configure and submit your first order." />
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
                    const canDownloadInvoice = ["approved", "processing", "partially_fulfilled", "shipped", "delivered"].includes(o.status?.toLowerCase());

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
                          {o.warehouse_name || "Central Bhiwandi Hub"}
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
              <div className="text-xs text-slate-500 font-mono mt-0.5">
                Invoice No: {selected?.invoice_no || "INV-PENDING"} • Warehouse: {selected?.warehouse_name || "Central Bhiwandi"}
              </div>
            </div>
            {["approved", "processing", "partially_fulfilled", "shipped", "delivered"].includes(selected?.status?.toLowerCase()) && (
              <button
                onClick={() => setInvoiceModalOrder(selected)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow transition-all"
              >
                <FileText size={15} weight="bold" /> Download Official GST Tax Invoice
              </button>
            )}
          </DialogHeader>
          {selected && (
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
                  <div className="font-medium mt-0.5 text-xs">{selected.warehouse_name || "Central Bhiwandi"}</div>
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

              {/* Admin Processing & Status Controls */}
              {isAdmin && (
                <div className="bg-slate-900 text-white p-3 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 font-semibold">
                    <span className="text-amber-400 font-bold uppercase tracking-wider text-[11px]">Admin Actions:</span>
                    <span>Update Order & Processing Lifecycle</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {selected.status === "pending" && (
                      <button
                        onClick={() => updateStatus(selected.id, "approved")}
                        disabled={updatingStatus}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold transition-all inline-flex items-center gap-1"
                      >
                        <CheckCircle size={14} weight="bold" /> Approve & Reserve Stock
                      </button>
                    )}
                    {["approved", "partially_fulfilled"].includes(selected.status) && (
                      <>
                        <button
                          onClick={() => updateStatus(selected.id, "processing")}
                          disabled={updatingStatus}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded font-bold transition-all inline-flex items-center gap-1"
                        >
                          <Clock size={14} weight="bold" /> Mark Under Processing
                        </button>
                        <button
                          onClick={() => {
                            setBillingInvoiceNo(`INV-${selected.order_no.replace("ORD-", "")}-P${(selected.invoices?.length || 0) + 1}`);
                            const init = {};
                            selected.items?.forEach(it => {
                              init[it.product_id] = it.quantity_pending || Math.max(0, (it.quantity_ordered || it.quantity) - (it.quantity_invoiced || 0));
                            });
                            setPartialBillInputs(init);
                            setPartialBillModalOpen(true);
                          }}
                          className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded font-bold transition-all inline-flex items-center gap-1"
                        >
                          <FileText size={14} weight="bold" /> Record Partial Billing
                        </button>
                      </>
                    )}
                    {selected.status === "processing" && (
                      <button
                        onClick={() => updateStatus(selected.id, "shipped")}
                        disabled={updatingStatus}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold transition-all inline-flex items-center gap-1"
                      >
                        <Truck size={14} weight="bold" /> Mark Shipped / Dispatched
                      </button>
                    )}
                    {selected.status === "shipped" && (
                      <button
                        onClick={() => updateStatus(selected.id, "delivered")}
                        disabled={updatingStatus}
                        className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded font-bold transition-all inline-flex items-center gap-1"
                      >
                        <Package size={14} weight="bold" /> Mark Delivered
                      </button>
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
                      <th className="text-right text-emerald-700">Allocated (Stock)</th>
                      <th className="text-right text-blue-700">Billed</th>
                      <th className="text-right text-amber-700">Under Processing</th>
                      <th className="text-right">Weight (KG)</th>
                      <th className="text-right">Before Tax</th>
                      <th className="text-right">GST (18%)</th>
                      <th className="text-right">After Tax</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.items?.map((it, i) => {
                      const qOrd = it.quantity_ordered ?? it.quantity ?? 0;
                      const qAlloc = it.quantity_allocated ?? (selected.reservation_status === "reserved" ? qOrd : 0);
                      const qInv = it.quantity_invoiced ?? 0;
                      const qPend = it.quantity_pending ?? Math.max(0, qOrd - qInv);
                      return (
                        <tr key={i}>
                          <td className="font-medium text-[#06182F]">{it.product_name}</td>
                          <td className="font-mono font-bold text-xs text-[#4B5563]">{it.size || it.sku}</td>
                          <td className="text-right tabular font-mono font-semibold">{qOrd} pcs</td>
                          <td className="text-right tabular font-mono font-bold text-emerald-700">
                            {qAlloc} pcs
                          </td>
                          <td className="text-right tabular font-mono font-bold text-blue-700">{qInv} pcs</td>
                          <td className="text-right tabular font-mono font-bold">
                            {qPend > 0 ? (
                              <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-xs">
                                ⏳ {qPend} pcs
                              </span>
                            ) : (
                              <span className="text-gray-400">0 pcs</span>
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
                    {selected.items?.reduce((s, i) => s + (i.total_weight_kg || 0), 0).toFixed(3)} KG
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
                  {["approved", "processing", "partially_fulfilled", "shipped", "delivered"].includes(selected.status?.toLowerCase()) && (
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
          )}
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
                      <th className="p-2 text-right">Ordered</th>
                      <th className="p-2 text-right">Already Billed</th>
                      <th className="p-2 text-right">Quantity to Bill Now (Pcs)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {selected.items?.map((it) => {
                      const qOrd = it.quantity_ordered || it.quantity || 0;
                      const qInv = it.quantity_invoiced || 0;
                      const pending = Math.max(0, qOrd - qInv);
                      return (
                        <tr key={it.product_id} className="hover:bg-slate-50">
                          <td className="p-2 font-medium">{it.product_name} <span className="font-mono text-slate-500">({it.size})</span></td>
                          <td className="p-2 text-right font-mono">{qOrd}</td>
                          <td className="p-2 text-right font-mono text-emerald-600">{qInv}</td>
                          <td className="p-2 text-right">
                            <input
                              type="number"
                              min="0"
                              max={pending}
                              value={partialBillInputs[it.product_id] ?? pending}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10) || 0;
                                setPartialBillInputs(p => ({ ...p, [it.product_id]: val }));
                              }}
                              className="w-24 h-8 px-2 border rounded text-right font-mono font-bold"
                            />
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
