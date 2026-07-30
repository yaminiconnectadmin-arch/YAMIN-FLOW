import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";
import { PageSection, StatusBadge, EmptyState } from "@/components/common/Common";
import { toast } from "@/components/ui/sonner";
import { Printer } from "@phosphor-icons/react";
import ReceiptModal from "@/components/common/ReceiptModal";

export default function InvoicesPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReceiptOrder, setSelectedReceiptOrder] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/invoices");
        setItems(data);
      } catch { toast.error("Failed to load invoices"); }
      finally { setLoading(false); }
    })();
  }, []);

  return (
    <AppShell title="Invoices" subtitle={`${items.length} invoices generated for your account`}>
      <PageSection title="Invoice Register">
        {loading ? <div className="p-8 text-center text-sm text-[#5C6670]">Loading…</div>
          : items.length === 0 ? <EmptyState title="No invoices yet" />
          : (
            <>
              <table className="yf-table w-full">
                <thead>
                  <tr>
                    <th>Invoice No</th>
                    <th>Order No</th>
                    <th>Date</th>
                    <th className="text-right">Subtotal</th>
                    <th className="text-right">GST</th>
                    <th className="text-right">Total</th>
                    <th>Order Status</th>
                    <th>Payment Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.id} data-testid={`invoice-${i.invoice_no}`}>
                      <td className="font-mono text-xs font-semibold">{i.invoice_no}</td>
                      <td className="font-mono text-xs">{i.order_no}</td>
                      <td className="text-xs text-[#5C6670]">{fmt.date(i.created_at)}</td>
                      <td className="text-right tabular text-xs">{fmt.inr(i.subtotal)}</td>
                      <td className="text-right tabular text-xs text-[#5C6670]">{fmt.inr(i.gst)}</td>
                      <td className="text-right tabular font-semibold">{fmt.inr(i.total)}</td>
                      <td><StatusBadge status={i.status} /></td>
                      <td>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          i.payment_status === "paid"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}>
                          {i.payment_status || "unpaid"}
                        </span>
                      </td>
                      <td className="text-right">
                        {i.payment_status === "paid" ? (
                          <button
                            onClick={() => setSelectedReceiptOrder(i)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-[#E5E7EB] hover:bg-[#F8FAFC] text-xs font-semibold text-[#1D242B] transition-all"
                          >
                            <Printer size={13} weight="bold" /> Receipt
                          </button>
                        ) : (
                          <span className="text-xs text-[#9CA3AF]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <ReceiptModal
                isOpen={!!selectedReceiptOrder}
                onClose={() => setSelectedReceiptOrder(null)}
                order={selectedReceiptOrder}
              />
            </>
          )}
      </PageSection>
    </AppShell>
  );
}
