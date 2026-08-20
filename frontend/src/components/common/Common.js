import { TrendUp, TrendDown } from "@phosphor-icons/react";
import { fmt } from "@/lib/api";

export function KPICard({ label, value, trend, hint, icon: Icon, format = "num", testId }) {
  const formatted =
    format === "inr" ? fmt.inr(value) :
    format === "num" ? fmt.num(value) : value;

  const trendUp = typeof trend === "number" && trend >= 0;
  return (
    <div className="kpi-card bg-white p-5 rounded-lg border border-[#E5E7EB] card-shadow hover:border-[#BFC5CB] transition-all" data-testid={testId}>
      <div className="flex items-start justify-between mb-2">
        <div className="text-[11px] font-medium uppercase tracking-widest text-[#5C6670]">{label}</div>
        {Icon ? (
          <div className="w-8 h-8 rounded-md bg-[#F4F5F7] flex items-center justify-center text-[#0A2342]">
            <Icon size={16} weight="regular" />
          </div>
        ) : null}
      </div>
      <div className="font-display text-[28px] font-bold text-[#06182F] tabular tracking-tight leading-none mb-2">
        {formatted}
      </div>
      <div className="flex items-center gap-2">
        {typeof trend === "number" && (
          <span className={`inline-flex items-center gap-1 text-xs font-medium ${trendUp ? "text-emerald-600" : "text-red-600"}`}>
            {trendUp ? <TrendUp size={12} weight="bold" /> : <TrendDown size={12} weight="bold" />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
        {hint ? <span className="text-xs text-[#5C6670]">{hint}</span> : null}
      </div>
    </div>
  );
}

export function StatusBadge({ status }) {
  const map = {
    delivered: "badge-success", approved: "badge-info",
    pending: "bg-amber-100 text-amber-900 border border-amber-300 font-bold",
    shipped: "badge-info", cancelled: "badge-error", reserved: "badge-brand",
    partially_fulfilled: "bg-amber-100 text-amber-800 border border-amber-300",
    processing: "badge-warning",
    active: "badge-success", inactive: "badge-neutral",
    success: "badge-success", failed: "badge-error",
    draft: "badge-neutral", sent: "badge-info", confirmed: "badge-brand", received: "badge-success",
    healthy: "badge-success", critical: "badge-error", low: "badge-warning", high: "badge-warning",
    medium: "badge-info", degraded: "badge-warning",
  };
  const s = status?.toLowerCase() || "";
  const cls = map[s] || "badge-neutral";
  const label =
    s === "pending" ? "APPROVAL PENDING" :
    s === "partially_fulfilled" ? "PARTIALLY FULFILLED" : status;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${cls}`} data-testid={`status-badge-${status}`}>
      {label}
    </span>
  );
}

export function PageSection({ title, description, actions, children, className = "" }) {
  return (
    <section className={`bg-white rounded-lg border border-[#E5E7EB] card-shadow ${className}`}>
      {(title || actions) && (
        <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
          <div>
            {title ? <h2 className="font-display text-[15px] font-semibold text-[#06182F]">{title}</h2> : null}
            {description ? <p className="text-xs text-[#5C6670] mt-0.5">{description}</p> : null}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({ title = "No data", description, action }) {
  return (
    <div className="p-12 text-center">
      <div className="mx-auto w-14 h-14 rounded-full bg-[#F4F5F7] flex items-center justify-center text-[#BFC5CB] mb-3">
        <span className="font-display text-2xl">∅</span>
      </div>
      <div className="font-display font-semibold text-[#06182F]">{title}</div>
      {description ? <div className="text-sm text-[#5C6670] mt-1">{description}</div> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
