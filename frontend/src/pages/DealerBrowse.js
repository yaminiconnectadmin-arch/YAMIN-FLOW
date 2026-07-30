import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";
import { EmptyState } from "@/components/common/Common";
import { Plus, Minus, ShoppingCart, Scales, Stack, CheckCircle } from "@phosphor-icons/react";
import { toast } from "@/components/ui/sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function DealerBrowse() {
  useAuth();
  const [products, setProducts] = useState([]);
  const [dbCategories, setDbCategories] = useState([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("CSK Chipboard Screws");
  const [cart, setCart] = useState({});
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const navigate = useNavigate();

  // Interactive Fastener Configuration State
  const [selectedProductId, setSelectedProductId] = useState("");
  const [boxCount, setBoxCount] = useState(10);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/categories");
        setDbCategories(data);
        if (data.length > 0) {
          if (!data.some(c => c.name === "CSK Chipboard Screws")) {
            setCat(data[0].name);
          }
        }
      } catch {
        toast.error("Failed to load categories");
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/products", { params: { q, category: cat === "All" ? "" : cat, status: "active" } });
        setProducts(data);
        if (data.length > 0 && !selectedProductId) {
          setSelectedProductId(data[0].id);
        } else if (data.length > 0 && !data.some((p) => p.id === selectedProductId)) {
          setSelectedProductId(data[0].id);
        }
      } catch {
        toast.error("Failed to load products");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, cat]);

  const categories = [...dbCategories.map(c => c.name), "All"];

  const selectedProduct = products.find((p) => p.id === selectedProductId) || products[0];

  // Calculations for Fastener Configuration Box
  const qtyPerBox = selectedProduct?.qty_per_box || selectedProduct?.moq || 1000;
  const totalPcs = (boxCount || 0) * qtyPerBox;
  const wtPer1000 = selectedProduct?.wt_1000_pcs_kg || (selectedProduct?.weight_kg ? selectedProduct.weight_kg * 1000 : 1.0);
  const totalWeightKg = round((totalPcs / 1000.0) * wtPer1000, 3);

  // Price calculations as per picture: rate / dealer_landing
  const ratePerBox = selectedProduct?.dealer_landing ? selectedProduct.dealer_landing : (selectedProduct?.price || 0);
  const valueBeforeTax = round((boxCount || 0) * ratePerBox, 2);
  const gstAmount = round(valueBeforeTax * 0.18, 2);
  const valueAfterTax = round(valueBeforeTax + gstAmount, 2);

  function round(num, decimals = 2) {
    return Number(Math.round(num + "e" + decimals) + "e-" + decimals);
  }

  const addConfiguredToCart = () => {
    if (!selectedProduct) return;
    if (boxCount <= 0) return toast.error("Please enter a valid box quantity");

    setCart((c) => {
      const existing = c[selectedProduct.id] || {};
      const newBoxes = (existing.boxes || 0) + boxCount;
      const newTotalPcs = newBoxes * qtyPerBox;
      const newTotalWeight = round((newTotalPcs / 1000.0) * wtPer1000, 3);
      const newValBeforeTax = round(newBoxes * ratePerBox, 2);
      const newGst = round(newValBeforeTax * 0.18, 2);
      const newValAfterTax = round(newValBeforeTax + newGst, 2);

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
    toast.success(`Added ${boxCount} Boxes (${totalWeightKg} KG) of ${selectedProduct.name} to order`);
  };

  const addSingleBox = (p) => {
    const pBoxes = 1;
    const pQtyPerBox = p.qty_per_box || p.moq || 1000;
    const pWt1000 = p.wt_1000_pcs_kg || (p.weight_kg ? p.weight_kg * 1000 : 1.0);
    const pRate = p.dealer_landing ? p.dealer_landing : (p.price || 0);

    setCart((c) => {
      const existing = c[p.id] || { boxes: 0 };
      const nextBoxes = existing.boxes + pBoxes;
      const nextQty = nextBoxes * pQtyPerBox;
      const nextWeight = round((nextQty / 1000.0) * pWt1000, 3);
      const nextValBefore = round(nextBoxes * pRate, 2);
      const nextGst = round(nextValBefore * 0.18, 2);
      const nextValAfter = round(nextValBefore + nextGst, 2);

      return {
        ...c,
        [p.id]: {
          product: p,
          boxes: nextBoxes,
          qty: nextQty,
          qty_per_box: pQtyPerBox,
          size: p.size || p.sku,
          wt_1000_pcs_kg: pWt1000,
          total_weight_kg: nextWeight,
          rate: pRate,
          dealer_landing: p.dealer_landing || p.cost || 0,
          value_before_tax: nextValBefore,
          gst_amount: nextGst,
          value_after_tax: nextValAfter,
        }
      };
    });
  };

  const removeSingleBox = (p) => {
    setCart((c) => {
      if (!c[p.id]) return c;
      const nextBoxes = c[p.id].boxes - 1;
      if (nextBoxes <= 0) {
        const nc = { ...c };
        delete nc[p.id];
        return nc;
      }
      const pQtyPerBox = c[p.id].qty_per_box;
      const pWt1000 = c[p.id].wt_1000_pcs_kg;
      const pRate = c[p.id].rate;
      const nextQty = nextBoxes * pQtyPerBox;
      const nextWeight = round((nextQty / 1000.0) * pWt1000, 3);
      const nextValBefore = round(nextBoxes * pRate, 2);
      const nextGst = round(nextValBefore * 0.18, 2);
      const nextValAfter = round(nextValBefore + nextGst, 2);

      return {
        ...c,
        [p.id]: {
          ...c[p.id],
          boxes: nextBoxes,
          qty: nextQty,
          total_weight_kg: nextWeight,
          value_before_tax: nextValBefore,
          gst_amount: nextGst,
          value_after_tax: nextValAfter,
        }
      };
    });
  };

  const cartItems = Object.values(cart);
  const cartSubtotal = round(cartItems.reduce((s, i) => s + i.value_before_tax, 0), 2);
  const cartGst = round(cartSubtotal * 0.18, 2);
  const cartTotal = round(cartSubtotal + cartGst, 2);
  const cartTotalWeight = round(cartItems.reduce((s, i) => s + i.total_weight_kg, 0), 3);

  const placeOrder = async () => {
    if (cartItems.length === 0) return toast.error("Cart is empty");
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
        notes: `Order placed via Fastener Configurator (${cartTotalWeight} KG total weight across ${cartItems.length} items)`
      };
      const { data } = await api.post("/orders", payload);
      toast.success(`Order ${data.order_no} placed successfully — Total Weight: ${cartTotalWeight} KG`);
      setCart({});
      navigate("/orders");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to place order");
    } finally {
      setPlacing(false);
    }
  };

  const isFastenerCategory = cat.includes("Screws") || cat === "All";

  return (
    <AppShell title="Order Configurator & Catalog" subtitle="Interactive Fastener Ordering — Select Size & Box Options with Before/After Tax breakdown">
      {/* Category Pills */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 border-b border-[#E5E7EB]">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all shadow-sm ${
              cat === c
                ? "gradient-brand-accent text-white shadow-md scale-105"
                : "bg-white text-[#5C6670] border border-[#E5E7EB] hover:bg-[#F8FAFC]"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          {/* INTERACTIVE FASTENER CONFIGURATION ENGINE */}
          {selectedProduct && isFastenerCategory && (
            <div className="bg-[#1D242B] text-white rounded-xl card-shadow border border-[#334155] p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#F28C18]/20 to-transparent rounded-full blur-3xl pointer-events-none" />
              
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#334155]">
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-lg bg-[#F28C18] flex items-center justify-center text-white font-bold shadow-md">
                    <Stack size={20} />
                  </span>
                  <div>
                    <h2 className="font-display font-bold text-lg text-white">Interactive Fastener Order Configuration</h2>
                    <p className="text-xs text-[#94A3B8]">Select {cat} Size and Box option — Exact calculations aligned with Total Weight Matrix</p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#F28C18]/20 text-[#F28C18] border border-[#F28C18]/40">
                  {cat}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                {/* Available Size Dropdown */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#94A3B8] mb-2">
                    1. Available Size & Specification Option
                  </label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-lg bg-[#0F172A] border border-[#475569] text-white text-sm font-medium focus:border-[#F28C18] focus:ring-2 focus:ring-[#F28C18]/30 outline-none"
                    data-testid="size-dropdown"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.size ? `Size: ${p.size} (${p.sku})` : p.name} — Rate: {fmt.inr(p.dealer_landing || p.price)} | Box: {p.qty_per_box} pcs
                      </option>
                    ))}
                  </select>
                </div>

                {/* Box Option Input */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#94A3B8] mb-2">
                    2. Box Option (Boxes to Order)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      value={boxCount}
                      onChange={(e) => setBoxCount(parseInt(e.target.value) || 0)}
                      className="flex-1 h-11 px-4 rounded-lg bg-[#0F172A] border border-[#475569] text-white text-base font-mono font-bold focus:border-[#F28C18] focus:ring-2 focus:ring-[#F28C18]/30 outline-none"
                      data-testid="box-input"
                    />
                    <div className="text-right px-2">
                      <div className="text-xs text-[#94A3B8]">Packing</div>
                      <div className="font-mono text-sm font-semibold text-[#FEF08A]">{qtyPerBox} pcs/box</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* LIVE PRICING & WEIGHT BREAKDOWN PANEL */}
              <div className="bg-[#0F172A] rounded-xl border border-[#334155] p-5 grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                <div className="border-r border-[#334155]/60 pr-2">
                  <div className="text-[11px] font-semibold text-[#94A3B8] uppercase">Total Pieces</div>
                  <div className="font-mono font-bold text-lg text-white mt-1">{totalPcs.toLocaleString()} <span className="text-xs font-normal text-[#94A3B8]">pcs</span></div>
                </div>
                <div className="border-r border-[#334155]/60 pr-2">
                  <div className="text-[11px] font-semibold text-[#F28C18] uppercase">Matrix Weight</div>
                  <div className="font-mono font-bold text-lg text-[#FEF08A] mt-1">{totalWeightKg} <span className="text-xs font-normal text-[#94A3B8]">KG</span></div>
                  <div className="text-[10px] text-[#94A3B8]">({wtPer1000} kg / 1000 pcs)</div>
                </div>
                <div className="border-r border-[#334155]/60 pr-2">
                  <div className="text-[11px] font-semibold text-[#94A3B8] uppercase">Value (Before Tax)</div>
                  <div className="font-mono font-bold text-lg text-white mt-1">{fmt.inr(valueBeforeTax)}</div>
                  <div className="text-[10px] text-[#94A3B8]">({fmt.inr(ratePerBox)} / box)</div>
                </div>
                <div className="border-r border-[#334155]/60 pr-2">
                  <div className="text-[11px] font-semibold text-[#94A3B8] uppercase">GST (18%)</div>
                  <div className="font-mono font-bold text-lg text-[#93C5FD] mt-1">{fmt.inr(gstAmount)}</div>
                </div>
                <div>
                  <div className="text-[11px] font-bold text-[#4ADE80] uppercase">Value (After Tax)</div>
                  <div className="font-mono font-extrabold text-xl text-[#4ADE80] mt-1">{fmt.inr(valueAfterTax)}</div>
                  <div className="text-[10px] text-[#94A3B8]">Total Landing</div>
                </div>
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  onClick={addConfiguredToCart}
                  className="px-6 h-11 rounded-lg gradient-brand-accent text-white font-bold text-sm shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all flex items-center gap-2"
                  data-testid="add-configured-to-cart"
                >
                  <Plus size={18} weight="bold" /> Add Fastener Configuration to Order Cart
                </button>
              </div>
            </div>
          )}

          {/* Quick Search and Individual Product Cards below */}
          <div className="flex items-center justify-between pt-2">
            <h3 className="font-display font-semibold text-base text-[#06182F]">Or Quick Select Individual SKUs</h3>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter SKUs by size or code…"
              className="h-9 px-3 rounded-md border border-[#E5E7EB] text-sm w-[260px] focus:border-[#F28C18] outline-none" />
          </div>

          {loading ? <div className="p-8 text-center text-sm text-[#5C6670]">Loading catalog…</div>
            : products.length === 0 ? <EmptyState title="No products found" />
            : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {products.map((p) => {
                  const cartItem = cart[p.id];
                  const boxes = cartItem?.boxes || 0;
                  const pRate = p.dealer_landing || p.price;
                  return (
                    <div key={p.id} className={`bg-white rounded-lg border transition-all p-4 ${boxes > 0 ? "border-[#F28C18] shadow-md bg-[#FFFBEB]/30" : "border-[#E5E7EB] card-shadow hover:border-[#F28C18]/50"}`} data-testid={`browse-product-${p.sku}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono font-bold text-xs text-[#06182F] bg-[#F3F4F6] px-2 py-0.5 rounded">{p.sku}</span>
                        <span className="text-[11px] font-mono text-[#D96B0B] font-semibold">{p.size || p.unit}</span>
                      </div>
                      <div className="font-display font-semibold text-[14px] text-[#06182F] leading-tight mb-1 line-clamp-1">{p.name}</div>
                      <div className="text-xs text-[#5C6670] mb-3 flex items-center justify-between">
                        <span>Box: {p.qty_per_box || p.moq} pcs</span>
                        <span className="font-mono text-[#D96B0B] font-medium">{p.wt_1000_pcs_kg ? `${p.wt_1000_pcs_kg} kg/1k` : `${p.weight_kg} kg`}</span>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-[#F1F2F4]">
                        <div>
                          <div className="font-mono text-base font-bold text-[#06182F] tabular">{fmt.inr(pRate)}</div>
                          <div className="text-[10px] text-[#5C6670]">before tax / box</div>
                        </div>
                        {boxes === 0 ? (
                          <button onClick={() => addSingleBox(p)} className="h-8 px-3 rounded bg-[#1D242B] text-white text-xs font-semibold hover:bg-[#F28C18] transition-all">
                            + 1 Box
                          </button>
                        ) : (
                          <div className="flex items-center gap-1 bg-[#F4F5F7] rounded-md p-1 border border-[#E5E7EB]">
                            <button onClick={() => removeSingleBox(p)} className="w-6 h-6 rounded flex items-center justify-center hover:bg-white text-[#5C6670]">
                              <Minus size={12} weight="bold" />
                            </button>
                            <span className="w-10 text-center font-mono font-bold text-xs tabular text-[#D96B0B]">{boxes} Box</span>
                            <button onClick={() => addSingleBox(p)} className="w-6 h-6 rounded flex items-center justify-center hover:bg-white text-[#5C6670]">
                              <Plus size={12} weight="bold" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </div>

        {/* Order Cart & Summary Panel */}
        <div className="lg:col-span-4">
          <div className="sticky top-6 bg-white rounded-xl border border-[#E5E7EB] card-shadow overflow-hidden" data-testid="cart-panel">
            <div className="px-5 py-4 bg-[#1D242B] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart size={18} className="text-[#F28C18]" />
                <h3 className="font-display font-bold text-[16px]">Order Summary</h3>
              </div>
              <span className="badge-brand inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider bg-[#F28C18] text-white">
                {cartItems.length} items
              </span>
            </div>

            {cartItems.length === 0 ? (
              <div className="p-10 text-center text-sm text-[#5C6670]">
                <Scales size={36} className="mx-auto text-[#CBD5E1] mb-2" />
                Select sizes and box quantities to build your order with automatic weight calculation.
              </div>
            ) : (
              <>
                <div className="max-h-[420px] overflow-y-auto divide-y divide-[#F1F2F4]">
                  {cartItems.map((i) => (
                    <div key={i.product.id} className="p-4 hover:bg-[#F8FAFC] transition-all">
                      <div className="flex justify-between items-start mb-1">
                        <div>
                          <div className="text-sm font-bold text-[#06182F]">{i.product.name}</div>
                          <div className="text-xs font-mono text-[#5C6670]">Size: {i.size} · {i.boxes} Boxes ({i.qty.toLocaleString()} pcs)</div>
                        </div>
                        <span className="font-mono text-xs font-bold bg-[#FEF08A] text-[#854D0E] px-2 py-0.5 rounded">
                          {i.total_weight_kg} KG
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-1 text-xs mt-2 bg-[#F3F4F6] p-2 rounded-md text-center">
                        <div>
                          <div className="text-[10px] text-[#5C6670]">Before Tax</div>
                          <div className="font-mono font-semibold">{fmt.inr(i.value_before_tax)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-[#5C6670]">GST (18%)</div>
                          <div className="font-mono font-semibold text-[#3B82F6]">{fmt.inr(i.gst_amount)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-[#16A34A] font-bold">After Tax</div>
                          <div className="font-mono font-bold text-[#16A34A]">{fmt.inr(i.value_after_tax)}</div>
                        </div>
                      </div>

                      <div className="flex justify-end mt-2">
                        <button onClick={() => removeSingleBox(i.product)} className="text-[11px] text-red-500 hover:underline font-medium">
                          Remove 1 Box
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Final Order Breakdown Footer */}
                <div className="px-5 py-4 bg-[#F8FAFC] border-t border-[#E5E7EB] space-y-2 text-sm">
                  <div className="flex justify-between font-mono"><span className="text-[#5C6670]">Total Boxes</span><span className="font-bold">{cartItems.reduce((s, i) => s + i.boxes, 0)} Boxes</span></div>
                  <div className="flex justify-between font-mono"><span className="text-[#D96B0B] font-semibold">Total Order Weight</span><span className="font-bold text-[#D96B0B]">{cartTotalWeight} KG</span></div>
                  <div className="flex justify-between font-mono pt-1 border-t border-[#E5E7EB]"><span className="text-[#5C6670]">Value (Before Tax)</span><span className="tabular font-semibold">{fmt.inr(cartSubtotal)}</span></div>
                  <div className="flex justify-between font-mono"><span className="text-[#5C6670]">GST (18%)</span><span className="tabular font-semibold text-[#3B82F6]">{fmt.inr(cartGst)}</span></div>
                  <div className="flex justify-between font-display font-bold text-lg pt-2 border-t border-[#E5E7EB] text-[#16A34A]">
                    <span>Value (After Tax)</span>
                    <span className="tabular">{fmt.inr(cartTotal)}</span>
                  </div>
                </div>

                <div className="p-4 bg-white border-t border-[#E5E7EB]">
                  <button
                    onClick={placeOrder}
                    disabled={placing}
                    className="w-full h-12 rounded-lg gradient-brand-accent text-white font-bold text-base shadow-lg hover:shadow-xl hover:scale-[1.01] transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                    data-testid="place-order-button"
                  >
                    <CheckCircle size={20} weight="bold" />
                    {placing ? "Placing Order…" : `Place Fastener Order (${cartTotalWeight} KG)`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
