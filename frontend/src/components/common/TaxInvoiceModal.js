import React, { useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Printer } from "@phosphor-icons/react";
import { fmt } from "@/lib/api";

function numberToWords(num) {
  if (!num || isNaN(num)) return "Zero Rupees Only";
  const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function inWords(n) {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + a[n % 10] : "");
    if (n < 1000) return a[Math.floor(n / 100)] + " Hundred" + (n % 100 !== 0 ? " and " + inWords(n % 100) : "");
    if (n < 100000) return inWords(Math.floor(n / 1000)) + " Thousand" + (n % 1000 !== 0 ? " " + inWords(n % 1000) : "");
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + " Lakh" + (n % 100000 !== 0 ? " " + inWords(n % 100000) : "");
    return inWords(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 !== 0 ? " " + inWords(n % 10000000) : "");
  }

  const integerPart = Math.floor(num);
  const words = inWords(integerPart);
  return `Rupees ${words} Only`;
}

export default function TaxInvoiceModal({ isOpen, onClose, order }) {
  const printAreaRef = useRef(null);

  if (!order) return null;

  const invoiceNo = order.invoice_no || order.tally_voucher_no || `INV-${(order.order_no || "").replace("ORD-", "")}`;
  const invoiceDate = order.created_at ? fmt.date(order.created_at) : new Date().toLocaleDateString("en-IN");
  const isInterstate = (order.dealer_state || "").toLowerCase().trim() !== "maharashtra" && (order.dealer_state || "").trim() !== "";
  
  const subtotal = order.subtotal || 0;
  const gstTotal = order.gst || (subtotal * 0.18);
  const grandTotal = order.total || (subtotal + gstTotal);
  const totalWeight = order.items?.reduce((s, i) => s + (i.total_weight_kg || 0), 0) || order.total_weight_kg || 0;
  const totalBoxes = order.items?.reduce((s, i) => s + (i.boxes || Math.ceil((i.quantity || 1000) / (i.qty_per_box || 1000))), 0) || 0;

  const handlePrint = () => {
    const printContent = printAreaRef.current ? printAreaRef.current.innerHTML : "";
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
          <title>Tax Invoice - ${invoiceNo}</title>
          <style>
            @page { size: A4; margin: 12mm; }
            * { box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              color: #0F172A;
              padding: 0;
              margin: 0;
              font-size: 11px;
              line-height: 1.4;
            }
            .invoice-box {
              max-width: 800px;
              margin: 0 auto;
              border: 1.5px solid #0F172A;
              padding: 16px;
            }
            .header-table {
              width: 100%;
              border-bottom: 2px solid #0F172A;
              padding-bottom: 12px;
              margin-bottom: 12px;
            }
            .title-badge {
              font-size: 16px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 1px;
              color: #0F172A;
            }
            .company-name {
              font-size: 18px;
              font-weight: 900;
              color: #D97706;
              letter-spacing: 0.5px;
            }
            .grid-party {
              display: table;
              width: 100%;
              border: 1px solid #CBD5E1;
              margin-bottom: 12px;
            }
            .grid-party-col {
              display: table-cell;
              width: 50%;
              padding: 8px 10px;
              vertical-align: top;
            }
            .grid-party-col:first-child {
              border-right: 1px solid #CBD5E1;
            }
            .party-header {
              font-size: 10px;
              font-weight: 700;
              text-transform: uppercase;
              color: #64748B;
              margin-bottom: 4px;
            }
            .party-title {
              font-size: 13px;
              font-weight: 700;
              color: #0F172A;
            }
            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 12px;
            }
            .items-table th {
              background: #F1F5F9;
              border: 1px solid #94A3B8;
              padding: 6px 4px;
              font-size: 9.5px;
              font-weight: 700;
              text-transform: uppercase;
              text-align: left;
            }
            .items-table td {
              border: 1px solid #CBD5E1;
              padding: 6px 4px;
              font-size: 10px;
            }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .font-mono { font-family: monospace; }
            .font-bold { font-weight: bold; }
            .totals-table {
              width: 100%;
              border-collapse: collapse;
            }
            .totals-table td {
              padding: 4px 8px;
              font-size: 10px;
            }
            .footer-sign {
              margin-top: 20px;
              display: table;
              width: 100%;
              border-top: 1px dashed #CBD5E1;
              padding-top: 12px;
            }
            .footer-sign-col {
              display: table-cell;
              width: 50%;
              vertical-align: bottom;
            }
            .seal-box {
              text-align: right;
              font-size: 10px;
              color: #475569;
            }
            .stamp {
              display: inline-block;
              border: 2px solid #0284C7;
              color: #0284C7;
              padding: 4px 8px;
              font-weight: bold;
              border-radius: 4px;
              text-transform: uppercase;
              font-size: 10px;
              margin-bottom: 8px;
            }
          </style>
        </head>
        <body>
          <div class="invoice-box">
            ${printContent}
          </div>
        </body>
      </html>
    `);
    doc.close();
    iframe.contentWindow.focus();
    setTimeout(() => {
      iframe.contentWindow.print();
      document.body.removeChild(iframe);
    }, 400);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-6 bg-white border border-slate-200">
        <DialogHeader className="flex flex-row items-center justify-between border-b pb-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-amber-500 text-white flex items-center justify-center font-black">
              YF
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900">
                GST Tax Invoice — {invoiceNo}
              </DialogTitle>
              <div className="text-xs text-slate-500 font-mono">
                Order #{order.order_no} • {order.dealer_name}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition-all"
            >
              <Printer size={15} weight="bold" /> Print / Download PDF
            </button>
          </div>
        </DialogHeader>

        {/* Printable Area */}
        <div ref={printAreaRef} className="space-y-4 text-slate-900 p-2">
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-3">
            <div>
              <div className="text-xl font-black tracking-tight text-amber-600">YAMINI FLOW</div>
              <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">Fastener Distribution Network (ERP)</div>
              <div className="text-[11px] text-slate-600 mt-1 max-w-sm">
                Yamini Connect HQ & Distribution Center, Bhiwandi Industrial Hub, Maharashtra, PIN: 421302<br />
                <strong>GSTIN:</strong> 27AABCY1234F1Z5 • <strong>State:</strong> Maharashtra (27)<br />
                <strong>Email:</strong> billing@yaminiconnect.com • <strong>Tally Sync:</strong> Active
              </div>
            </div>
            <div className="text-right">
              <div className="inline-block bg-slate-900 text-white font-extrabold text-sm px-3 py-1 rounded uppercase tracking-wider">
                TAX INVOICE
              </div>
              <div className="mt-2 text-xs">
                <div><span className="text-slate-500">Invoice No:</span> <strong className="font-mono text-slate-900">{invoiceNo}</strong></div>
                <div><span className="text-slate-500">Invoice Date:</span> <strong>{invoiceDate}</strong></div>
                <div><span className="text-slate-500">Order Ref:</span> <span className="font-mono">{order.order_no}</span></div>
                <div><span className="text-slate-500">Payment Terms:</span> 30 Days Credit</div>
              </div>
            </div>
          </div>

          {/* Billed To & Shipped To Grid */}
          <div className="grid grid-cols-2 gap-4 border border-slate-200 rounded p-3 bg-slate-50 text-xs">
            <div>
              <div className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Billed To (Party Details)</div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">{order.dealer_name || "Direct Distributor"}</div>
              <div className="font-mono text-[11px] font-semibold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded w-max mt-1">
                Party Code: {order.dealer_code || "D-ASSIGNED"}
              </div>
              <div className="mt-1 text-slate-600">
                <strong>State:</strong> {order.dealer_state || "Maharashtra"} {isInterstate ? "(Inter-State IGST)" : "(Intra-State CGST+SGST)"}<br />
                <strong>GSTIN:</strong> {order.dealer_gstin || "27XXXXX0000X1Z1"}<br />
                <strong>Network Tag:</strong> {order.cnf_name || "Direct (Yamini Flow HQ)"} ({order.cnf_code || "DIRECT"})
              </div>
            </div>
            <div className="border-l pl-4 border-slate-200">
              <div className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Dispatch / Warehouse Hub</div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">
                {order.warehouse_name ? `${order.warehouse_name}${order.warehouse_code ? ` (${order.warehouse_code})` : ''}` : (order.warehouse_code || "Main Warehouse")}
              </div>
              <div className="mt-1 text-slate-600">
                <strong>Order Type:</strong> {order.order_type === "cnf_stock" ? "CNF Depot Stock Replenishment" : "Distributor Commercial Order"}<br />
                <strong>Allocation Status:</strong> <span className="font-semibold uppercase text-emerald-700">{order.reservation_status || "Reserved"}</span><br />
                <strong>Total Packaging:</strong> {totalBoxes} Boxes ({totalWeight.toFixed(3)} KG Total)
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="border border-slate-200 rounded overflow-hidden">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-700">
                  <th className="p-2 text-center w-8">#</th>
                  <th className="p-2">Product Description / Fastener Size</th>
                  <th className="p-2 text-center">HSN</th>
                  <th className="p-2 text-right">Boxes</th>
                  <th className="p-2 text-right">Total Pcs</th>
                  <th className="p-2 text-right">Weight (KG)</th>
                  <th className="p-2 text-right">Rate / Box</th>
                  <th className="p-2 text-right">Taxable (₹)</th>
                  <th className="p-2 text-right">GST (18%)</th>
                  <th className="p-2 text-right">Total (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {order.items?.map((item, idx) => {
                  const boxes = item.boxes || Math.ceil((item.quantity || 1000) / (item.qty_per_box || 1000));
                  const pcs = item.quantity || (boxes * (item.qty_per_box || 1000));
                  const wt = item.total_weight_kg || 0;
                  const rate = item.rate || item.dealer_landing || (item.value_before_tax ? (item.value_before_tax / boxes) : 0);
                  const taxable = item.value_before_tax || (rate * boxes);
                  const gst = item.gst_amount || (taxable * 0.18);
                  const total = item.value_after_tax || (taxable + gst);

                  return (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-2 text-center font-mono text-slate-400">{idx + 1}</td>
                      <td className="p-2">
                        <div className="font-semibold text-slate-900">{item.product_name}</div>
                        <div className="font-mono text-[10px] text-slate-500">Size: {item.size || item.sku}</div>
                      </td>
                      <td className="p-2 text-center font-mono text-[11px] text-slate-600">73181500</td>
                      <td className="p-2 text-right font-mono font-semibold">{boxes} Box</td>
                      <td className="p-2 text-right font-mono text-slate-600">{pcs.toLocaleString()} pcs</td>
                      <td className="p-2 text-right font-mono font-bold text-amber-700">{wt > 0 ? `${wt.toFixed(3)} kg` : "—"}</td>
                      <td className="p-2 text-right font-mono">{fmt.inr(rate)}</td>
                      <td className="p-2 text-right font-mono font-semibold">{fmt.inr(taxable)}</td>
                      <td className="p-2 text-right font-mono text-sky-700">{fmt.inr(gst)}</td>
                      <td className="p-2 text-right font-mono font-bold text-emerald-700">{fmt.inr(total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Tax Breakdown & Totals */}
          <div className="grid grid-cols-2 gap-4">
            <div className="border border-slate-200 rounded p-3 text-xs bg-slate-50 flex flex-col justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-1">GST Tax Breakdown</div>
                {isInterstate ? (
                  <div className="flex justify-between py-1 border-b border-slate-200 text-slate-700">
                    <span>Integrated GST (IGST @ 18%):</span>
                    <strong className="font-mono">{fmt.inr(gstTotal)}</strong>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between py-1 border-b border-slate-200 text-slate-700">
                      <span>Central GST (CGST @ 9%):</span>
                      <strong className="font-mono">{fmt.inr(gstTotal / 2)}</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200 text-slate-700">
                      <span>State GST (SGST @ 9%):</span>
                      <strong className="font-mono">{fmt.inr(gstTotal / 2)}</strong>
                    </div>
                  </>
                )}
                <div className="mt-2 text-[11px] text-slate-500 italic">
                  Amount in Words:<br />
                  <strong className="text-slate-800 not-italic font-sans">{numberToWords(grandTotal)}</strong>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-200 text-[10px] text-slate-500">
                <strong>Bank:</strong> HDFC Bank Ltd • <strong>A/C:</strong> 50200012345678 • <strong>IFSC:</strong> HDFC0001234
              </div>
            </div>

            <div className="border border-slate-200 rounded p-3 text-xs space-y-1.5 bg-slate-50">
              <div className="flex justify-between text-slate-600">
                <span>Total Consignment Weight:</span>
                <strong className="font-mono text-amber-700">{totalWeight.toFixed(3)} KG</strong>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Total Taxable Value:</span>
                <strong className="font-mono">{fmt.inr(subtotal)}</strong>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Total GST (18%):</span>
                <strong className="font-mono text-sky-700">{fmt.inr(gstTotal)}</strong>
              </div>
              <div className="flex justify-between items-center pt-2 border-t-2 border-slate-900 text-slate-900 text-sm font-black">
                <span>Net Invoice Total:</span>
                <span className="font-mono text-emerald-700 text-base">{fmt.inr(grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Footer Signature */}
          <div className="flex justify-between items-end pt-4 border-t border-slate-200 text-xs">
            <div className="text-[10px] text-slate-500 max-w-sm">
              <strong>Declaration:</strong> We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct. Electronic ERP & Tally synced document.
            </div>
            <div className="text-right">
              <div className="border-2 border-sky-600 text-sky-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase inline-block mb-2">
                ✓ Tally ERP Verified
              </div>
              <div className="font-bold text-slate-900">For YAMINI FLOW (Yamini Connect)</div>
              <div className="text-[10px] text-slate-500 mt-4">Authorized Signatory</div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
