import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";
import { PageSection, StatusBadge, EmptyState } from "@/components/common/Common";
import { toast } from "@/components/ui/sonner";
import {
  Lightning, Package, Clock, MagnifyingGlass,
  Scales, Stack, PencilSimple, Plus, Sparkle, ArrowsClockwise, FileText
} from "@phosphor-icons/react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

export default function ProcurementPage() {
  const [activeTab, setActiveTab] = useState("collation"); // collation | recs | matrix
  const [loading, setLoading] = useState(true);

  // Tab 1: Collation state
  const [uncollatedSummary, setUncollatedSummary] = useState({ total_orders: 0, total_demanded_pcs: 0, estimated_total_kg: 0, items: [] });
  const [collations, setCollations] = useState([]);
  const [collating, setCollating] = useState(false);

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
        api.get("/procurement/uncollated-summary").catch(() => ({ data: { total_orders: 0, total_demanded_pcs: 0, estimated_total_kg: 0, items: [] } })),
        api.get("/procurement/collations").catch(() => ({ data: [] })),
        api.get("/procurement/weight-matrix").catch(() => ({ data: [] })),
      ]);
      setRecs(r.data || []);
      setWarehouses(w.data || []);
      if (w.data && w.data[0]) setWarehouseId(w.data[0].id);
      setUncollatedSummary(u.data || { total_orders: 0, total_demanded_pcs: 0, estimated_total_kg: 0, items: [] });
      setCollations(c.data || []);
      setMatrixItems(m.data || []);
    } catch (e) {
      toast.error("Failed to load procurement engine data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  // Handle Order Collation
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
    <AppShell title="Intelligent Procurement & Weight Engine" subtitle="Order collation, exact piece-to-weight conversion, and fastener matrix"
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
              <Sparkle size={14} weight="fill" /> {collating ? "Collating & Converting..." : "Collate Orders Now (KG POs)"}
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
          Order Collation Engine
          {uncollatedSummary.total_orders > 0 && (
            <span className="ml-1 px-2 py-0.5 text-xs font-bold bg-[#FFF7ED] text-[#D96B0B] border border-[#FDE68A] rounded-full">
              {uncollatedSummary.total_orders} pending
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
          Loading Intelligent Procurement Engine & Matrix Data...
        </div>
      ) : (
        <>
          {/* ===================== TAB 1: COLLATION ENGINE ===================== */}
          {activeTab === "collation" && (
            <div className="space-y-6">
              {/* Summary Stats & Nightly Auto-Collation Banner */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-[#1D242B] to-[#2D3748] text-white p-5 rounded-xl shadow-md border border-[#374151]">
                  <div className="flex items-center justify-between text-[#9CA3AF] text-xs font-medium uppercase tracking-wider mb-2">
                    <span>Pending Orders Queue</span>
                    <Clock size={16} className="text-[#FBBF24]" />
                  </div>
                  <div className="text-3xl font-extrabold tracking-tight">{uncollatedSummary.total_orders} Orders</div>
                  <p className="text-xs text-[#D1D5DB] mt-1">Awaiting collation from distributors & dealers</p>
                </div>

                <div className="bg-white p-5 rounded-xl shadow-sm border border-[#E5E7EB]">
                  <div className="flex items-center justify-between text-[#5C6670] text-xs font-medium uppercase tracking-wider mb-2">
                    <span>Total Pieces Demanded</span>
                    <Package size={16} className="text-[#3B82F6]" />
                  </div>
                  <div className="text-3xl font-extrabold text-[#1D242B]">{fmt.num(uncollatedSummary.total_demanded_pcs)} PCS</div>
                  <p className="text-xs text-[#5C6670] mt-1">Summed across all pending distributor order items</p>
                </div>

                <div className="bg-[#FFFBF5] p-5 rounded-xl shadow-sm border border-[#FDE68A]">
                  <div className="flex items-center justify-between text-[#D96B0B] text-xs font-bold uppercase tracking-wider mb-2">
                    <span>Converted Weight (Exact)</span>
                    <Scales size={18} weight="fill" className="text-[#F28C18]" />
                  </div>
                  <div className="text-3xl font-extrabold text-[#D96B0B]">{fmt.kg(uncollatedSummary.estimated_total_kg)}</div>
                  <p className="text-xs text-[#B45309] mt-1">Formula: (PCS / 1000) × Weight of 1000 PCS</p>
                </div>
              </div>

              {/* Nightly Auto-Collation Info Bar */}
              <div className="flex items-center justify-between p-4 bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl text-sm text-[#1E40AF]">
                <div className="flex items-center gap-3">
                  <span className="p-2 bg-[#DBEAFE] rounded-lg text-[#2563EB]"><Clock size={20} weight="fill" /></span>
                  <div>
                    <span className="font-bold">Automatic Nightly Collation Active (12:00 AM):</span>
                    <p className="text-xs text-[#3B82F6] mt-0.5">The system auto-collates pending orders every midnight, converts weights via exact matrix ratios, and issues supplier POs.</p>
                  </div>
                </div>
                <button onClick={handleCollateNow} disabled={collating || uncollatedSummary.total_orders === 0}
                  className="px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold rounded-lg shadow-sm transition-all disabled:opacity-50">
                  {collating ? "Processing..." : "Force Collate Now"}
                </button>
              </div>

              {/* Queue Breakdown Table */}
              <PageSection title="Live Uncollated Queue Breakdown" description="Real-time conversion breakdown of items waiting to be collated into supplier POs">
                {uncollatedSummary.items?.length === 0 ? (
                  <EmptyState title="No uncollated items" description="All distributor orders have already been collated into supplier weight POs." />
                ) : (
                  <table className="yf-table w-full">
                    <thead>
                      <tr>
                        <th>SKU / Item Code</th><th>Fastener Description</th><th>Category</th>
                        <th>Ordering Distributor(s)</th><th>Assigned Under</th>
                        <th className="text-right">Demanded PCS</th><th className="text-right">Net Deficit</th>
                        <th className="text-right">WT / 1000 PCS</th><th className="text-right">Required Weight</th>
                        <th>Assigned Primary Supplier</th>
                      </tr>
                    </thead>
                    <tbody>
                      {uncollatedSummary.items.map((it) => (
                        <tr key={it.product_id}>
                          <td className="font-mono font-bold text-xs text-[#1D242B]">{it.sku}</td>
                          <td className="font-medium">{it.product_name}</td>
                          <td><span className="px-2 py-0.5 text-[11px] font-medium bg-[#F3F4F6] text-[#4B5563] rounded">{it.category}</span></td>
                          <td>
                            <div className="flex flex-wrap gap-1 max-w-[160px]">
                              {it.dealer_codes && it.dealer_codes.length > 0 ? (
                                it.dealer_codes.map((c, idx) => (
                                  <span key={idx} className="bg-[#FEF08A] text-[#854D0E] font-mono text-[11px] font-bold px-1.5 py-0.5 rounded shadow-sm">{c}</span>
                                ))
                              ) : (
                                <span className="text-xs text-[#5C6670]">—</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="flex flex-wrap gap-1 max-w-[160px]">
                              {it.mnp_codes && it.mnp_codes.length > 0 ? (
                                it.mnp_codes.map((c, idx) => c !== "DIRECT" ? (
                                  <span key={idx} className="bg-[#BAE6FD] text-[#0369A1] font-mono text-[11px] font-bold px-1.5 py-0.5 rounded shadow-sm" title="Assigned MNP">🏷️ {c}</span>
                                ) : (
                                  <span key={idx} className="bg-[#E6F4EA] text-[#137333] font-medium text-[11px] px-1.5 py-0.5 rounded border border-[#CEEAD6]">⚡ Direct</span>
                                ))
                              ) : (
                                <span className="text-xs text-[#5C6670]">—</span>
                              )}
                            </div>
                          </td>
                          <td className="text-right tabular font-semibold">{fmt.num(it.demanded_pcs)} pcs</td>
                          <td className="text-right tabular text-[#5C6670]">{fmt.num(it.recommended_pcs)} pcs</td>
                          <td className="text-right tabular font-mono text-xs text-[#3B82F6]">{it.wt_1000_pcs_kg} kg</td>
                          <td className="text-right tabular font-bold text-[#D96B0B] bg-[#FFF7ED]">{fmt.kg(it.recommended_weight_kg)}</td>
                          <td className="text-sm font-medium">{it.supplier_name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </PageSection>

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
    </AppShell>
  );
}
