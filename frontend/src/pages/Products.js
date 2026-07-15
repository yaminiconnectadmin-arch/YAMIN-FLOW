import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";
import { PageSection, StatusBadge, EmptyState } from "@/components/common/Common";
import { Plus, Trash, PencilSimple } from "@phosphor-icons/react";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

const emptyProduct = {
  sku: "", name: "", category: "Electronics", description: "", unit: "pcs",
  weight_kg: 0, price: 0, cost: 0, gst: 18, hsn: "", moq: 1, safety_stock: 0,
  lead_time_days: 7, status: "active", primary_supplier_id: "", secondary_supplier_id: "",
};

export default function ProductsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [products, setProducts] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyProduct);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/products", { params: { q } });
      setProducts(data);
    } catch { toast.error("Failed to load products"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [q]);

  const openNew = () => { setEditing(null); setForm(emptyProduct); setDialogOpen(true); };
  const openEdit = (p) => {
    setEditing(p);
    setForm({ ...emptyProduct, ...p });
    setDialogOpen(true);
  };

  const save = async () => {
    try {
      if (editing) {
        await api.put(`/products/${editing.id}`, form);
        toast.success("Product updated");
      } else {
        await api.post("/products", form);
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

  return (
    <AppShell
      title="Products"
      subtitle={`${products.length} SKUs in catalog`}
      actions={
        isAdmin && (
          <button onClick={openNew} className="inline-flex items-center gap-2 px-4 h-9 rounded-md gradient-brand-accent text-white text-sm font-semibold shadow-sm hover:shadow-md transition-all" data-testid="new-product-button">
            <Plus size={14} weight="bold" /> New Product
          </button>
        )
      }
    >
      <PageSection
        title="Catalog"
        actions={
          <input
            value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or SKU…"
            className="h-9 px-3 rounded-md border border-[#E5E7EB] text-sm w-[280px] focus:border-[#F28C18] focus:ring-1 focus:ring-[#F28C18] outline-none"
            data-testid="products-search"
          />
        }
      >
        {loading ? (
          <div className="p-8 text-center text-[#5C6670] text-sm">Loading…</div>
        ) : products.length === 0 ? (
          <EmptyState title="No products yet" description="Add your first SKU to get started." />
        ) : (
          <div className="overflow-x-auto">
            <table className="yf-table w-full">
              <thead>
                <tr>
                  <th>SKU</th><th>Product</th><th>Category</th>
                  <th className="text-right">Price</th><th className="text-right">Cost</th>
                  <th className="text-right">MOQ</th><th className="text-right">Safety</th>
                  <th>Status</th>{isAdmin && <th></th>}
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} data-testid={`product-row-${p.sku}`}>
                    <td className="font-mono text-xs">{p.sku}</td>
                    <td className="font-medium">{p.name}</td>
                    <td>{p.category}</td>
                    <td className="text-right tabular">{fmt.inr(p.price)}</td>
                    <td className="text-right tabular text-[#5C6670]">{fmt.inr(p.cost)}</td>
                    <td className="text-right tabular">{p.moq}</td>
                    <td className="text-right tabular">{p.safety_stock}</td>
                    <td><StatusBadge status={p.status} /></td>
                    {isAdmin && (
                      <td className="text-right">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => openEdit(p)} className="p-1.5 rounded hover:bg-[#F4F5F7] text-[#5C6670]" data-testid={`edit-product-${p.sku}`}>
                            <PencilSimple size={14} />
                          </button>
                          <button onClick={() => del(p)} className="p-1.5 rounded hover:bg-red-50 text-red-500" data-testid={`delete-product-${p.sku}`}>
                            <Trash size={14} />
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Product" : "New Product"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2 max-h-[60vh] overflow-y-auto">
            {[
              ["sku", "SKU"], ["name", "Name"], ["category", "Category"], ["hsn", "HSN Code"],
              ["unit", "Unit"], ["weight_kg", "Weight (kg)", "number"],
              ["price", "Price (₹)", "number"], ["cost", "Cost (₹)", "number"],
              ["gst", "GST %", "number"], ["moq", "MOQ", "number"],
              ["safety_stock", "Safety Stock", "number"], ["lead_time_days", "Lead Time (days)", "number"],
            ].map(([key, label, type = "text"]) => (
              <div key={key}>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#5C6670] mb-1.5">{label}</label>
                <input
                  type={type} value={form[key] ?? ""}
                  onChange={(e) => setForm({ ...form, [key]: type === "number" ? Number(e.target.value) : e.target.value })}
                  className="w-full h-10 px-3 rounded-md border border-[#E5E7EB] text-sm focus:border-[#F28C18] focus:ring-1 focus:ring-[#F28C18] outline-none"
                  data-testid={`product-form-${key}`}
                />
              </div>
            ))}
            <div className="col-span-2">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#5C6670] mb-1.5">Description</label>
              <textarea rows={3} value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 rounded-md border border-[#E5E7EB] text-sm focus:border-[#F28C18] focus:ring-1 focus:ring-[#F28C18] outline-none" />
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setDialogOpen(false)} className="h-9 px-4 rounded-md border border-[#E5E7EB] text-sm">Cancel</button>
            <button onClick={save} className="h-9 px-4 rounded-md gradient-brand-accent text-white text-sm font-semibold" data-testid="save-product-button">
              {editing ? "Save Changes" : "Create Product"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
