import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";
import { PageSection, EmptyState, KPICard } from "@/components/common/Common";
import IndiaHeatmap from "@/components/common/IndiaHeatmap";
import { ExportButton } from "@/lib/csv";
import { toast } from "@/components/ui/sonner";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Legend,
} from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { CurrencyInr, ShoppingCart, Users, Package, MapTrifold, X } from "@phosphor-icons/react";

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [mnpDealers, setMnpDealers] = useState([]);
  const [mnpsSummary, setMnpsSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drillState, setDrillState] = useState(null);
  const [drillData, setDrillData] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const results = await Promise.allSettled([
          api.get("/analytics/overview"),
          user?.role === "admin" || user?.role === "cnf" || user?.role === "mnp" ? api.get("/analytics/cnf/dealers") : Promise.resolve({ data: [] }),
          user?.role === "admin" ? api.get("/analytics/cnfs-summary") : Promise.resolve({ data: [] }),
        ]);

        if (results[0].status === "fulfilled" && results[0].value?.data) {
          setData(results[0].value.data);
        } else {
          toast.error("Failed to load overview analytics");
        }

        if (results[1].status === "fulfilled" && results[1].value?.data) {
          setMnpDealers(results[1].value.data);
        }

        if (results[2].status === "fulfilled" && results[2].value?.data) {
          setMnpsSummary(results[2].value.data);
        }
      } catch { toast.error("Failed to load analytics"); }
      finally { setLoading(false); }
    })();
  }, [user?.role]);

  const openDrill = async (state) => {
    setDrillState(state);
    setDrillData(null);
    try {
      const { data } = await api.get(`/analytics/state/${encodeURIComponent(state)}`);
      setDrillData(data);
    } catch { toast.error(`Failed to load ${state}`); }
  };

  if (loading || !data) return <AppShell title="Analytics"><div className="p-8 text-sm text-[#5C6670]">Loading…</div></AppShell>;

  return (
    <AppShell title="Analytics" subtitle="Deep-dive into performance across your network">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6 stagger">
        <KPICard label="Total Revenue" value={data.kpis.revenue} format="inr" icon={CurrencyInr} trend={12.4} testId="an-kpi-revenue" />
        <KPICard label="Orders" value={data.kpis.total_orders} icon={ShoppingCart} trend={8.2} testId="an-kpi-orders" />
        <KPICard label="Dealers" value={data.kpis.dealer_count} icon={Users} trend={5.6} testId="an-kpi-dealers" />
        <KPICard label="Products" value={data.kpis.product_count} icon={Package} testId="an-kpi-products" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
        <PageSection
          title="Territory Heatmap"
          description="Click any state to drill into dealers & top products"
          className="lg:col-span-7"
          actions={<span className="text-xs text-[#5C6670] inline-flex items-center gap-1"><MapTrifold size={14} /> India</span>}
        >
          <div className="p-4">
            <IndiaHeatmap data={data.state_data} onSelectState={openDrill} />
          </div>
        </PageSection>

        <PageSection title="Revenue vs Orders" description="Last 12 weeks" className="lg:col-span-5">
          <div className="p-4 h-[520px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.revenue_trend}>
                <CartesianGrid strokeDasharray="2 4" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#5C6670", fontSize: 11 }} />
                <YAxis yAxisId="left" tickLine={false} axisLine={false} tick={{ fill: "#5C6670", fontSize: 11 }}
                        tickFormatter={(v) => v >= 100000 ? `${(v/100000).toFixed(1)}L` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tick={{ fill: "#5C6670", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 12 }} formatter={(v, n) => n === "revenue" ? [fmt.inr(v), "Revenue"] : [v, "Orders"]} />
                <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
                <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#0A2342" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="orders" stroke="#F28C18" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </PageSection>
      </div>

      <PageSection
        title="State Ranking"
        description="Ordered by revenue"
        className="mb-6"
        actions={
          <ExportButton
            filename="yamini-flow-state-sales-{date}.csv"
            rows={data.state_data}
            columns={[
              { key: "state", label: "State" },
              { key: "revenue", label: "Revenue (INR)" },
              { key: "orders", label: "Orders" },
            ]}
          />
        }
      >
        <div className="p-4 h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.state_data} onClick={(d) => d?.activeLabel && openDrill(d.activeLabel)}>
              <CartesianGrid strokeDasharray="2 4" stroke="#E5E7EB" vertical={false} />
              <XAxis dataKey="state" tickLine={false} axisLine={false} tick={{ fill: "#5C6670", fontSize: 11 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: "#5C6670", fontSize: 11 }}
                      tickFormatter={(v) => v >= 100000 ? `${(v/100000).toFixed(1)}L` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 12 }} formatter={(v) => fmt.inr(v)} />
              <Bar dataKey="revenue" fill="#0A2342" radius={[4, 4, 0, 0]} cursor="pointer" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </PageSection>

      {user.role === "admin" && (
        <PageSection
          title="Regional CNF Network & Distributor Analytics"
          description="Performance overview across each assigned CNF and their active distributors"
          className="mb-6"
          actions={
            <ExportButton
              filename="yamini-flow-cnf-analytics-{date}.csv"
              rows={mnpsSummary}
              columns={[
                { key: "name", label: "Regional CNF" },
                { key: "area", label: "Area" },
                { key: "state", label: "State" },
                { key: "distributor_count", label: "Distributors Added" },
                { key: "target_monthly", label: "Monthly Target" },
                { key: "orders", label: "Orders" },
                { key: "revenue", label: "Revenue" },
              ]}
            />
          }
        >
          {mnpsSummary.length === 0 ? <EmptyState title="No regional CNFs added yet" /> : (
            <div className="overflow-x-auto">
              <table className="yf-table w-full">
                <thead>
                  <tr>
                    <th>Regional CNF</th><th>Area / State</th>
                    <th className="text-right">Distributors Added</th>
                    <th className="text-right">Monthly Target</th>
                    <th className="text-right">Orders</th>
                    <th className="text-right">Total Revenue</th>
                    <th className="text-right">Achievement</th>
                  </tr>
                </thead>
                <tbody>
                  {mnpsSummary.map((m) => {
                    const ach = m.target_monthly > 0 ? Math.round((m.revenue / m.target_monthly) * 100) : 0;
                    return (
                      <tr key={m.cnf_id || m.mnp_id} data-testid={`mnp-perf-${m.cnf_id || m.mnp_id}`}>
                        <td className="font-medium text-[#06182F]">{m.name}</td>
                        <td className="text-xs">{m.area}{m.state ? `, ${m.state}` : ""}</td>
                        <td className="text-right tabular font-semibold text-[#0A2342]">{m.distributor_count}</td>
                        <td className="text-right tabular text-[#5C6670]">{fmt.inr(m.target_monthly)}</td>
                        <td className="text-right tabular">{m.orders}</td>
                        <td className="text-right tabular font-semibold text-[#06182F]">{fmt.inr(m.revenue)}</td>
                        <td className="text-right">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${ach >= 100 ? "bg-green-100 text-green-700" : ach >= 60 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-[#5C6670]"}`}>
                            {ach}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </PageSection>
      )}

      {(user.role === "admin" || user.role === "cnf" || user.role === "mnp") && (
        <PageSection
          title={user.role === "cnf" || user.role === "mnp" ? "My Distributor Network Performance" : "Distributor / Dealer Performance Breakdown"}
          description="Revenue, orders, and credit limits per distributor"
          actions={
            <ExportButton
              filename="yamini-flow-distributor-performance-{date}.csv"
              rows={mnpDealers}
              columns={[
                { key: "name", label: "Distributor" },
                { key: "city", label: "City" },
                { key: "state", label: "State" },
                { key: "credit_limit", label: "Credit Limit" },
                { key: "orders", label: "Orders" },
                { key: "revenue", label: "Revenue" },
              ]}
            />
          }
        >
          {mnpDealers.length === 0 ? <EmptyState title="No distributors to show" /> : (
            <div className="overflow-x-auto">
              <table className="yf-table w-full">
                <thead>
                  <tr>
                    <th>Distributor / Dealer</th><th>City</th><th>State</th>
                    <th className="text-right">Credit Limit</th>
                    <th className="text-right">Orders</th><th className="text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {mnpDealers.map((d) => (
                    <tr key={d.dealer_id} data-testid={`dealer-perf-${d.dealer_id}`}>
                      <td className="font-medium text-[#06182F]">{d.name}</td>
                      <td>{d.city}</td>
                      <td>{d.state}</td>
                      <td className="text-right tabular text-[#5C6670]">{fmt.inr(d.credit_limit)}</td>
                      <td className="text-right tabular">{d.orders}</td>
                      <td className="text-right tabular font-semibold text-[#06182F]">{fmt.inr(d.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PageSection>
      )}

      {/* State drill-down modal */}
      {drillState && (
        <div className="fixed inset-0 z-40 bg-[#06182F]/60 backdrop-blur-sm flex items-end lg:items-center justify-center p-4" onClick={() => setDrillState(null)}>
          <div className="bg-white rounded-lg border border-[#E5E7EB] shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col fade-in-up"
               onClick={(e) => e.stopPropagation()} data-testid="state-drilldown">
            <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-[#F28C18] font-semibold mb-0.5">Territory Drill-down</div>
                <h2 className="font-display text-xl font-semibold text-[#06182F]">{drillState}</h2>
              </div>
              <button onClick={() => setDrillState(null)} className="p-1.5 rounded hover:bg-[#F4F5F7] text-[#5C6670]" data-testid="close-drilldown">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6 space-y-6">
              {!drillData ? <div className="text-sm text-[#5C6670]">Loading…</div> : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#F4F5F7] rounded-lg p-4">
                      <div className="text-[10px] uppercase tracking-widest text-[#5C6670] font-semibold">Total Revenue</div>
                      <div className="font-display text-2xl font-bold text-[#06182F] tabular mt-1">{fmt.inr(drillData.revenue)}</div>
                    </div>
                    <div className="bg-[#F4F5F7] rounded-lg p-4">
                      <div className="text-[10px] uppercase tracking-widest text-[#5C6670] font-semibold">Orders</div>
                      <div className="font-display text-2xl font-bold text-[#06182F] tabular mt-1">{drillData.orders}</div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-display font-semibold text-sm text-[#06182F]">Dealers in {drillState}</h3>
                      <ExportButton
                        filename={`yamini-flow-${drillState}-dealers-{date}.csv`}
                        rows={drillData.dealers}
                        columns={[
                          { key: "name", label: "Dealer" },
                          { key: "revenue", label: "Revenue" },
                          { key: "orders", label: "Orders" },
                        ]}
                      />
                    </div>
                    {drillData.dealers.length === 0 ? <div className="text-sm text-[#5C6670]">No dealers with sales in this state yet.</div> : (
                      <div className="border border-[#E5E7EB] rounded-md overflow-hidden">
                        <table className="yf-table w-full">
                          <thead><tr><th>Dealer</th><th className="text-right">Orders</th><th className="text-right">Revenue</th></tr></thead>
                          <tbody>
                            {drillData.dealers.map((d) => (
                              <tr key={d.id}>
                                <td className="font-medium">{d.name}</td>
                                <td className="text-right tabular">{d.orders}</td>
                                <td className="text-right tabular font-semibold">{fmt.inr(d.revenue)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="font-display font-semibold text-sm text-[#06182F] mb-2">Top Products in {drillState}</h3>
                    {drillData.top_products.length === 0 ? <div className="text-sm text-[#5C6670]">No product data yet.</div> : (
                      <div className="border border-[#E5E7EB] rounded-md overflow-hidden">
                        <table className="yf-table w-full">
                          <thead><tr><th>Product</th><th>SKU</th><th className="text-right">Units</th><th className="text-right">Revenue</th></tr></thead>
                          <tbody>
                            {drillData.top_products.map((p) => (
                              <tr key={p.id}>
                                <td className="font-medium">{p.name}</td>
                                <td className="font-mono text-xs">{p.sku}</td>
                                <td className="text-right tabular">{p.units}</td>
                                <td className="text-right tabular font-semibold">{fmt.inr(p.revenue)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
