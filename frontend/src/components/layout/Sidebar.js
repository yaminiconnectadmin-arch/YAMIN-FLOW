import React, { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import InstallModal from "@/components/InstallPrompt";
import {
  ChartBar, Package, Warehouse, ShoppingCart, TrendUp,
  Bell, ClipboardText, GearSix, Storefront, Receipt, FileText,
  Handshake, MapTrifold, ArrowsClockwise, ShieldCheck, DeviceMobile,
  Crown, UserGear, X,
} from "@phosphor-icons/react";

const NAV = {
  admin: [
    { section: "Overview" },
    { to: "/dashboard",       label: "Dashboard",       icon: ChartBar,       tabKey: "dashboard" },
    { to: "/analytics",       label: "Analytics",       icon: TrendUp,        tabKey: "analytics" },
    { section: "Distribution" },
    { to: "/products",        label: "Products",        icon: Package,        tabKey: "products" },
    { to: "/inventory",       label: "Inventory",       icon: Warehouse,      tabKey: "inventory" },
    { to: "/orders",          label: "Orders",          icon: ShoppingCart,   tabKey: "orders" },
    { to: "/procurement",     label: "Procurement",     icon: ClipboardText,  tabKey: "procurement" },
    { to: "/purchase-orders", label: "Purchase Orders", icon: Receipt,        tabKey: "purchase-orders" },
    { section: "Network" },
    { to: "/dealers",         label: "Dealers",         icon: Storefront,     tabKey: "dealers" },
    { to: "/cnf",             label: "CNF Personnel",   icon: MapTrifold,     tabKey: "cnf" },
    { to: "/suppliers",       label: "Suppliers",       icon: Handshake,      tabKey: "suppliers" },
    { to: "/warehouses",      label: "Warehouses",      icon: Warehouse,      tabKey: "warehouses" },
    { section: "System" },
    { to: "/tally",           label: "Tally Sync",      icon: ArrowsClockwise,tabKey: "tally" },
    { to: "/notifications",   label: "Notifications",   icon: Bell,           tabKey: "notifications" },
    { to: "/audit",           label: "Audit Logs",      icon: ShieldCheck,    tabKey: "audit" },
    { to: "/settings",        label: "Settings",        icon: GearSix,        tabKey: "settings" },
  ],
  dealer: [
    { section: "My Store" },
    { to: "/dashboard", label: "Dashboard",        icon: ChartBar },
    { to: "/browse",    label: "Browse Products",  icon: Package },
    { to: "/orders",    label: "My Orders",        icon: ShoppingCart },
    { to: "/invoices",  label: "Invoices",         icon: FileText },
    { to: "/notifications", label: "Notifications", icon: Bell },
  ],
  cnf: [
    { section: "Field Operations" },
    { to: "/dashboard",     label: "Dashboard",    icon: ChartBar },
    { to: "/analytics",     label: "Analytics",    icon: TrendUp },
    { to: "/dealers",       label: "My Dealers",   icon: Storefront },
    { to: "/orders",        label: "Orders",        icon: ShoppingCart },
    { to: "/notifications", label: "Notifications", icon: Bell },
  ],
  mnp: [
    { section: "Field Operations" },
    { to: "/dashboard",     label: "Dashboard",    icon: ChartBar },
    { to: "/analytics",     label: "Analytics",    icon: TrendUp },
    { to: "/dealers",       label: "My Dealers",   icon: Storefront },
    { to: "/orders",        label: "Orders",        icon: ShoppingCart },
    { to: "/notifications", label: "Notifications", icon: Bell },
  ],
  supplier: [
    { section: "Supply" },
    { to: "/dashboard",       label: "Dashboard",       icon: ChartBar },
    { to: "/purchase-orders", label: "Purchase Orders", icon: Receipt },
    { to: "/notifications",   label: "Notifications",   icon: Bell },
  ],
};

/** Filter admin nav items based on the staff user's allowed_tabs */
function filterNavForStaff(items, allowedTabs) {
  if (!allowedTabs || allowedTabs.includes("all")) return items;
  return items.filter((item) => {
    if (item.section) return true;
    if (!item.tabKey) return true;
    return allowedTabs.includes(item.tabKey);
  }).filter((item, idx, arr) => {
    if (!item.section) return true;
    const nextSectionIdx = arr.findIndex((x, i) => i > idx && x.section);
    const siblings = arr.slice(idx + 1, nextSectionIdx === -1 ? undefined : nextSectionIdx);
    return siblings.some((s) => !s.section);
  });
}

export default function Sidebar({ open, onClose }) {
  const { user } = useAuth();
  const location = useLocation();
  const [showInstallModal, setShowInstallModal] = useState(false);

  const isStaff = user?.role === "admin" && user?.admin_role === "staff";
  const rawItems = NAV[user?.role] || [];
  const items = isStaff ? filterNavForStaff(rawItems, user?.allowed_tabs) : rawItems;

  // On mobile: sidebar is a fixed drawer controlled by `open` prop.
  // On desktop (md+): always visible, `open` prop is ignored.
  const drawerClass = [
    "yf-sidebar flex-shrink-0 flex flex-col h-screen",
    // Desktop: static position inside flex row, always visible
    "md:relative md:translate-x-0 md:w-[260px] md:z-auto",
    // Mobile: fixed full-height slide-in drawer
    "max-md:fixed max-md:top-0 max-md:left-0 max-md:z-50 max-md:w-[280px] max-md:shadow-2xl",
    // Mobile visibility gating
    open ? "max-md:yf-sidebar-drawer-open" : "max-md:hidden",
  ].join(" ");

  return (
    <aside className={drawerClass} data-testid="app-sidebar" aria-label="Main navigation">
      {/* ── Logo + close button ─────────────────────────────────────── */}
      <div className="px-6 py-5 border-b border-white/5 flex items-center gap-3.5">
        <img
          src="/logo.png"
          alt="Yamini Flow Logo"
          className="w-10 h-10 rounded-lg object-cover shadow-lg border border-white/10 flex-shrink-0"
        />
        <div className="leading-tight flex-1 min-w-0">
          <div className="text-white font-display font-semibold text-[15px] tracking-wide">YAMINI FLOW</div>
          <div className="text-[10px] text-[#F28C18] font-medium tracking-widest uppercase mt-0.5">Distribution OS</div>
        </div>
        {/* Close button — mobile only */}
        <button
          className="md:hidden w-8 h-8 flex items-center justify-center rounded-md hover:bg-white/10 text-white/60 hover:text-white transition-colors flex-shrink-0"
          onClick={onClose}
          aria-label="Close navigation"
        >
          <X size={18} />
        </button>
      </div>

      {/* ── Navigation links ────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5" aria-label="App sections">
        {items.map((item, idx) => {
          if (item.section) {
            return (
              <div
                key={idx}
                className="px-3 pt-4 pb-1 text-[10px] font-semibold tracking-[0.15em] uppercase text-white/55"
              >
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
              onClick={onClose}
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

      {/* ── Install app button ──────────────────────────────────────── */}
      <div className="px-3 py-2 border-t border-white/5">
        <button
          onClick={() => setShowInstallModal(true)}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg bg-gradient-to-r from-[#F28C18]/20 to-[#F28C18]/10 hover:from-[#F28C18]/30 hover:to-[#F28C18]/20 border border-[#F28C18]/30 text-white font-medium text-[13px] transition-all shadow-sm"
          data-testid="sidebar-install-app-btn"
          aria-label="Install Yamini Flow app"
        >
          <div className="w-6 h-6 rounded-md bg-[#F28C18] flex items-center justify-center text-white flex-shrink-0 shadow">
            <DeviceMobile size={15} weight="bold" />
          </div>
          <div className="text-left leading-tight">
            <div className="font-semibold text-white">Add App to Device</div>
            <div className="text-[10px] text-[#F28C18]">Install Yamini Flow</div>
          </div>
        </button>
      </div>

      {/* ── User strip with role badge ──────────────────────────────── */}
      <div className="px-4 py-4 border-t border-white/5">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
            aria-hidden="true"
          >
            {user?.name?.[0]?.toUpperCase() || "?"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-white text-sm font-medium truncate">{user?.name}</div>
            {user?.role === "admin" ? (
              isStaff ? (
                <div className="flex items-center gap-1 mt-0.5">
                  <UserGear size={11} weight="fill" className="text-blue-400 flex-shrink-0" />
                  <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider">Staff Access</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 mt-0.5">
                  <Crown size={11} weight="fill" className="text-[#F28C18] flex-shrink-0" />
                  <span className="text-[10px] font-semibold text-[#F28C18] uppercase tracking-wider">Super Admin</span>
                </div>
              )
            ) : (
              <div className="text-[11px] text-white/50 uppercase tracking-wider">{user?.role}</div>
            )}
          </div>
        </div>
      </div>

      <InstallModal isOpen={showInstallModal} onClose={() => setShowInstallModal(false)} />
    </aside>
  );
}
