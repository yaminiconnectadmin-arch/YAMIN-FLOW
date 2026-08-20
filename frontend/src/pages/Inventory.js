import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";
import { PageSection, StatusBadge, EmptyState } from "@/components/common/Common";
import { ExportButton } from "@/lib/csv";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export default function InventoryPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [rows, setRows] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [warehouse, setWarehouse] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  // Edit stock modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [editQty, setEditQty] = useState(0);
  const [editSafety, setEditSafety] = useState(0);
  const [editReason, setEditReason] = useState("Manual stock override");
  const [savingStock, setSavingStock] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/inventory", { params: { warehouse_id: warehouse } });
      setRows(data);
    } catch { toast.error("Failed to load inventory"); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    (async () => {
      const { data } = await api.get("/warehouses");
      setWarehouses(data);
    })();
  }, []);

  useEffect(() => {
    loadData();
  }, [warehouse]);

  const handleSaveStock = async () => {
    if (!selectedRow) return;
    setSavingStock(true);
    try {
      await api.post("/inventory/adjust", {
        warehouse_id: selectedRow.warehouse_id,
        product_id: selectedRow.product_id,
        quantity: Number(editQty),
        mode: "set",
        safety_stock: Number(editSafety),
        reason: editReason.trim() || "admin_manual_override"
      });
      toast.success(`Inventory updated for ${selectedRow.product_name}: ${editQty} Boxes`);
      setEditModalOpen(false);
      loadData();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to update inventory stock");
    } finally {
      setSavingStock(false);
    }
  };

  const filtered = q
    ? rows.filter((r) => (r.product_name || "").toLowerCase().includes(q.toLowerCase()) ||
                          (r.product_sku || "").toLowerCase().includes(q.toLowerCase()))
    : rows;

  const totals = filtered.reduce((acc, r) => {
    acc.qty += r.quantity || 0;
    acc.reserved += r.reserved || 0;
    acc.value += (r.quantity || 0) * (r.price || 0);
    acc.critical += r.stock_status === "critical" ? 1 : 0;
    return acc;
  }, { qty: 0, reserved: 0, value: 0, critical: 0 });

  return (
    <AppShell title="Inventory" subtitle="Live stock across warehouses">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-6 stagger">
        <div className="kpi-card bg-white p-5 rounded-lg border border-[#E5E7EB] card-shadow">
          <div className="text-[11px] font-medium uppercase tracking-widest text-[#5C6670]">On-hand Boxes</div>
          <div className="font-display text-2xl font-bold text-[#06182F] tabular mt-2">{fmt.num(totals.qty)}</div>
        </div>
        <div className="kpi-card bg-white p-5 rounded-lg border border-[#E5E7EB] card-shadow">
          <div className="text-[11px] font-medium uppercase tracking-widest text-[#5C6670]">Reserved (Boxes)</div>
          <div className="font-display text-2xl font-bold text-[#06182F] tabular mt-2">{fmt.num(totals.reserved)}</div>
        </div>
        <div className="kpi-card bg-white p-5 rounded-lg border border-[#E5E7EB] card-shadow">
          <div className="text-[11px] font-medium uppercase tracking-widest text-[#5C6670]">Stock Value</div>
          <div className="font-display text-2xl font-bold text-[#06182F] tabular mt-2">{fmt.inr(totals.value)}</div>
        </div>
        <div className="kpi-card bg-white p-5 rounded-lg border border-[#E5E7EB] card-shadow">
          <div className="text-[11px] font-medium uppercase tracking-widest text-[#5C6670]">Critical SKUs</div>
          <div className="font-display text-2xl font-bold text-red-600 tabular mt-2">{totals.critical}</div>
        </div>
      </div>

      <PageSection
        title="Stock Ledger"
        actions={
          <div className="flex items-center gap-3">
            <select value={warehouse} onChange={(e) => setWarehouse(e.target.value)}
              className="h-9 px-3 rounded-md border border-[#E5E7EB] text-sm bg-white focus:border-[#F28C18] focus:ring-1 focus:ring-[#F28C18] outline-none"
              data-testid="inventory-warehouse-filter">
              <option value="">All Warehouses</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
            </select>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…"
              className="h-9 px-3 rounded-md border border-[#E5E7EB] text-sm w-[220px] focus:border-[#F28C18] focus:ring-1 focus:ring-[#F28C18] outline-none"
              data-testid="inventory-search" />
            <ExportButton
              filename="yamini-flow-inventory-{date}.csv"
              rows={filtered}
              columns={[
                { key: "warehouse_code", label: "Warehouse" },
                { key: "product_sku", label: "SKU" },
                { key: "product_name", label: "Product" },
                { key: "category", label: "Category" },
                { key: "quantity", label: "On Hand (Boxes)" },
                { key: "reserved", label: "Reserved (Boxes)" },
                { key: "available", label: "Available (Boxes)" },
                { key: "safety_stock", label: "Safety Stock" },
                { key: "stock_status", label: "Status" },
                { key: "price", label: "Unit Price" },
              ]}
            />
          </div>
        }
      >
        {loading ? <div className="p-8 text-center text-sm text-[#5C6670]">Loading…</div>
          : filtered.length === 0 ? <EmptyState title="No stock rows" />
          : (
            <div className="overflow-x-auto">
              <table className="yf-table w-full">
                <thead>
                  <tr>
                    <th>Warehouse</th><th>SKU</th><th>Product</th><th>Category</th>
                    <th className="text-right">On Hand (Boxes)</th><th className="text-right">Reserved</th>
                    <th className="text-right">Available</th><th className="text-right">Safety</th>
                    <th className="text-right">Value</th><th>Status</th>
                    {isAdmin && <th className="text-center">Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} data-testid={`inventory-row-${r.product_sku}`}>
                      <td>{r.warehouse_code}</td>
                      <td className="font-mono text-xs">{r.product_sku}</td>
                      <td className="font-medium">{r.product_name}</td>
                      <td className="text-[#5C6670]">{r.category}</td>
                      <td className="text-right tabular font-bold text-slate-900">
                        <div>{r.quantity?.toLocaleString()} Boxes</div>
                        <div className="text-[10px] text-slate-400 font-normal">({((r.quantity || 0) * (r.qty_per_box || 1000)).toLocaleString()} pcs)</div>
                      </td>
                      <td className="text-right tabular text-[#5C6670]">
                        <div>{r.reserved?.toLocaleString()} Boxes</div>
                        <div className="text-[10px] text-slate-400">({((r.reserved || 0) * (r.qty_per_box || 1000)).toLocaleString()} pcs)</div>
                      </td>
                      <td className="text-right tabular font-bold text-emerald-700">
                        <div>{r.available?.toLocaleString()} Boxes</div>
                        <div className="text-[10px] text-emerald-600/80 font-normal">({((r.available || 0) * (r.qty_per_box || 1000)).toLocaleString()} pcs)</div>
                      </td>
                      <td className="text-right tabular text-[#5C6670]">{r.safety_stock?.toLocaleString()} Boxes</td>
                      <td className="text-right tabular">{fmt.inr(r.quantity * r.price)}</td>
                      <td><StatusBadge status={r.stock_status} /></td>
                      {isAdmin && (
                        <td className="text-center">
                          <button
                            onClick={() => {
                              setSelectedRow(r);
                              setEditQty(r.quantity || 0);
                              setEditSafety(r.safety_stock || 0);
                              setEditReason("Manual stock override");
                              setEditModalOpen(true);
                            }}
                            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs font-bold transition-all shadow-2xs inline-flex items-center gap-1 font-mono"
                          >
                            ✏️ Edit Stock
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </PageSection>

      {/* Admin Manual Stock Adjustment Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-md bg-white p-6 border rounded-xl shadow-lg space-y-4">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>📦</span> Manual Stock Update (in Boxes)
            </DialogTitle>
          </DialogHeader>
          {selectedRow && (
            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 border p-3 rounded-lg text-slate-700 space-y-1">
                <div>Product: <strong className="text-slate-900">{selectedRow.product_name}</strong></div>
                <div>SKU: <span className="font-mono">{selectedRow.product_sku}</span> • Warehouse: <strong>{selectedRow.warehouse_code} ({selectedRow.warehouse_name})</strong></div>
                <div>Packing: <span className="font-mono font-bold text-slate-900">{selectedRow.qty_per_box || 1000} pcs / Box</span></div>
                <div>Current On-Hand Stock: <strong className="font-mono text-amber-700">{selectedRow.quantity?.toLocaleString()} Boxes</strong> <span className="text-slate-500">({((selectedRow.quantity || 0) * (selectedRow.qty_per_box || 1000)).toLocaleString()} pcs)</span></div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target On-Hand Stock (Number of Boxes) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  min="0"
                  value={editQty}
                  onChange={(e) => setEditQty(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full h-9 px-3 border rounded text-sm font-mono font-bold text-slate-900 bg-white"
                />
                <div className="text-[11px] text-amber-700 font-mono mt-1 font-semibold">
                  = {editQty?.toLocaleString()} Boxes ({((editQty || 0) * (selectedRow.qty_per_box || 1000)).toLocaleString()} total pieces)
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Safety Stock Threshold (Boxes)</label>
                <input
                  type="number"
                  min="0"
                  value={editSafety}
                  onChange={(e) => setEditSafety(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full h-9 px-3 border rounded text-sm font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Adjustment Reason / Notes</label>
                <input
                  type="text"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="e.g. Physical stock count / Tally sync fallback"
                  className="w-full h-9 px-3 border rounded text-xs"
                />
              </div>
            </div>
          )}
          <DialogFooter className="flex justify-end gap-2 pt-2 border-t">
            <button onClick={() => setEditModalOpen(false)} className="h-9 px-4 border rounded text-xs font-semibold">
              Cancel
            </button>
            <button onClick={handleSaveStock} disabled={savingStock} className="h-9 px-4 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded shadow">
              {savingStock ? "Saving..." : "Save Updated Stock"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
