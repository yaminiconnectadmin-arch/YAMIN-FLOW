import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";
import { EmptyState } from "@/components/common/Common";
import { Plus, Minus, ShoppingCart, Scales, Stack, CheckCircle } from "@phosphor-icons/react";
import { toast } from "@/components/ui/sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

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

function filterDealerProducts(rawList, cat, q) {
  let list = Array.isArray(rawList) && rawList.length > 0 ? rawList : MASTER_PRICE_LIST_PRODUCTS;
  if (cat && cat !== "All") {
    const catClean = cat.replace("CSK ", "").replace(" (Zinc)", "").replace("Screws", "").trim().toLowerCase();
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

export default function DealerBrowse() {
  const { user } = useAuth();
  const [products, setProducts] = useState(MASTER_PRICE_LIST_PRODUCTS);
  const [dbCategories, setDbCategories] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("CSK Chipboard Screws");
  const [cart, setCart] = useState({});
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const navigate = useNavigate();

  // Interactive Fastener Configuration State
  const [selectedProductId, setSelectedProductId] = useState("4CB16");
  const [boxCount, setBoxCount] = useState(10);

  useEffect(() => {
    (async () => {
      try {
        const [catRes, whRes] = await Promise.all([
          api.get("/categories"),
          api.get("/warehouses").catch(() => ({ data: [] }))
        ]);
        setDbCategories(catRes.data);
        if (catRes.data.length > 0) {
          if (!catRes.data.some(c => c.name === "CSK Chipboard Screws")) {
            setCat(catRes.data[0].name);
          }
        }
        const whs = whRes.data || [];
        setWarehouses(whs);
        if (whs.length > 0) {
          const userState = (user?.state || "").toLowerCase().trim();
          const matched = whs.find(w => (w.state || "").toLowerCase().trim() === userState);
          setSelectedWarehouseId(matched ? matched.id : whs[0].id);
        }
      } catch {
        // use defaults
      }
    })();
  }, [user]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/products", { params: { q, category: cat === "All" ? "" : cat, status: "active" } });
        const filtered = filterDealerProducts(data, cat, q);
        setProducts(filtered);
        if (filtered.length > 0 && !selectedProductId) {
          setSelectedProductId(filtered[0].id);
        } else if (filtered.length > 0 && !filtered.some((p) => p.id === selectedProductId)) {
          setSelectedProductId(filtered[0].id);
        }
      } catch {
        const filtered = filterDealerProducts(MASTER_PRICE_LIST_PRODUCTS, cat, q);
        setProducts(filtered);
        if (filtered.length > 0) setSelectedProductId(filtered[0].id);
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
        dealer_id: user?.id,
        items: cartItems.map((i) => ({
          product_id: i.product.id,
          quantity: i.boxes,
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
                    <p className="text-xs text-[#94A3B8]">Select {cat} Size, Box option & Fulfillment Warehouse Hub</p>
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
                    1. Size & Spec Option
                  </label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-lg bg-[#0F172A] border border-[#475569] text-white text-xs font-medium focus:border-[#F28C18] focus:ring-2 focus:ring-[#F28C18]/30 outline-none"
                    data-testid="size-dropdown"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.size ? `Size: ${p.size}` : p.name} ({p.sku}) — {fmt.inr(p.dealer_landing || p.price)}/box
                      </option>
                    ))}
                  </select>
                </div>

                {/* Box Option Input */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#94A3B8] mb-2">
                    2. Box Quantity
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="1"
                      value={boxCount}
                      onChange={(e) => setBoxCount(parseInt(e.target.value) || 0)}
                      className="flex-1 h-11 px-3.5 rounded-lg bg-[#0F172A] border border-[#475569] text-white text-base font-mono font-bold focus:border-[#F28C18] focus:ring-2 focus:ring-[#F28C18]/30 outline-none"
                      data-testid="box-input"
                    />
                    <div className="bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-1.5 text-right flex-shrink-0">
                      <div className="text-[10px] text-[#94A3B8] uppercase tracking-wider">Packing</div>
                      <div className="font-mono text-xs font-bold text-[#FEF08A]">{qtyPerBox} pcs / box</div>
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

            {/* Smart Warehouse Allocation Notice */}
            <div className="p-3 bg-[#F8FAFC] border-b border-[#E5E7EB] text-xs">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase text-[#5C6670] tracking-wider mb-1">
                <span>Fulfillment Routing</span>
                <span className="text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded font-mono font-extrabold text-[9px]">
                  SMART ALLOCATED
                </span>
              </div>
              <div className="text-[11px] text-[#475569] leading-snug">
                Dispatched from optimal regional hub ({user?.state || "HQ Direct"}) based on live inventory &amp; shortest transit time.
              </div>
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
