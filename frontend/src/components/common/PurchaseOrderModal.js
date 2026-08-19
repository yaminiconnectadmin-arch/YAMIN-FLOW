import React, { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Printer, WhatsappLogo, Copy, Check, FileText } from "@phosphor-icons/react";
import { fmt } from "@/lib/api";
import { toast } from "@/components/ui/sonner";

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

export default function PurchaseOrderModal({ isOpen, onClose, po }) {
  const printAreaRef = useRef(null);
  const [copied, setCopied] = useState(false);

  if (!po) return null;

  const poNo = po.po_no || `PO-${Date.now().toString().slice(-6)}`;
  const poDate = po.created_at ? fmt.date(po.created_at) : new Date().toLocaleDateString("en-IN");
  
  const subtotal = po.subtotal || po.items?.reduce((s, i) => s + (i.amount || (i.quantity * i.rate) || 0), 0) || 0;
  const gstTotal = po.gst || (subtotal * 0.18);
  const grandTotal = po.total || (subtotal + gstTotal);
  const totalWeightKg = po.total_weight_kg || po.items?.reduce((s, i) => s + (i.quantity_kg || i.recommended_weight_kg || 0), 0) || 0;
  const totalPieces = po.total_pieces || po.items?.reduce((s, i) => s + (i.quantity || i.demanded_pcs || i.recommended_pcs || 0), 0) || 0;

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
          <title>Purchase Order - ${poNo}</title>
          <style>
            @page { size: A4; margin: 10mm; }
            * { box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              color: #0F172A;
              padding: 0;
              margin: 0;
              font-size: 11px;
              line-height: 1.4;
            }
            .po-box {
              max-width: 800px;
              margin: 0 auto;
              border: 1.5px solid #0F172A;
              padding: 16px;
            }
            .header-table {
              width: 100%;
              border-bottom: 2px solid #0F172A;
              padding-bottom: 10px;
              margin-bottom: 12px;
            }
            .title-badge {
              font-size: 15px;
              font-weight: 900;
              letter-spacing: 1px;
              text-transform: uppercase;
              color: #1E3A8A;
            }
            table.items {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
              margin-bottom: 12px;
            }
            table.items th, table.items td {
              border: 1px solid #CBD5E1;
              padding: 5px 8px;
              font-size: 10.5px;
            }
            table.items th {
              background-color: #F1F5F9;
              font-weight: bold;
              text-align: left;
              text-transform: uppercase;
              font-size: 10px;
              letter-spacing: 0.5px;
            }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
            .font-bold { font-weight: bold; }
            .bg-accent { background-color: #FEF3C7; }
            .bg-blue { background-color: #EFF6FF; }
          </style>
        </head>
        <body>
          <div class="po-box">
            ${printContent}
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(() => { window.frameElement.remove(); }, 1000);
            }
          </script>
        </body>
      </html>
    `);
    doc.close();
  };

  const handleCopyMessage = () => {
    if (po.whatsapp_message) {
      navigator.clipboard.writeText(po.whatsapp_message);
      setCopied(true);
      toast.success("Purchase order text copied to clipboard!");
      setTimeout(() => setCopied(false), 2500);
    } else {
      toast.error("No WhatsApp message available");
    }
  };

  const handleOpenWhatsApp = () => {
    if (po.whatsapp_url) {
      window.open(po.whatsapp_url, "_blank", "noopener,noreferrer");
    } else {
      toast.error("Supplier phone number not available for direct WhatsApp link");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-4 sm:p-6 overflow-hidden">
        <DialogHeader className="flex flex-row items-center justify-between border-b pb-3 space-y-0">
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
            <FileText size={20} className="text-indigo-600" />
            Purchase Order: <span className="font-mono text-indigo-700 font-bold">{poNo}</span>
          </DialogTitle>
          <div className="flex items-center gap-2">
            {po.whatsapp_message && (
              <button
                onClick={handleCopyMessage}
                className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs flex items-center gap-1.5 transition-colors border"
                title="Copy formatted WhatsApp message"
              >
                {copied ? <Check size={14} className="text-emerald-600 font-bold" /> : <Copy size={14} />}
                {copied ? "Copied!" : "Copy WA Text"}
              </button>
            )}
            {po.whatsapp_url && (
              <button
                onClick={handleOpenWhatsApp}
                className="px-3.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                title="Open WhatsApp chat with supplier"
              >
                <WhatsappLogo size={16} weight="fill" />
                Send via WhatsApp
              </button>
            )}
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Printer size={16} weight="bold" />
              Print / Save PDF
            </button>
          </div>
        </DialogHeader>

        {/* Printable Purchase Order Body */}
        <div className="overflow-y-auto flex-1 p-2">
          <div ref={printAreaRef} className="bg-white text-slate-900 font-sans text-xs border border-slate-300 rounded-lg p-5 shadow-sm space-y-4">
            
            {/* Header / Company Banner */}
            <div className="border-b-2 border-slate-900 pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-lg font-black tracking-tight text-slate-950 flex items-center gap-1.5">
                    <span className="text-amber-600">⚡</span> YAMINI FLOW FASTENERS & FIXINGS
                  </div>
                  <div className="text-[11px] text-slate-600 font-medium mt-0.5">
                    Premium Industrial Screws, CSK Chipboard, Drywall Fasteners & Hardware
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1 space-y-0.5">
                    <div>HQ: Sector 18, Industrial Logistics Hub, Bhiwandi, Thane, MH - 421302</div>
                    <div>GSTIN: <strong>27AAACY1029F1Z4</strong> • Email: procurement@yaminiflow.com • Tel: +91 22 4982 9100</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="inline-block bg-indigo-50 border border-indigo-200 text-indigo-950 px-3 py-1 rounded font-black text-sm tracking-wider uppercase">
                    OFFICIAL PURCHASE ORDER
                  </div>
                  <div className="mt-2 text-right text-xs">
                    <div>PO No: <strong className="font-mono text-slate-900 text-sm">{poNo}</strong></div>
                    <div>Date: <strong className="text-slate-800">{poDate}</strong></div>
                    {po.status && (
                      <div className="mt-1">
                        Status: <span className="uppercase font-bold text-[10px] bg-slate-100 px-2 py-0.5 rounded border">{po.status}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Supplier & Delivery Destination Information Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg">
                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">
                  SUPPLIER DETAILS (VENDOR):
                </div>
                <div className="font-bold text-sm text-slate-900">{po.supplier_company || po.supplier_name || "Assigned Supplier"}</div>
                <div className="text-slate-600 mt-1 space-y-0.5 text-[11px]">
                  {po.supplier_name && po.supplier_company !== po.supplier_name && (
                    <div>Contact Person: <strong>{po.supplier_name}</strong></div>
                  )}
                  {po.supplier_phone && (
                    <div>Phone / WhatsApp: <strong className="font-mono text-emerald-800 font-bold">{po.supplier_phone}</strong></div>
                  )}
                  {po.supplier_email && <div>Email: {po.supplier_email}</div>}
                  {po.supplier_gstin && <div>GSTIN: <strong className="font-mono">{po.supplier_gstin}</strong></div>}
                  {(po.supplier_city || po.supplier_state) && (
                    <div>Location: {[po.supplier_city, po.supplier_state].filter(Boolean).join(", ")}</div>
                  )}
                </div>
              </div>

              <div className="bg-indigo-50/50 border border-indigo-200 p-3 rounded-lg">
                <div className="text-[10px] uppercase font-bold text-indigo-800 tracking-wider mb-1">
                  DELIVERY / FULFILLMENT DESTINATION:
                </div>
                <div className="font-bold text-sm text-indigo-950">{po.warehouse_name || "Central Fulfillment Hub (WH-MAIN)"}</div>
                <div className="text-slate-600 mt-1 space-y-0.5 text-[11px]">
                  <div>Address: {po.warehouse_address || "Plot 42, Logistics Gateway, Bhiwandi, Maharashtra - 421302"}</div>
                  <div>Delivery Window: <strong>{po.expected_delivery || "Standard 5–7 Working Days"}</strong></div>
                  <div>Notes: {po.notes || "Auto-collated from dealer order backlog"}</div>
                </div>
              </div>
            </div>

            {/* Collated Items & Weight Conversion Table */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <div className="font-bold text-xs text-slate-800 uppercase tracking-wide">
                  Collated Items & Piece-To-Weight Conversion:
                </div>
                <div className="text-[11px] font-mono text-slate-500">
                  Total Items: <strong>{po.items?.length || 0}</strong>
                </div>
              </div>

              <div className="border border-slate-300 rounded-md overflow-hidden">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="p-2 w-8 text-center">#</th>
                      <th className="p-2">Item SKU</th>
                      <th className="p-2">Description & Size</th>
                      <th className="p-2 text-right">Quantity (Pcs)</th>
                      <th className="p-2 text-right">WT / 1000 Pcs</th>
                      <th className="p-2 text-right bg-amber-50/80 font-extrabold text-amber-900">Converted WT (KG)</th>
                      <th className="p-2 text-right">Rate (₹)</th>
                      <th className="p-2 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {po.items?.map((it, idx) => {
                      const pcs = it.quantity || it.demanded_pcs || it.recommended_pcs || 0;
                      const wt1000 = it.wt_1000_pcs_kg || it.weight_per_1000_pcs || 1.0;
                      const kg = it.quantity_kg || it.recommended_weight_kg || roundTo((pcs / 1000) * wt1000, 2);
                      const rate = it.rate || 0;
                      const amt = it.amount || (pcs * rate);

                      return (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2 text-center text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                          <td className="p-2 font-mono font-bold text-slate-800">{it.sku}</td>
                          <td className="p-2">
                            <span className="font-semibold text-slate-900">{it.product_name || `${it.category} ${it.size}`}</span>
                            {it.size && <span className="font-mono text-slate-500 ml-1">({it.size})</span>}
                          </td>
                          <td className="p-2 text-right font-mono font-semibold">{fmt.num(pcs)}</td>
                          <td className="p-2 text-right font-mono text-slate-600">{Number(wt1000).toFixed(3)} kg</td>
                          <td className="p-2 text-right font-mono font-black text-amber-800 bg-amber-50/50">
                            {Number(kg).toFixed(2)} KG
                          </td>
                          <td className="p-2 text-right font-mono">{fmt.inr(rate)}</td>
                          <td className="p-2 text-right font-mono font-bold text-slate-900">{fmt.inr(amt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals & Summary Box */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg space-y-1.5">
                <div className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">COLLATED CONSIGNMENT SUMMARY:</div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600">Total Demanded Quantity:</span>
                  <span className="font-mono font-bold text-slate-900">{fmt.num(totalPieces)} Pcs</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600">Total Converted Weight:</span>
                  <span className="font-mono font-extrabold text-amber-700 bg-amber-100 px-2 py-0.5 rounded border border-amber-200">
                    {Number(totalWeightKg).toFixed(2)} KG
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-200">
                  Amount in words: <strong className="text-slate-800">{numberToWords(grandTotal)}</strong>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg space-y-1 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Subtotal (Basic Value):</span>
                  <span className="font-mono font-semibold">{fmt.inr(subtotal)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">GST (18% Integrated/State):</span>
                  <span className="font-mono font-semibold text-blue-600">{fmt.inr(gstTotal)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-300 font-bold text-sm text-slate-950">
                  <span>Grand Total (Payable):</span>
                  <span className="font-mono font-black text-emerald-700">{fmt.inr(grandTotal)}</span>
                </div>
              </div>
            </div>

            {/* Terms & Authorization Stamp Block */}
            <div className="pt-3 border-t border-slate-200 grid grid-cols-2 gap-4 text-[10px] text-slate-500">
              <div>
                <div className="font-bold text-slate-700 mb-0.5">TERMS & INSTRUCTIONS:</div>
                <ol className="list-decimal list-inside space-y-0.5">
                  <li>Goods must conform strictly to specified dimensions & weights.</li>
                  <li>Dispatch must be accompanied by valid e-Way Bill & Tax Invoice.</li>
                  <li>Notify tracking number and LR docket immediately upon dispatch.</li>
                </ol>
              </div>
              <div className="text-right flex flex-col justify-end items-end">
                <div className="w-40 border-b border-slate-400 pb-8 text-center text-slate-400 italic">
                  Authorized Signatory
                </div>
                <div className="font-bold text-slate-800 text-[11px] mt-1">For Yamini Flow Procurement Hub</div>
              </div>
            </div>

          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function roundTo(num, decimals) {
  return Number(Math.round(num + "e" + decimals) + "e-" + decimals);
}
