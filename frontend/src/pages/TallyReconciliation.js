import { useEffect, useState, useCallback } from "react";
import { api, fmt } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";
import { PageSection, StatusBadge, EmptyState } from "@/components/common/Common";
import { toast } from "@/components/ui/sonner";
import { CheckCircle, Clock, ArrowsClockwise, LinkBreak, Lightning, Warning, Check, FileText } from "@phosphor-icons/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export default function TallyReconciliation() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [linking, setLinking] = useState(false);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/tally/webhook-events");
      setEvents(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error("Failed to load Tally reconciliation events");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const openMatchDialog = async (eventObj) => {
    setSelectedEvent(eventObj);
    setLoadingCandidates(true);
    try {
      const { data } = await api.get(`/tally/webhook-events/${eventObj.id || eventObj._id}/candidates`);
      setCandidates(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Failed to load candidate orders for matching");
      setCandidates([]);
    } finally {
      setLoadingCandidates(false);
    }
  };

  const handleLinkOrder = async (orderId) => {
    if (!selectedEvent) return;
    setLinking(true);
    try {
      const eventId = selectedEvent.id || selectedEvent._id;
      await api.post(`/tally/webhook-events/${eventId}/link`, { order_id: orderId });
      toast.success("Voucher manually matched & reconciled with Yamini Flow Order!");
      setSelectedEvent(null);
      loadEvents();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to link voucher");
    } finally {
      setLinking(false);
    }
  };

  const handleUnlinkOrder = async (eventId) => {
    if (!window.confirm("Unlink this Tally voucher from the Yamini Flow Order?")) return;
    try {
      await api.post(`/tally/webhook-events/${eventId}/unlink`);
      toast.success("Voucher unlinked successfully");
      loadEvents();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to unlink voucher");
    }
  };

  const filteredEvents = events.filter((e) => {
    if (statusFilter === "matched") return e.matched_order_id || e.match_status === "matched";
    if (statusFilter === "unmatched") return !e.matched_order_id && e.match_status !== "matched";
    if (statusFilter === "failed") return e.status === "failed" || e.match_status === "failed";
    return true;
  });

  const matchedCount = events.filter((e) => e.matched_order_id || e.match_status === "matched").length;
  const unmatchedCount = events.length - matchedCount;

  return (
    <AppShell
      title="Tally ERP Reconciliation Center"
      subtitle="Operational vs Accounting System of Record Reconciliation Engine • Idempotency & Audit Logs"
      actions={
        <button
          onClick={loadEvents}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-xs"
        >
          <ArrowsClockwise size={14} weight="bold" /> Refresh Events
        </button>
      }
    >
      {/* Header Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Tally Events</div>
          <div className="text-2xl font-black text-slate-900 mt-1 font-mono">{events.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">Idempotent Webhook Events</div>
        </div>

        <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200 shadow-xs">
          <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle size={15} weight="fill" /> Reconciled & Matched
          </div>
          <div className="text-2xl font-black text-emerald-900 mt-1 font-mono">{matchedCount}</div>
          <div className="text-[11px] text-emerald-700 mt-1">100% Linked to Yamini Orders</div>
        </div>

        <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200 shadow-xs">
          <div className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
            <Warning size={15} weight="fill" /> Unmatched Review Queue
          </div>
          <div className="text-2xl font-black text-amber-900 mt-1 font-mono">{unmatchedCount}</div>
          <div className="text-[11px] text-amber-700 mt-1">Requires Manual Verification</div>
        </div>
      </div>

      {/* Main Events Table Section */}
      <PageSection
        title={`${filteredEvents.length} Tally Vouchers Listed`}
        actions={
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 px-3 rounded-md border border-slate-300 text-xs font-semibold bg-white outline-none"
            >
              <option value="all">All Events ({events.length})</option>
              <option value="matched">Matched ({matchedCount})</option>
              <option value="unmatched">Unmatched ({unmatchedCount})</option>
            </select>
          </div>
        }
      >
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500 font-medium">Loading Tally sync events…</div>
        ) : filteredEvents.length === 0 ? (
          <EmptyState
            title="No Tally Events Found"
            description="Tally vouchers sent via XML sync or webhooks will appear here for reconciliation."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="yf-table w-full">
              <thead>
                <tr>
                  <th>Voucher / GUID</th>
                  <th>Voucher Type</th>
                  <th>Party Name</th>
                  <th className="text-right">Amount (₹)</th>
                  <th>Match Confidence</th>
                  <th>Yamini Flow Order</th>
                  <th>Date</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((evt) => {
                  const isMatched = Boolean(evt.matched_order_id || evt.match_status === "matched");
                  const confidence = evt.match_confidence || (isMatched ? 1.0 : 0.0);
                  const confidencePct = Math.round(confidence * 100);

                  return (
                    <tr key={evt.id || evt._id}>
                      <td className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded w-max">
                        {evt.voucher_no || evt.guid || "VOUCHER-RAW"}
                      </td>
                      <td className="text-xs font-semibold text-slate-700">{evt.voucher_type || "Sales Invoice"}</td>
                      <td className="text-xs font-bold text-slate-900">{evt.party || evt.party_name || "—"}</td>
                      <td className="text-right font-mono font-bold text-emerald-700">{fmt.inr(evt.amount || 0)}</td>
                      <td>
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                            confidencePct >= 90
                              ? "bg-emerald-100 text-emerald-800"
                              : confidencePct >= 50
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {confidencePct}% Match
                        </span>
                      </td>
                      <td className="font-mono text-xs">
                        {isMatched ? (
                          <span className="text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                            {evt.matched_order_no || evt.matched_order_id}
                          </span>
                        ) : (
                          <span className="text-amber-800 bg-amber-100 px-2 py-0.5 rounded font-semibold text-[10px]">
                            ⏳ Unmatched
                          </span>
                        )}
                      </td>
                      <td className="text-xs text-slate-500">{fmt.datetime(evt.created_at || evt.date)}</td>
                      <td className="text-right">
                        {isMatched ? (
                          <button
                            onClick={() => handleUnlinkOrder(evt.id || evt._id)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition-all"
                            title="Unlink Voucher"
                          >
                            <LinkBreak size={16} weight="bold" />
                          </button>
                        ) : (
                          <button
                            onClick={() => openMatchDialog(evt)}
                            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded shadow-xs transition-all inline-flex items-center gap-1"
                          >
                            <Lightning size={13} weight="fill" /> Match Order
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </PageSection>

      {/* Manual Matching Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={(v) => !v && setSelectedEvent(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader border-b pb-3>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <FileText size={18} className="text-amber-600" weight="fill" />
              Reconcile Voucher: {selectedEvent?.voucher_no || selectedEvent?.guid}
            </DialogTitle>
            <div className="text-xs text-slate-500 font-mono mt-1">
              Party: <strong>{selectedEvent?.party || selectedEvent?.party_name}</strong> • Amount:{" "}
              <strong className="text-emerald-700">{fmt.inr(selectedEvent?.amount || 0)}</strong>
            </div>
          </DialogHeader>

          <div className="py-3 space-y-3">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Candidate Orders (Confidence Match Hierarchy):
            </div>

            {loadingCandidates ? (
              <div className="p-6 text-center text-xs text-slate-500">Searching matching orders…</div>
            ) : candidates.length === 0 ? (
              <EmptyState
                title="No Candidate Orders Found"
                description="No unlinked Yamini Flow orders match this party name or invoice amount."
              />
            ) : (
              <div className="space-y-2">
                {candidates.map((cand) => (
                  <div
                    key={cand.id || cand._id}
                    className="p-3 border border-slate-200 rounded-xl hover:border-amber-400 hover:bg-amber-50/40 flex items-center justify-between gap-3 transition-all"
                  >
                    <div>
                      <div className="font-mono font-bold text-xs text-slate-900 flex items-center gap-2">
                        <span>{cand.order_no}</span>
                        <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                          {cand.dealer_name}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        Amount: {fmt.inr(cand.total || cand.subtotal || 0)} • Date: {fmt.date(cand.created_at)}
                      </div>
                    </div>

                    <button
                      disabled={linking}
                      onClick={() => handleLinkOrder(cand.id || cand._id)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs inline-flex items-center gap-1 transition-all disabled:opacity-50"
                    >
                      <Check size={14} weight="bold" /> Confirm Link
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
