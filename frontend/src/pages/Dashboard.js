import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import AppShell from "@/components/layout/AppShell";
import { KPICard, PageSection, StatusBadge, EmptyState } from "@/components/common/Common";
import {
  CurrencyInr, ShoppingCart, Warehouse, Users, Package, TrendUp, Lightning, Robot, ArrowRight, Handshake,
} from "@phosphor-icons/react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, PieChart, Pie, Cell,
} from "recharts";
import { Link } from "react-router-dom";

const CHART_COLORS = ["#0A2342", "#F28C18", "#5C6670", "#BFC5CB", "#0EA5E9"];

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let m = true;
    (async () => {
      try {
        const { data } = await api.get("/analytics/overview");
        if (m) setData(data);
      } catch (e) { console.error(e); }
      finally { if (m) setLoading(false); }
    })();
    return () => { m = false; };
  }, []);

  const isAdmin = user?.role === "admin";
  const isDealer = user?.role === "dealer";
  const isMnp = user?.role === "mnp";
  const isSupplier = user?.role === "supplier";

  const roleGreeting = {
    admin: "Executive overview across the entire distribution network.",
    dealer: "Your orders, invoices, and offers at a glance.",
    mnp: "Track your dealers and territory performance.",
    supplier: "Manage your purchase orders and deliveries.",
  }[user?.role];

  return (
    <AppShell title={`Welcome back, ${user?.name?.split(" ")[0] || ""}`} subtitle={roleGreeting}>
      {loading || !data ? (
        <div className="grid grid-cols-4 gap-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-lg bg-white border border-[#E5E7EB] animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* KPI Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 stagger">
            <KPICard
              label={isSupplier ? "Total POs" : "Revenue"}
              value={isSupplier ? data.kpis.total_orders : data.kpis.revenue}
              format={isSupplier ? "num" : "inr"}
              icon={CurrencyInr}
              trend={12.4}
              hint="vs. last 30d"
              testId="kpi-revenue"
            />
            <KPICard
              label={isDealer ? "My Orders" : "Total Orders"}
              value={data.kpis.total_orders}
              icon={ShoppingCart}
              trend={8.2}
              hint={`${data.kpis.delivered_orders} delivered`}
              testId="kpi-orders"
            />
            <KPICard
              label="Inventory Value"
              value={data.kpis.inventory_value}
              format="inr"
              icon={Warehouse}
              trend={-2.1}
              hint={`${fmt.num(data.kpis.total_units)} units`}
              testId="kpi-inventory"
            />
            <KPICard
              label={isAdmin ? "Dealers" : isMnp ? "Active Dealers" : isSupplier ? "SKUs Supplied" : "SKUs Available"}
              value={isSupplier ? data.kpis.product_count : data.kpis.dealer_count}
              icon={isSupplier ? Package : Users}
              trend={5.6}
              hint={isAdmin ? `${data.kpis.supplier_count} suppliers` : ""}
              testId="kpi-partners"
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <PageSection
              title="Revenue Trend"
              description="Weekly revenue across the last 12 weeks"
              className="lg:col-span-8"
              actions={
                <div className="flex items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#0A2342]" /> Revenue</span>
                  <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#F28C18]" /> Orders</span>
                </div>
              }
            >
              <div className="p-4 h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.revenue_trend} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0A2342" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="#0A2342" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 4" stroke="#E5E7EB" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#5C6670", fontSize: 11 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: "#5C6670", fontSize: 11 }}
                            tickFormatter={(v) => v >= 100000 ? `${(v/100000).toFixed(1)}L` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                    <Tooltip
                      contentStyle={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 12, boxShadow: "0 4px 20px rgba(6,24,47,0.08)" }}
                      formatter={(v, n) => n === "revenue" ? [fmt.inr(v), "Revenue"] : [v, "Orders"]}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#0A2342" strokeWidth={2} fill="url(#rev)" />
                    <Area type="monotone" dataKey="orders" stroke="#F28C18" strokeWidth={2} fill="transparent" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </PageSection>

            <PageSection title="Top Products" description="By revenue" className="lg:col-span-4">
              <div className="p-4 h-[300px]">
                {data.top_products.length === 0 ? (
                  <EmptyState title="No sales yet" description="Once orders come in, top products will show here." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.top_products} dataKey="revenue" nameKey="name"
                        innerRadius={55} outerRadius={90} paddingAngle={2}
                      >
                        {data.top_products.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 12 }}
                        formatter={(v) => fmt.inr(v)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </PageSection>
          </div>

          {/* Second row: top dealers + state-wise + low stock */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {(isAdmin || isMnp) && (
              <PageSection title="Top Dealers" description="Ranked by revenue" className="lg:col-span-6">
                <div className="p-4">
                  {data.top_dealers.length === 0 ? (
                    <EmptyState title="No dealers ranked yet" />
                  ) : (
                    <div className="space-y-3">
                      {data.top_dealers.map((d, i) => (
                        <div key={d.id} className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-md bg-[#F4F5F7] font-display font-semibold text-[13px] flex items-center justify-center text-[#0A2342]">
                            #{i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-[#06182F] truncate">{d.name}</div>
                            <div className="text-xs text-[#5C6670]">{d.state} · {d.orders} orders</div>
                          </div>
                          <div className="tabular text-sm font-semibold text-[#0A2342]">{fmt.inr(d.revenue)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </PageSection>
            )}

            <PageSection
              title={isAdmin || isMnp ? "State-wise Sales" : "Recent Activity"}
              description={isAdmin || isMnp ? "Revenue distribution" : "Latest updates on your account"}
              className={isAdmin || isMnp ? "lg:col-span-6" : "lg:col-span-12"}
            >
              <div className="p-4 h-[280px]">
                {(isAdmin || isMnp) && data.state_data.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.state_data} layout="vertical" margin={{ left: 12, right: 12 }}>
                      <CartesianGrid horizontal={false} strokeDasharray="2 4" stroke="#E5E7EB" />
                      <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: "#5C6670", fontSize: 11 }}
                              tickFormatter={(v) => v >= 100000 ? `${(v/100000).toFixed(1)}L` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                      <YAxis type="category" dataKey="state" tickLine={false} axisLine={false} tick={{ fill: "#06182F", fontSize: 12 }} width={100} />
                      <Tooltip
                        contentStyle={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 12 }}
                        formatter={(v) => fmt.inr(v)}
                      />
                      <Bar dataKey="revenue" fill="#F28C18" radius={[0, 4, 4, 0]} barSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState title="No data yet" />
                )}
              </div>
            </PageSection>
          </div>

          {/* Low stock + AI CTA */}
          {(isAdmin || isMnp) && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <PageSection title="Low Stock Alerts" description="Below safety threshold" className="lg:col-span-7">
                <div className="p-0">
                  {data.low_stock_alerts.length === 0 ? (
                    <EmptyState title="All good" description="No products below safety stock." />
                  ) : (
                    <table className="yf-table w-full">
                      <thead>
                        <tr><th>Product</th><th>SKU</th><th className="text-right">Available</th><th className="text-right">Safety</th><th>Status</th></tr>
                      </thead>
                      <tbody>
                        {data.low_stock_alerts.map((l) => (
                          <tr key={l.product_id} data-testid={`low-stock-${l.sku}`}>
                            <td className="font-medium">{l.name}</td>
                            <td className="font-mono text-xs text-[#5C6670]">{l.sku}</td>
                            <td className="text-right tabular font-semibold">{l.available}</td>
                            <td className="text-right tabular text-[#5C6670]">{l.safety_stock}</td>
                            <td><StatusBadge status={l.available === 0 ? "critical" : "low"} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </PageSection>

              <div className="lg:col-span-5 bg-gradient-to-br from-[#06182F] to-[#0A2342] text-white rounded-lg p-6 border border-[#0A2342] card-shadow flex flex-col justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#F28C18] font-semibold mb-3">
                    <Robot size={14} /> AI Intelligence
                  </div>
                  <h3 className="font-display text-2xl font-semibold leading-tight tracking-tight mb-2">
                    Ask Yamini AI to explain what's happening in your business.
                  </h3>
                  <p className="text-sm text-white/70">
                    Get instant executive summaries, dealer rankings, demand forecasts and procurement recommendations — powered by Claude.
                  </p>
                </div>
                <Link
                  to="/ai-insights"
                  data-testid="dashboard-ai-cta"
                  className="mt-6 self-start inline-flex items-center gap-2 px-4 py-2.5 rounded-md gradient-brand-accent text-white text-sm font-semibold hover:shadow-lg transition-all"
                >
                  Open AI Insights <ArrowRight size={14} weight="bold" />
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
