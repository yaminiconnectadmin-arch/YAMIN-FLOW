import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";
import { PageSection, StatusBadge, EmptyState } from "@/components/common/Common";
import { ExportButton } from "@/lib/csv";
import { Plus, Trash, PencilSimple, Tag } from "@phosphor-icons/react";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

const MASTER_PRICE_LIST_PRODUCTS = [
  // SECTION 01: DRY WALL SCREWS
  { id: "35D16", sku: "35D16", item_code: "35D16", sr_no: 1, name: "CSK Drywall Screws 3.5X16", category: "CSK Drywall Screws", category_section: "01 DRY WALL SCREWS", size: "3.5X16", size_mm: "3.5 x 16", qty_per_box: 1000, mrp: 322, rate: 322, price: 322, dealer_landing: 161, cost: 161, wt_1000_pcs_kg: 0.67, weight_kg: 0.00067, wd_basic: 122, wd_landing: 144, status: "active" },
  { id: "35D19", sku: "35D19", item_code: "35D19", sr_no: 2, name: "CSK Drywall Screws 3.5X19", category: "CSK Drywall Screws", category_section: "01 DRY WALL SCREWS", size: "3.5X19", size_mm: "3.5 x 19", qty_per_box: 1000, mrp: 368, rate: 368, price: 368, dealer_landing: 184, cost: 184, wt_1000_pcs_kg: 0.92, weight_kg: 0.00092, wd_basic: 139, wd_landing: 164, status: "active" },
  { id: "35D25", sku: "35D25", item_code: "35D25", sr_no: 3, name: "CSK Drywall Screws 3.5X25", category: "CSK Drywall Screws", category_section: "01 DRY WALL SCREWS", size: "3.5X25", size_mm: "3.5 x 25", qty_per_box: 1000, mrp: 450, rate: 450, price: 450, dealer_landing: 225, cost: 225, wt_1000_pcs_kg: 1.13, weight_kg: 0.00113, wd_basic: 170, wd_landing: 201, status: "active" },
  { id: "35D32", sku: "35D32", item_code: "35D32", sr_no: 4, name: "CSK Drywall Screws 3.5X32", category: "CSK Drywall Screws", category_section: "01 DRY WALL SCREWS", size: "3.5X32", size_mm: "3.5 x 32", qty_per_box: 750,  mrp: 452, rate: 452, price: 452, dealer_landing: 226, cost: 226, wt_1000_pcs_kg: 1.35, weight_kg: 0.00135, wd_basic: 171, wd_landing: 202, status: "active" },
  { id: "35D38", sku: "35D38", item_code: "35D38", sr_no: 5, name: "CSK Drywall Screws 3.5X38", category: "CSK Drywall Screws", category_section: "01 DRY WALL SCREWS", size: "3.5X38", size_mm: "3.5 x 38", qty_per_box: 500,  mrp: 351, rate: 351, price: 351, dealer_landing: 175, cost: 175, wt_1000_pcs_kg: 1.53, weight_kg: 0.00153, wd_basic: 133, wd_landing: 157, status: "active" },
  { id: "35D50", sku: "35D50", item_code: "35D50", sr_no: 6, name: "CSK Drywall Screws 3.5X50", category: "CSK Drywall Screws", category_section: "01 DRY WALL SCREWS", size: "3.5X50", size_mm: "3.5 x 50", qty_per_box: 500,  mrp: 641, rate: 641, price: 641, dealer_landing: 321, cost: 321, wt_1000_pcs_kg: 1.91, weight_kg: 0.00191, wd_basic: 243, wd_landing: 286, status: "active" },
  { id: "35D60", sku: "35D60", item_code: "35D60", sr_no: 7, name: "CSK Drywall Screws 3.5X60", category: "CSK Drywall Screws", category_section: "01 DRY WALL SCREWS", size: "3.5X60", size_mm: "3.5 x 60", qty_per_box: 400,  mrp: 619, rate: 619, price: 619, dealer_landing: 309, cost: 309, wt_1000_pcs_kg: 2.28, weight_kg: 0.00228, wd_basic: 234, wd_landing: 276, status: "active" },
  { id: "35D75", sku: "35D75", item_code: "35D75", sr_no: 8, name: "CSK Drywall Screws 3.5X75", category: "CSK Drywall Screws", category_section: "01 DRY WALL SCREWS", size: "3.5X75", size_mm: "3.5 x 75", qty_per_box: 200,  mrp: 774, rate: 774, price: 774, dealer_landing: 387, cost: 387, wt_1000_pcs_kg: 2.68, weight_kg: 0.00268, wd_basic: 293, wd_landing: 346, status: "active" },

  // SECTION 02: CHIPBOARD SCREWS (ZINC)
  { id: "4CB16", sku: "4CB16", item_code: "4CB16", sr_no: 1, name: "CSK Chipboard Screws 4X16", category: "CSK Chipboard Screws", category_section: "02 CHIPBOARD SCREWS (ZINC)", size: "4X16", size_mm: "4 x 16", qty_per_box: 1000, mrp: 556, rate: 556, price: 556, dealer_landing: 278, cost: 278, wt_1000_pcs_kg: 1.000, weight_kg: 0.00100, wd_basic: 195, wd_landing: 231, status: "active" },
  { id: "4CB20", sku: "4CB20", item_code: "4CB20", sr_no: 2, name: "CSK Chipboard Screws 4X20", category: "CSK Chipboard Screws", category_section: "02 CHIPBOARD SCREWS (ZINC)", size: "4X20", size_mm: "4 x 20", qty_per_box: 1000, mrp: 689, rate: 689, price: 689, dealer_landing: 345, cost: 345, wt_1000_pcs_kg: 1.290, weight_kg: 0.00129, wd_basic: 242, wd_landing: 286, status: "active" },
  { id: "4CB25", sku: "4CB25", item_code: "4CB25", sr_no: 3, name: "CSK Chipboard Screws 4X25", category: "CSK Chipboard Screws", category_section: "02 CHIPBOARD SCREWS (ZINC)", size: "4X25", size_mm: "4 x 25", qty_per_box: 1000, mrp: 791, rate: 791, price: 791, dealer_landing: 395, cost: 395, wt_1000_pcs_kg: 1.480, weight_kg: 0.00148, wd_basic: 278, wd_landing: 328, status: "active" },
  { id: "4CB30", sku: "4CB30", item_code: "4CB30", sr_no: 4, name: "CSK Chipboard Screws 4X30", category: "CSK Chipboard Screws", category_section: "02 CHIPBOARD SCREWS (ZINC)", size: "4X30", size_mm: "4 x 30", qty_per_box: 1000, mrp: 940, rate: 940, price: 940, dealer_landing: 470, cost: 470, wt_1000_pcs_kg: 1.760, weight_kg: 0.00176, wd_basic: 331, wd_landing: 390, status: "active" },
  { id: "4CB35", sku: "4CB35", item_code: "4CB35", sr_no: 5, name: "CSK Chipboard Screws 4X35", category: "CSK Chipboard Screws", category_section: "02 CHIPBOARD SCREWS (ZINC)", size: "4X35", size_mm: "4 x 35", qty_per_box: 500,  mrp: 756, rate: 756, price: 756, dealer_landing: 378, cost: 378, wt_1000_pcs_kg: 1.940, weight_kg: 0.00194, wd_basic: 266, wd_landing: 314, status: "active" },
  { id: "4CB40", sku: "4CB40", item_code: "4CB40", sr_no: 6, name: "CSK Chipboard Screws 4X40", category: "CSK Chipboard Screws", category_section: "02 CHIPBOARD SCREWS (ZINC)", size: "4X40", size_mm: "4 x 40", qty_per_box: 500,  mrp: 869, rate: 869, price: 869, dealer_landing: 434, cost: 434, wt_1000_pcs_kg: 2.230, weight_kg: 0.00223, wd_basic: 306, wd_landing: 361, status: "active" },
  { id: "4CB45", sku: "4CB45", item_code: "4CB45", sr_no: 7, name: "CSK Chipboard Screws 4X45", category: "CSK Chipboard Screws", category_section: "02 CHIPBOARD SCREWS (ZINC)", size: "4X45", size_mm: "4 x 45", qty_per_box: 500,  mrp: 1846, rate: 1846, price: 1846, dealer_landing: 923, cost: 923, wt_1000_pcs_kg: 2.480, weight_kg: 0.00248, wd_basic: 649, wd_landing: 766, status: "active" },
  { id: "4CB50", sku: "4CB50", item_code: "4CB50", sr_no: 8, name: "CSK Chipboard Screws 4X50", category: "CSK Chipboard Screws", category_section: "02 CHIPBOARD SCREWS (ZINC)", size: "4X50", size_mm: "4 x 50", qty_per_box: 400,  mrp: 1620, rate: 1620, price: 1620, dealer_landing: 810, cost: 810, wt_1000_pcs_kg: 2.720, weight_kg: 0.00272, wd_basic: 570, wd_landing: 672, status: "active" },

  // 5mm Chipboard Screws
  { id: "5CB20", sku: "5CB20", item_code: "5CB20", sr_no: 9, name: "CSK Chipboard Screws 5X20", category: "CSK Chipboard Screws", category_section: "02 CHIPBOARD SCREWS (ZINC)", size: "5X20", size_mm: "5 x 20", qty_per_box: 500,  mrp: 1100, rate: 1100, price: 1100, dealer_landing: 550, cost: 550, wt_1000_pcs_kg: 2.310, weight_kg: 0.00231, wd_basic: 385, wd_landing: 454, status: "active" },
  { id: "5CB25", sku: "5CB25", item_code: "5CB25", sr_no: 10, name: "CSK Chipboard Screws 5X25", category: "CSK Chipboard Screws", category_section: "02 CHIPBOARD SCREWS (ZINC)", size: "5X25", size_mm: "5 x 25", qty_per_box: 500,  mrp: 1250, rate: 1250, price: 1250, dealer_landing: 625, cost: 625, wt_1000_pcs_kg: 2.600, weight_kg: 0.00260, wd_basic: 438, wd_landing: 517, status: "active" },
  { id: "5CB30", sku: "5CB30", item_code: "5CB30", sr_no: 11, name: "CSK Chipboard Screws 5X30", category: "CSK Chipboard Screws", category_section: "02 CHIPBOARD SCREWS (ZINC)", size: "5X30", size_mm: "5 x 30", qty_per_box: 500,  mrp: 1400, rate: 1400, price: 1400, dealer_landing: 700, cost: 700, wt_1000_pcs_kg: 2.890, weight_kg: 0.00289, wd_basic: 490, wd_landing: 578, status: "active" },
  { id: "5CB35", sku: "5CB35", item_code: "5CB35", sr_no: 12, name: "CSK Chipboard Screws 5X35", category: "CSK Chipboard Screws", category_section: "02 CHIPBOARD SCREWS (ZINC)", size: "5X35", size_mm: "5 x 35", qty_per_box: 400,  mrp: 1550, rate: 1550, price: 1550, dealer_landing: 775, cost: 775, wt_1000_pcs_kg: 3.180, weight_kg: 0.00318, wd_basic: 543, wd_landing: 640, status: "active" },
  { id: "5CB40", sku: "5CB40", item_code: "5CB40", sr_no: 13, name: "CSK Chipboard Screws 5X40", category: "CSK Chipboard Screws", category_section: "02 CHIPBOARD SCREWS (ZINC)", size: "5X40", size_mm: "5 x 40", qty_per_box: 400,  mrp: 1700, rate: 1700, price: 1700, dealer_landing: 850, cost: 850, wt_1000_pcs_kg: 3.470, weight_kg: 0.00347, wd_basic: 595, wd_landing: 702, status: "active" },
  { id: "5CB45", sku: "5CB45", item_code: "5CB45", sr_no: 14, name: "CSK Chipboard Screws 5X45", category: "CSK Chipboard Screws", category_section: "02 CHIPBOARD SCREWS (ZINC)", size: "5X45", size_mm: "5 x 45", qty_per_box: 300,  mrp: 1850, rate: 1850, price: 1850, dealer_landing: 925, cost: 925, wt_1000_pcs_kg: 3.770, weight_kg: 0.00377, wd_basic: 648, wd_landing: 765, status: "active" },
  { id: "5CB50", sku: "5CB50", item_code: "5CB50", sr_no: 15, name: "CSK Chipboard Screws 5X50", category: "CSK Chipboard Screws", category_section: "02 CHIPBOARD SCREWS (ZINC)", size: "5X50", size_mm: "5 x 50", qty_per_box: 300,  mrp: 2000, rate: 2000, price: 2000, dealer_landing: 1000, cost: 1000, wt_1000_pcs_kg: 4.050, weight_kg: 0.00405, wd_basic: 700, wd_landing: 826, status: "active" },
];

function filterProductsHelper(rawList, categoryFilter, q) {
  let list = Array.isArray(rawList) && rawList.length > 0 ? rawList : MASTER_PRICE_LIST_PRODUCTS;
  if (categoryFilter && categoryFilter !== "All") {
    const catClean = categoryFilter.replace("CSK ", "").replace(" (Zinc)", "").replace("Screws", "").trim().toLowerCase();
    list = list.filter(p => 
      (p.category || "").toLowerCase().includes(catClean) || 
      (p.category_section || "").toLowerCase().includes(catClean)
    );
  }
  if (q) {
    const qClean = q.trim().toLowerCase();
    list = list.filter(p => 
      (p.name || "").toLowerCase().includes(qClean) ||
      (p.sku || "").toLowerCase().includes(qClean) ||
      (p.size || "").toLowerCase().includes(qClean) ||
      (p.size_mm || "").toLowerCase().includes(qClean)
    );
  }
  return list;
}

export default function ProductsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [products, setProducts] = useState(MASTER_PRICE_LIST_PRODUCTS);
  const [categories, setCategories] = useState([]);
  const [q, setQ] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyProduct);
  const [categoryForm, setCategoryForm] = useState({ name: "", description: "" });
  const [editingCategory, setEditingCategory] = useState(null);

  const loadCategories = async () => {
    try {
      const { data } = await api.get("/categories");
      if (Array.isArray(data) && data.length > 0) {
        setCategories(data);
      } else {
        setCategories([
          { name: "CSK Chipboard Screws", description: "Chipboard Screws (Zinc) - Price List YFS-PL-001" },
          { name: "CSK Drywall Screws", description: "Dry Wall Screws - Price List YFS-PL-001" }
        ]);
      }
    } catch {
      setCategories([
        { name: "CSK Chipboard Screws", description: "Chipboard Screws (Zinc) - Price List YFS-PL-001" },
        { name: "CSK Drywall Screws", description: "Dry Wall Screws - Price List YFS-PL-001" }
      ]);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/products", { params: { q, category: categoryFilter } });
      const filtered = filterProductsHelper(data, categoryFilter, q);
      setProducts(filtered);
    } catch {
      const filtered = filterProductsHelper(MASTER_PRICE_LIST_PRODUCTS, categoryFilter, q);
      setProducts(filtered);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [q, categoryFilter]);

  useEffect(() => {
    loadCategories();
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm({
      ...emptyProduct,
      category: categories[0]?.name || emptyProduct.category
    });
    setDialogOpen(true);
  };
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

  const saveCategory = async () => {
    const nameVal = (categoryForm.name || "").trim();
    if (!nameVal) {
      toast.error("Category name is required");
      return;
    }
    try {
      if (editingCategory) {
        await api.put(`/categories/${editingCategory.id || editingCategory._id}`, {
          name: nameVal,
          description: categoryForm.description
        });
        toast.success("Category updated");
      } else {
        await api.post("/categories", {
          name: nameVal,
          description: categoryForm.description
        });
        toast.success("Category created");
      }
      setCategoryForm({ name: "", description: "" });
      setEditingCategory(null);
      loadCategories();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to save category");
    }
  };

  const editCategory = (cat) => {
    setEditingCategory(cat);
    setCategoryForm({ name: cat.name, description: cat.description || "" });
  };

  const deleteCategory = async (cat) => {
    if (!window.confirm(`Delete category "${cat.name}"?`)) return;
    try {
      await api.delete(`/categories/${cat.id || cat._id}`);
      toast.success("Category deleted");
      loadCategories();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to delete category");
    }
  };

  return (
    <AppShell
      title="Product & Fastener Catalog"
      subtitle={`${products.length} registered items (Enriched with Total Weight Matrix Specifications & Exact Rates)`}
      actions={
        isAdmin && (
          <div className="flex gap-2">
            <button onClick={() => { setCategoryForm({ name: "", description: "" }); setEditingCategory(null); setCategoryDialogOpen(true); }} className="inline-flex items-center gap-2 px-4 h-9 rounded-md border border-[#E5E7EB] bg-white text-[#1D242B] text-sm font-semibold shadow-sm hover:bg-[#F8FAFC] transition-all">
              <Tag size={14} weight="bold" /> Manage Categories
            </button>
            <button onClick={openNew} className="inline-flex items-center gap-2 px-4 h-9 rounded-md gradient-brand-accent text-white text-sm font-semibold shadow-sm hover:shadow-md transition-all" data-testid="new-product-button">
              <Plus size={14} weight="bold" /> New Fastener / SKU
            </button>
          </div>
        )
      }
    >
      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
        {["All", ...categories.map(c => c.name)].map((c) => (
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

      {/* Price List Document Control Banner */}
      <div className="bg-[#0A1E3B] text-white p-4 rounded-lg mb-6 shadow-sm border border-[#1E3A8A] flex flex-wrap justify-between items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-[#F28C18] text-white text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-widest">OFFICIAL PRICE LIST 2026</span>
            <span className="text-xs text-slate-300 font-mono">CODE: YFS-PL-001 | REV: 01</span>
          </div>
          <h3 className="text-base font-bold text-white mt-1">YAMINI FASTENING SOLUTIONS — PRODUCT & PRICE LIST CATALOG</h3>
          <p className="text-xs text-slate-300 mt-0.5">Built for Strength. Built for Trust. Prices Inclusive of GST. Effective From: 06 June 2026</p>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono bg-[#11284A] px-3.5 py-2 rounded-md border border-[#1E3A8A]">
          <div><span className="text-slate-400 block text-[10px] uppercase">Effective Date</span><span className="font-bold text-amber-400">06 JUN 2026</span></div>
          <div className="h-6 w-px bg-slate-700"></div>
          <div><span className="text-slate-400 block text-[10px] uppercase">Packing Options</span><span className="font-semibold text-white">200 / 250 / 500 / 1000 PCS</span></div>
          <div className="h-6 w-px bg-slate-700"></div>
          <div><span className="text-slate-400 block text-[10px] uppercase">Confidentiality</span><span className="font-semibold text-emerald-400">PUBLIC</span></div>
        </div>
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
                { key: "sr_no", label: "SR NO." },
                { key: "sku", label: "SKU / Item Code" },
                { key: "name", label: "Product Description" },
                { key: "size_mm", label: "Size (mm)" },
                { key: "category", label: "Category" },
                { key: "wt_1000_pcs_kg", label: "WT / 1000 PCS (KG)" },
                { key: "qty_per_box", label: "Qty / Box (PCS)" },
                { key: "mrp", label: "MRP (INR)" },
                { key: "dealer_landing", label: "Dealer Landing (INR)" },
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
                  <th className="w-12 text-center">SR NO.</th>
                  <th>SKU / Code</th>
                  <th>Product Description</th>
                  <th>Size (mm)</th>
                  <th>Category</th>
                  <th className="text-right">WT / 1000 PCS</th>
                  <th className="text-right">Qty/Box</th>
                  <th className="text-right">MRP (₹)</th>
                  <th className="text-right">Dealer Landing (₹)</th>
                  <th className="text-right">WD Landing (₹)</th>
                  <th>Status</th>
                  {isAdmin && <th></th>}
                </tr>
              </thead>
              <tbody>
                {products.map((p, idx) => (
                  <tr key={p.id || p.sku} data-testid={`product-row-${p.sku}`}>
                    <td className="text-center font-mono text-xs text-slate-500 font-bold">{p.sr_no || idx + 1}</td>
                    <td className="font-mono font-bold text-xs text-[#1D242B] bg-[#F3F4F6] px-2 py-1 rounded w-max">{p.sku}</td>
                    <td className="font-medium text-[#1D242B]">{p.name}</td>
                    <td className="font-mono font-bold text-sm text-[#4B5563]">{p.size_mm || p.size || "—"}</td>
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
                    <td className="text-right tabular font-mono font-bold">{p.qty_per_box || p.moq || "—"}</td>
                    <td className="text-right tabular font-mono font-bold text-[#1D242B]">{fmt.inr(p.mrp || p.price)}</td>
                    <td className="text-right tabular font-mono font-bold text-[#16A34A] bg-emerald-50/50">
                      {fmt.inr(p.dealer_landing || p.cost)}
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
              <select value={form.category || ""} onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full h-10 px-3 rounded-md border border-[#E5E7EB] text-sm bg-white focus:border-[#F28C18]">
                {categories.map((cat) => (
                  <option key={cat.id || cat._id} value={cat.name}>{cat.name}</option>
                ))}
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

      {/* Category Management Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Product Categories</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-4">
            {/* Add / Edit Category Form */}
            <div className="bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0] space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#1D242B]">
                {editingCategory ? "Edit Category" : "Add New Category"}
              </h4>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Category Name (e.g. Washers)"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  className="w-full h-9 px-3 rounded-md border border-[#E5E7EB] text-sm focus:border-[#F28C18] outline-none bg-white"
                />
                <input
                  type="text"
                  placeholder="Description"
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  className="w-full h-9 px-3 rounded-md border border-[#E5E7EB] text-sm focus:border-[#F28C18] outline-none bg-white"
                />
              </div>
              <div className="flex gap-2 justify-end">
                {editingCategory && (
                  <button
                    onClick={() => { setEditingCategory(null); setCategoryForm({ name: "", description: "" }); }}
                    className="h-8 px-3 rounded-md border border-[#E5E7EB] text-xs"
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={saveCategory}
                  className="h-8 px-4 rounded-md gradient-brand-accent text-white text-xs font-semibold"
                >
                  {editingCategory ? "Update" : "Add Category"}
                </button>
              </div>
            </div>

            {/* List of current categories */}
            <div className="max-h-[35vh] overflow-y-auto pr-1 space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#5C6670]">Existing Categories</label>
              {categories.length === 0 ? (
                <p className="text-xs text-center text-[#5C6670] py-4">No categories registered.</p>
              ) : (
                categories.map((cat) => (
                  <div key={cat.id || cat._id} className="flex items-center justify-between p-2.5 rounded-md border border-[#E5E7EB] hover:bg-[#F8FAFC]">
                    <div>
                      <p className="text-sm font-semibold text-[#1D242B]">{cat.name}</p>
                      {cat.description && <p className="text-xs text-[#5C6670]">{cat.description}</p>}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => editCategory(cat)} className="p-1 rounded hover:bg-[#E2E8F0] text-[#5C6670]">
                        <PencilSimple size={14} />
                      </button>
                      <button onClick={() => deleteCategory(cat)} className="p-1 rounded hover:bg-red-50 text-red-500">
                        <Trash size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setCategoryDialogOpen(false)} className="h-9 px-4 rounded-md border border-[#E5E7EB] text-sm">Close</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
