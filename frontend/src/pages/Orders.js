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
import { Eye, Plus, ShoppingCart, Stack, Scales, CheckCircle } from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";

const STATUS_OPTIONS = ["pending", "approved", "reserved", "shipped", "delivered", "cancelled"];

export default function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Fastener Order Placement Modal State
  const [newOrderModalOpen, setNewOrderModalOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [cat, setCat] = useState("CSK Drywall Screws");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [boxCount, setBoxCount] = useState(10);
  const [cart, setCart] = useState({});
  const [placing, setPlacing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/orders", { params: { status } });
      setOrders(data);
    } catch { toast.error("Failed to load orders"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [status]);

  // Load products for the order modal when opened
  useEffect(() => {
    if (newOrderModalOpen) {
      (async () => {
        try {
          const { data } = await api.get("/products", { params: { category: cat === "All" ? "" : cat, status: "active" } });
          setProducts(data);
          if (data.length > 0) setSelectedProductId(data[0].id);
        } catch {
          toast.error("Failed to load catalog for ordering");
        }
      })();
    }
  }, [newOrderModalOpen, cat]);

  const updateStatus = async (o, newStatus) => {
    try {
      await api.patch(`/orders/${o.id}/status`, { status: newStatus });
      toast.success(`Order ${o.order_no} → ${newStatus}`);
      load();
      if (selected?.id === o.id) setSelected({ ...selected, status: newStatus });
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  const selectedProduct = products.find((p) => p.id === selectedProductId) || products[0];
  const qtyPerBox = selectedProduct?.qty_per_box || selectedProduct?.moq || 1000;
  const totalPcs = (boxCount || 0) * qtyPerBox;
  const wtPer1000 = selectedProduct?.wt_1000_pcs_kg || (selectedProduct?.weight_kg ? selectedProduct.weight_kg * 1000 : 1.0);
  const totalWeightKg = Number(((totalPcs / 1000.0) * wtPer1000).toFixed(3));

  const ratePerBox = selectedProduct?.dealer_landing ? selectedProduct.dealer_landing : (selectedProduct?.price || 0);
  const valueBeforeTax = Number(((boxCount || 0) * ratePerBox).toFixed(2));
  const gstAmount = Number((valueBeforeTax * 0.18).toFixed(2));
  const valueAfterTax = Number((valueBeforeTax + gstAmount).toFixed(2));

  const addConfiguredToCart = () => {
    if (!selectedProduct) return;
    if (boxCount <= 0) return toast.error("Please enter a valid box quantity");

    setCart((c) => {
      const existing = c[selectedProduct.id] || {};
      const newBoxes = (existing.boxes || 0) + boxCount;
      const newTotalPcs = newBoxes * qtyPerBox;
      const newTotalWeight = Number(((newTotalPcs / 1000.0) * wtPer1000).toFixed(3));
      const newValBeforeTax = Number((newBoxes * ratePerBox).toFixed(2));
      const newGst = Number((newValBeforeTax * 0.18).toFixed(2));
      const newValAfterTax = Number((newValBeforeTax + newGst).toFixed(2));

      return {
        ...c,
        [selectedProduct.id]: {
          product: selectedProduct,
          boxes: newBoxes,
          qty: newTotalPcs,
          qty_per_box: qtyPerBox,
          size: selectedProduct.size || selectedProduct.sku,
          wt_1000_pcs_kg: wtPer1000,
          total_weight_kg: newTotalWeight,
          rate: ratePerBox,
          dealer_landing: selectedProduct.dealer_landing || selectedProduct.cost || 0,
          value_before_tax: newValBeforeTax,
          gst_amount: newGst,
          value_after_tax: newValAfterTax,
        }
      };
    });
    toast.success(`Added ${boxCount} Boxes (${totalWeightKg} KG) to order cart`);
  };

  const removeCartItem = (id) => {
    setCart((c) => {
      const nc = { ...c };
      delete nc[id];
      return nc;
    });
  };

  const cartItems = Object.values(cart);
  const cartSubtotal = Number(cartItems.reduce((s, i) => s + i.value_before_tax, 0).toFixed(2));
  const cartGst = Number((cartSubtotal * 0.18).toFixed(2));
  const cartTotal = Number((cartSubtotal + cartGst).toFixed(2));
  const cartTotalWeight = Number(cartItems.reduce((s, i) => s + i.total_weight_kg, 0).toFixed(3));

  const placeOrder = async () => {
    if (cartItems.length === 0) return toast.error("Please add at least one fastener configuration to cart");
    setPlacing(true);
    try {
      const payload = {
        items: cartItems.map((i) => ({
          product_id: i.product.id,
          quantity: i.qty,
          boxes: i.boxes,
          size: i.size,
          qty_per_box: i.qty_per_box,
          wt_1000_pcs_kg: i.wt_1000_pcs_kg,
          total_weight_kg: i.total_weight_kg,
          rate: i.rate,
          dealer_landing: i.dealer_landing,
          value_before_tax: i.value_before_tax,
          gst_amount: i.gst_amount,
          value_after_tax: i.value_after_tax,
        })),
        notes: `Fastener Order (${cartTotalWeight} KG total across ${cartItems.length} configurations)`
      };
      const { data } = await api.post("/orders", payload);
      toast.success(`Order ${data.order_no} placed successfully (${cartTotalWeight} KG Total)`);
      setCart({});
      setNewOrderModalOpen(false);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to place order");
    } finally {
      setPlacing(false);
    }
  };

  return (
    <AppShell
      title="Distributor & MNP Orders"
      subtitle="Manage, track, and place size-based orders with automatic weight & tax calculation"
      actions={
        <button
          onClick={() => { setCart({}); setNewOrderModalOpen(true); }}
          className="inline-flex items-center gap-2 px-4 h-9 rounded-md gradient-brand-accent text-white text-sm font-semibold shadow-md hover:shadow-lg hover:scale-105 transition-all"
          data-testid="new-fastener-order-button"
        >
          <Plus size={16} weight="bold" /> + Place Fastener Order (Select Size & Boxes)
        </button>
      }
    >
      <PageSection
        title={`${orders.length} orders listed`}
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
                { key: "subtotal", label: "Value (Before Tax)" },
                { key: "gst", label: "GST (18%)" },
                { key: "total", label: "Value (After Tax)" },
                { key: "status", label: "Status" },
                { key: "created_at", label: "Created" },
              ]}
            />
          </div>
        }
      >
        {loading ? <div className="p-8 text-center text-sm text-[#5C6670]">Loading orders…</div>
          : orders.length === 0 ? <EmptyState title="No orders found" description="Click '+ Place Fastener Order' to configure and submit your first order." />
          : (
            <div className="overflow-x-auto">
              <table className="yf-table w-full">
                <thead>
                  <tr>
                    <th>Order No</th>
                    <th>Dealer / MNP</th>
                    <th>State</th>
                    <th>Configs</th>
                    <th className="text-right">Total Weight</th>
                    <th className="text-right">Value (Before Tax)</th>
                    <th className="text-right">GST (18%)</th>
                    <th className="text-right">Value (After Tax)</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => {
                    const totalWeight = o.items?.reduce((s, i) => s + (i.total_weight_kg || 0), 0) || 0;
                    return (
                      <tr key={o.id} data-testid={`order-row-${o.order_no}`}>
                        <td className="font-mono text-xs font-bold text-[#06182F] bg-[#F3F4F6] px-2 py-1 rounded w-max">{o.order_no}</td>
                        <td className="font-medium text-[#06182F]">{o.dealer_name}</td>
                        <td className="text-[#5C6670]">{o.dealer_state || "—"}</td>
                        <td className="font-mono">{o.items?.length || 0}</td>
                        <td className="text-right tabular font-mono font-bold text-[#D96B0B]">
                          {totalWeight > 0 ? `${totalWeight.toFixed(3)} KG` : "—"}
                        </td>
                        <td className="text-right tabular font-mono">{fmt.inr(o.subtotal)}</td>
                        <td className="text-right tabular font-mono text-[#3B82F6]">{fmt.inr(o.gst)}</td>
                        <td className="text-right tabular font-mono font-bold text-[#16A34A]">{fmt.inr(o.total)}</td>
                        <td><StatusBadge status={o.status} /></td>
                        <td className="text-[#5C6670] text-xs">{fmt.datetime(o.created_at)}</td>
                        <td className="text-right">
                          <button onClick={() => setSelected(o)} className="p-1.5 rounded hover:bg-[#F4F5F7] text-[#5C6670]" data-testid={`view-order-${o.order_no}`}>
                            <Eye size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
      </PageSection>

      {/* View Existing Order Dialog */}
      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Order Breakdown: {selected?.order_no}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="py-2 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-4 gap-4 text-sm bg-[#F8FAFC] p-3 rounded-lg border border-[#E5E7EB]">
                <div><div className="text-[11px] uppercase text-[#5C6670] tracking-wider">Dealer</div><div className="font-bold mt-0.5 text-[#06182F]">{selected.dealer_name}</div></div>
                <div><div className="text-[11px] uppercase text-[#5C6670] tracking-wider">State</div><div className="font-medium mt-0.5">{selected.dealer_state || "-"}</div></div>
                <div><div className="text-[11px] uppercase text-[#5C6670] tracking-wider">Placed On</div><div className="font-medium mt-0.5">{fmt.datetime(selected.created_at)}</div></div>
                <div><div className="text-[11px] uppercase text-[#5C6670] tracking-wider">Status</div><div className="mt-0.5"><StatusBadge status={selected.status} /></div></div>
              </div>

              <div className="border border-[#E5E7EB] rounded-lg overflow-hidden">
                <table className="yf-table w-full">
                  <thead>
                    <tr>
                      <th>Product / Fastener Description</th>
                      <th>Size</th>
                      <th className="text-right">Boxes</th>
                      <th className="text-right">Total Pcs</th>
                      <th className="text-right">Weight (KG)</th>
                      <th className="text-right">Before Tax</th>
                      <th className="text-right">GST (18%)</th>
                      <th className="text-right">After Tax</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.items?.map((it, i) => (
                      <tr key={i}>
                        <td className="font-medium text-[#06182F]">{it.product_name}</td>
                        <td className="font-mono font-bold text-xs text-[#4B5563]">{it.size || it.sku}</td>
                        <td className="text-right tabular font-mono font-semibold">{it.boxes || Math.ceil((it.quantity || 1000) / (it.qty_per_box || 1000))} Box</td>
                        <td className="text-right tabular font-mono text-xs">{it.quantity?.toLocaleString()} pcs</td>
                        <td className="text-right tabular font-mono font-bold text-[#D96B0B]">
                          {it.total_weight_kg ? `${it.total_weight_kg} kg` : "—"}
                        </td>
                        <td className="text-right tabular font-mono">{fmt.inr(it.value_before_tax || it.subtotal)}</td>
                        <td className="text-right tabular font-mono text-[#3B82F6]">{fmt.inr(it.gst_amount || (it.subtotal * 0.18))}</td>
                        <td className="text-right tabular font-mono font-bold text-[#16A34A]">{fmt.inr(it.value_after_tax || (it.subtotal * 1.18))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center bg-[#1D242B] text-white p-4 rounded-lg">
                <div>
                  <div className="text-xs uppercase tracking-wider text-[#94A3B8]">Total Order Weight</div>
                  <div className="font-mono text-xl font-bold text-[#FEF08A]">
                    {selected.items?.reduce((s, i) => s + (i.total_weight_kg || 0), 0).toFixed(3)} KG
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex gap-6 justify-end text-xs text-[#94A3B8]"><span>Value Before Tax:</span><span className="tabular font-mono text-white">{fmt.inr(selected.subtotal)}</span></div>
                  <div className="flex gap-6 justify-end text-xs text-[#94A3B8] mt-0.5"><span>GST (18%):</span><span className="tabular font-mono text-[#93C5FD]">{fmt.inr(selected.gst)}</span></div>
                  <div className="flex gap-6 justify-end font-display font-bold text-lg mt-1 pt-1 border-t border-[#334155] text-[#4ADE80]"><span>Value After Tax:</span><span className="tabular font-mono">{fmt.inr(selected.total)}</span></div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Place New Fastener Order Modal */}
      <Dialog open={newOrderModalOpen} onOpenChange={setNewOrderModalOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Stack size={22} className="text-[#F28C18]" />
              Place New Fastener Order — Size & Box Configurator
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-5 max-h-[75vh] overflow-y-auto pr-1">
            {/* Category Switcher inside Modal */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {["CSK Drywall Screws", "CSK Chipboard Screws", "Electronics", "Appliances", "Hardware", "Furniture"].map((c) => (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    cat === c ? "bg-[#1D242B] text-white shadow" : "bg-[#F3F4F6] text-[#5C6670] hover:bg-[#E5E7EB]"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            {/* Interactive Configuration Box */}
            {selectedProduct && (
              <div className="bg-[#0F172A] text-white rounded-xl p-5 border border-[#334155] space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                      Select Available Size & Option
                    </label>
                    <select
                      value={selectedProductId}
                      onChange={(e) => setSelectedProductId(e.target.value)}
                      className="w-full h-11 px-3 rounded-lg bg-[#1E293B] border border-[#475569] text-white text-sm font-medium focus:border-[#F28C18]"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.size ? `${p.size} (${p.sku})` : p.name} — Rate: {fmt.inr(p.dealer_landing || p.price)} | Box of {p.qty_per_box} pcs
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                      Box Option (Quantity of Boxes)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        value={boxCount}
                        onChange={(e) => setBoxCount(parseInt(e.target.value) || 0)}
                        className="flex-1 h-11 px-3 rounded-lg bg-[#1E293B] border border-[#475569] text-white text-base font-mono font-bold focus:border-[#F28C18]"
                      />
                      <span className="text-xs font-mono text-[#FEF08A] bg-[#1E293B] px-3 py-3 rounded-lg border border-[#475569]">
                        {qtyPerBox} pcs/box
                      </span>
                    </div>
                  </div>
                </div>

                {/* Breakdown Strip */}
                <div className="bg-[#1E293B] rounded-lg p-3 grid grid-cols-4 gap-2 text-center text-xs">
                  <div>
                    <div className="text-[10px] text-[#94A3B8] uppercase font-semibold">Total Pieces</div>
                    <div className="font-mono font-bold text-sm text-white mt-0.5">{totalPcs.toLocaleString()} pcs</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#F28C18] uppercase font-semibold">Weight Specification</div>
                    <div className="font-mono font-bold text-sm text-[#FEF08A] mt-0.5">{totalWeightKg} KG</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#94A3B8] uppercase font-semibold">Value (Before Tax)</div>
                    <div className="font-mono font-bold text-sm text-white mt-0.5">{fmt.inr(valueBeforeTax)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#4ADE80] uppercase font-bold">Value (After Tax)</div>
                    <div className="font-mono font-bold text-base text-[#4ADE80] mt-0.5">{fmt.inr(valueAfterTax)}</div>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    onClick={addConfiguredToCart}
                    className="px-5 h-10 rounded-lg gradient-brand-accent text-white font-bold text-sm shadow hover:scale-[1.01] transition-all flex items-center gap-2"
                  >
                    <Plus size={16} weight="bold" /> Add Configuration to Cart
                  </button>
                </div>
              </div>
            )}

            {/* Cart Items List */}
            <div className="border border-[#E5E7EB] rounded-xl overflow-hidden bg-white">
              <div className="px-4 py-3 bg-[#F8FAFC] border-b border-[#E5E7EB] font-bold text-sm text-[#06182F] flex justify-between items-center">
                <span>Configurations in Order ({cartItems.length})</span>
                <span className="font-mono text-xs text-[#D96B0B] bg-[#FFF7ED] px-2 py-0.5 rounded font-bold">
                  Total Weight: {cartTotalWeight} KG
                </span>
              </div>
              {cartItems.length === 0 ? (
                <div className="p-8 text-center text-sm text-[#5C6670]">No items added to order yet.</div>
              ) : (
                <div className="divide-y divide-[#F1F2F4] max-h-[220px] overflow-y-auto">
                  {cartItems.map((i) => (
                    <div key={i.product.id} className="p-3 flex items-center justify-between text-sm">
                      <div>
                        <div className="font-bold text-[#06182F]">{i.product.name}</div>
                        <div className="text-xs font-mono text-[#5C6670]">Size: {i.size} · {i.boxes} Boxes ({i.qty.toLocaleString()} pcs) · <span className="text-[#D96B0B] font-bold">{i.total_weight_kg} KG</span></div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-[10px] text-[#5C6670]">After Tax</div>
                          <div className="font-mono font-bold text-[#16A34A]">{fmt.inr(i.value_after_tax)}</div>
                        </div>
                        <button onClick={() => removeCartItem(i.product.id)} className="text-xs text-red-500 hover:underline">
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {cartItems.length > 0 && (
                <div className="p-3 bg-[#F8FAFC] border-t border-[#E5E7EB] flex justify-between items-center font-bold text-sm">
                  <span>Total Order Landing (After Tax)</span>
                  <span className="font-display text-lg text-[#16A34A] font-extrabold">{fmt.inr(cartTotal)}</span>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setNewOrderModalOpen(false)} className="h-10 px-4 rounded-md border border-[#E5E7EB] text-sm">Close</button>
            <button onClick={placeOrder} disabled={placing || cartItems.length === 0} className="h-10 px-6 rounded-md gradient-brand-accent text-white font-bold text-sm disabled:opacity-50">
              {placing ? "Submitting…" : `Submit Fastener Order (${cartTotalWeight} KG)`}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
