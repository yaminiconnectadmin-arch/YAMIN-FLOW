import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";
import { PageSection, StatusBadge, EmptyState } from "@/components/common/Common";
import { toast } from "@/components/ui/sonner";
import {
  Lightning, Package, Clock, MagnifyingGlass,
  Scales, Stack, PencilSimple, Plus, Sparkle, ArrowsClockwise, FileText,
  WhatsappLogo, Eye, Check, Copy, Printer, Users, CaretDown, CaretRight
} from "@phosphor-icons/react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import PurchaseOrderModal from "@/components/common/PurchaseOrderModal";

// ===================== ITEM ACCORDION ROW =====================
function ItemAccordionRow({ it, idx, fmt }) {
  const [open, setOpen] = useState(false);
  const statusColors = {
    pending: "bg-amber-100 text-amber-800 border-amber-300",
    approved: "bg-emerald-100 text-emerald-800 border-emerald-300",
    partially_fulfilled: "bg-blue-100 text-blue-800 border-blue-300",
    processing: "bg-purple-100 text-purple-800 border-purple-300",
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Summary Row — clickable */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50 transition-colors group"
      >
        {/* Index */}
        <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-[11px] font-black flex items-center justify-center flex-shrink-0">
          {idx + 1}
        </span>

        {/* SKU + Name */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-black text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded">{it.sku}</span>
            <span className="font-semibold text-sm text-slate-800">{it.product_name}</span>
            {it.size && <span className="text-xs text-slate-500 font-mono">({it.size})</span>}
            <span className="px-2 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600 rounded">{it.category}</span>
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-xs text-slate-500">Supplier: <strong className="text-slate-700">{it.supplier_name}</strong></span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-500">{(it.order_breakdown || []).length} order{(it.order_breakdown || []).length !== 1 ? 's' : ''} driving demand</span>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="hidden sm:flex items-center gap-4 text-right flex-shrink-0">
          <div>
            <div className="text-[10px] font-bold uppercase text-slate-400">Pending PCS</div>
            <div className="text-sm font-black text-slate-900 font-mono">{fmt.num(it.recommended_pcs)}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase text-amber-600">Required KG</div>
            <div className="text-sm font-black text-amber-700 font-mono">{fmt.kg(it.recommended_weight_kg)}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase text-blue-500">Wt/1000 PCS</div>
            <div className="text-sm font-black text-blue-700 font-mono">{Number(it.wt_1000_pcs_kg).toFixed(3)} kg</div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase text-slate-400">Amount</div>
            <div className="text-sm font-black text-emerald-700 font-mono">{fmt.inr(it.amount)}</div>
          </div>
        </div>

        {/* Expand Icon */}
        <div className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
          open ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-400 group-hover:bg-amber-100 group-hover:text-amber-600"
        }`}>
          {open ? <CaretDown size={14} weight="bold" /> : <CaretRight size={14} weight="bold" />}
        </div>
      </button>

      {/* Expanded Drill-Down */}
      {open && (
        <div className="border-t border-slate-200 bg-slate-50">
          {/* Dealer Code Tags */}
          <div className="px-5 py-2.5 flex items-center gap-2 flex-wrap border-b border-slate-100">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Ordering Dealers:</span>
            {(it.dealer_codes || []).map((c, i) => (
              <span key={i} className="bg-amber-100 text-amber-800 font-mono text-[11px] font-bold px-2 py-0.5 rounded border border-amber-300">{c}</span>
            ))}
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-3">Under CNF/MNP:</span>
            {(it.cnf_codes || []).map((c, i) => c !== "DIRECT" ? (
              <span key={i} className="bg-blue-100 text-blue-800 font-mono text-[11px] font-bold px-2 py-0.5 rounded border border-blue-300">🏷️ {c}</span>
            ) : (
              <span key={i} className="bg-emerald-100 text-emerald-800 text-[11px] font-medium px-2 py-0.5 rounded border border-emerald-300">⚡ Direct</span>
            ))}
          </div>

          {/* Per-Order Breakdown Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200">
                  <th className="text-left px-4 py-2.5 font-bold text-slate-600">Order No.</th>
                  <th className="text-left px-4 py-2.5 font-bold text-slate-600">Dealer Code</th>
                  <th className="text-left px-4 py-2.5 font-bold text-slate-600">Dealer Name</th>
                  <th className="text-left px-4 py-2.5 font-bold text-slate-600">CNF / MNP</th>
                  <th className="text-left px-4 py-2.5 font-bold text-slate-600">Order Status</th>
                  <th className="text-right px-4 py-2.5 font-bold text-slate-600">Qty Ordered</th>
                  <th className="text-right px-4 py-2.5 font-bold text-emerald-700">Qty Allocated</th>
                  <th className="text-right px-4 py-2.5 font-bold text-amber-700 bg-amber-50">Qty Pending ⬇</th>
                </tr>
              </thead>
              <tbody>
                {(it.order_breakdown || []).map((ob, oi) => (
                  <tr key={oi} className={`border-b border-slate-100 ${
                    oi % 2 === 0 ? "bg-white" : "bg-slate-50/60"
                  }`}>
                    <td className="px-4 py-2.5 font-mono font-black text-slate-900">{ob.order_no}</td>
                    <td className="px-4 py-2.5">
                      <span className="bg-amber-100 text-amber-800 font-mono font-bold px-2 py-0.5 rounded text-[11px] border border-amber-300">
                        {ob.dealer_code}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-700">{ob.dealer_name || ob.dealer_code}</td>
                    <td className="px-4 py-2.5">
                      {ob.cnf_code && ob.cnf_code !== "DIRECT" ? (
                        <span className="bg-blue-100 text-blue-800 font-mono font-bold px-2 py-0.5 rounded text-[11px] border border-blue-300">🏷️ {ob.cnf_code}</span>
                      ) : (
                        <span className="text-emerald-700 font-medium text-[11px]">⚡ Direct</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        statusColors[ob.order_status] || "bg-slate-100 text-slate-700 border-slate-300"
                      }`}>
                        {ob.order_status?.toUpperCase().replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular font-mono text-slate-700">{fmt.num(ob.qty_ordered)}</td>
                    <td className="px-4 py-2.5 text-right tabular font-mono text-emerald-700 font-semibold">{fmt.num(ob.qty_allocated)}</td>
                    <td className="px-4 py-2.5 text-right tabular font-mono font-black text-amber-800 bg-amber-50">{fmt.num(ob.qty_pending)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-900 text-white">
                  <td colSpan={5} className="px-4 py-2.5 font-black text-xs uppercase tracking-wider">TOTAL — {it.product_name}</td>
                  <td className="px-4 py-2.5 text-right tabular font-mono font-bold">{fmt.num((it.order_breakdown || []).reduce((s, o) => s + (o.qty_ordered || 0), 0))}</td>
                  <td className="px-4 py-2.5 text-right tabular font-mono font-bold text-emerald-400">{fmt.num((it.order_breakdown || []).reduce((s, o) => s + (o.qty_allocated || 0), 0))}</td>
                  <td className="px-4 py-2.5 text-right tabular font-mono font-black text-amber-300 bg-amber-900/40">{fmt.num(it.recommended_pcs)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Weight Conversion Summary */}
          <div className="px-5 py-3 bg-gradient-to-r from-amber-50 to-orange-50 border-t border-amber-200 flex flex-wrap items-center gap-6">
            <div className="text-xs">
              <span className="text-amber-700 font-bold">Weight Formula: </span>
              <span className="font-mono text-slate-700">({fmt.num(it.recommended_pcs)} PCS ÷ 1000) × {Number(it.wt_1000_pcs_kg).toFixed(3)} kg = </span>
              <span className="font-black text-amber-800">{fmt.kg(it.recommended_weight_kg)}</span>
            </div>
            <div className="text-xs">
              <span className="text-slate-600 font-bold">To Supplier: </span>
              <span className="font-semibold text-slate-800">{it.supplier_name}</span>
              {it.supplier_phone && <span className="ml-2 font-mono text-slate-500">{it.supplier_phone}</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProcurementPage() {
  const [activeTab, setActiveTab] = useState("collation"); // collation | recs | matrix
  const [collationViewMode, setCollationViewMode] = useState("by_supplier"); // "by_supplier" | "by_item"
  const [loading, setLoading] = useState(true);

  // Tab 1: Collation state
  const [uncollatedSummary, setUncollatedSummary] = useState({ total_orders: 0, total_demanded_pcs: 0, estimated_total_kg: 0, items: [], by_supplier: [] });
  const [collations, setCollations] = useState([]);
  const [collating, setCollating] = useState(false);
  const [approvingSupplierId, setApprovingSupplierId] = useState(null);
  const [supplierPhoneOverrides, setSupplierPhoneOverrides] = useState({});

  // Official Purchase Order Preview/Print Modal State
  const [poModalOrder, setPoModalOrder] = useState(null);

  // Tab 2: Recommendations state
  const [recs, setRecs] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [selected, setSelected] = useState({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [warehouseId, setWarehouseId] = useState("");

  // Tab 3: Matrix state
  const [matrixItems, setMatrixItems] = useState([]);
  const [matrixSearch, setMatrixSearch] = useState("");
  const [editItem, setEditItem] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [r, w, u, c, m] = await Promise.all([
        api.get("/procurement/recommendations").catch(() => ({ data: [] })),
        api.get("/warehouses").catch(() => ({ data: [] })),
        api.get("/procurement/uncollated-summary").catch(() => ({ data: { total_orders: 0, total_demanded_pcs: 0, estimated_total_kg: 0, items: [], by_supplier: [] } })),
        api.get("/procurement/collations").catch(() => ({ data: [] })),
        api.get("/procurement/weight-matrix").catch(() => ({ data: [] })),
      ]);
      setRecs(r.data || []);
      setWarehouses(w.data || []);
      if (w.data && w.data[0]) setWarehouseId(w.data[0].id);
      setUncollatedSummary(u.data || { total_orders: 0, total_demanded_pcs: 0, estimated_total_kg: 0, items: [], by_supplier: [] });
      setCollations(c.data || []);
      setMatrixItems(m.data || []);
    } catch (e) {
      toast.error("Failed to load procurement engine data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  // Handle Full Order Collation Trigger
  const handleCollateNow = async () => {
    setCollating(true);
    try {
      const res = await api.post("/procurement/collate", { triggered_by: "manual" });
      if (res.data.status === "noop") {
        toast.info("No uncollated orders pending at this time.");
      } else {
        toast.success(`Collation ${res.data.batch_no} successful! Created ${res.data.po_count} Weight POs (${res.data.total_kg} KG total).`);
        await loadAll();
      }
    } catch (e) {
      toast.error("Collation failed: " + (e.response?.data?.detail || e.message));
    } finally {
      setCollating(false);
    }
  };

  // Handle Approve PO for a single Supplier & Redirect to WhatsApp
  const handleApproveAndSendWhatsApp = async (supplierGroup) => {
    const sid = supplierGroup.supplier_id;
    setApprovingSupplierId(sid);
    try {
      const phoneToUse = supplierPhoneOverrides[sid] ?? supplierGroup.phone ?? "";
      const res = await api.post("/procurement/approve-supplier-po", {
        supplier_id: sid,
        custom_phone: phoneToUse,
        warehouse_id: warehouseId,
      });

      toast.success(`Purchase Order ${res.data.po_no} approved for ${res.data.supplier_name}!`);

      // Open WhatsApp chat in a new tab if URL available
      if (res.data.whatsapp_url) {
        window.open(res.data.whatsapp_url, "_blank", "noopener,noreferrer");
      }

      // Display official purchase order modal
      if (res.data.po) {
        setPoModalOrder(res.data.po);
      }

      await loadAll();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to approve and generate purchase order");
    } finally {
      setApprovingSupplierId(null);
    }
  };

  // Preview Draft PO before approval
  const handlePreviewDraftPO = (supplierGroup) => {
    const draftPO = {
      po_no: supplierGroup.draft_po_no || "DRAFT-PO",
      supplier_name: supplierGroup.supplier_name,
      supplier_company: supplierGroup.company || supplierGroup.supplier_name,
      supplier_phone: supplierPhoneOverrides[supplierGroup.supplier_id] ?? supplierGroup.phone,
      supplier_email: supplierGroup.email,
      supplier_gstin: supplierGroup.gstin,
      supplier_city: supplierGroup.city,
      supplier_state: supplierGroup.state,
      warehouse_name: "Central Warehouse Hub",
      warehouse_address: "Plot 42, Logistics Gateway, Bhiwandi, Maharashtra - 421302",
      items: supplierGroup.items,
      subtotal: supplierGroup.subtotal,
      gst: supplierGroup.gst,
      total: supplierGroup.total,
      total_weight_kg: supplierGroup.total_kg,
      total_pieces: supplierGroup.total_pcs,
      status: "draft (pending approval)",
      whatsapp_message: supplierGroup.whatsapp_message,
      whatsapp_url: supplierGroup.whatsapp_url,
      created_at: new Date().toISOString(),
    };
    setPoModalOrder(draftPO);
  };

  // Recommendations checkbox selection
  const toggleRec = (r) => setSelected((s) => {
    const ns = { ...s };
    if (ns[r.product_id]) delete ns[r.product_id];
    else ns[r.product_id] = {
      product_id: r.product_id,
      quantity: r.recommended_qty,
      quantity_kg: r.recommended_weight_kg,
      rate: r.cost,
      supplier_id: r.supplier_id
    };
    return ns;
  });

  const bySupplier = () => {
    const map = {};
    Object.values(selected).forEach((s) => {
      if (!map[s.supplier_id]) map[s.supplier_id] = [];
      map[s.supplier_id].push(s);
    });
    return map;
  };

  const generateManualPOs = async () => {
    const groups = bySupplier();
    if (Object.keys(groups).length === 0) return toast.error("Select at least one item");
    let created = 0;
    for (const [sid, items] of Object.entries(groups)) {
      if (!sid || sid === "undefined") continue;
      try {
        await api.post("/purchase-orders", {
          supplier_id: sid, warehouse_id: warehouseId, items, notes: "Generated from deficit recommendations (with weight conversion)",
        });
        created++;
      } catch (e) { console.error(e); }
    }
    toast.success(`Generated ${created} purchase order(s)`);
    setSelected({});
    setConfirmOpen(false);
    loadAll();
  };

  // Handle Weight Matrix Save
  const saveMatrixItem = async (e) => {
    e.preventDefault();
    try {
      await api.post("/procurement/weight-matrix", editItem);
      toast.success(`Saved matrix item ${editItem.item_code}`);
      setEditModalOpen(false);
      loadAll();
    } catch (e) {
      toast.error("Failed to save matrix item");
    }
  };

  const totalSelectedItems = Object.keys(selected).length;

  // Filter matrix by search and category
  const filteredMatrix = matrixItems.filter((i) => {
    if (!matrixSearch) return true;
    const q = matrixSearch.toLowerCase();
    return (i.item_code?.toLowerCase().includes(q) || i.size?.toLowerCase().includes(q) || i.category?.toLowerCase().includes(q));
  });

  const chipboardScrews = filteredMatrix.filter(i => i.category === "CSK Chipboard Screws");
  const drywallScrews = filteredMatrix.filter(i => i.category === "CSK Drywall Screws");
  const otherScrews = filteredMatrix.filter(i => i.category !== "CSK Chipboard Screws" && i.category !== "CSK Drywall Screws");

  return (
    <AppShell title="Intelligent Procurement & Collated Weight Engine" subtitle="Order collation, exact piece-to-weight conversion, and supplier WhatsApp dispatch"
      actions={
        <div className="flex items-center gap-2">
          <button onClick={loadAll} className="p-2 rounded-md border border-[#E5E7EB] text-[#5C6670] hover:bg-[#F8FAFC]" title="Refresh Data">
            <ArrowsClockwise size={16} className={loading ? "animate-spin" : ""} />
          </button>
          {activeTab === "recs" && (
            <button onClick={() => setConfirmOpen(true)} disabled={totalSelectedItems === 0}
              className="inline-flex items-center gap-2 px-4 h-9 rounded-md gradient-brand-accent text-white text-sm font-semibold disabled:opacity-50 shadow-sm">
              <Lightning size={14} weight="fill" /> Generate {totalSelectedItems} PO{totalSelectedItems !== 1 ? "s" : ""}
            </button>
          )}
          {activeTab === "collation" && (
            <button onClick={handleCollateNow} disabled={collating || uncollatedSummary.total_orders === 0}
              className="inline-flex items-center gap-2 px-4 h-9 rounded-md gradient-brand-accent text-white text-sm font-semibold disabled:opacity-50 shadow-sm">
              <Sparkle size={14} weight="fill" /> {collating ? "Collating & Converting..." : "Collate All Orders (Batch)"}
            </button>
          )}
          {activeTab === "matrix" && (
            <button onClick={() => { setEditItem({ category: "CSK Chipboard Screws", size: "", item_code: "", wt_1000_pcs_kg: 1.0, qty_per_box: 1000, rate: 0, dealer_landing: 0, wd_basic: 0, wd_landing: 0 }); setEditModalOpen(true); }}
              className="inline-flex items-center gap-2 px-4 h-9 rounded-md bg-[#1D242B] text-white text-sm font-semibold hover:bg-black shadow-sm">
              <Plus size={14} weight="bold" /> Add Fastener Size
            </button>
          )}
        </div>
      }
    >
      {/* Navigation Tabs */}
      <div className="flex border-b border-[#E5E7EB] mb-6 bg-white rounded-t-xl px-4 pt-2 gap-6 shadow-sm">
        <button onClick={() => setActiveTab("collation")}
          className={`pb-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition-all ${
            activeTab === "collation" ? "border-[#F28C18] text-[#1D242B]" : "border-transparent text-[#5C6670] hover:text-[#1D242B]"
          }`}>
          <Scales size={18} weight={activeTab === "collation" ? "fill" : "regular"} className="text-[#F28C18]" />
          Collated Weight & Pending Orders
          {uncollatedSummary.total_orders > 0 && (
            <span className="ml-1 px-2.5 py-0.5 text-xs font-black bg-[#FFF7ED] text-[#D96B0B] border border-[#FDE68A] rounded-full shadow-xs">
              {fmt.kg(uncollatedSummary.estimated_total_kg)} • {uncollatedSummary.total_orders} orders
            </span>
          )}
        </button>
        <button onClick={() => setActiveTab("recs")}
          className={`pb-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition-all ${
            activeTab === "recs" ? "border-[#F28C18] text-[#1D242B]" : "border-transparent text-[#5C6670] hover:text-[#1D242B]"
          }`}>
          <Stack size={18} weight={activeTab === "recs" ? "fill" : "regular"} className="text-[#3B82F6]" />
          Deficit Recommendations
        </button>
        <button onClick={() => setActiveTab("matrix")}
          className={`pb-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition-all ${
            activeTab === "matrix" ? "border-[#F28C18] text-[#1D242B]" : "border-transparent text-[#5C6670] hover:text-[#1D242B]"
          }`}>
          <FileText size={18} weight={activeTab === "matrix" ? "fill" : "regular"} className="text-[#10B981]" />
          Total Weight Matrix & Fasteners Catalog
          <span className="ml-1 text-xs text-[#5C6670] font-mono">({matrixItems.length} SKUs)</span>
        </button>
      </div>

      {loading ? (
        <div className="p-16 text-center text-sm text-[#5C6670] bg-white rounded-xl border border-[#E5E7EB] shadow-sm animate-pulse">
          Loading Intelligent Procurement Engine & Collated Weight Data...
        </div>
      ) : (
        <>
          {/* ===================== TAB 1: COLLATED WEIGHT & PENDING ORDERS ===================== */}
          {activeTab === "collation" && (
            <div className="space-y-6">
              
              {/* Prominent High-Level Collated Weight Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-[#1D242B] to-[#2D3748] text-white p-5 rounded-xl shadow-md border border-[#374151]">
                  <div className="flex items-center justify-between text-[#9CA3AF] text-xs font-medium uppercase tracking-wider mb-2">
                    <span>Total Collated Weight</span>
                    <Scales size={20} weight="fill" className="text-[#FBBF24]" />
                  </div>
                  <div className="text-3xl font-extrabold text-[#FEF08A] tracking-tight">{fmt.kg(uncollatedSummary.estimated_total_kg)}</div>
                  <p className="text-[11px] text-[#D1D5DB] mt-1 font-mono">Formula: (PCS ÷ 1000) × WT OF 1000 PCS</p>
                </div>

                <div className="bg-white p-5 rounded-xl shadow-sm border border-[#E5E7EB]">
                  <div className="flex items-center justify-between text-[#5C6670] text-xs font-medium uppercase tracking-wider mb-2">
                    <span>Total Pieces Demanded</span>
                    <Package size={20} className="text-[#3B82F6]" />
                  </div>
                  <div className="text-3xl font-extrabold text-[#1D242B]">{fmt.num(uncollatedSummary.total_demanded_pcs)} PCS</div>
                  <p className="text-[11px] text-[#5C6670] mt-1">Across all uncollated distributor order items</p>
                </div>

                <div className="bg-white p-5 rounded-xl shadow-sm border border-[#E5E7EB]">
                  <div className="flex items-center justify-between text-[#5C6670] text-xs font-medium uppercase tracking-wider mb-2">
                    <span>Pending Orders Queue</span>
                    <Clock size={20} className="text-[#F28C18]" />
                  </div>
                  <div className="text-3xl font-extrabold text-[#D96B0B]">{uncollatedSummary.total_orders} Orders</div>
                  <p className="text-[11px] text-[#5C6670] mt-1">From dealers & CNF regional depots</p>
                </div>

                <div className="bg-white p-5 rounded-xl shadow-sm border border-[#E5E7EB]">
                  <div className="flex items-center justify-between text-[#5C6670] text-xs font-medium uppercase tracking-wider mb-2">
                    <span>Suppliers to Dispatch</span>
                    <Users size={20} className="text-emerald-600" />
                  </div>
                  <div className="text-3xl font-extrabold text-emerald-700">{uncollatedSummary.by_supplier?.length || 0} Vendors</div>
                  <p className="text-[11px] text-[#5C6670] mt-1">Direct PO & WhatsApp dispatch ready</p>
                </div>
              </div>

              {/* View Selector & Nightly Auto-Collation Info Bar */}
              <div className="bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-sm flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">View Mode:</span>
                  <button
                    onClick={() => setCollationViewMode("by_supplier")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                      collationViewMode === "by_supplier"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    <WhatsappLogo size={16} weight="fill" />
                    Grouped by Supplier POs (WhatsApp Approval)
                    <span className="ml-1 px-1.5 py-0.2 bg-white/20 rounded-full text-[10px]">
                      {uncollatedSummary.by_supplier?.length || 0}
                    </span>
                  </button>
                  <button
                    onClick={() => setCollationViewMode("by_item")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                      collationViewMode === "by_item"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    <Package size={16} />
                    Detailed Item-by-Item Weight Breakdown
                    <span className="ml-1 px-1.5 py-0.2 bg-white/20 rounded-full text-[10px]">
                      {uncollatedSummary.items?.length || 0}
                    </span>
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200">
                  <Clock size={14} weight="bold" />
                  <span>Auto-Collation scheduled daily at <strong>12:00 AM Midnight</strong></span>
                </div>
              </div>

              {/* VIEW 1: GROUPED BY SUPPLIER POS (WHATSAPP REDIRECTION & PO APPROVAL) */}
              {collationViewMode === "by_supplier" && (
                <div className="space-y-6">
                  {(!uncollatedSummary.by_supplier || uncollatedSummary.by_supplier.length === 0) ? (
                    <EmptyState title="No pending supplier orders" description="All distributor order items have already been collated and dispatched to suppliers." />
                  ) : (
                    uncollatedSummary.by_supplier.map((sup) => {
                      const sid = sup.supplier_id;
                      const isApproving = approvingSupplierId === sid;
                      const currentPhone = supplierPhoneOverrides[sid] ?? sup.phone ?? "";

                      return (
                        <div key={sid} className="bg-white rounded-xl border border-slate-300 shadow-md overflow-hidden space-y-0">
                          {/* Supplier Header Banner */}
                          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 font-bold text-lg flex-shrink-0">
                                🏭
                              </div>
                              <div>
                                <div className="text-base font-extrabold flex items-center gap-2">
                                  <span>{sup.supplier_name}</span>
                                  {sup.company && sup.company !== sup.supplier_name && (
                                    <span className="text-xs text-slate-300 font-normal">({sup.company})</span>
                                  )}
                                  <span className="text-[10px] font-mono bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded border border-indigo-400/30">
                                    {sup.draft_po_no || "DRAFT-PO"}
                                  </span>
                                </div>
                                <div className="text-xs text-slate-300 mt-0.5 flex items-center gap-3 flex-wrap">
                                  {sup.city && <span>📍 {[sup.city, sup.state].filter(Boolean).join(", ")}</span>}
                                  {sup.gstin && <span>GSTIN: <strong className="font-mono text-white">{sup.gstin}</strong></span>}
                                  {sup.email && <span>✉️ {sup.email}</span>}
                                </div>
                              </div>
                            </div>

                            {/* Summary Badges Box */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="bg-white/10 backdrop-blur-sm border border-white/20 px-3.5 py-2 rounded-lg text-right">
                                <div className="text-[10px] uppercase font-bold text-amber-300">Collated Weight</div>
                                <div className="text-base font-black font-mono text-white">{fmt.kg(sup.total_kg)}</div>
                              </div>
                              <div className="bg-white/10 backdrop-blur-sm border border-white/20 px-3.5 py-2 rounded-lg text-right">
                                <div className="text-[10px] uppercase font-bold text-blue-300">Total Quantity</div>
                                <div className="text-base font-black font-mono text-white">{fmt.num(sup.total_pcs)} Pcs</div>
                              </div>
                              <div className="bg-white/10 backdrop-blur-sm border border-white/20 px-3.5 py-2 rounded-lg text-right">
                                <div className="text-[10px] uppercase font-bold text-emerald-300">Payable Total</div>
                                <div className="text-base font-black font-mono text-emerald-300">{fmt.inr(sup.total)}</div>
                              </div>
                            </div>
                          </div>

                          {/* Items Table */}
                          <div className="p-4 sm:p-5 space-y-4">
                            <div className="border border-slate-200 rounded-lg overflow-hidden">
                              <table className="yf-table w-full text-xs">
                                <thead className="bg-slate-100 font-bold text-slate-700">
                                  <tr>
                                    <th>SKU / Code</th>
                                    <th>Fastener Description</th>
                                    <th>Size</th>
                                    <th>Category</th>
                                    <th className="text-right">Demanded PCS</th>
                                    <th className="text-right">WT / 1000 PCS</th>
                                    <th className="text-right bg-amber-50 font-extrabold text-amber-900">Converted Weight</th>
                                    <th className="text-right">Unit Rate</th>
                                    <th className="text-right">Basic Amount</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {sup.items.map((it) => (
                                    <tr key={it.product_id} className="hover:bg-slate-50">
                                      <td className="font-mono font-bold text-slate-900">{it.sku}</td>
                                      <td className="font-medium">{it.product_name}</td>
                                      <td className="font-mono font-semibold">{it.size || "—"}</td>
                                      <td><span className="px-2 py-0.5 text-[10px] bg-slate-100 text-slate-600 rounded">{it.category}</span></td>
                                      <td className="text-right tabular font-mono font-semibold">{fmt.num(it.recommended_pcs)} pcs</td>
                                      <td className="text-right tabular font-mono text-blue-700">{Number(it.wt_1000_pcs_kg).toFixed(3)} kg</td>
                                      <td className="text-right tabular font-mono font-black text-amber-800 bg-amber-50/60">
                                        {fmt.kg(it.recommended_weight_kg)}
                                      </td>
                                      <td className="text-right tabular font-mono">{fmt.inr(it.rate)}</td>
                                      <td className="text-right tabular font-mono font-bold">{fmt.inr(it.amount)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            {/* Approval, WhatsApp & PO Actions Bar */}
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
                              {/* WhatsApp Phone Configurator */}
                              <div className="flex items-center gap-2 text-xs flex-1 min-w-[280px]">
                                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                                  <WhatsappLogo size={20} weight="fill" />
                                </div>
                                <div className="flex-1">
                                  <div className="text-[10px] uppercase font-bold text-slate-500">Supplier WhatsApp Contact Number</div>
                                  <input
                                    type="text"
                                    value={currentPhone}
                                    onChange={(e) => setSupplierPhoneOverrides(prev => ({ ...prev, [sid]: e.target.value }))}
                                    placeholder="Enter 10-digit mobile (e.g. 9876543210)"
                                    className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs font-mono font-bold text-slate-900 mt-0.5"
                                  />
                                </div>
                              </div>

                              {/* Action Buttons */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => handlePreviewDraftPO(sup)}
                                  className="h-9 px-3.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                                >
                                  <Eye size={16} /> Preview PO Document
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleApproveAndSendWhatsApp(sup)}
                                  disabled={isApproving}
                                  className="h-9 px-4 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black flex items-center gap-2 transition-all shadow-md disabled:opacity-50"
                                >
                                  <WhatsappLogo size={18} weight="fill" />
                                  {isApproving ? "Generating PO & Opening WhatsApp..." : "Approve & Send to Supplier WhatsApp"}
                                </button>
                              </div>
                            </div>

                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* VIEW 2: DETAILED ITEM-BY-ITEM WEIGHT QUEUE BREAKDOWN — EXPANDABLE */}
              {collationViewMode === "by_item" && (
                <div className="space-y-3">
                  <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-sm px-5 py-3 flex items-center justify-between">
                    <div>
                      <h3 className="font-extrabold text-sm text-[#1D242B]">Live Uncollated Queue — Item Breakdown</h3>
                      <p className="text-xs text-[#5C6670] mt-0.5">Click any item row to expand and see which orders & dealers are driving the procurement need</p>
                    </div>
                    <span className="text-xs font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1.5 rounded-lg">
                      {uncollatedSummary.items?.length || 0} Items Pending Procurement
                    </span>
                  </div>

                  {(!uncollatedSummary.items || uncollatedSummary.items.length === 0) ? (
                    <EmptyState title="No uncollated items" description="All distributor orders have already been collated into supplier weight POs." />
                  ) : (
                    <div className="space-y-2">
                      {uncollatedSummary.items.map((it, idx) => (
                        <ItemAccordionRow key={it.product_id} it={it} idx={idx} fmt={fmt} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Historical Collation Batches */}
              <PageSection title="Historical Collation Batches" description="Audit history of manual and automated 12:00 AM order collations">
                {collations.length === 0 ? (
                  <EmptyState title="No past collations" description="Once orders are collated manually or automatically at 12 AM, batches appear here." />
                ) : (
                  <table className="yf-table w-full">
                    <thead>
                      <tr>
                        <th>Batch Number</th><th>Triggered By</th><th>Orders Collated</th>
                        <th className="text-right">Total Pieces</th><th className="text-right">Total Converted Weight</th>
                        <th>Generated Purchase Orders</th><th>Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {collations.map((b) => (
                        <tr key={b.id || b.batch_no}>
                          <td className="font-mono font-bold text-[#1D242B]">{b.batch_no}</td>
                          <td>
                            <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                              b.triggered_by === "auto_12am" ? "bg-[#DBEAFE] text-[#1E40AF]" : "bg-[#FEF3C7] text-[#92400E]"
                            }`}>
                              {b.triggered_by === "auto_12am" ? "⏰ 12:00 AM Auto" : "⚡ Manual Click"}
                            </span>
                          </td>
                          <td className="font-semibold">{b.orders_count} orders</td>
                          <td className="text-right tabular font-mono">{fmt.num(b.total_pcs)} pcs</td>
                          <td className="text-right tabular font-bold text-[#D96B0B]">{fmt.kg(b.total_kg)}</td>
                          <td>
                            <div className="flex flex-wrap gap-1.5">
                              {b.po_nos?.map((po, idx) => (
                                <span key={idx} className="px-2 py-0.5 bg-[#F3F4F6] border border-[#E5E7EB] rounded text-xs font-mono font-semibold text-[#374151]">
                                  {po}
                                </span>
                              )) || "—"}
                            </div>
                          </td>
                          <td className="text-xs text-[#5C6670]">{fmt.datetime(b.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </PageSection>
            </div>
          )}

          {/* ===================== TAB 2: DEFICIT RECOMMENDATIONS ===================== */}
          {activeTab === "recs" && (
            <PageSection title="Safety Stock & Deficit Recommendations" description="Calculates warehouse deficit and converts required safety order into exact KG weight">
              {recs.length === 0 ? (
                <EmptyState title="All inventory healthy" description="No products below safety threshold or pending demand right now." />
              ) : (
                <table className="yf-table w-full">
                  <thead>
                    <tr>
                      <th className="w-8"></th><th>Product Name</th><th>SKU</th><th>Category</th>
                      <th className="text-right">Available</th><th className="text-right">Safety</th>
                      <th className="text-right">Pending</th><th className="text-right">Recommended PCS</th>
                      <th className="text-right">WT / 1000 PCS</th><th className="text-right">Required Weight</th>
                      <th>Primary Supplier</th><th>Urgency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recs.map((r) => (
                      <tr key={r.product_id}>
                        <td>
                          <input type="checkbox" checked={!!selected[r.product_id]} onChange={() => toggleRec(r)}
                            className="w-4 h-4 accent-[#F28C18] cursor-pointer" />
                        </td>
                        <td className="font-medium">{r.product_name}</td>
                        <td className="font-mono text-xs">{r.sku}</td>
                        <td>{r.category}</td>
                        <td className="text-right tabular">{fmt.num(r.available)}</td>
                        <td className="text-right tabular text-[#5C6670]">{fmt.num(r.safety_stock)}</td>
                        <td className="text-right tabular text-[#5C6670]">{fmt.num(r.pending_demand)}</td>
                        <td className="text-right tabular font-semibold text-[#1D242B]">{fmt.num(r.recommended_qty)} pcs</td>
                        <td className="text-right tabular font-mono text-xs text-[#3B82F6]">{r.wt_1000_pcs_kg} kg</td>
                        <td className="text-right tabular font-bold text-[#D96B0B] bg-[#FFF7ED]">{fmt.kg(r.recommended_weight_kg)}</td>
                        <td className="text-sm">{r.supplier_name}</td>
                        <td><StatusBadge status={r.urgency} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </PageSection>
          )}

          {/* ===================== TAB 3: TOTAL WEIGHT MATRIX ===================== */}
          {activeTab === "matrix" && (
            <div className="space-y-8">
              {/* Search Matrix */}
              <div className="flex items-center justify-between gap-4 bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-sm">
                <div className="relative flex-1 max-w-md">
                  <MagnifyingGlass size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                  <input type="text" placeholder="Search size (e.g. 4X16, 3.5X25) or item code (4CB16)..."
                    value={matrixSearch} onChange={(e) => setMatrixSearch(e.target.value)}
                    className="w-full h-10 pl-10 pr-4 rounded-lg border border-[#E5E7EB] text-sm focus:border-[#F28C18] focus:ring-1 focus:ring-[#F28C18] outline-none" />
                </div>
                <div className="text-xs text-[#5C6670] font-mono bg-[#F3F4F6] px-3 py-2 rounded-lg border border-[#E5E7EB]">
                  Conversion Formula: (Demanded PCS ÷ 1000) × WT of 1000 PCS = Required Supplier KG
                </div>
              </div>

              {/* CSK CHIPBOARD SCREWS TABLE (Yellow Header matching client matrix) */}
              <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">
                <div className="bg-[#FEF08A] px-6 py-3.5 border-b border-[#FDE047] flex items-center justify-between">
                  <h3 className="font-extrabold text-base text-[#854D0E] tracking-wide flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#EAB308]"></span>
                    CSK CHIPBOARD SCREWS — TOTAL WEIGHT MATRIX
                  </h3>
                  <span className="text-xs font-bold text-[#854D0E] bg-[#FEF9C3] px-3 py-1 rounded-full border border-[#FDE047]">
                    {chipboardScrews.length} Sizes Registered
                  </span>
                </div>
                <table className="yf-table w-full text-sm">
                  <thead>
                    <tr className="bg-[#FFFBEB] text-[#78350F]">
                      <th className="py-3">Size</th>
                      <th className="text-right py-3">WT OF 1000 PCS in KG</th>
                      <th className="text-right py-3">QTY / BOX</th>
                      <th className="text-right py-3">RATE (₹)</th>
                      <th className="text-right py-3">Dealer Landing (50%)</th>
                      <th className="py-3">Item Code</th>
                      <th className="text-right py-3">WD BASIC (₹)</th>
                      <th className="text-right py-3">WD LANDING (₹)</th>
                      <th className="w-16 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chipboardScrews.map((it) => (
                      <tr key={it.item_code} className="hover:bg-[#FEFCE8]">
                        <td className="font-bold font-mono text-[#1D242B]">{it.size}</td>
                        <td className="text-right tabular font-mono font-bold text-[#D96B0B] bg-[#FFF7ED]">{it.wt_1000_pcs_kg.toFixed(3)}</td>
                        <td className="text-right tabular font-mono">{it.qty_per_box || "—"}</td>
                        <td className="text-right tabular font-mono font-medium">₹{it.rate}</td>
                        <td className="text-right tabular font-mono text-[#16A34A] font-semibold">₹{it.dealer_landing}</td>
                        <td className="font-mono font-bold text-xs bg-[#F3F4F6] px-2 py-1 rounded text-[#1D242B] w-max">{it.item_code}</td>
                        <td className="text-right tabular font-mono text-[#5C6670]">₹{it.wd_basic}</td>
                        <td className="text-right tabular font-mono font-bold text-[#2563EB]">₹{it.wd_landing}</td>
                        <td className="text-center">
                          <button onClick={() => { setEditItem({ ...it }); setEditModalOpen(true); }}
                            className="p-1.5 rounded text-[#5C6670] hover:text-[#D96B0B] hover:bg-[#FFF7ED]">
                            <PencilSimple size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* CSK DRYWALL SCREWS TABLE (Blue Header matching client matrix) */}
              <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">
                <div className="bg-[#BFDBFE] px-6 py-3.5 border-b border-[#93C5FD] flex items-center justify-between">
                  <h3 className="font-extrabold text-base text-[#1E3A8A] tracking-wide flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#3B82F6]"></span>
                    CSK DRYWALL SCREWS — TOTAL WEIGHT MATRIX
                  </h3>
                  <span className="text-xs font-bold text-[#1E3A8A] bg-[#EFF6FF] px-3 py-1 rounded-full border border-[#93C5FD]">
                    {drywallScrews.length} Sizes Registered
                  </span>
                </div>
                <table className="yf-table w-full text-sm">
                  <thead>
                    <tr className="bg-[#EFF6FF] text-[#1E40AF]">
                      <th className="py-3">Size</th>
                      <th className="text-right py-3">WT OF 1000 PCS in KG</th>
                      <th className="text-right py-3">QTY / BOX</th>
                      <th className="text-right py-3">RATE (₹)</th>
                      <th className="text-right py-3">Dealer Landing (50%)</th>
                      <th className="py-3">Item Code</th>
                      <th className="text-right py-3">WD BASIC (₹)</th>
                      <th className="text-right py-3">WD LANDING (₹)</th>
                      <th className="w-16 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drywallScrews.map((it) => (
                      <tr key={it.item_code} className="hover:bg-[#EFF6FF]">
                        <td className="font-bold font-mono text-[#1D242B]">{it.size}</td>
                        <td className="text-right tabular font-mono font-bold text-[#2563EB] bg-[#EFF6FF]">{it.wt_1000_pcs_kg.toFixed(3)}</td>
                        <td className="text-right tabular font-mono">{it.qty_per_box || "—"}</td>
                        <td className="text-right tabular font-mono font-medium">₹{it.rate}</td>
                        <td className="text-right tabular font-mono text-[#16A34A] font-semibold">₹{it.dealer_landing}</td>
                        <td className="font-mono font-bold text-xs bg-[#F3F4F6] px-2 py-1 rounded text-[#1D242B] w-max">{it.item_code}</td>
                        <td className="text-right tabular font-mono text-[#5C6670]">₹{it.wd_basic}</td>
                        <td className="text-right tabular font-mono font-bold text-[#2563EB]">₹{it.wd_landing}</td>
                        <td className="text-center">
                          <button onClick={() => { setEditItem({ ...it }); setEditModalOpen(true); }}
                            className="p-1.5 rounded text-[#5C6670] hover:text-[#2563EB] hover:bg-[#EFF6FF]">
                            <PencilSimple size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {otherScrews.length > 0 && (
                <PageSection title="Other Fasteners Matrix" description="Additional product weight conversions">
                  <table className="yf-table w-full text-sm">
                    <thead>
                      <tr>
                        <th>Category</th><th>Size</th><th className="text-right">WT / 1000 PCS</th>
                        <th className="text-right">Qty/Box</th><th className="text-right">Rate</th>
                        <th>Item Code</th><th className="text-right">WD Landing</th><th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {otherScrews.map((it) => (
                        <tr key={it.item_code}>
                          <td>{it.category}</td><td className="font-mono font-bold">{it.size}</td>
                          <td className="text-right font-mono font-bold text-[#D96B0B]">{it.wt_1000_pcs_kg}</td>
                          <td className="text-right font-mono">{it.qty_per_box}</td>
                          <td className="text-right font-mono">₹{it.rate}</td>
                          <td className="font-mono font-bold text-xs">{it.item_code}</td>
                          <td className="text-right font-mono">₹{it.wd_landing}</td>
                          <td>
                            <button onClick={() => { setEditItem({ ...it }); setEditModalOpen(true); }}
                              className="p-1.5 rounded text-[#5C6670] hover:text-[#D96B0B]">
                              <PencilSimple size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </PageSection>
              )}
            </div>
          )}
        </>
      )}

      {/* Confirmation Modal for Manual PO Generation from Recommendations */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Generate Weight Purchase Orders</DialogTitle></DialogHeader>
          <div className="py-2 space-y-3 text-sm">
            <p>We will create grouped POs per primary supplier, converting piece quantities to exact kilograms:</p>
            <ul className="list-disc list-inside text-[#5C6670]">
              <li>{totalSelectedItems} items across {Object.keys(bySupplier()).length} supplier(s)</li>
            </ul>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#5C6670] mb-1.5">Destination Warehouse</label>
              <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-[#E5E7EB] text-sm bg-white focus:border-[#F28C18] focus:ring-1 focus:ring-[#F28C18] outline-none">
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setConfirmOpen(false)} className="h-9 px-4 rounded-md border border-[#E5E7EB] text-sm">Cancel</button>
            <button onClick={generateManualPOs} className="h-9 px-4 rounded-md gradient-brand-accent text-white text-sm font-semibold">
              Confirm & Generate POs
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit/Add Matrix Item Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editItem?.id ? `Edit Fastener Size: ${editItem.item_code}` : "Add New Fastener Size & Weight"}</DialogTitle>
          </DialogHeader>
          {editItem && (
            <form onSubmit={saveMatrixItem} className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-[#5C6670] mb-1">Category</label>
                  <select value={editItem.category} onChange={(e) => setEditItem({ ...editItem, category: e.target.value })}
                    className="w-full h-9 px-3 rounded-md border border-[#E5E7EB] text-sm">
                    <option value="CSK Chipboard Screws">CSK Chipboard Screws</option>
                    <option value="CSK Drywall Screws">CSK Drywall Screws</option>
                    <option value="Hardware">Hardware</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-[#5C6670] mb-1">Size (e.g. 4X16)</label>
                  <input type="text" required value={editItem.size} onChange={(e) => setEditItem({ ...editItem, size: e.target.value })}
                    className="w-full h-9 px-3 rounded-md border border-[#E5E7EB] text-sm font-mono" placeholder="4X16" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-[#5C6670] mb-1">Item Code (SKU)</label>
                  <input type="text" required value={editItem.item_code} onChange={(e) => setEditItem({ ...editItem, item_code: e.target.value })}
                    className="w-full h-9 px-3 rounded-md border border-[#E5E7EB] text-sm font-mono uppercase" placeholder="4CB16" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-[#D96B0B] mb-1">WT OF 1000 PCS (KG)</label>
                  <input type="number" step="0.001" required value={editItem.wt_1000_pcs_kg} onChange={(e) => setEditItem({ ...editItem, wt_1000_pcs_kg: parseFloat(e.target.value) || 0 })}
                    className="w-full h-9 px-3 rounded-md border border-[#F28C18] text-sm font-mono font-bold bg-[#FFF7ED]" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-[#5C6670] mb-1">Qty / Box</label>
                  <input type="number" value={editItem.qty_per_box} onChange={(e) => setEditItem({ ...editItem, qty_per_box: parseInt(e.target.value) || 0 })}
                    className="w-full h-9 px-3 rounded-md border border-[#E5E7EB] text-sm font-mono" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-[#5C6670] mb-1">Rate (₹)</label>
                  <input type="number" step="0.01" value={editItem.rate} onChange={(e) => {
                    const rate = parseFloat(e.target.value) || 0;
                    setEditItem({ ...editItem, rate, dealer_landing: Math.round(rate * 0.5) });
                  }} className="w-full h-9 px-3 rounded-md border border-[#E5E7EB] text-sm font-mono" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-[#16A34A] mb-1">Dealer Landing</label>
                  <input type="number" step="0.01" value={editItem.dealer_landing} onChange={(e) => setEditItem({ ...editItem, dealer_landing: parseFloat(e.target.value) || 0 })}
                    className="w-full h-9 px-3 rounded-md border border-[#E5E7EB] text-sm font-mono font-semibold text-[#16A34A]" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-[#5C6670] mb-1">WD Basic (₹)</label>
                  <input type="number" step="0.01" value={editItem.wd_basic} onChange={(e) => setEditItem({ ...editItem, wd_basic: parseFloat(e.target.value) || 0 })}
                    className="w-full h-9 px-3 rounded-md border border-[#E5E7EB] text-sm font-mono" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-[#2563EB] mb-1">WD Landing (₹)</label>
                  <input type="number" step="0.01" value={editItem.wd_landing} onChange={(e) => setEditItem({ ...editItem, wd_landing: parseFloat(e.target.value) || 0 })}
                    className="w-full h-9 px-3 rounded-md border border-[#E5E7EB] text-sm font-mono font-bold text-[#2563EB]" />
                </div>
              </div>

              <DialogFooter className="pt-4">
                <button type="button" onClick={() => setEditModalOpen(false)} className="h-9 px-4 rounded-md border border-[#E5E7EB] text-sm">Cancel</button>
                <button type="submit" className="h-9 px-5 rounded-md gradient-brand-accent text-white text-sm font-semibold shadow-sm">Save Matrix Item</button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Official Purchase Order Document Modal (Print & WhatsApp) */}
      <PurchaseOrderModal
        isOpen={!!poModalOrder}
        onClose={() => setPoModalOrder(null)}
        po={poModalOrder}
      />
    </AppShell>
  );
}
