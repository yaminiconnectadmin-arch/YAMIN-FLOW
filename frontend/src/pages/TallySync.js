import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";
import { PageSection, StatusBadge, KPICard, EmptyState } from "@/components/common/Common";
import { ExportButton } from "@/lib/csv";
import { toast } from "@/components/ui/sonner";
import { ArrowsClockwise, CheckCircle, XCircle, Plugs, Copy, Eye, EyeSlash, ArrowClockwise, Broadcast } from "@phosphor-icons/react";

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
  const [hook, setHook] = useState(null);
  const [hookEvents, setHookEvents] = useState([]);
  const [showSecret, setShowSecret] = useState(false);
  const [matchEvent, setMatchEvent] = useState(null);
  const [matchCandidates, setMatchCandidates] = useState([]);
  const [matchLoading, setMatchLoading] = useState(false);

  const load = async () => {
    try {
      const [s, l, h, e] = await Promise.all([
        api.get("/tally/status"),
        api.get("/tally/logs", { params: { limit: 30 } }),
        api.get("/tally/webhook-config"),
        api.get("/tally/webhook-events", { params: { limit: 30 } }),
      ]);
      setStatus(s.data); setLogs(l.data); setHook(h.data); setHookEvents(e.data);
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

  const rotateSecret = async () => {
    if (!window.confirm("Rotate the webhook secret? Any Tally configuration using the old secret will stop working until updated.")) return;
    try {
      const { data } = await api.post("/tally/webhook-config/rotate", {});
      toast.success("Webhook secret rotated");
      setHook((h) => ({ ...h, secret_full: data.secret_full }));
      setShowSecret(true);
    } catch { toast.error("Failed"); }
  };

  const copy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch { toast.error("Copy failed"); }
  };

  const openMatch = async (event) => {
    setMatchEvent(event);
    setMatchCandidates([]);
    setMatchLoading(true);
    try {
      const { data } = await api.get(`/tally/webhook-events/${event.id}/candidates`);
      setMatchCandidates(data);
    } catch { toast.error("Failed to load candidate orders"); }
    finally { setMatchLoading(false); }
  };

  const linkTo = async (orderId) => {
    try {
      await api.post(`/tally/webhook-events/${matchEvent.id}/link`, { order_id: orderId });
      toast.success("Voucher linked to order");
      setMatchEvent(null);
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  const unlinkEvent = async (event) => {
    if (!window.confirm(`Unlink voucher ${event.voucher_no} from order ${event.matched_order_no}?`)) return;
    try {
      await api.post(`/tally/webhook-events/${event.id}/unlink`, {});
      toast.success("Unlinked");
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
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

          {/* Webhook Config */}
          {hook && (
            <PageSection
              title="Real-time Webhook"
              description="Point Tally's TDL to push voucher events here — no polling delay"
              actions={
                <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                  <Broadcast size={14} weight="fill" /> Listening
                </span>
              }
            >
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#5C6670] mb-1.5">Webhook URL</label>
                  <div className="flex items-center gap-2">
                    <input readOnly value={hook.webhook_url}
                      className="flex-1 h-10 px-3 rounded-md border border-[#E5E7EB] text-sm font-mono bg-[#F4F5F7] text-[#06182F]"
                      data-testid="webhook-url" />
                    <button onClick={() => copy(hook.webhook_url, "URL")}
                      className="h-10 w-10 flex items-center justify-center rounded-md border border-[#E5E7EB] hover:border-[#F28C18] text-[#5C6670] hover:text-[#D96B0B] transition-colors"
                      data-testid="copy-webhook-url">
                      <Copy size={14} />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#5C6670] mb-1.5">Secret Token</label>
                  <div className="flex items-center gap-2">
                    <input readOnly type={showSecret ? "text" : "password"}
                      value={showSecret ? hook.secret_full : hook.secret_masked}
                      className="flex-1 h-10 px-3 rounded-md border border-[#E5E7EB] text-sm font-mono bg-[#F4F5F7] text-[#06182F] tracking-widest"
                      data-testid="webhook-secret" />
                    <button onClick={() => setShowSecret((s) => !s)}
                      className="h-10 w-10 flex items-center justify-center rounded-md border border-[#E5E7EB] hover:border-[#F28C18] text-[#5C6670] hover:text-[#D96B0B]"
                      data-testid="toggle-secret">
                      {showSecret ? <EyeSlash size={14} /> : <Eye size={14} />}
                    </button>
                    <button onClick={() => copy(hook.secret_full, "Secret")}
                      className="h-10 w-10 flex items-center justify-center rounded-md border border-[#E5E7EB] hover:border-[#F28C18] text-[#5C6670] hover:text-[#D96B0B]"
                      data-testid="copy-secret">
                      <Copy size={14} />
                    </button>
                    <button onClick={rotateSecret}
                      className="inline-flex items-center gap-1.5 h-10 px-3 rounded-md border border-[#E5E7EB] hover:border-[#F28C18] text-sm font-medium text-[#0A2342] hover:text-[#D96B0B]"
                      data-testid="rotate-secret">
                      <ArrowClockwise size={14} /> Rotate
                    </button>
                  </div>
                  <p className="text-[11px] text-[#5C6670] mt-1.5">
                    Include as <span className="font-mono">?token=…</span> query or <span className="font-mono">X-Tally-Token</span> header. Rotating invalidates the previous secret immediately.
                  </p>
                </div>

                <details className="border border-[#E5E7EB] rounded-md">
                  <summary className="px-4 py-2.5 text-sm font-medium cursor-pointer hover:bg-[#F4F5F7]">
                    How to configure Tally
                  </summary>
                  <div className="px-4 pb-4 pt-2 text-xs text-[#5C6670] space-y-2">
                    <p>Add a TDL like the following to your Tally company (F12 → TDL & Add-Ons):</p>
                    <pre className="bg-[#06182F] text-[#F28C18] p-3 rounded font-mono text-[11px] leading-relaxed overflow-x-auto">
{`[System: Formula]
    YF Endpoint : "${hook.webhook_url}?token=<SECRET>"

[Function: SendToYamini]
    Parameter   : pVoucherGUID : String
    Variable    : Payload      : String
    01 : SET    : Payload : "<TALLYMESSAGE>...voucher xml...</TALLYMESSAGE>"
    02 : HTTP POST : @@YFEndpoint : Payload : "text/xml"`}
                    </pre>
                    <p>Tally will POST voucher XML on every Create/Modify/Delete. YAMINI FLOW deduplicates by voucher number + GUID.</p>
                  </div>
                </details>
              </div>
            </PageSection>
          )}

          {/* Webhook Events */}
          <PageSection
            title="Live Webhook Events"
            description={`${hookEvents.length} vouchers received from Tally`}
            actions={
              <ExportButton
                filename="yamini-flow-webhook-events-{date}.csv"
                rows={hookEvents}
                columns={[
                  { key: "received_at", label: "Received" },
                  { key: "voucher_type", label: "Type" },
                  { key: "voucher_no", label: "Voucher No" },
                  { key: "date", label: "Voucher Date" },
                  { key: "party", label: "Party" },
                  { key: "amount", label: "Amount" },
                  { key: "action", label: "Action" },
                  { key: "guid", label: "GUID" },
                ]}
              />
            }
          >
            {hookEvents.length === 0 ? (
              <EmptyState
                title="Waiting for Tally to push"
                description="Configure the webhook URL + token in Tally and events will appear here in real time."
              />
            ) : (
              <table className="yf-table w-full">
                <thead>
                  <tr>
                    <th>Received</th><th>Type</th><th>Voucher No</th>
                    <th>Party</th><th className="text-right">Amount</th>
                    <th>Link Status</th><th>Yamini Order</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {hookEvents.map((e) => {
                    const s = e.link_status;
                    const badge =
                      s === "linked" ? { cls: "badge-success", label: "linked" } :
                      s === "ambiguous" ? { cls: "badge-warning", label: "ambiguous" } :
                      s === "unmatched" ? { cls: "badge-error", label: "unmatched" } :
                      s === "no_party" ? { cls: "badge-neutral", label: "no party" } :
                      s === "non_sales" ? { cls: "badge-info", label: "non-sales" } :
                      { cls: "badge-neutral", label: s || "—" };
                    const canMatch = e.voucher_type?.toLowerCase() === "sales" &&
                                     (s === "unmatched" || s === "ambiguous") && !e.matched_order_no;
                    return (
                      <tr key={e.id} data-testid={`webhook-event-${e.voucher_no || e.guid}`}>
                        <td className="text-xs text-[#5C6670]">{fmt.datetime(e.received_at)}</td>
                        <td className="font-medium">{e.voucher_type}</td>
                        <td className="font-mono text-xs">{e.voucher_no || "—"}</td>
                        <td>{e.party || "—"}</td>
                        <td className="text-right tabular font-semibold">{e.amount ? fmt.inr(e.amount) : "—"}</td>
                        <td>
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${badge.cls}`}
                                data-testid={`link-status-${e.id}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td>
                          {e.matched_order_no ? (
                            <span className="font-mono text-xs font-semibold text-[#D96B0B]" data-testid={`matched-order-${e.id}`}>
                              {e.matched_order_no}
                            </span>
                          ) : <span className="text-xs text-[#BFC5CB]">—</span>}
                        </td>
                        <td className="text-right">
                          {canMatch ? (
                            <button onClick={() => openMatch(e)}
                              className="h-8 px-3 rounded-md border border-[#F28C18] text-xs font-semibold text-[#D96B0B] hover:bg-[#F28C18]/10 transition-colors"
                              data-testid={`match-btn-${e.id}`}>
                              Match
                            </button>
                          ) : e.matched_order_no ? (
                            <button onClick={() => unlinkEvent(e)}
                              className="h-8 px-3 rounded-md border border-[#E5E7EB] text-xs font-medium text-[#5C6670] hover:border-red-400 hover:text-red-600 transition-colors"
                              data-testid={`unlink-btn-${e.id}`}>
                              Unlink
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
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

      {/* Manual Match Modal */}
      {matchEvent && (
        <div className="fixed inset-0 z-40 bg-[#06182F]/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setMatchEvent(null)}>
          <div className="bg-white rounded-lg border border-[#E5E7EB] shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col fade-in-up"
               onClick={(e) => e.stopPropagation()} data-testid="match-modal">
            <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-start justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-[#F28C18] font-semibold mb-0.5">Manual Match</div>
                <h2 className="font-display text-xl font-semibold text-[#06182F]">
                  {matchEvent.voucher_type} · {matchEvent.voucher_no}
                </h2>
                <div className="text-xs text-[#5C6670] mt-0.5">
                  Party: <span className="font-medium text-[#06182F]">{matchEvent.party || "—"}</span>
                  {" · "}Amount: <span className="font-mono text-[#06182F]">{fmt.inr(matchEvent.amount)}</span>
                </div>
              </div>
              <button onClick={() => setMatchEvent(null)}
                className="p-1.5 rounded hover:bg-[#F4F5F7] text-[#5C6670]" data-testid="close-match-modal">
                <XCircle size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              {matchLoading ? (
                <div className="text-sm text-[#5C6670]">Searching candidate orders…</div>
              ) : matchCandidates.length === 0 ? (
                <EmptyState
                  title="No candidate orders"
                  description="No open orders match this party + amount. Widen your criteria or check the party name spelling in Tally."
                />
              ) : (
                <div className="space-y-2">
                  <div className="text-xs text-[#5C6670] mb-2">Pick the Yamini order this voucher belongs to:</div>
                  {matchCandidates.map((o) => (
                    <div key={o.id} className="border border-[#E5E7EB] rounded-md p-3 flex items-center justify-between hover:border-[#F28C18] transition-colors" data-testid={`candidate-${o.order_no}`}>
                      <div>
                        <div className="font-mono text-sm font-semibold text-[#06182F]">{o.order_no}</div>
                        <div className="text-xs text-[#5C6670] mt-0.5">
                          {o.dealer_name} · {o.dealer_state} · {o.items?.length || 0} items · {fmt.date(o.created_at)}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="tabular font-semibold text-[#0A2342]">{fmt.inr(o.total)}</div>
                          <div className="text-[10px] uppercase tracking-widest text-[#5C6670]">{o.status}</div>
                        </div>
                        <button onClick={() => linkTo(o.id)}
                          className="h-9 px-4 rounded-md gradient-brand-accent text-white text-sm font-semibold"
                          data-testid={`link-to-${o.order_no}`}>
                          Link
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
