import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast, Toaster } from "@/components/ui/sonner";
import { CircleNotch, Envelope, Lock, Buildings } from "@phosphor-icons/react";

export default function LoginPage() {
  const [email, setEmail] = useState("admin@yaminiflow.com");
  const [password, setPassword] = useState("Admin@123");
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && user !== false) navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const res = await login(email, password);
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
      admin: ["admin@yaminiflow.com", "Admin@123"],
      dealer: ["dealer@yaminiflow.com", "Dealer@123"],
      mnp: ["mnp@yaminiflow.com", "Mnp@123"],
      supplier: ["supplier@yaminiflow.com", "Supplier@123"],
    }[role];
    setEmail(creds[0]);
    setPassword(creds[1]);
  };

  return (
    <div className="min-h-screen flex" data-testid="login-page">
      <Toaster position="top-right" richColors />

      {/* Left hero */}
      <div className="hidden lg:flex login-hero flex-1 flex-col justify-between p-12 text-white">
        <div className="flex items-center gap-3.5">
          <img src="/logo.png" alt="Yamini Flow Logo" className="w-12 h-12 rounded-xl object-cover shadow-lg border border-white/15" />
          <div>
            <div className="font-display text-xl font-semibold tracking-tight">YAMINI FLOW</div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-[#F28C18] font-medium">The Intelligent Distribution Platform</div>
          </div>
        </div>

        <div className="max-w-lg">
          <div className="inline-flex items-center gap-2 mb-4 text-[10px] uppercase tracking-[0.2em] text-[#F28C18] font-semibold">
            <span className="w-8 h-px bg-[#F28C18]"></span> Distribution Intelligence, v2
          </div>
          <h1 className="font-display text-4xl lg:text-5xl font-semibold leading-[1.05] tracking-tight">
            One ecosystem. <br /> Every dealer, warehouse and supplier — <span className="text-[#F28C18]">in flow.</span>
          </h1>
          <p className="mt-5 text-white/70 text-[15px] leading-relaxed max-w-md">
            Live inventory, automatic procurement, Tally sync, and AI-driven forecasts.
            Built for the operators who ship every day.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-6 max-w-lg text-white/60">
          <div>
            <div className="font-display text-2xl font-semibold text-white">42%</div>
            <div className="text-[11px] uppercase tracking-widest mt-1">Faster Fulfilment</div>
          </div>
          <div>
            <div className="font-display text-2xl font-semibold text-white">↓ 31%</div>
            <div className="text-[11px] uppercase tracking-widest mt-1">Dead Stock</div>
          </div>
          <div>
            <div className="font-display text-2xl font-semibold text-white">99.6%</div>
            <div className="text-[11px] uppercase tracking-widest mt-1">Sync Uptime</div>
          </div>
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
            <p className="text-sm text-[#5C6670] mt-2">Enter your credentials to continue. Role-based access is enforced across every module.</p>
          </div>

          <form onSubmit={submit} className="space-y-4" data-testid="login-form">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#5C6670] mb-1.5">Email</label>
              <div className="relative">
                <Envelope size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#BFC5CB]" />
                <input
                  type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-11 pl-10 pr-3 rounded-md border border-[#E5E7EB] focus:border-[#F28C18] focus:ring-1 focus:ring-[#F28C18] outline-none text-sm text-[#06182F] bg-white transition-colors"
                  placeholder="you@company.com"
                  data-testid="login-email-input"
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
              {loading ? <><CircleNotch size={16} className="animate-spin" /> Signing in…</> : "Sign in to Yamini Flow"}
            </button>
          </form>

          <div className="mt-8">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#5C6670] mb-3 font-semibold flex items-center gap-2">
              <span className="w-8 h-px bg-[#E5E7EB]"></span> Try a demo role
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { r: "admin", label: "Admin" },
                { r: "dealer", label: "Dealer" },
                { r: "mnp", label: "MNP" },
                { r: "supplier", label: "Supplier" },
              ].map((d) => (
                <button
                  key={d.r} type="button" onClick={() => fillDemo(d.r)}
                  className="text-xs py-2 px-3 rounded-md border border-[#E5E7EB] hover:border-[#F28C18] hover:bg-[#F28C18]/5 transition-colors text-[#0A2342] font-medium"
                  data-testid={`demo-${d.r}-button`}
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
