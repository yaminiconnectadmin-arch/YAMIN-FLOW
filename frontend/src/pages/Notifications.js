import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";
import { PageSection, EmptyState } from "@/components/common/Common";
import { toast } from "@/components/ui/sonner";
import { Bell, Check } from "@phosphor-icons/react";

export default function NotificationsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await api.get("/notifications");
    setItems(data); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const markAll = async () => {
    await api.post("/notifications/mark-all-read");
    toast.success("All marked as read");
    load();
  };

  const kindClass = (k) => ({
    info: "badge-info", success: "badge-success", warning: "badge-warning", error: "badge-error",
  }[k] || "badge-neutral");

  return (
    <AppShell title="Notifications" subtitle="Recent activity across your workspace"
      actions={
        <button onClick={markAll} className="inline-flex items-center gap-2 px-4 h-9 rounded-md border border-[#E5E7EB] hover:border-[#F28C18] text-sm font-medium" data-testid="mark-all-read">
          <Check size={14} weight="bold" /> Mark all read
        </button>
      }
    >
      <PageSection title={`${items.length} notifications`}>
        {loading ? <div className="p-8 text-center text-sm text-[#5C6670]">Loading…</div>
          : items.length === 0 ? <EmptyState title="No notifications" description="You're all caught up." />
          : (
            <div className="divide-y divide-[#F1F2F4]">
              {items.map((n) => (
                <div key={n.id} className={`px-5 py-4 flex items-start gap-4 ${n.read ? "" : "bg-[#F28C18]/[0.03]"}`} data-testid={`notif-${n.id}`}>
                  <div className="w-8 h-8 rounded-full bg-[#F4F5F7] flex items-center justify-center text-[#0A2342] flex-shrink-0">
                    <Bell size={14} weight={n.read ? "regular" : "fill"} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="font-display font-semibold text-sm text-[#06182F]">{n.title}</div>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${kindClass(n.kind)}`}>
                        {n.kind}
                      </span>
                    </div>
                    <div className="text-sm text-[#5C6670]">{n.body}</div>
                    <div className="text-[11px] text-[#BFC5CB] mt-1">{fmt.datetime(n.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
      </PageSection>
    </AppShell>
  );
}
