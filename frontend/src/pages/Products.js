import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";
import { PageSection, StatusBadge, EmptyState } from "@/components/common/Common";
import { ExportButton } from "@/lib/csv";
import { Plus, Trash, PencilSimple } from "@phosphor-icons/react";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

const emptyProduct = {
  sku: "", name: "", category: "CSK Chipboard Screws", size: "", item_code: "",
  description: "", unit: "box", weight_kg: 0.001, wt_1000_pcs_kg: 1.0, qty_per_box: 1000,
  price: 0, cost: 0, dealer_landing: 0, wd_basic: 0, wd_landing: 0,
  gst: 18, hsn: "7318", moq: 1, safety_stock: 10, lead_time_days: 5, status: "active",
};

export default function ProductsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [products, setProducts] = useState([]);
  const [q, setQ] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyProduct);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/products", { params: { q, category: categoryFilter } });
      setProducts(data);
    } catch { toast.error("Failed to load products"); }
    finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [q, categoryFilter]);

  const openNew = () => { setEditing(null); setForm(emptyProduct); setDialogOpen(true); };
  const openEdit = (p) => {
    setEditing(p);
    setForm({ ...emptyProduct, ...p, item_code: p.item_code || p.sku });
    setDialogOpen(true);
  };

  const save = async () => {
    try {
      const payload = {
        ...form,
        sku: form.item_code || form.sku,
        cost: form.dealer_landing || form.cost,
        price: form.price || form.rate || 0,
      };
      if (editing) {
        await api.put(`/products/${editing.id}`, payload);
        toast.success("Product updated");
      } else {
        await api.post("/products", payload);
        toast.success("Product created");
      }
      setDialogOpen(false);
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  const del = async (p) => {
    if (!window.confirm(`Delete ${p.name}?`)) return;
    await api.delete(`/products/${p.id}`);
    toast.success("Deleted");
    load();
  };

  const categories = ["All", "CSK Chipboard Screws", "CSK Drywall Screws", "Electronics", "Appliances", "Hardware", "Furniture"];

  return (
    <AppShell
      title="Product & Fastener Catalog"
      subtitle={`${products.length} registered items (Enriched with Total Weight Matrix Specifications & Exact Rates)`}
      actions={
        isAdmin && (
          <button onClick={openNew} className="inline-flex items-center gap-2 px-4 h-9 rounded-md gradient-brand-accent text-white text-sm font-semibold shadow-sm hover:shadow-md transition-all" data-testid="new-product-button">
            <Plus size={14} weight="bold" /> New Fastener / SKU
          </button>
        )
      }
    >
      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategoryFilter(c === "All" ? "" : c)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
              (c === "All" && !categoryFilter) || categoryFilter === c
                ? "bg-[#1D242B] text-white border-[#1D242B]"
                : "bg-white text-[#5C6670] border-[#E5E7EB] hover:bg-[#F8FAFC]"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <PageSection
        title="Full Catalog & Pricing Matrix"
        actions={
          <div className="flex items-center gap-2">
            <input
              value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search size, SKU, or name…"
              className="h-9 px-3 rounded-md border border-[#E5E7EB] text-sm w-[280px] focus:border-[#F28C18] focus:ring-1 focus:ring-[#F28C18] outline-none"
              data-testid="products-search"
            />
            <ExportButton
              filename="yamini-flow-catalog-{date}.csv"
              rows={products}
              columns={[
                { key: "sku", label: "SKU / Item Code" },
                { key: "name", label: "Product Description" },
                { key: "size", label: "Size" },
                { key: "category", label: "Category" },
                { key: "wt_1000_pcs_kg", label: "WT / 1000 PCS (KG)" },
                { key: "qty_per_box", label: "Qty / Box" },
                { key: "price", label: "Rate (INR)" },
                { key: "dealer_landing", label: "Dealer Landing (50% INR)" },
                { key: "wd_landing", label: "WD Landing (INR)" },
                { key: "status", label: "Status" },
              ]}
            />
          </div>
        }
      >
        {loading ? (
          <div className="p-12 text-center text-[#5C6670] text-sm animate-pulse">Loading exact product catalog specifications…</div>
        ) : products.length === 0 ? (
          <EmptyState title="No products found" description="Adjust your search or add new SKUs." />
        ) : (
          <div className="overflow-x-auto">
            <table className="yf-table w-full">
              <thead>
                <tr>
                  <th>SKU / Code</th>
                  <th>Product Description</th>
                  <th>Size</th>
                  <th>Category</th>
                  <th className="text-right">WT / 1000 PCS</th>
                  <th className="text-right">Qty/Box</th>
                  <th className="text-right">Rate (Price)</th>
                  <th className="text-right">Dealer Landing</th>
                  <th className="text-right">WD Landing</th>
                  <th>Status</th>
                  {isAdmin && <th></th>}
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} data-testid={`product-row-${p.sku}`}>
                    <td className="font-mono font-bold text-xs text-[#1D242B] bg-[#F3F4F6] px-2 py-1 rounded w-max">{p.sku}</td>
                    <td className="font-medium text-[#1D242B]">{p.name}</td>
                    <td className="font-mono font-bold text-sm text-[#4B5563]">{p.size || "—"}</td>
                    <td>
                      <span className={`px-2 py-0.5 text-[11px] font-medium rounded ${
                        p.category === "CSK Chipboard Screws" ? "bg-[#FEF9C3] text-[#854D0E] border border-[#FDE047]" :
                        p.category === "CSK Drywall Screws" ? "bg-[#EFF6FF] text-[#1E40AF] border border-[#BFDBFE]" :
                        "bg-[#F3F4F6] text-[#4B5563]"
                      }`}>
                        {p.category}
                      </span>
                    </td>
                    <td className="text-right tabular font-mono font-bold text-[#D96B0B] bg-[#FFF7ED]">
                      {p.wt_1000_pcs_kg ? `${Number(p.wt_1000_pcs_kg).toFixed(3)} kg` : `${p.weight_kg || 0} kg`}
                    </td>
                    <td className="text-right tabular font-mono">{p.qty_per_box || p.moq || "—"}</td>
                    <td className="text-right tabular font-mono font-bold text-[#1D242B]">{fmt.inr(p.price)}</td>
                    <td className="text-right tabular font-mono font-semibold text-[#16A34A]">
                      {p.dealer_landing ? fmt.inr(p.dealer_landing) : fmt.inr(p.cost)}
                    </td>
                    <td className="text-right tabular font-mono font-bold text-[#2563EB]">
                      {p.wd_landing ? fmt.inr(p.wd_landing) : "—"}
                    </td>
                    <td><StatusBadge status={p.status} /></td>
                    {isAdmin && (
                      <td className="text-right">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => openEdit(p)} className="p-1.5 rounded hover:bg-[#F4F5F7] text-[#5C6670]" data-testid={`edit-product-${p.sku}`}>
                            <PencilSimple size={15} />
                          </button>
                          <button onClick={() => del(p)} className="p-1.5 rounded hover:bg-red-50 text-red-500" data-testid={`delete-product-${p.sku}`}>
                            <Trash size={15} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageSection>

      {/* Edit / New Product Modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit Fastener / SKU: ${editing.sku}` : "New Fastener / Product Specification"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-4 py-2 max-h-[65vh] overflow-y-auto pr-1">
            <div className="col-span-1">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#5C6670] mb-1.5">SKU / Item Code</label>
              <input type="text" value={form.item_code || form.sku || ""} onChange={(e) => setForm({ ...form, sku: e.target.value.toUpperCase(), item_code: e.target.value.toUpperCase() })}
                className="w-full h-10 px-3 rounded-md border border-[#E5E7EB] text-sm font-mono uppercase focus:border-[#F28C18]" placeholder="4CB16" />
            </div>
            <div className="col-span-1">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#5C6670] mb-1.5">Size</label>
              <input type="text" value={form.size || ""} onChange={(e) => setForm({ ...form, size: e.target.value })}
                className="w-full h-10 px-3 rounded-md border border-[#E5E7EB] text-sm font-mono focus:border-[#F28C18]" placeholder="4X16" />
            </div>
            <div className="col-span-1">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#5C6670] mb-1.5">Category</label>
              <select value={form.category || "CSK Chipboard Screws"} onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full h-10 px-3 rounded-md border border-[#E5E7EB] text-sm bg-white focus:border-[#F28C18]">
                <option value="CSK Chipboard Screws">CSK Chipboard Screws</option>
                <option value="CSK Drywall Screws">CSK Drywall Screws</option>
                <option value="Electronics">Electronics</option>
                <option value="Appliances">Appliances</option>
                <option value="Hardware">Hardware</option>
                <option value="Furniture">Furniture</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#5C6670] mb-1.5">Product Name</label>
              <input type="text" value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full h-10 px-3 rounded-md border border-[#E5E7EB] text-sm focus:border-[#F28C18]" placeholder="CSK Chipboard Screws 4X16" />
            </div>
            <div className="col-span-1">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#D96B0B] mb-1.5 font-bold">WT / 1000 PCS (KG)</label>
              <input type="number" step="0.001" value={form.wt_1000_pcs_kg ?? 0} onChange={(e) => setForm({ ...form, wt_1000_pcs_kg: parseFloat(e.target.value) || 0, weight_kg: (parseFloat(e.target.value) || 0) / 1000 })}
                className="w-full h-10 px-3 rounded-md border border-[#F28C18] text-sm font-mono font-bold bg-[#FFF7ED]" />
            </div>

            <div className="col-span-1">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#5C6670] mb-1.5">Qty / Box</label>
              <input type="number" value={form.qty_per_box ?? 1000} onChange={(e) => setForm({ ...form, qty_per_box: parseInt(e.target.value) || 0, moq: parseInt(e.target.value) || 0 })}
                className="w-full h-10 px-3 rounded-md border border-[#E5E7EB] text-sm font-mono" />
            </div>
            <div className="col-span-1">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#1D242B] font-bold mb-1.5">Rate / Price (₹)</label>
              <input type="number" step="0.01" value={form.price ?? 0} onChange={(e) => {
                const price = parseFloat(e.target.value) || 0;
                setForm({ ...form, price, cost: Math.round(price * 0.5), dealer_landing: Math.round(price * 0.5) });
              }} className="w-full h-10 px-3 rounded-md border border-[#E5E7EB] text-sm font-mono font-bold" />
            </div>
            <div className="col-span-1">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#16A34A] font-semibold mb-1.5">Dealer Landing (50%)</label>
              <input type="number" step="0.01" value={form.dealer_landing ?? form.cost ?? 0} onChange={(e) => setForm({ ...form, dealer_landing: parseFloat(e.target.value) || 0, cost: parseFloat(e.target.value) || 0 })}
                className="w-full h-10 px-3 rounded-md border border-[#E5E7EB] text-sm font-mono font-semibold text-[#16A34A]" />
            </div>

            <div className="col-span-1">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#5C6670] mb-1.5">WD Basic (₹)</label>
              <input type="number" step="0.01" value={form.wd_basic ?? 0} onChange={(e) => setForm({ ...form, wd_basic: parseFloat(e.target.value) || 0 })}
                className="w-full h-10 px-3 rounded-md border border-[#E5E7EB] text-sm font-mono" />
            </div>
            <div className="col-span-1">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#2563EB] font-bold mb-1.5">WD Landing (₹)</label>
              <input type="number" step="0.01" value={form.wd_landing ?? 0} onChange={(e) => setForm({ ...form, wd_landing: parseFloat(e.target.value) || 0 })}
                className="w-full h-10 px-3 rounded-md border border-[#E5E7EB] text-sm font-mono font-bold text-[#2563EB]" />
            </div>
            <div className="col-span-1">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#5C6670] mb-1.5">Status</label>
              <select value={form.status || "active"} onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full h-10 px-3 rounded-md border border-[#E5E7EB] text-sm bg-white">
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div className="col-span-3">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#5C6670] mb-1.5">Description</label>
              <textarea rows={2} value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 rounded-md border border-[#E5E7EB] text-sm focus:border-[#F28C18] outline-none" placeholder="CSK Screw size..." />
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setDialogOpen(false)} className="h-9 px-4 rounded-md border border-[#E5E7EB] text-sm">Cancel</button>
            <button onClick={save} className="h-9 px-4 rounded-md gradient-brand-accent text-white text-sm font-semibold" data-testid="save-product-button">
              {editing ? "Save Changes" : "Create SKU Specification"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
