import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";
import { PageSection, StatusBadge, KPICard, EmptyState } from "@/components/common/Common";
import { ExportButton } from "@/lib/csv";
import { toast } from "@/components/ui/sonner";
import { ArrowsClockwise, CheckCircle, XCircle, Clock, Plugs } from "@phosphor-icons/react";

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
  const [testing, setTesting] = useState(false);

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
      const { data } = await api.post("/tally/sync", { module, direction: "pull" });
      if (data.status === "success") toast.success(`${module}: ${data.records} records synced`);
      else toast.error(`${module}: ${data.message}`);
      load();
    } catch { toast.error("Sync failed"); }
    finally { setSyncing((s) => ({ ...s, [module]: false })); }
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      const { data } = await api.post("/tally/test-connection", {});
      if (data.ok) toast.success(`Connected — Tally responded in ${data.duration_ms}ms`);
      else toast.error(data.message || "Connection failed");
    } catch (e) { toast.error(e.response?.data?.detail || "Connection failed"); }
    finally { setTesting(false); }
  };

  return (
    <AppShell title="Tally Sync" subtitle="Bi-directional integration with Tally ERP"
      actions={
        <button onClick={testConnection} disabled={testing}
          className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-[#E5E7EB] text-sm font-medium text-[#0A2342] hover:border-[#F28C18] hover:text-[#D96B0B] transition-colors disabled:opacity-60"
          data-testid="test-tally-connection">
          <Plugs size={14} className={testing ? "animate-spin" : ""} />
          {testing ? "Testing…" : "Test Connection"}
        </button>
      }
    >
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

          <div className="bg-[#0A2342]/[0.03] border border-[#0A2342]/10 rounded-md p-4 flex items-start gap-3">
            <Plugs size={20} className="text-[#0A2342] flex-shrink-0 mt-0.5" />
            <div className="text-sm text-[#06182F]">
              <div className="font-display font-semibold">Live Tally HTTP-XML Client</div>
              <div className="text-xs text-[#5C6670] mt-1">
                Sync now attempts a real HTTP-XML call to the endpoint set in Settings → Tally Integration
                (default <span className="font-mono">http://localhost:9000</span>). Configure your Tally server
                with <span className="font-mono">TDL Server → Yes</span> and the correct port. Failed connections
                are logged with the reason below — no data is fabricated.
              </div>
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

          <PageSection
            title="Sync History"
            description="Latest sync events, most recent first"
            actions={
              <ExportButton
                filename="yamini-flow-tally-sync-logs-{date}.csv"
                rows={logs}
                columns={[
                  { key: "created_at", label: "Timestamp" },
                  { key: "module", label: "Module" },
                  { key: "direction", label: "Direction" },
                  { key: "status", label: "Status" },
                  { key: "records", label: "Records" },
                  { key: "duration_ms", label: "Duration (ms)" },
                  { key: "message", label: "Message" },
                ]}
              />
            }
          >
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
