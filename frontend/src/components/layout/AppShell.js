import { useState, useCallback } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import BottomNav from "./BottomNav";
import { Toaster } from "@/components/ui/sonner";

export default function AppShell({ title, subtitle, actions, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const openSidebar  = useCallback(() => setSidebarOpen(true),  []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <>
      {/* Skip-to-content — visible on keyboard focus for screen readers */}
      <a href="#main-content" className="skip-to-content">Skip to content</a>

      <div className="flex h-screen w-full overflow-hidden bg-[#F4F5F7] text-[#06182F]">
        {/* ── Mobile overlay backdrop ─────────────────────────────────── */}
        {sidebarOpen && (
          <div
            className="yf-sidebar-overlay md:hidden"
            onClick={closeSidebar}
            aria-hidden="true"
          />
        )}

        {/* ── Sidebar ─────────────────────────────────────────────────── */}
        <Sidebar open={sidebarOpen} onClose={closeSidebar} />

        {/* ── Main content area ───────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header
            title={title}
            subtitle={subtitle}
            actions={actions}
            onMenuClick={openSidebar}
          />
          <main
            id="main-content"
            className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8"
            data-testid="page-content"
          >
            <div className="fade-in-up">{children}</div>
          </main>
        </div>

        <Toaster position="top-right" richColors />
      </div>

      {/* ── Bottom navigation — mobile only ─────────────────────────── */}
      <BottomNav />
    </>
  );
}

