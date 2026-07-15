import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";
import { PageSection, StatusBadge, KPICard, EmptyState } from "@/components/common/Common";
import { toast } from "@/components/ui/sonner";
import { ArrowsClockwise, CheckCircle, XCircle, Clock } from "@phosphor-icons/react";

const MODULES = [
  { key: "products", label: "Products" },
  { key: "stock", label: "Stock" },
  { key: "sales", label: "Sales Vouchers" },
  { key: "purchases", label: "Purchases" },
  { key: "vouchers", label: "Journals" },
  { key: "warehouses", label: "Warehouses" },
  { key: "ledgers", label: "Ledgers" },
];

export default function TallySyncPage() {
  const [status, setStatus] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState({});

  const load = async () => {
    try {
      const [s, l] = await Promise.all([api.get("/tally/status"), api.get("/tally/logs", { params: { limit: 30 } })]);
      setStatus(s.data); setLogs(l.data);
    } catch { toast.error("Failed to load Tally status"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const runSync = async (module) => {
    setSyncing((s) => ({ ...s, [module]: true }));
    try {
      const { data } = await api.post("/tally/sync", { module, direction: "push" });
      if (data.status === "success") toast.success(`${module}: ${data.records} records synced`);
      else toast.error(`${module}: ${data.message}`);
      load();
    } catch { toast.error("Sync failed"); }
    finally { setSyncing((s) => ({ ...s, [module]: false })); }
  };

  return (
    <AppShell title="Tally Sync" subtitle="Bi-directional integration with Tally ERP">
      {loading || !status ? <div className="p-8 text-center text-sm text-[#5C6670]">Loading…</div> : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 stagger">
            <KPICard label="Successful Syncs" value={status.success_count} icon={CheckCircle} hint="all time" testId="kpi-sync-success" />
            <KPICard label="Failed Syncs" value={status.failed_count} icon={XCircle} hint="all time" testId="kpi-sync-fail" />
            <div className="kpi-card bg-white p-5 rounded-lg border border-[#E5E7EB] card-shadow">
              <div className="text-[11px] font-medium uppercase tracking-widest text-[#5C6670]">Health</div>
              <div className="font-display text-2xl font-bold mt-2 flex items-center gap-2">
                <StatusBadge status={status.health} />
              </div>
              <div className="text-xs text-[#5C6670] mt-2">Auto-sync every 30 min</div>
            </div>
            <div className="kpi-card bg-white p-5 rounded-lg border border-[#E5E7EB] card-shadow">
              <div className="text-[11px] font-medium uppercase tracking-widest text-[#5C6670]">Last Sync</div>
              <div className="font-display text-lg font-bold mt-2 text-[#06182F]">
                {status.last_sync ? fmt.datetime(status.last_sync.created_at) : "—"}
              </div>
              <div className="text-xs text-[#5C6670] mt-1">{status.last_sync?.module || ""}</div>
            </div>
          </div>

          <PageSection title="Modules" description="Trigger manual sync per module">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {MODULES.map((m) => {
                const last = status.modules[m.key];
                return (
                  <div key={m.key} className="border border-[#E5E7EB] rounded-md p-4 hover:border-[#F28C18]/50 transition-colors" data-testid={`sync-card-${m.key}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="font-display font-semibold text-[15px] text-[#06182F]">{m.label}</div>
                      {last ? <StatusBadge status={last.status} /> : <span className="text-xs text-[#BFC5CB]">Not synced</span>}
                    </div>
                    <div className="text-xs text-[#5C6670] space-y-1">
                      <div className="flex justify-between"><span>Records</span><span className="tabular">{last?.records ?? "—"}</span></div>
                      <div className="flex justify-between"><span>Duration</span><span className="tabular">{last?.duration_ms ?? "—"}ms</span></div>
                      <div className="flex justify-between"><span>Last</span><span>{last ? fmt.datetime(last.created_at) : "—"}</span></div>
                    </div>
                    <button onClick={() => runSync(m.key)} disabled={syncing[m.key]}
                      className="mt-4 w-full h-9 rounded-md border border-[#E5E7EB] text-sm font-medium hover:border-[#F28C18] hover:text-[#D96B0B] transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                      data-testid={`sync-${m.key}-button`}>
                      <ArrowsClockwise size={14} className={syncing[m.key] ? "animate-spin" : ""} />
                      {syncing[m.key] ? "Syncing…" : "Sync now"}
                    </button>
                  </div>
                );
              })}
            </div>
          </PageSection>

          <PageSection title="Sync History" description="Latest sync events, most recent first">
            {logs.length === 0 ? <EmptyState title="No sync events" /> : (
              <table className="yf-table w-full">
                <thead>
                  <tr><th>Time</th><th>Module</th><th>Direction</th><th>Status</th><th className="text-right">Records</th><th className="text-right">Duration</th><th>Message</th></tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id} data-testid={`sync-log-${l.id}`}>
                      <td className="text-xs text-[#5C6670]">{fmt.datetime(l.created_at)}</td>
                      <td className="font-medium">{l.module}</td>
                      <td className="uppercase text-xs tracking-wider">{l.direction}</td>
                      <td><StatusBadge status={l.status} /></td>
                      <td className="text-right tabular">{l.records}</td>
                      <td className="text-right tabular text-[#5C6670]">{l.duration_ms}ms</td>
                      <td className="text-xs text-[#5C6670]">{l.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </PageSection>
        </div>
      )}
    </AppShell>
  );
}
