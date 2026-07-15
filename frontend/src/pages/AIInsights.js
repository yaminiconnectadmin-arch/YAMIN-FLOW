import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";
import { PageSection, EmptyState } from "@/components/common/Common";
import { toast } from "@/components/ui/sonner";
import { Sparkle, CircleNotch, Robot } from "@phosphor-icons/react";

const TOPICS = [
  { key: "sales_summary", label: "Sales Summary", desc: "Executive briefing on revenue & trends" },
  { key: "dealer_ranking", label: "Dealer Ranking", desc: "Top and bottom dealers with commentary" },
  { key: "supplier_ranking", label: "Supplier Assessment", desc: "Reliability and lead-time analysis" },
  { key: "demand_forecast", label: "Demand Forecast", desc: "30-day outlook by category" },
  { key: "procurement", label: "Procurement Advice", desc: "What to order and why" },
  { key: "dead_stock", label: "Dead Stock", desc: "Slow-moving SKUs and next steps" },
];

export default function AIInsightsPage() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(null);

  const load = async () => {
    try {
      const { data } = await api.get("/ai/history", { params: { limit: 20 } });
      setHistory(data);
    } catch { toast.error("Failed to load"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const ask = async (topic) => {
    setGenerating(topic);
    try {
      await api.post("/ai/insight", { topic });
      toast.success("Insight generated");
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
    finally { setGenerating(null); }
  };

  return (
    <AppShell title="AI Insights" subtitle="Executive intelligence powered by Claude Sonnet">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 stagger mb-6">
        {TOPICS.map((t) => (
          <button key={t.key} onClick={() => ask(t.key)} disabled={!!generating}
            className="text-left bg-white p-5 rounded-lg border border-[#E5E7EB] hover:border-[#F28C18] hover:shadow-md transition-all disabled:opacity-60 group"
            data-testid={`ai-topic-${t.key}`}>
            <div className="flex items-start justify-between mb-2">
              <div className="w-9 h-9 rounded-md bg-[#F4F5F7] flex items-center justify-center text-[#0A2342] group-hover:bg-[#F28C18]/10 group-hover:text-[#D96B0B] transition-colors">
                <Sparkle size={16} weight="fill" />
              </div>
              {generating === t.key && <CircleNotch size={16} className="animate-spin text-[#F28C18]" />}
            </div>
            <div className="font-display font-semibold text-[#06182F] text-[15px]">{t.label}</div>
            <div className="text-xs text-[#5C6670] mt-1">{t.desc}</div>
          </button>
        ))}
      </div>

      <PageSection title="Recent Insights" description="Your latest AI-generated business briefings">
        {loading ? <div className="p-8 text-center text-sm text-[#5C6670]">Loading…</div>
          : history.length === 0 ? <EmptyState title="No insights yet" description="Pick a topic above to generate your first insight." />
          : (
            <div className="divide-y divide-[#F1F2F4]">
              {history.map((h) => (
                <div key={h.id} className="p-5" data-testid={`insight-${h.id}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-md gradient-brand-accent flex items-center justify-center">
                        <Robot size={13} className="text-white" weight="fill" />
                      </div>
                      <div>
                        <div className="font-display font-semibold text-[#06182F] text-sm">{TOPICS.find((t) => t.key === h.topic)?.label || h.topic}</div>
                        <div className="text-[11px] text-[#5C6670]">{fmt.datetime(h.created_at)}</div>
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-[#06182F] leading-relaxed whitespace-pre-wrap font-[400]">
                    {h.output}
                  </div>
                </div>
              ))}
            </div>
          )}
      </PageSection>
    </AppShell>
  );
}
