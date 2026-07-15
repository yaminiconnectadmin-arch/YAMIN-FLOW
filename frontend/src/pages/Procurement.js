import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";
import { PageSection, StatusBadge, EmptyState } from "@/components/common/Common";
import { toast } from "@/components/ui/sonner";
import { Lightning, Package } from "@phosphor-icons/react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

export default function ProcurementPage() {
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [warehouses, setWarehouses] = useState([]);
  const [selected, setSelected] = useState({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [warehouseId, setWarehouseId] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [r, w] = await Promise.all([api.get("/procurement/recommendations"), api.get("/warehouses")]);
      setRecs(r.data); setWarehouses(w.data);
      if (w.data[0]) setWarehouseId(w.data[0].id);
    } catch { toast.error("Failed to load"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const toggle = (r) => setSelected((s) => {
    const ns = { ...s };
    if (ns[r.product_id]) delete ns[r.product_id];
    else ns[r.product_id] = { product_id: r.product_id, quantity: r.recommended_qty, rate: r.cost, supplier_id: r.supplier_id };
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

  const generate = async () => {
    const groups = bySupplier();
    if (Object.keys(groups).length === 0) return toast.error("Select at least one recommendation");
    let created = 0;
    for (const [sid, items] of Object.entries(groups)) {
      if (!sid || sid === "undefined") continue;
      try {
        await api.post("/purchase-orders", {
          supplier_id: sid, warehouse_id: warehouseId, items, notes: "Auto-generated from procurement recommendations",
        });
        created++;
      } catch (e) { console.error(e); }
    }
    toast.success(`Generated ${created} purchase order(s)`);
    setSelected({});
    setConfirmOpen(false);
    load();
  };

  const totalItems = Object.keys(selected).length;

  return (
    <AppShell title="Procurement" subtitle="Smart deficit calculations and purchase suggestions"
      actions={
        <button onClick={() => setConfirmOpen(true)} disabled={totalItems === 0}
          className="inline-flex items-center gap-2 px-4 h-9 rounded-md gradient-brand-accent text-white text-sm font-semibold disabled:opacity-50"
          data-testid="generate-po-button">
          <Lightning size={14} weight="fill" /> Generate {totalItems} PO{totalItems !== 1 ? "s" : ""}
        </button>
      }
    >
      <PageSection title="Recommendations" description="Products below safety threshold or with pending demand">
        {loading ? <div className="p-8 text-center text-sm text-[#5C6670]">Analyzing inventory…</div>
          : recs.length === 0 ? <EmptyState title="All levels healthy" description="No procurement action needed right now." />
          : (
            <table className="yf-table w-full">
              <thead>
                <tr>
                  <th></th><th>Product</th><th>SKU</th><th>Category</th>
                  <th className="text-right">Available</th><th className="text-right">Safety</th>
                  <th className="text-right">Pending</th><th className="text-right">Recommended</th>
                  <th>Supplier</th><th>Urgency</th>
                </tr>
              </thead>
              <tbody>
                {recs.map((r) => (
                  <tr key={r.product_id} data-testid={`rec-row-${r.sku}`}>
                    <td>
                      <input type="checkbox" checked={!!selected[r.product_id]} onChange={() => toggle(r)}
                        className="w-4 h-4 accent-[#F28C18] cursor-pointer" data-testid={`select-${r.sku}`} />
                    </td>
                    <td className="font-medium">{r.product_name}</td>
                    <td className="font-mono text-xs">{r.sku}</td>
                    <td>{r.category}</td>
                    <td className="text-right tabular">{r.available}</td>
                    <td className="text-right tabular text-[#5C6670]">{r.safety_stock}</td>
                    <td className="text-right tabular text-[#5C6670]">{r.pending_demand}</td>
                    <td className="text-right tabular font-semibold text-[#D96B0B]">{r.recommended_qty}</td>
                    <td>{r.supplier_name}</td>
                    <td><StatusBadge status={r.urgency} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </PageSection>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Generate Purchase Orders</DialogTitle></DialogHeader>
          <div className="py-2 space-y-3 text-sm">
            <p>We will create one PO per supplier with the selected items:</p>
            <ul className="list-disc list-inside text-[#5C6670]">
              <li>{totalItems} items across {Object.keys(bySupplier()).length} supplier(s)</li>
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
            <button onClick={generate} className="h-9 px-4 rounded-md gradient-brand-accent text-white text-sm font-semibold" data-testid="confirm-generate-po">
              Generate Now
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
