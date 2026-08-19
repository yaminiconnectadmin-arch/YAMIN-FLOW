import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";
import { PageSection, StatusBadge, EmptyState } from "@/components/common/Common";
import { ExportButton } from "@/lib/csv";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Eye, WhatsappLogo, Printer, Scales } from "@phosphor-icons/react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import PurchaseOrderModal from "@/components/common/PurchaseOrderModal";

const PO_STATUSES = ["draft", "sent", "confirmed", "shipped", "received", "cancelled"];

export default function PurchaseOrdersPage() {
  const { user } = useAuth();
  const [pos, setPos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState("");
  const [poDocModalOrder, setPoDocModalOrder] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/purchase-orders", { params: { status } });
      setPos(data);
    } catch { toast.error("Failed to load purchase orders"); }
    finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [status]);

  const updateStatus = async (po, newStatus) => {
    try {
      await api.patch(`/purchase-orders/${po.id}/status`, { status: newStatus });
      toast.success(`${po.po_no} status updated to ${newStatus.toUpperCase()}`);
      load();
      if (selected?.id === po.id) setSelected({ ...selected, status: newStatus });
    } catch (e) { toast.error(e.response?.data?.detail || "Failed to update PO status"); }
  };

  return (
    <AppShell title="Purchase Orders & Supplier Procurement" subtitle="Manage supplier procurement, exact weight POs, and WhatsApp consignments"
      actions={
        <div className="flex items-center gap-2">
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            className="h-9 px-3 rounded-md border border-[#E5E7EB] text-sm bg-white focus:border-[#F28C18] focus:ring-1 focus:ring-[#F28C18] outline-none"
            data-testid="po-status-filter">
            <option value="">All Statuses</option>
            {PO_STATUSES.map((s) => <option key={s} value={s}>{s.toUpperCase()}</option>)}
          </select>
          <ExportButton
            filename="yamini-flow-purchase-orders-{date}.csv"
            rows={pos}
            columns={[
              { key: "po_no", label: "PO No" },
              { key: "supplier_name", label: "Supplier" },
              { key: "items", label: "Items", format: (v) => v?.length ?? 0 },
              { key: "total_weight_kg", label: "Total Weight (KG)" },
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
        {loading ? <div className="p-8 text-center text-sm text-[#5C6670]">Loading purchase orders…</div>
          : pos.length === 0 ? <EmptyState title="No purchase orders" />
          : (
            <table className="yf-table w-full text-xs">
              <thead>
                <tr>
                  <th>PO No</th>
                  <th>Supplier</th>
                  <th>Warehouse Hub</th>
                  <th>Items</th>
                  <th className="text-right">Collated Weight</th>
                  <th className="text-right">Total Payable</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pos.map((p) => {
                  const totalKg = p.total_weight_kg || p.items?.reduce((s, i) => s + (i.quantity_kg || 0), 0) || 0;
                  return (
                    <tr key={p.id} data-testid={`po-row-${p.po_no}`}>
                      <td className="font-mono font-bold text-slate-900">{p.po_no}</td>
                      <td className="font-semibold text-slate-800">
                        <div>{p.supplier_company || p.supplier_name}</div>
                        {p.supplier_phone && <div className="text-[10px] text-slate-500 font-mono">WA: {p.supplier_phone}</div>}
                      </td>
                      <td className="text-slate-600 font-mono text-[11px]">{p.warehouse_name || "Central Hub"}</td>
                      <td className="font-mono">{p.items?.length || 0} items</td>
                      <td className="text-right tabular font-mono font-bold text-amber-800 bg-amber-50/50">
                        {fmt.kg(totalKg)}
                      </td>
                      <td className="text-right tabular font-bold text-emerald-700">{fmt.inr(p.total)}</td>
                      <td><StatusBadge status={p.status} /></td>
                      <td className="text-slate-500 text-[11px]">{fmt.date(p.created_at)}</td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {p.whatsapp_url && (
                            <a
                              href={p.whatsapp_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors shadow-2xs"
                              title="Send / Open WhatsApp PO"
                            >
                              <WhatsappLogo size={15} weight="fill" />
                            </a>
                          )}
                          <button
                            onClick={() => setPoDocModalOrder(p)}
                            className="p-1.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors shadow-2xs"
                            title="Print / View Official Purchase Order"
                          >
                            <Printer size={15} weight="bold" />
                          </button>
                          <button
                            onClick={() => setSelected(p)}
                            className="p-1.5 rounded hover:bg-slate-100 text-slate-600 border"
                            data-testid={`view-po-${p.po_no}`}
                            title="Quick View Details"
                          >
                            <Eye size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
      </PageSection>

      {/* Quick Details & Status Update Dialog */}
      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader className="flex flex-row items-center justify-between border-b pb-2">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              Purchase Order: <span className="font-mono text-indigo-700">{selected?.po_no}</span>
            </DialogTitle>
            {selected && (
              <button
                onClick={() => {
                  const target = selected;
                  setSelected(null);
                  setPoDocModalOrder(target);
                }}
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold flex items-center gap-1.5"
              >
                <Printer size={14} weight="bold" /> Official PO Document
              </button>
            )}
          </DialogHeader>
          {selected && (
            <div className="py-2 space-y-4 max-h-[60vh] overflow-y-auto text-xs">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-[10px] uppercase text-[#5C6670] tracking-wider font-bold">Supplier</div>
                  <div className="font-bold text-slate-900 mt-0.5">{selected.supplier_company || selected.supplier_name}</div>
                  {selected.supplier_phone && <div className="font-mono text-slate-500">Phone: {selected.supplier_phone}</div>}
                </div>
                <div>
                  <div className="text-[10px] uppercase text-[#5C6670] tracking-wider font-bold">Created</div>
                  <div className="font-medium mt-0.5">{fmt.datetime(selected.created_at)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-[#5C6670] tracking-wider font-bold">Status</div>
                  <div className="mt-0.5"><StatusBadge status={selected.status} /></div>
                </div>
              </div>

              {/* Items Breakdown */}
              <div className="border border-[#E5E7EB] rounded-md overflow-hidden">
                <table className="yf-table w-full text-xs">
                  <thead className="bg-slate-100 font-bold">
                    <tr>
                      <th>Item Description</th>
                      <th>SKU</th>
                      <th className="text-right">Qty (Pcs)</th>
                      <th className="text-right">Weight (KG)</th>
                      <th className="text-right">Rate</th>
                      <th className="text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.items?.map((it, i) => (
                      <tr key={i}>
                        <td className="font-medium">{it.product_name}</td>
                        <td className="font-mono text-xs">{it.sku}</td>
                        <td className="text-right tabular font-mono font-semibold">{fmt.num(it.quantity)}</td>
                        <td className="text-right tabular font-mono font-bold text-amber-800 bg-amber-50/50">
                          {fmt.kg(it.quantity_kg || 0)}
                        </td>
                        <td className="text-right tabular font-mono">{fmt.inr(it.rate)}</td>
                        <td className="text-right tabular font-mono font-bold">{fmt.inr(it.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border">
                <div className="text-xs">
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Collated Weight: </span>
                  <span className="font-mono font-black text-amber-800">
                    {fmt.kg(selected.total_weight_kg || selected.items?.reduce((s, i) => s + (i.quantity_kg || 0), 0) || 0)}
                  </span>
                </div>
                <div className="text-right text-xs space-y-0.5">
                  <div className="flex justify-end gap-4"><span className="text-slate-500">Subtotal:</span><span className="font-mono font-semibold">{fmt.inr(selected.subtotal)}</span></div>
                  <div className="flex justify-end gap-4"><span className="text-slate-500">GST (18%):</span><span className="font-mono font-semibold text-blue-600">{fmt.inr(selected.gst)}</span></div>
                  <div className="flex justify-end gap-4 font-bold text-sm text-slate-900 border-t pt-1"><span>Grand Total:</span><span className="font-mono font-black text-emerald-700">{fmt.inr(selected.total)}</span></div>
                </div>
              </div>
            </div>
          )}
          {(user?.role === "admin" || user?.role === "supplier") && (
            <DialogFooter className="flex flex-wrap gap-2 border-t pt-3">
              {PO_STATUSES.map((s) => (
                <button key={s} onClick={() => updateStatus(selected, s)}
                  disabled={selected?.status === s}
                  className={`h-8 px-2.5 rounded text-[11px] font-bold uppercase tracking-wider transition-colors ${
                    selected?.status === s ? "bg-slate-100 text-slate-400 cursor-not-allowed" :
                    "border border-slate-300 hover:border-amber-500 hover:text-amber-700 bg-white"
                  }`}
                  data-testid={`set-po-status-${s}`}>
                  {s}
                </button>
              ))}
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Official Purchase Order Document Modal */}
      <PurchaseOrderModal
        isOpen={!!poDocModalOrder}
        onClose={() => setPoDocModalOrder(null)}
        po={poDocModalOrder}
      />
    </AppShell>
  );
}
