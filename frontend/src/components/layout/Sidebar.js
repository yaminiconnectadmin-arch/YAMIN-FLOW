import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  ChartBar, Package, Warehouse, Users, Truck, ShoppingCart, TrendUp,
  Robot, Bell, ClipboardText, GearSix, Storefront, Receipt, FileText,
  Handshake, MapTrifold, ArrowsClockwise, ShieldCheck,
} from "@phosphor-icons/react";

const NAV = {
  admin: [
    { section: "Overview" },
    { to: "/dashboard", label: "Dashboard", icon: ChartBar },
    { to: "/analytics", label: "Analytics", icon: TrendUp },
    { to: "/ai-insights", label: "AI Insights", icon: Robot },
    { section: "Distribution" },
    { to: "/products", label: "Products", icon: Package },
    { to: "/inventory", label: "Inventory", icon: Warehouse },
    { to: "/orders", label: "Orders", icon: ShoppingCart },
    { to: "/procurement", label: "Procurement", icon: ClipboardText },
    { to: "/purchase-orders", label: "Purchase Orders", icon: Receipt },
    { section: "Network" },
    { to: "/dealers", label: "Dealers", icon: Storefront },
    { to: "/mnp", label: "MNP Personnel", icon: MapTrifold },
    { to: "/suppliers", label: "Suppliers", icon: Handshake },
    { to: "/warehouses", label: "Warehouses", icon: Warehouse },
    { section: "System" },
    { to: "/tally", label: "Tally Sync", icon: ArrowsClockwise },
    { to: "/notifications", label: "Notifications", icon: Bell },
    { to: "/audit", label: "Audit Logs", icon: ShieldCheck },
    { to: "/settings", label: "Settings", icon: GearSix },
  ],
  dealer: [
    { section: "My Store" },
    { to: "/dashboard", label: "Dashboard", icon: ChartBar },
    { to: "/browse", label: "Browse Products", icon: Package },
    { to: "/orders", label: "My Orders", icon: ShoppingCart },
    { to: "/invoices", label: "Invoices", icon: FileText },
    { to: "/notifications", label: "Notifications", icon: Bell },
  ],
  mnp: [
    { section: "Field Operations" },
    { to: "/dashboard", label: "Dashboard", icon: ChartBar },
    { to: "/analytics", label: "Analytics", icon: TrendUp },
    { to: "/dealers", label: "My Dealers", icon: Storefront },
    { to: "/orders", label: "Orders", icon: ShoppingCart },
    { to: "/ai-insights", label: "AI Insights", icon: Robot },
    { to: "/notifications", label: "Notifications", icon: Bell },
  ],
  supplier: [
    { section: "Supply" },
    { to: "/dashboard", label: "Dashboard", icon: ChartBar },
    { to: "/purchase-orders", label: "Purchase Orders", icon: Receipt },
    { to: "/notifications", label: "Notifications", icon: Bell },
  ],
};

export default function Sidebar() {
  const { user } = useAuth();
  const items = NAV[user?.role] || [];
  const location = useLocation();

  return (
    <aside className="yf-sidebar w-[260px] flex-shrink-0 flex flex-col h-screen" data-testid="app-sidebar">
      <div className="px-6 py-5 border-b border-white/5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-md gradient-brand-accent flex items-center justify-center font-display text-white font-bold shadow-lg">
          YF
        </div>
        <div className="leading-tight">
          <div className="text-white font-display font-semibold text-[15px]">YAMINI FLOW</div>
          <div className="text-[11px] text-white/50 tracking-widest uppercase">Distribution OS</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {items.map((item, idx) => {
          if (item.section) {
            return (
              <div key={idx} className="px-3 pt-4 pb-1 text-[10px] font-semibold tracking-[0.15em] uppercase text-white/40">
                {item.section}
              </div>
            );
          }
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              data-testid={`sidebar-${item.to.replace("/", "")}-link`}
              className={({ isActive }) =>
                `yf-sidebar-item flex items-center gap-3 px-4 py-2.5 mx-1 rounded-md text-[13.5px] font-medium ${
                  isActive ? "active text-white" : "text-white/70 hover:text-white"
                }`
              }
            >
              <Icon size={18} weight={location.pathname === item.to ? "fill" : "regular"} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white text-sm font-semibold">
            {user?.name?.[0]?.toUpperCase() || "?"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-white text-sm font-medium truncate">{user?.name}</div>
            <div className="text-[11px] text-white/50 uppercase tracking-wider">{user?.role}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
