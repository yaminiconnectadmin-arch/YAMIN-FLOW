import React, { useState, useEffect } from "react";
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

/** Detect if we're on a mobile-width viewport */
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    const handler = (e) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

export default function Sidebar({ open, onClose }) {
  const { user } = useAuth();
  const location = useLocation();
  const [showInstallModal, setShowInstallModal] = useState(false);
  const isMobile = useIsMobile();

  const isStaff = user?.role === "admin" && user?.admin_role === "staff";
  const rawItems = NAV[user?.role] || [];
  const items = isStaff ? filterNavForStaff(rawItems, user?.allowed_tabs) : rawItems;

  // On desktop: always show, no positioning tricks needed
  // On mobile: fixed drawer, shown only when open=true
  if (isMobile) {
    return (
      <>
        {/* Mobile drawer */}
        <aside
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            height: "100dvh",
            width: "280px",
            zIndex: 50,
            transform: open ? "translateX(0)" : "translateX(-100%)",
            transition: "transform 250ms cubic-bezier(0.25, 0.46, 0.45, 0.94)",
            display: "flex",
            flexDirection: "column",
          }}
          className="yf-sidebar shadow-2xl"
          data-testid="app-sidebar"
          aria-label="Main navigation"
        >
          <SidebarContent
            items={items}
            location={location}
            user={user}
            isStaff={isStaff}
            onClose={onClose}
            showInstallModal={showInstallModal}
            setShowInstallModal={setShowInstallModal}
            showCloseButton
          />
        </aside>
      </>
    );
  }

  // Desktop: static sidebar in the flex row
  return (
    <aside
      className="yf-sidebar flex-shrink-0 flex flex-col h-screen"
      style={{ width: "260px" }}
      data-testid="app-sidebar"
      aria-label="Main navigation"
    >
      <SidebarContent
        items={items}
        location={location}
        user={user}
        isStaff={isStaff}
        onClose={onClose}
        showInstallModal={showInstallModal}
        setShowInstallModal={setShowInstallModal}
        showCloseButton={false}
      />
    </aside>
  );
}

function SidebarContent({ items, location, user, isStaff, onClose, showInstallModal, setShowInstallModal, showCloseButton }) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Logo + close button ─────────────────────────────────────── */}
      <div className="px-6 py-5 border-b border-white/5 flex items-center gap-3.5 flex-shrink-0">
        <img
          src="/logo.png"
          alt="Yamini Flow Logo"
          className="w-10 h-10 rounded-lg object-cover shadow-lg border border-white/10 flex-shrink-0"
        />
        <div className="leading-tight flex-1 min-w-0">
          <div className="text-white font-display font-semibold text-[15px] tracking-wide">YAMINI FLOW</div>
          <div className="text-[10px] text-[#F28C18] font-medium tracking-widest uppercase mt-0.5">Distribution OS</div>
        </div>
        {showCloseButton && (
          <button
            style={{
              width: 32, height: 32,
              display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: 6, background: "transparent", border: "none",
              color: "rgba(255,255,255,0.6)", cursor: "pointer", flexShrink: 0,
            }}
            onClick={onClose}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* ── Navigation links ────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5" aria-label="App sections">
        {items.map((item, idx) => {
          if (item.section) {
            return (
              <div
                key={idx}
                className="px-3 pt-4 pb-1 text-[10px] font-semibold tracking-[0.15em] uppercase"
                style={{ color: "rgba(255,255,255,0.55)" }}
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
      <div className="px-3 py-2 border-t border-white/5 flex-shrink-0">
        <button
          onClick={() => setShowInstallModal(true)}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg border border-[#F28C18]/30 text-white font-medium text-[13px] transition-all shadow-sm"
          style={{ background: "linear-gradient(to right, rgba(242,140,24,0.2), rgba(242,140,24,0.1))" }}
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
      <div className="px-4 py-4 border-t border-white/5 flex-shrink-0">
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
    </div>
  );
}
