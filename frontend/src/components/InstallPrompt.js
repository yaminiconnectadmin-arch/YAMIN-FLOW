import React, { useState, useEffect } from "react";
import { DeviceMobile, Monitor, ShareNetwork, DotsThreeVertical, CheckCircle, X, DownloadSimple } from "@phosphor-icons/react";

export default function InstallModal({ isOpen, onClose }) {
  const [deferredPrompt, setDeferredPrompt] = useState(window.deferredPWAInstallPrompt || null);
  const [isInstalled, setIsInstalled] = useState(
    window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true
  );
  const [installSuccess, setInstallSuccess] = useState(false);

  useEffect(() => {
    const handleAvailable = () => {
      setDeferredPrompt(window.deferredPWAInstallPrompt);
    };
    const handleInstalled = () => {
      setIsInstalled(true);
      setInstallSuccess(true);
      window.deferredPWAInstallPrompt = null;
      setDeferredPrompt(null);
    };

    window.addEventListener("pwaInstallAvailable", handleAvailable);
    window.addEventListener("appinstalled", handleInstalled);

    if (window.deferredPWAInstallPrompt) {
      setDeferredPrompt(window.deferredPWAInstallPrompt);
    }

    return () => {
      window.removeEventListener("pwaInstallAvailable", handleAvailable);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setInstallSuccess(true);
      setIsInstalled(true);
      window.deferredPWAInstallPrompt = null;
      setDeferredPrompt(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-[#06182F] border border-white/10 rounded-2xl max-w-md w-full p-6 text-white shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/50 hover:text-white p-1 rounded-lg transition-colors"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-4 mb-5">
          <img
            src="/logo.png"
            alt="Yamini Flow Logo"
            className="w-14 h-14 rounded-xl object-cover shadow-lg border border-white/20"
          />
          <div>
            <h3 className="font-display font-semibold text-lg leading-tight">Install Yamini Flow App</h3>
            <p className="text-xs text-[#F28C18] font-medium mt-1">Direct Device Installation</p>
          </div>
        </div>

        {isInstalled || installSuccess ? (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-center my-4">
            <CheckCircle size={32} className="text-emerald-400 mx-auto mb-2" weight="fill" />
            <div className="font-semibold text-sm text-emerald-300">App Installed Successfully!</div>
            <p className="text-xs text-white/70 mt-1">
              You can now launch Yamini Flow directly from your device home screen or desktop.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {deferredPrompt ? (
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                <p className="text-xs text-white/80 mb-3 leading-relaxed">
                  Click the button below to add Yamini Flow directly to your home screen/device for an instant, full-screen experience.
                </p>
                <button
                  onClick={handleInstallClick}
                  className="w-full py-3 px-4 bg-gradient-to-r from-[#F28C18] to-[#E07A08] hover:from-[#E07A08] hover:to-[#D06900] text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg transition-all transform hover:-translate-y-0.5"
                >
                  <DownloadSimple size={18} weight="bold" />
                  <span>Install App Now</span>
                </button>
              </div>
            ) : (
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-xs text-white/80 mb-3 font-medium">
                  If the instant install prompt is not visible, follow these quick steps:
                </p>

                <div className="space-y-3 text-xs text-white/70">
                  <div className="flex items-start gap-2.5 bg-black/20 p-2.5 rounded-lg border border-white/5">
                    <DeviceMobile size={18} className="text-[#F28C18] flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-white">iOS / Safari:</span> Tap the{" "}
                      <span className="inline-flex items-center gap-1 bg-white/10 px-1.5 py-0.5 rounded text-white font-mono text-[11px]">
                        <ShareNetwork size={12} /> Share
                      </span>{" "}
                      icon in Safari and select <span className="text-white font-medium">Add to Home Screen</span>.
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 bg-black/20 p-2.5 rounded-lg border border-white/5">
                    <DeviceMobile size={18} className="text-[#F28C18] flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-white">Android Chrome:</span> Tap the{" "}
                      <span className="inline-flex items-center gap-1 bg-white/10 px-1.5 py-0.5 rounded text-white font-mono text-[11px]">
                        <DotsThreeVertical size={12} /> Menu
                      </span>{" "}
                      icon and choose <span className="text-white font-medium">Install app</span> or{" "}
                      <span className="text-white font-medium">Add to Home screen</span>.
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 bg-black/20 p-2.5 rounded-lg border border-white/5">
                    <Monitor size={18} className="text-[#F28C18] flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-white">Desktop Chrome / Edge:</span> Click the{" "}
                      <span className="text-white font-medium">Install icon (⊕)</span> on the right side of the browser address bar at the top right.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-white/50">
          <span>⚡ Automatic session & route restoration enabled</span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
