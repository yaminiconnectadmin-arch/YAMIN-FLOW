import React, { useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Printer } from "@phosphor-icons/react";
import { fmt } from "@/lib/api";

export default function ReceiptModal({ isOpen, onClose, order }) {
  const printAreaRef = useRef(null);

  if (!order) return null;

  const receipt = order.tally_receipt || {};
  const receiptNo = order.tally_receipt_no || receipt.receipt_no || "REC-PENDING";
  const receiptDate = receipt.date || order.updated_at || order.created_at;
  const amountPaid = receipt.amount || order.total;

  const handlePrint = () => {

    // Standard high-fidelity iframe-based print to prevent clobbering main DOM state
    const iframe = document.createElement("iframe");
    iframe.style.position = "absolute";
    iframe.style.width = "0px";
    iframe.style.height = "0px";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <html>
        <head>
          <title>Receipt - ${receiptNo}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              color: #1D242B;
              padding: 40px;
              line-height: 1.5;
            }
            .receipt-container {
              max-width: 600px;
              margin: 0 auto;
              border: 1px solid #E5E7EB;
              padding: 30px;
              border-radius: 8px;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #F28C18;
              padding-bottom: 20px;
              margin-bottom: 25px;
            }
            .logo-placeholder {
              font-size: 24px;
              font-weight: bold;
              color: #1D242B;
              letter-spacing: 1px;
            }
            .subtitle {
              font-size: 11px;
              text-transform: uppercase;
              color: #F28C18;
              font-weight: 600;
              letter-spacing: 2px;
              margin-top: 4px;
            }
            .title {
              font-size: 18px;
              font-weight: 700;
              margin-top: 15px;
              color: #111827;
            }
            .details-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
              margin-bottom: 30px;
            }
            .details-label {
              font-size: 11px;
              text-transform: uppercase;
              color: #5C6670;
              font-weight: 600;
              margin-bottom: 4px;
            }
            .details-val {
              font-size: 14px;
              font-weight: 500;
            }
            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 30px;
            }
            .items-table th {
              border-bottom: 1px solid #E5E7EB;
              text-align: left;
              padding: 8px 0;
              font-size: 11px;
              text-transform: uppercase;
              color: #5C6670;
            }
            .items-table td {
              border-bottom: 1px solid #F3F4F6;
              padding: 10px 0;
              font-size: 13px;
            }
            .text-right {
              text-align: right !important;
            }
            .summary-box {
              border-top: 2px double #E5E7EB;
              padding-top: 15px;
              margin-top: 20px;
            }
            .summary-row {
              display: flex;
              justify-content: space-between;
              font-size: 13px;
              margin-bottom: 6px;
            }
            .summary-row.total {
              font-size: 16px;
              font-weight: 700;
              color: #111827;
              margin-top: 10px;
              padding-top: 10px;
              border-top: 1px solid #E5E7EB;
            }
            .footer {
              text-align: center;
              font-size: 11px;
              color: #9CA3AF;
              margin-top: 40px;
              border-top: 1px dashed #E5E7EB;
              padding-top: 20px;
            }
            .badge-success {
              background-color: #DEF7EC;
              color: #03543F;
              padding: 4px 8px;
              border-radius: 9999px;
              font-size: 11px;
              font-weight: 600;
              display: inline-block;
            }
          </style>
        </head>
        <body>
          <div class="receipt-container">
            ${printContent}
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() {
                window.close();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    doc.close();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl bg-white p-6 rounded-lg shadow-xl border border-gray-200">
        <DialogHeader className="flex justify-between items-center border-b pb-3">
          <DialogTitle className="text-lg font-bold text-gray-900">Payment Receipt</DialogTitle>
        </DialogHeader>

        {/* Printable Area */}
        <div ref={printAreaRef} className="py-4 font-sans text-gray-800 leading-relaxed">
          {/* Header */}
          <div className="text-center border-b-2 border-[#F28C18] pb-4 mb-6">
            <div className="text-2xl font-bold tracking-wide text-gray-900">YAMINI FLOW</div>
            <div className="text-[10px] uppercase tracking-widest text-[#F28C18] font-bold">Distribution OS</div>
            <div className="text-base font-bold mt-4 text-gray-900">PAYMENT RECEIPT</div>
            <div className="mt-1.5">
              <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-semibold border border-emerald-200/50">
                Payment Success
              </span>
            </div>
          </div>

          {/* Details Info Grid */}
          <div className="grid grid-cols-2 gap-6 mb-6 text-sm">
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-gray-400 mb-0.5">Receipt Number</div>
              <div className="font-semibold font-mono text-gray-900">{receiptNo}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-gray-400 mb-0.5">Payment Date</div>
              <div className="font-semibold text-gray-900">{fmt.date(receiptDate)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-gray-400 mb-0.5">Received From</div>
              <div className="font-semibold text-gray-900">{order.dealer_name}</div>
              {order.dealer_code && <div className="text-xs text-gray-500 font-mono mt-0.5">Code: {order.dealer_code}</div>}
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-gray-400 mb-0.5">Linked Order No</div>
              <div className="font-semibold font-mono text-gray-900">{order.order_no}</div>
              <div className="text-xs text-gray-500 mt-0.5">Order Date: {fmt.date(order.created_at)}</div>
            </div>
          </div>

          {/* Items Table */}
          <table className="w-full text-left text-sm border-collapse mb-6">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="py-2 text-[10px] uppercase tracking-wider text-gray-400 font-bold">Product Item</th>
                <th className="py-2 text-[10px] uppercase tracking-wider text-gray-400 font-bold text-right">Quantity</th>
                <th className="py-2 text-[10px] uppercase tracking-wider text-gray-400 font-bold text-right">Rate</th>
                <th className="py-2 text-[10px] uppercase tracking-wider text-gray-400 font-bold text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {order.items?.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-100">
                  <td className="py-2.5 font-medium text-gray-900">
                    {item.product_name}
                    {item.size && <span className="text-xs text-gray-500 ml-2">({item.size})</span>}
                  </td>
                  <td className="py-2.5 text-right font-mono text-gray-600">{item.boxes || 1} Box ({fmt.num(item.quantity)} pcs)</td>
                  <td className="py-2.5 text-right font-mono text-gray-600">{fmt.inr(item.price || item.rate)}</td>
                  <td className="py-2.5 text-right font-semibold text-gray-900">{fmt.inr(item.subtotal || item.value_before_tax)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Summary Box */}
          <div className="border-t border-gray-200 pt-4 text-sm max-w-xs ml-auto">
            <div className="flex justify-between py-1 text-gray-500">
              <span>Subtotal:</span>
              <span className="font-mono">{fmt.inr(order.subtotal)}</span>
            </div>
            <div className="flex justify-between py-1 text-gray-500">
              <span>GST (18%):</span>
              <span className="font-mono">{fmt.inr(order.gst)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-gray-200 font-bold text-gray-900 text-base">
              <span>Total Received:</span>
              <span className="font-mono text-[#F28C18]">{fmt.inr(amountPaid)}</span>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center font-mono text-[10px] text-gray-400 mt-10 border-t border-dashed pt-4">
            This is a computer-generated payment receipt synced live from Tally ERP. 
            <br />
            No physical signature is required.
          </div>
        </div>

        <DialogFooter className="flex justify-end gap-2 border-t pt-3">
          <button onClick={onClose} className="h-9 px-4 rounded-md border border-gray-200 text-sm font-semibold hover:bg-gray-50">
            Close
          </button>
          <button onClick={handlePrint} className="inline-flex items-center gap-2 h-9 px-4 rounded-md gradient-brand-accent text-white text-sm font-semibold shadow-sm">
            <Printer size={15} weight="bold" /> Print / Save PDF
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
