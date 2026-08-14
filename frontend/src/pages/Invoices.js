import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";
import { PageSection, StatusBadge, EmptyState } from "@/components/common/Common";
import { toast } from "@/components/ui/sonner";
import { Printer, FileText } from "@phosphor-icons/react";
import ReceiptModal from "@/components/common/ReceiptModal";
import TaxInvoiceModal from "@/components/common/TaxInvoiceModal";

export default function InvoicesPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReceiptOrder, setSelectedReceiptOrder] = useState(null);
  const [selectedTaxInvoiceOrder, setSelectedTaxInvoiceOrder] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/invoices");
        setItems(data);
      } catch { 
        toast.error("Failed to load invoices"); 
      } finally { 
        setLoading(false); 
      }
    })();
  }, []);

  return (
    <AppShell title="GST Tax Invoices" subtitle={`${items.length} official tax invoices synced from Tally ERP & approved orders`}>
      <PageSection title="Tax Invoice Register">
        {loading ? <div className="p-8 text-center text-sm text-[#5C6670]">Loading invoices…</div>
          : items.length === 0 ? <EmptyState title="No invoices available" description="Approved and processed orders automatically generate Tally-synced GST Tax Invoices here." />
          : (
            <>
              <div className="overflow-x-auto">
                <table className="yf-table w-full">
                  <thead>
                    <tr>
                      <th>Invoice No</th>
                      <th>Order No</th>
                      <th>Party & Code</th>
                      <th>Network Tag</th>
                      <th>Date</th>
                      <th className="text-right">Taxable Value</th>
                      <th className="text-right">GST (18%)</th>
                      <th className="text-right">Invoice Total</th>
                      <th>Fulfillment</th>
                      <th>Payment</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((i) => {
                      const isCnf = i.order_type === "cnf_stock" || (i.dealer_code && i.dealer_code.startsWith("C-"));
                      const cCode = i.cnf_code || i.mnp_code;

                      return (
                        <tr key={i.id} data-testid={`invoice-${i.invoice_no}`}>
                          <td className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded w-max">
                            {i.invoice_no}
                          </td>
                          <td className="font-mono text-xs text-slate-600">{i.order_no}</td>
                          <td className="font-medium text-[#06182F]">
                            <div>{i.dealer_name}</div>
                            <div className="font-mono text-[10px] text-amber-800 bg-amber-100 px-1 rounded w-max mt-0.5">
                              {i.dealer_code || (isCnf ? "C-DEPOT" : "D-ASSIGNED")}
                            </div>
                          </td>
                          <td>
                            {cCode && cCode !== "DIRECT" ? (
                              <span className="bg-[#BAE6FD] text-[#0369A1] px-1.5 py-0.5 rounded font-mono font-bold text-[11px]">
                                {cCode}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">Direct HQ</span>
                            )}
                          </td>
                          <td className="text-xs text-[#5C6670]">{fmt.date(i.created_at)}</td>
                          <td className="text-right tabular text-xs font-mono">{fmt.inr(i.subtotal)}</td>
                          <td className="text-right tabular text-xs text-sky-700 font-mono">{fmt.inr(i.gst)}</td>
                          <td className="text-right tabular font-bold font-mono text-emerald-700">{fmt.inr(i.total)}</td>
                          <td><StatusBadge status={i.status} /></td>
                          <td>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              i.payment_status === "paid"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}>
                              {i.payment_status || "unpaid"}
                            </span>
                          </td>
                          <td className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setSelectedTaxInvoiceOrder(i)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold border border-amber-300 transition-all shadow-sm"
                                title="Download & Print Tax Invoice"
                              >
                                <FileText size={14} weight="bold" /> Tax Invoice
                              </button>
                              {i.payment_status === "paid" && (
                                <button
                                  onClick={() => setSelectedReceiptOrder(i)}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[#E5E7EB] hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-all"
                                  title="Payment Receipt"
                                >
                                  <Printer size={13} weight="bold" /> Receipt
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Tax Invoice Modal */}
              <TaxInvoiceModal
                isOpen={!!selectedTaxInvoiceOrder}
                onClose={() => setSelectedTaxInvoiceOrder(null)}
                order={selectedTaxInvoiceOrder}
              />

              {/* Payment Receipt Modal */}
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
