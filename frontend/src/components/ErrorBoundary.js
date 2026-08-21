import React from "react";
import { ArrowsClockwise, WarningCircle } from "@phosphor-icons/react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Yamini Flow Error Boundary caught an error:", error, errorInfo);

    // Auto-reload on ChunkLoadError (new deployment hash update)
    const isChunkError =
      error?.name === "ChunkLoadError" ||
      error?.message?.includes("Loading chunk") ||
      error?.message?.includes("Failed to fetch dynamically imported module") ||
      error?.message?.includes("Importing a module script failed");

    if (isChunkError) {
      const lastReload = sessionStorage.getItem("yf_chunk_reload");
      const now = Date.now();
      if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
        sessionStorage.setItem("yf_chunk_reload", String(now));
        window.location.reload();
      }
    }
  }

  handleReload = () => {
    try {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((r) => r.unregister());
        });
      }
      if ("caches" in window) {
        caches.keys().then((names) => {
          names.forEach((name) => caches.delete(name));
        });
      }
      sessionStorage.clear();
    } catch (e) {
      console.error(e);
    }
    setTimeout(() => {
      window.location.href = window.location.origin + "/orders?reset=" + Date.now();
    }, 200);
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#06182F] p-6 text-white">
          <div className="max-w-md w-full bg-[#0A2540] border border-white/10 rounded-2xl p-8 text-center shadow-2xl space-y-5">
            <div className="w-16 h-16 bg-[#F28C18]/15 border border-[#F28C18]/30 rounded-2xl flex items-center justify-center mx-auto text-[#F28C18]">
              <WarningCircle size={36} weight="bold" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-display">New Version Available</h2>
              <p className="text-sm text-white/70 mt-2">
                A new version of Yamini Flow was deployed. Please reload the page to apply the latest updates.
              </p>
            </div>
            <button
              onClick={this.handleReload}
              className="w-full h-11 rounded-lg bg-[#F28C18] hover:bg-[#E07D10] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg transition-all"
            >
              <ArrowsClockwise size={18} weight="bold" />
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
