import { useState } from "react";
import { LockKey, Eye, EyeSlash, CheckCircle } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/components/ui/sonner";

/**
 * Non-dismissible modal shown when user.must_change_password === true.
 * Staff members must set a new password before accessing the console.
 */
export default function ForcePasswordReset() {
  const { user, refreshUser } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const valid =
    current.length >= 1 &&
    next.length >= 6 &&
    next === confirm;

  const submit = async (e) => {
    e.preventDefault();
    if (!valid) return;
    setLoading(true);
    try {
      const { data } = await api.post("/auth/change-password", {
        current_password: current,
        new_password: next,
      });
      setDone(true);
      toast.success("Password updated! Welcome to YAMINI FLOW.");
      setTimeout(() => refreshUser(data.access_token), 800);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  return (
    /* Backdrop — pointer-events-none on the blur layer so nothing beneath is clickable */
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div className="relative z-10 w-full max-w-md mx-4">
        <div
          className="rounded-2xl shadow-2xl overflow-hidden"
          style={{ background: "linear-gradient(135deg, #1C2333 0%, #151C2A 100%)" }}
        >
          {/* Header stripe */}
          <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg, #F28C18, #E07A10)" }} />

          <div className="p-8">
            {/* Icon + title */}
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl bg-[#F28C18]/15 border border-[#F28C18]/30 flex items-center justify-center flex-shrink-0">
                <LockKey size={24} weight="fill" className="text-[#F28C18]" />
              </div>
              <div>
                <h2 className="text-white font-display font-bold text-[18px]">
                  Password Reset Required
                </h2>
                <p className="text-white/50 text-[12px] mt-0.5">
                  Hi <span className="text-[#F28C18] font-semibold">{user?.name}</span> — set a personal password to continue
                </p>
              </div>
            </div>

            <p className="text-white/40 text-[12px] mb-6 leading-relaxed">
              Your account was created with a temporary password. You must set a new
              personal password before accessing the admin console.
            </p>

            {done ? (
              <div className="flex flex-col items-center gap-3 py-6">
                <CheckCircle size={48} weight="fill" className="text-green-400" />
                <p className="text-white font-semibold">Password updated! Redirecting…</p>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                {/* Current (temp) password */}
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-1.5">
                    Temporary Password
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrent ? "text" : "password"}
                      value={current}
                      onChange={(e) => setCurrent(e.target.value)}
                      placeholder="Enter your temporary password"
                      required
                      className="w-full h-11 px-4 pr-10 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-white/20 focus:border-[#F28C18] focus:ring-1 focus:ring-[#F28C18] outline-none transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrent((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                    >
                      {showCurrent ? <EyeSlash size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* New password */}
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-1.5">
                    New Password <span className="normal-case font-normal">(min. 6 chars)</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showNext ? "text" : "password"}
                      value={next}
                      onChange={(e) => setNext(e.target.value)}
                      placeholder="Choose a strong password"
                      required
                      minLength={6}
                      className="w-full h-11 px-4 pr-10 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-white/20 focus:border-[#F28C18] focus:ring-1 focus:ring-[#F28C18] outline-none transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNext((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                    >
                      {showNext ? <EyeSlash size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Confirm */}
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-1.5">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Re-enter new password"
                    required
                    className={`w-full h-11 px-4 rounded-lg bg-white/5 border text-white text-sm placeholder-white/20 outline-none transition focus:ring-1 ${
                      confirm && next !== confirm
                        ? "border-red-500/60 focus:ring-red-500/40"
                        : "border-white/10 focus:border-[#F28C18] focus:ring-[#F28C18]"
                    }`}
                  />
                  {confirm && next !== confirm && (
                    <p className="text-red-400 text-[11px] mt-1">Passwords do not match</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!valid || loading}
                  className="w-full h-11 rounded-lg text-white font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed mt-2"
                  style={{ background: "linear-gradient(135deg, #F28C18, #E07A10)" }}
                >
                  {loading ? "Updating…" : "Set New Password & Continue"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
