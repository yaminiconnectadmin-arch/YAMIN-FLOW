import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";
import { PageSection, StatusBadge, EmptyState } from "@/components/common/Common";
import { toast } from "@/components/ui/sonner";


export default function InvoicesPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/invoices");
        setItems(data);
      } catch { toast.error("Failed"); }
      finally { setLoading(false); }
    })();
  }, []);

  return (
    <AppShell title="Invoices" subtitle={`${items.length} invoices generated for your account`}>
      <PageSection title="Invoice Register">
        {loading ? <div className="p-8 text-center text-sm text-[#5C6670]">Loading…</div>
          : items.length === 0 ? <EmptyState title="No invoices yet" />
          : (
            <table className="yf-table w-full">
              <thead>
                <tr><th>Invoice No</th><th>Order No</th><th>Date</th><th className="text-right">Subtotal</th><th className="text-right">GST</th><th className="text-right">Total</th><th>Status</th></tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} data-testid={`invoice-${i.invoice_no}`}>
                    <td className="font-mono text-xs font-semibold">{i.invoice_no}</td>
                    <td className="font-mono text-xs">{i.order_no}</td>
                    <td className="text-xs text-[#5C6670]">{fmt.date(i.created_at)}</td>
                    <td className="text-right tabular">{fmt.inr(i.subtotal)}</td>
                    <td className="text-right tabular text-[#5C6670]">{fmt.inr(i.gst)}</td>
                    <td className="text-right tabular font-semibold">{fmt.inr(i.total)}</td>
                    <td><StatusBadge status={i.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </PageSection>
    </AppShell>
  );
}
