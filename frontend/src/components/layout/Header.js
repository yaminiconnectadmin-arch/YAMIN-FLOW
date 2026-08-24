import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { MagnifyingGlass, Bell, SignOut, List, X } from "@phosphor-icons/react";
import { Link, useNavigate } from "react-router-dom";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

export default function Header({ title, subtitle, actions, onMenuClick }) {
  const { user, logout } = useAuth();
  const [notifCount, setNotifCount] = useState(0);
  const [notifs, setNotifs] = useState([]);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const { data } = await api.get("/notifications");
        if (!mounted) return;
        setNotifs(data.slice(0, 5));
        setNotifCount(data.filter((n) => !n.read).length);
      } catch (e) { /* ignore */ }
    };
    load();
    const t = setInterval(load, 30000);
    return () => { mounted = false; clearInterval(t); };
  }, []);

  return (
    <header
      className="flex items-center justify-between bg-white border-b border-[#E5E7EB] relative z-10"
      style={{
        height: isMobile ? 56 : 64,
        flexShrink: 0,
        paddingLeft: isMobile ? 16 : 32,
        paddingRight: isMobile ? 16 : 32,
      }}
      data-testid="app-header"
    >
      {/* ── Left: hamburger (mobile) + title ─────────── */}
      <div className="flex items-center gap-3 min-w-0 flex-1">

        {/* Hamburger button — only on mobile */}
        {isMobile && !mobileSearchOpen && (
          <button
            style={{
              width: 36, height: 36, display: "flex", alignItems: "center",
              justifyContent: "center", borderRadius: 6, background: "transparent",
              border: "none", color: "#06182F", cursor: "pointer", flexShrink: 0,
            }}
            onClick={onMenuClick}
            aria-label="Open navigation menu"
            data-testid="hamburger-menu-btn"
          >
            <List size={22} />
          </button>
        )}

        {/* Title */}
        {!mobileSearchOpen && (
          <div className="min-w-0">
            <h1
              className="font-display font-semibold text-[#06182F] leading-tight truncate"
              style={{ fontSize: isMobile ? 16 : 18 }}
              data-testid="page-title"
            >
              {title}
            </h1>
            {subtitle && !isMobile ? (
              <p className="text-xs text-[#5C6670] mt-0.5 truncate">{subtitle}</p>
            ) : null}
          </div>
        )}

        {/* Mobile expanded search */}
        {mobileSearchOpen && isMobile && (
          <div
            className="flex-1 flex items-center gap-2 rounded-md px-3 py-2"
            style={{ background: "white", border: "1px solid rgba(242,140,24,0.4)" }}
          >
            <MagnifyingGlass size={16} className="text-[#5C6670] flex-shrink-0" />
            <input
              autoFocus
              className="bg-transparent border-0 outline-none text-sm text-[#06182F] placeholder:text-[#BFC5CB] flex-1 min-w-0"
              placeholder="Search orders, products, dealers…"
              data-testid="mobile-search-input"
            />
            <button
              onClick={() => setMobileSearchOpen(false)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#5C6670", flexShrink: 0 }}
              aria-label="Close search"
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>

      {/* ── Right: search + actions + notif + user ────── */}
      <div className="flex items-center gap-2 flex-shrink-0">

        {/* Desktop search bar */}
        {!isMobile && (
          <div className="flex items-center gap-2 bg-[#F4F5F7] rounded-md px-3 py-2 border border-transparent focus-within:border-[#F28C18]/40 focus-within:bg-white transition-colors"
            style={{ width: 280 }}>
            <MagnifyingGlass size={16} className="text-[#5C6670]" />
            <input
              className="bg-transparent border-0 outline-none text-sm text-[#06182F] placeholder:text-[#BFC5CB] flex-1"
              placeholder="Search orders, products, dealers…"
              data-testid="global-search-input"
            />
            <kbd className="text-[10px] text-[#BFC5CB] font-mono px-1.5 py-0.5 border border-[#E5E7EB] rounded">⌘K</kbd>
          </div>
        )}

        {/* Mobile search icon */}
        {isMobile && !mobileSearchOpen && (
          <button
            style={{
              width: 36, height: 36, display: "flex", alignItems: "center",
              justifyContent: "center", borderRadius: 6, background: "transparent",
              border: "none", color: "#06182F", cursor: "pointer",
            }}
            onClick={() => setMobileSearchOpen(true)}
            aria-label="Open search"
            data-testid="mobile-search-btn"
          >
            <MagnifyingGlass size={20} />
          </button>
        )}

        {actions}

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="relative p-2 rounded-md hover:bg-[#F4F5F7] transition-colors"
              data-testid="notifications-button"
              aria-label={`Notifications${notifCount > 0 ? `, ${notifCount} unread` : ""}`}
            >
              <Bell size={20} className="text-[#06182F]" />
              {notifCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#F28C18] text-white text-[9px] font-bold flex items-center justify-center">
                  {notifCount > 9 ? "9+" : notifCount}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" style={{ width: Math.min(360, window.innerWidth * 0.9) }}>
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>Notifications</span>
              <Link to="/notifications" className="text-xs text-[#D96B0B] hover:underline">View all</Link>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifs.length === 0 ? (
              <div className="p-6 text-center text-sm text-[#5C6670]">No notifications</div>
            ) : (
              notifs.map((n) => (
                <DropdownMenuItem key={n.id} className="flex flex-col items-start gap-1 py-2.5 cursor-pointer">
                  <div className="text-sm font-medium text-[#06182F]">{n.title}</div>
                  <div className="text-xs text-[#5C6670] line-clamp-2">{n.body}</div>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-2 pl-1.5 pr-2 py-1.5 rounded-md hover:bg-[#F4F5F7] transition-colors"
              data-testid="user-menu"
              aria-label="User account menu"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0A2342] to-[#06182F] text-white flex items-center justify-center text-sm font-semibold">
                {user?.name?.[0]?.toUpperCase()}
              </div>
              {!isMobile && (
                <div className="text-left">
                  <div className="text-sm font-medium text-[#06182F] leading-tight">{user?.name}</div>
                  <div className="text-[10px] text-[#5C6670] uppercase tracking-wider">{user?.role}</div>
                </div>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[220px]">
            <DropdownMenuLabel>
              <div className="text-sm font-medium text-[#06182F]">{user?.name}</div>
              <div className="text-[11px] text-[#5C6670]">{user?.email}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {user?.role === "admin" && (
              <DropdownMenuItem onClick={() => navigate("/settings")} data-testid="settings-menu-item">
                Settings
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={logout} className="text-red-600" data-testid="logout-button">
              <SignOut size={16} className="mr-2" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
