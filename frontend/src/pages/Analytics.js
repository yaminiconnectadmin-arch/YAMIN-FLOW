import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";
import { PageSection, StatusBadge, EmptyState, KPICard } from "@/components/common/Common";
import { toast } from "@/components/ui/sonner";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Legend,
} from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { CurrencyInr, ShoppingCart, Users, Package } from "@phosphor-icons/react";

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [mnpDealers, setMnpDealers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [o, m] = await Promise.all([
          api.get("/analytics/overview"),
          user.role === "admin" || user.role === "mnp" ? api.get("/analytics/mnp/dealers") : Promise.resolve({ data: [] }),
        ]);
        setData(o.data);
        setMnpDealers(m.data);
      } catch { toast.error("Failed to load analytics"); }
      finally { setLoading(false); }
    })();
  }, [user.role]);

  if (loading || !data) return <AppShell title="Analytics"><div className="p-8 text-sm text-[#5C6670]">Loading…</div></AppShell>;

  return (
    <AppShell title="Analytics" subtitle="Deep-dive into performance across your network">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6 stagger">
        <KPICard label="Total Revenue" value={data.kpis.revenue} format="inr" icon={CurrencyInr} trend={12.4} testId="an-kpi-revenue" />
        <KPICard label="Orders" value={data.kpis.total_orders} icon={ShoppingCart} trend={8.2} testId="an-kpi-orders" />
        <KPICard label="Dealers" value={data.kpis.dealer_count} icon={Users} trend={5.6} testId="an-kpi-dealers" />
        <KPICard label="Products" value={data.kpis.product_count} icon={Package} testId="an-kpi-products" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <PageSection title="Revenue vs Orders" description="Trend across the last 12 weeks">
          <div className="p-4 h-[320px]">
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

        <PageSection title="State Distribution" description="Revenue by dealer state">
          <div className="p-4 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.state_data}>
                <CartesianGrid strokeDasharray="2 4" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="state" tickLine={false} axisLine={false} tick={{ fill: "#5C6670", fontSize: 11 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: "#5C6670", fontSize: 11 }}
                        tickFormatter={(v) => v >= 100000 ? `${(v/100000).toFixed(1)}L` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 12 }} formatter={(v) => fmt.inr(v)} />
                <Bar dataKey="revenue" fill="#0A2342" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </PageSection>
      </div>

      {(user.role === "admin" || user.role === "mnp") && (
        <PageSection title="Dealer Performance" description="Revenue and orders per dealer">
          {mnpDealers.length === 0 ? <EmptyState title="No dealers to show" /> : (
            <table className="yf-table w-full">
              <thead>
                <tr>
                  <th>Dealer</th><th>City</th><th>State</th>
                  <th className="text-right">Credit Limit</th>
                  <th className="text-right">Orders</th><th className="text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {mnpDealers.map((d) => (
                  <tr key={d.dealer_id} data-testid={`dealer-perf-${d.dealer_id}`}>
                    <td className="font-medium">{d.name}</td>
                    <td>{d.city}</td>
                    <td>{d.state}</td>
                    <td className="text-right tabular">{fmt.inr(d.credit_limit)}</td>
                    <td className="text-right tabular">{d.orders}</td>
                    <td className="text-right tabular font-semibold">{fmt.inr(d.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </PageSection>
      )}
    </AppShell>
  );
}
