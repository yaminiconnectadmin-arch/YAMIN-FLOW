import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast, Toaster } from "@/components/ui/sonner";
import { CircleNotch, IdentificationCard, Lock } from "@phosphor-icons/react";

export default function LoginPage() {
  const [loginId, setLoginId] = useState("D-ST-MH-101");
  const [password, setPassword] = useState("Dealer@123");
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && user !== false) navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const res = await login(loginId, password);
    setLoading(false);
    if (res.ok) {
      toast.success(`Welcome back, ${res.user.name}`);
      navigate("/dashboard");
    } else {
      toast.error(res.error);
    }
  };

  const fillDemo = (role) => {
    const creds = {
      dealer: ["D-ST-MH-101", "Dealer@123"],
      mnp: ["M-RK-MH-101", "Mnp@123"],
      admin: ["admin@yaminiflow.com", "Admin@123"],
      supplier: ["supplier@yaminiflow.com", "Supplier@123"],
    }[role];
    setLoginId(creds[0]);
    setPassword(creds[1]);
  };

  return (
    <div className="min-h-screen flex" data-testid="login-page">
      <Toaster position="top-right" richColors />

      {/* Left hero */}
      <div className="hidden lg:flex login-hero flex-1 flex-col justify-between p-12 text-white bg-[#06182F] relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#F28C18_1px,transparent_1px)] [background-size:16px_16px]" />
        
        <div className="relative z-10 flex items-center gap-3.5">
          <img src="/logo.png" alt="Yamini Flow Logo" className="w-12 h-12 rounded-xl object-cover shadow-lg border border-white/15" />
          <div>
            <div className="font-display text-xl font-semibold tracking-tight">YAMINI FLOW</div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-[#F28C18] font-medium">Distribution & Matrix Intelligence</div>
          </div>
        </div>

        <div className="relative z-10 max-w-lg">
          <div className="inline-flex items-center gap-2 mb-4 text-[10px] uppercase tracking-[0.2em] text-[#F28C18] font-semibold">
            <span className="w-8 h-px bg-[#F28C18]"></span> Fastener Matrix & Unique Login Codes
          </div>
          <h1 className="font-display text-4xl lg:text-5xl font-semibold leading-[1.05] tracking-tight">
            One ecosystem. <br /> Every distributor, MNP & supplier — <span className="text-[#F28C18]">in flow.</span>
          </h1>
          <p className="mt-5 text-white/70 text-[15px] leading-relaxed max-w-md">
            Intelligent weight-matrix conversions, automated 12 AM / single-click collation, and real-time distributor & MNP code tracking (e.g. D-ST-MH-101, M-RK-MH-101) across all regions.
          </p>
          <div className="grid grid-cols-2 gap-4 pt-6 mt-6 border-t border-white/10 text-xs">
            <div>
              <div className="font-bold text-white mb-0.5">Matrix Auto-Collation</div>
              <div className="text-[#BFC5CB]">Exact box & weight calculations</div>
            </div>
            <div>
              <div className="font-bold text-white mb-0.5">Unique Distributor & MNP Codes</div>
              <div className="text-[#BFC5CB]">Location-indexed login identifiers</div>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex justify-between items-center text-xs text-white/60">
          <span>© 2026 Yamini Flow ERP</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Systems Operational</span>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center bg-white p-6 lg:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <img src="/logo.png" alt="Yamini Flow Logo" className="w-11 h-11 rounded-lg object-cover shadow-md border border-[#E5E7EB]" />
            <div>
              <div className="font-display font-semibold text-[#06182F]">YAMINI FLOW</div>
              <div className="text-[10px] uppercase tracking-widest text-[#F28C18] font-medium">Distribution Intelligence</div>
            </div>
          </div>

          <div className="mb-8">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#F28C18] font-semibold mb-2">Sign in</div>
            <h2 className="font-display text-3xl font-semibold text-[#06182F] tracking-tight">Access your workspace</h2>
            <p className="text-sm text-[#5C6670] mt-2">Enter your unique Distributor / MNP Login ID or email address.</p>
          </div>

          <form onSubmit={submit} className="space-y-4" data-testid="login-form">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#5C6670] mb-1.5">
                Unique Login ID / Code <span className="text-[#F28C18] lowercase">(e.g. D-ST-MH-101, M-RK-MH-101)</span> or Email
              </label>
              <div className="relative">
                <IdentificationCard size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#F28C18]" />
                <input
                  type="text" required value={loginId} onChange={(e) => setLoginId(e.target.value)}
                  className="w-full h-11 pl-10 pr-3 rounded-md border border-[#E5E7EB] focus:border-[#F28C18] focus:ring-1 focus:ring-[#F28C18] outline-none text-sm font-mono font-medium text-[#06182F] bg-white transition-colors"
                  placeholder="Enter your Unique ID (e.g. D-ST-MH-101) or Email"
                  data-testid="login-id-input"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#5C6670] mb-1.5">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#BFC5CB]" />
                <input
                  type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-11 pl-10 pr-3 rounded-md border border-[#E5E7EB] focus:border-[#F28C18] focus:ring-1 focus:ring-[#F28C18] outline-none text-sm text-[#06182F] bg-white transition-colors"
                  placeholder="••••••••"
                  data-testid="login-password-input"
                />
              </div>
            </div>

            <button
              type="submit" disabled={loading}
              className="w-full h-11 rounded-md gradient-brand-accent text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all disabled:opacity-70"
              data-testid="login-submit-button"
            >
              {loading ? <><CircleNotch size={16} className="animate-spin" /> Signing in…</> : "Sign in with Unique ID"}
            </button>
          </form>

          <div className="mt-8">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#5C6670] mb-3 font-semibold flex items-center gap-2">
              <span className="w-8 h-px bg-[#E5E7EB]"></span> Try a demo role (Click to autofill)
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { r: "dealer", label: "Distributor (D-ST-MH-101)" },
                { r: "mnp", label: "MNP (M-RK-MH-101)" },
                { r: "admin", label: "Admin Account" },
                { r: "supplier", label: "Supplier Account" },
              ].map((d) => (
                <button
                  key={d.r} type="button" onClick={() => fillDemo(d.r)}
                  className="text-xs py-2 px-2 rounded-md border border-[#E5E7EB] hover:border-[#F28C18] hover:bg-[#F28C18]/5 transition-colors text-[#0A2342] font-medium truncate"
                  data-testid={`demo-${d.r}-button`}
                  title={`Fill demo credentials for ${d.label}`}
                >{d.label}</button>
              ))}
            </div>
          </div>

          <div className="mt-8 text-center text-[11px] text-[#BFC5CB] uppercase tracking-widest">
            Yamini Flow · v2.0 · Enterprise ERP
          </div>
        </div>
      </div>
    </div>
  );
}
