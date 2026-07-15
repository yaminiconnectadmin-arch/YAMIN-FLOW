import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";
import { PageSection, StatusBadge, EmptyState } from "@/components/common/Common";
import { toast } from "@/components/ui/sonner";

export default function InventoryPage() {
  const [rows, setRows] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [warehouse, setWarehouse] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await api.get("/warehouses");
      setWarehouses(data);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/inventory", { params: { warehouse_id: warehouse } });
        setRows(data);
      } catch { toast.error("Failed to load inventory"); }
      finally { setLoading(false); }
    })();
  }, [warehouse]);

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
          <div className="text-[11px] font-medium uppercase tracking-widest text-[#5C6670]">On-hand Units</div>
          <div className="font-display text-2xl font-bold text-[#06182F] tabular mt-2">{fmt.num(totals.qty)}</div>
        </div>
        <div className="kpi-card bg-white p-5 rounded-lg border border-[#E5E7EB] card-shadow">
          <div className="text-[11px] font-medium uppercase tracking-widest text-[#5C6670]">Reserved</div>
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
                    <th className="text-right">On Hand</th><th className="text-right">Reserved</th>
                    <th className="text-right">Available</th><th className="text-right">Safety</th>
                    <th className="text-right">Value</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} data-testid={`inventory-row-${r.product_sku}`}>
                      <td>{r.warehouse_code}</td>
                      <td className="font-mono text-xs">{r.product_sku}</td>
                      <td className="font-medium">{r.product_name}</td>
                      <td className="text-[#5C6670]">{r.category}</td>
                      <td className="text-right tabular">{r.quantity}</td>
                      <td className="text-right tabular text-[#5C6670]">{r.reserved}</td>
                      <td className="text-right tabular font-semibold">{r.available}</td>
                      <td className="text-right tabular text-[#5C6670]">{r.safety_stock}</td>
                      <td className="text-right tabular">{fmt.inr(r.quantity * r.price)}</td>
                      <td><StatusBadge status={r.stock_status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </PageSection>
    </AppShell>
  );
}
