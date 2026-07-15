import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";
import { PageSection, StatusBadge, EmptyState } from "@/components/common/Common";
import { ExportButton } from "@/lib/csv";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Eye } from "@phosphor-icons/react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

const PO_STATUSES = ["draft", "sent", "confirmed", "shipped", "received", "cancelled"];

export default function PurchaseOrdersPage() {
  const { user } = useAuth();
  const [pos, setPos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/purchase-orders", { params: { status } });
      setPos(data);
    } catch { toast.error("Failed to load"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [status]);

  const updateStatus = async (po, newStatus) => {
    try {
      await api.patch(`/purchase-orders/${po.id}/status`, { status: newStatus });
      toast.success(`${po.po_no} → ${newStatus}`);
      load();
      if (selected?.id === po.id) setSelected({ ...selected, status: newStatus });
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  return (
    <AppShell title="Purchase Orders" subtitle="Manage supplier procurement"
      actions={
        <div className="flex items-center gap-2">
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            className="h-9 px-3 rounded-md border border-[#E5E7EB] text-sm bg-white focus:border-[#F28C18] focus:ring-1 focus:ring-[#F28C18] outline-none"
            data-testid="po-status-filter">
            <option value="">All Statuses</option>
            {PO_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <ExportButton
            filename="yamini-flow-purchase-orders-{date}.csv"
            rows={pos}
            columns={[
              { key: "po_no", label: "PO No" },
              { key: "supplier_name", label: "Supplier" },
              { key: "items", label: "Items", format: (v) => v?.length ?? 0 },
              { key: "subtotal", label: "Subtotal" },
              { key: "gst", label: "GST" },
              { key: "total", label: "Total" },
              { key: "status", label: "Status" },
              { key: "created_at", label: "Created" },
            ]}
          />
        </div>
      }
    >
      <PageSection title={`${pos.length} purchase orders`}>
        {loading ? <div className="p-8 text-center text-sm text-[#5C6670]">Loading…</div>
          : pos.length === 0 ? <EmptyState title="No purchase orders" />
          : (
            <table className="yf-table w-full">
              <thead>
                <tr>
                  <th>PO No</th><th>Supplier</th><th>Items</th>
                  <th className="text-right">Total</th><th>Status</th><th>Created</th><th></th>
                </tr>
              </thead>
              <tbody>
                {pos.map((p) => (
                  <tr key={p.id} data-testid={`po-row-${p.po_no}`}>
                    <td className="font-mono text-xs font-semibold">{p.po_no}</td>
                    <td className="font-medium">{p.supplier_name}</td>
                    <td>{p.items?.length}</td>
                    <td className="text-right tabular font-semibold">{fmt.inr(p.total)}</td>
                    <td><StatusBadge status={p.status} /></td>
                    <td className="text-xs text-[#5C6670]">{fmt.date(p.created_at)}</td>
                    <td className="text-right">
                      <button onClick={() => setSelected(p)} className="p-1.5 rounded hover:bg-[#F4F5F7] text-[#5C6670]" data-testid={`view-po-${p.po_no}`}>
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </PageSection>

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>PO {selected?.po_no}</DialogTitle></DialogHeader>
          {selected && (
            <div className="py-2 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div><div className="text-[11px] uppercase text-[#5C6670] tracking-wider">Supplier</div><div className="font-medium mt-0.5">{selected.supplier_name}</div></div>
                <div><div className="text-[11px] uppercase text-[#5C6670] tracking-wider">Created</div><div className="font-medium mt-0.5">{fmt.datetime(selected.created_at)}</div></div>
                <div><div className="text-[11px] uppercase text-[#5C6670] tracking-wider">Status</div><div className="mt-0.5"><StatusBadge status={selected.status} /></div></div>
              </div>
              <div className="border border-[#E5E7EB] rounded-md overflow-hidden">
                <table className="yf-table w-full">
                  <thead><tr><th>Item</th><th>SKU</th><th className="text-right">Qty</th><th className="text-right">Rate</th><th className="text-right">Amount</th></tr></thead>
                  <tbody>
                    {selected.items?.map((it, i) => (
                      <tr key={i}>
                        <td className="font-medium">{it.product_name}</td>
                        <td className="font-mono text-xs">{it.sku}</td>
                        <td className="text-right tabular">{it.quantity}</td>
                        <td className="text-right tabular">{fmt.inr(it.rate)}</td>
                        <td className="text-right tabular">{fmt.inr(it.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end text-sm">
                <div className="text-right">
                  <div className="flex gap-6"><span className="text-[#5C6670]">Subtotal</span><span className="tabular w-28 text-right">{fmt.inr(selected.subtotal)}</span></div>
                  <div className="flex gap-6"><span className="text-[#5C6670]">GST (18%)</span><span className="tabular w-28 text-right">{fmt.inr(selected.gst)}</span></div>
                  <div className="flex gap-6 font-display font-semibold text-base mt-1"><span>Total</span><span className="tabular w-28 text-right">{fmt.inr(selected.total)}</span></div>
                </div>
              </div>
            </div>
          )}
          {(user?.role === "admin" || user?.role === "supplier") && (
            <DialogFooter className="flex flex-wrap gap-2">
              {PO_STATUSES.map((s) => (
                <button key={s} onClick={() => updateStatus(selected, s)}
                  disabled={selected?.status === s}
                  className={`h-9 px-3 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors ${
                    selected?.status === s ? "bg-[#F4F5F7] text-[#BFC5CB] cursor-not-allowed" :
                    "border border-[#E5E7EB] hover:border-[#F28C18] hover:text-[#D96B0B]"
                  }`}
                  data-testid={`set-po-status-${s}`}>
                  {s}
                </button>
              ))}
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
