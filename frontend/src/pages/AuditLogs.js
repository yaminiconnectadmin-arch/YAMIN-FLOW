import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";
import { PageSection, EmptyState } from "@/components/common/Common";
import { ExportButton } from "@/lib/csv";
import { toast } from "@/components/ui/sonner";

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/audit-logs", { params: { limit: 300 } });
        setLogs(data);
      } catch { toast.error("Failed to load"); }
      finally { setLoading(false); }
    })();
  }, []);

  return (
    <AppShell title="Audit Logs" subtitle="Immutable activity trail across every module">
      <PageSection
        title={`${logs.length} recent events`}
        actions={
          <ExportButton
            filename="yamini-flow-audit-logs-{date}.csv"
            rows={logs}
            columns={[
              { key: "created_at", label: "Timestamp" },
              { key: "actor_email", label: "Actor" },
              { key: "action", label: "Action" },
              { key: "target", label: "Target" },
              { key: "meta", label: "Metadata", format: (v) => JSON.stringify(v) },
            ]}
          />
        }
      >
        {loading ? <div className="p-8 text-center text-sm text-[#5C6670]">Loading…</div>
          : logs.length === 0 ? <EmptyState title="No events" />
          : (
            <table className="yf-table w-full">
              <thead>
                <tr><th>Time</th><th>Actor</th><th>Action</th><th>Target</th><th>Meta</th></tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} data-testid={`audit-${l.id}`}>
                    <td className="text-xs text-[#5C6670]">{fmt.datetime(l.created_at)}</td>
                    <td className="font-medium">{l.actor_email}</td>
                    <td><span className="font-mono text-xs px-2 py-0.5 rounded bg-[#F4F5F7]">{l.action}</span></td>
                    <td className="font-mono text-xs">{l.target}</td>
                    <td className="text-xs text-[#5C6670] font-mono">{JSON.stringify(l.meta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </PageSection>
    </AppShell>
  );
}
