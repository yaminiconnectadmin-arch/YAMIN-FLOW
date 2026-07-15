import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";
import { PageSection, EmptyState } from "@/components/common/Common";
import { Plus, Minus, ShoppingCart } from "@phosphor-icons/react";
import { toast } from "@/components/ui/sonner";
import { useNavigate } from "react-router-dom";

export default function DealerBrowse() {
  const [products, setProducts] = useState([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [cart, setCart] = useState({});
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await api.get("/products", { params: { q, category: cat, status: "active" } });
      setProducts(data);
      setLoading(false);
    })();
  }, [q, cat]);

  const categories = Array.from(new Set(products.map((p) => p.category)));
  const add = (p) => setCart((c) => ({ ...c, [p.id]: { product: p, qty: (c[p.id]?.qty || 0) + 1 } }));
  const remove = (p) => setCart((c) => {
    const nc = { ...c };
    if (!nc[p.id]) return nc;
    const next = nc[p.id].qty - 1;
    if (next <= 0) delete nc[p.id]; else nc[p.id] = { ...nc[p.id], qty: next };
    return nc;
  });

  const cartItems = Object.values(cart);
  const subtotal = cartItems.reduce((s, i) => s + i.product.price * i.qty, 0);

  const placeOrder = async () => {
    if (cartItems.length === 0) return toast.error("Cart is empty");
    setPlacing(true);
    try {
      const { data } = await api.post("/orders", {
        items: cartItems.map((i) => ({ product_id: i.product.id, quantity: i.qty })),
      });
      toast.success(`Order ${data.order_no} placed — ${data.status}`);
      setCart({});
      navigate("/orders");
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
    finally { setPlacing(false); }
  };

  return (
    <AppShell title="Browse Products" subtitle="Add SKUs to your cart and place a new order">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center gap-3">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…"
              className="h-10 px-3 rounded-md border border-[#E5E7EB] text-sm flex-1 focus:border-[#F28C18] focus:ring-1 focus:ring-[#F28C18] outline-none"
              data-testid="browse-search" />
            <select value={cat} onChange={(e) => setCat(e.target.value)}
              className="h-10 px-3 rounded-md border border-[#E5E7EB] text-sm bg-white focus:border-[#F28C18] focus:ring-1 focus:ring-[#F28C18] outline-none"
              data-testid="browse-category-filter">
              <option value="">All Categories</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {loading ? <div className="p-8 text-center text-sm text-[#5C6670]">Loading…</div>
            : products.length === 0 ? <EmptyState title="No products found" />
            : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 stagger">
                {products.map((p) => {
                  const qty = cart[p.id]?.qty || 0;
                  return (
                    <div key={p.id} className="bg-white rounded-lg border border-[#E5E7EB] card-shadow p-5 hover:border-[#F28C18]/50 transition-all" data-testid={`browse-product-${p.sku}`}>
                      <div className="flex items-center justify-between mb-3">
                        <span className="badge-brand inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">{p.category}</span>
                        <span className="text-[11px] font-mono text-[#5C6670]">{p.sku}</span>
                      </div>
                      <div className="font-display font-semibold text-[15px] text-[#06182F] leading-tight mb-1 line-clamp-2 min-h-[40px]">{p.name}</div>
                      <div className="text-xs text-[#5C6670] mb-3">MOQ: {p.moq} {p.unit} · {p.weight_kg}kg</div>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-display text-xl font-bold text-[#06182F] tabular">{fmt.inr(p.price)}</div>
                          <div className="text-[10px] uppercase tracking-widest text-[#5C6670]">per {p.unit}</div>
                        </div>
                        {qty === 0 ? (
                          <button onClick={() => add(p)} className="h-9 px-4 rounded-md gradient-brand-accent text-white text-sm font-semibold" data-testid={`add-${p.sku}`}>
                            Add
                          </button>
                        ) : (
                          <div className="flex items-center gap-1 bg-[#F4F5F7] rounded-md p-1">
                            <button onClick={() => remove(p)} className="w-7 h-7 rounded flex items-center justify-center hover:bg-white" data-testid={`decrement-${p.sku}`}>
                              <Minus size={12} weight="bold" />
                            </button>
                            <span className="w-8 text-center font-semibold text-sm tabular">{qty}</span>
                            <button onClick={() => add(p)} className="w-7 h-7 rounded flex items-center justify-center hover:bg-white" data-testid={`increment-${p.sku}`}>
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

        {/* Cart */}
        <div className="lg:col-span-4">
          <div className="sticky top-6 bg-white rounded-lg border border-[#E5E7EB] card-shadow" data-testid="cart-panel">
            <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart size={16} className="text-[#0A2342]" />
                <h3 className="font-display font-semibold text-[15px]">Cart</h3>
              </div>
              <span className="badge-brand inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                {cartItems.length} items
              </span>
            </div>
            {cartItems.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#5C6670]">
                Your cart is empty. Add products to get started.
              </div>
            ) : (
              <>
                <div className="max-h-[380px] overflow-y-auto">
                  {cartItems.map((i) => (
                    <div key={i.product.id} className="px-5 py-3 border-b border-[#F1F2F4] flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{i.product.name}</div>
                        <div className="text-xs text-[#5C6670] font-mono">{i.product.sku}</div>
                      </div>
                      <div className="flex items-center gap-1 bg-[#F4F5F7] rounded-md p-0.5">
                        <button onClick={() => remove(i.product)} className="w-6 h-6 rounded flex items-center justify-center hover:bg-white">
                          <Minus size={11} weight="bold" />
                        </button>
                        <span className="w-6 text-center font-semibold text-xs tabular">{i.qty}</span>
                        <button onClick={() => add(i.product)} className="w-6 h-6 rounded flex items-center justify-center hover:bg-white">
                          <Plus size={11} weight="bold" />
                        </button>
                      </div>
                      <div className="text-sm font-semibold tabular w-20 text-right">{fmt.inr(i.product.price * i.qty)}</div>
                    </div>
                  ))}
                </div>
                <div className="px-5 py-4 border-t border-[#E5E7EB] space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-[#5C6670]">Subtotal</span><span className="tabular">{fmt.inr(subtotal)}</span></div>
                  <div className="flex justify-between"><span className="text-[#5C6670]">GST (18%)</span><span className="tabular">{fmt.inr(subtotal * 0.18)}</span></div>
                  <div className="flex justify-between font-display font-semibold text-base pt-2 border-t border-[#F1F2F4]"><span>Total</span><span className="tabular">{fmt.inr(subtotal * 1.18)}</span></div>
                </div>
                <div className="p-4">
                  <button onClick={placeOrder} disabled={placing}
                    className="w-full h-11 rounded-md gradient-brand-accent text-white font-semibold text-sm disabled:opacity-70"
                    data-testid="place-order-button">
                    {placing ? "Placing…" : "Place Order"}
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
