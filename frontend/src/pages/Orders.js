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
import { Eye } from "@phosphor-icons/react";

const STATUS_OPTIONS = ["pending", "approved", "reserved", "shipped", "delivered", "cancelled"];

export default function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/orders", { params: { status } });
      setOrders(data);
    } catch { toast.error("Failed to load"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [status]);

  const updateStatus = async (o, newStatus) => {
    try {
      await api.patch(`/orders/${o.id}/status`, { status: newStatus });
      toast.success(`Order ${o.order_no} → ${newStatus}`);
      load();
      if (selected?.id === o.id) setSelected({ ...selected, status: newStatus });
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  return (
    <AppShell title="Orders" subtitle="Track and manage dealer orders">
      <PageSection
        title={`${orders.length} orders`}
        actions={
          <div className="flex items-center gap-2">
            <select value={status} onChange={(e) => setStatus(e.target.value)}
              className="h-9 px-3 rounded-md border border-[#E5E7EB] text-sm bg-white focus:border-[#F28C18] focus:ring-1 focus:ring-[#F28C18] outline-none"
              data-testid="orders-status-filter">
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <ExportButton
              filename="yamini-flow-orders-{date}.csv"
              rows={orders}
              columns={[
                { key: "order_no", label: "Order No" },
                { key: "dealer_name", label: "Dealer" },
                { key: "dealer_state", label: "State" },
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
        {loading ? <div className="p-8 text-center text-sm text-[#5C6670]">Loading…</div>
          : orders.length === 0 ? <EmptyState title="No orders yet" />
          : (
            <div className="overflow-x-auto">
              <table className="yf-table w-full">
                <thead>
                  <tr>
                    <th>Order No</th><th>Dealer</th><th>State</th><th>Items</th>
                    <th className="text-right">Subtotal</th><th className="text-right">Total</th>
                    <th>Status</th><th>Date</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} data-testid={`order-row-${o.order_no}`}>
                      <td className="font-mono text-xs font-semibold">{o.order_no}</td>
                      <td className="font-medium">{o.dealer_name}</td>
                      <td className="text-[#5C6670]">{o.dealer_state}</td>
                      <td>{o.items?.length || 0}</td>
                      <td className="text-right tabular">{fmt.inr(o.subtotal)}</td>
                      <td className="text-right tabular font-semibold">{fmt.inr(o.total)}</td>
                      <td><StatusBadge status={o.status} /></td>
                      <td className="text-[#5C6670] text-xs">{fmt.datetime(o.created_at)}</td>
                      <td className="text-right">
                        <button onClick={() => setSelected(o)} className="p-1.5 rounded hover:bg-[#F4F5F7] text-[#5C6670]" data-testid={`view-order-${o.order_no}`}>
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </PageSection>

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Order {selected?.order_no}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="py-2 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div><div className="text-[11px] uppercase text-[#5C6670] tracking-wider">Dealer</div><div className="font-medium mt-0.5">{selected.dealer_name}</div></div>
                <div><div className="text-[11px] uppercase text-[#5C6670] tracking-wider">State</div><div className="font-medium mt-0.5">{selected.dealer_state || "-"}</div></div>
                <div><div className="text-[11px] uppercase text-[#5C6670] tracking-wider">Placed</div><div className="font-medium mt-0.5">{fmt.datetime(selected.created_at)}</div></div>
                <div><div className="text-[11px] uppercase text-[#5C6670] tracking-wider">Status</div><div className="mt-0.5"><StatusBadge status={selected.status} /></div></div>
              </div>

              <div className="border border-[#E5E7EB] rounded-md overflow-hidden">
                <table className="yf-table w-full">
                  <thead><tr><th>Item</th><th>SKU</th><th className="text-right">Qty</th><th className="text-right">Price</th><th className="text-right">Subtotal</th></tr></thead>
                  <tbody>
                    {selected.items?.map((it, i) => (
                      <tr key={i}>
                        <td className="font-medium">{it.product_name}</td>
                        <td className="font-mono text-xs">{it.sku}</td>
                        <td className="text-right tabular">{it.quantity}</td>
                        <td className="text-right tabular">{fmt.inr(it.price)}</td>
                        <td className="text-right tabular">{fmt.inr(it.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-6 text-sm">
                <div className="text-right">
                  <div className="flex gap-6"><span className="text-[#5C6670]">Subtotal</span><span className="tabular w-28 text-right">{fmt.inr(selected.subtotal)}</span></div>
                  <div className="flex gap-6"><span className="text-[#5C6670]">GST (18%)</span><span className="tabular w-28 text-right">{fmt.inr(selected.gst)}</span></div>
                  <div className="flex gap-6 font-display font-semibold text-base mt-1"><span>Total</span><span className="tabular w-28 text-right">{fmt.inr(selected.total)}</span></div>
                </div>
              </div>

              {selected.deficits?.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-900">
                  <div className="font-semibold mb-1">Reservation Pending — Stock Deficit</div>
                  <ul className="list-disc list-inside text-xs space-y-0.5">
                    {selected.deficits.map((d, i) => (
                      <li key={i}>{d.product_name}: need {d.required}, have {d.available} (deficit {d.deficit})</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          {user?.role !== "dealer" && (
            <DialogFooter className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((s) => (
                <button key={s} onClick={() => updateStatus(selected, s)}
                  disabled={selected?.status === s}
                  className={`h-9 px-3 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors ${
                    selected?.status === s ? "bg-[#F4F5F7] text-[#BFC5CB] cursor-not-allowed" :
                    "border border-[#E5E7EB] hover:border-[#F28C18] hover:text-[#D96B0B]"
                  }`}
                  data-testid={`set-status-${s}`}>
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
