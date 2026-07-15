import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";
import { PageSection } from "@/components/common/Common";
import { toast } from "@/components/ui/sonner";

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await api.get("/settings");
      setSettings(data);
    })();
  }, []);

  if (!settings) return <AppShell title="Settings"><div className="p-8 text-sm text-[#5C6670]">Loading…</div></AppShell>;

  const save = async () => {
    try {
      const { data } = await api.put("/settings", settings);
      setSettings(data);
      toast.success("Settings saved");
    } catch { toast.error("Failed"); }
  };

  const set = (k, v) => setSettings({ ...settings, [k]: v });

  return (
    <AppShell title="Settings" subtitle="Global platform configuration">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PageSection title="Organization">
          <div className="p-5 space-y-4">
            {[
              ["company_name", "Company Name", "text"],
              ["currency", "Currency", "text"],
              ["gst_percent", "Default GST %", "number"],
            ].map(([k, l, t]) => (
              <div key={k}>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#5C6670] mb-1.5">{l}</label>
                <input type={t} value={settings[k] ?? ""} onChange={(e) => set(k, t === "number" ? Number(e.target.value) : e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-[#E5E7EB] text-sm focus:border-[#F28C18] focus:ring-1 focus:ring-[#F28C18] outline-none"
                  data-testid={`settings-${k}`} />
              </div>
            ))}
          </div>
        </PageSection>

        <PageSection title="Tally Integration">
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#5C6670] mb-1.5">Tally Endpoint</label>
              <input value={settings.tally_endpoint ?? ""} onChange={(e) => set("tally_endpoint", e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-[#E5E7EB] text-sm focus:border-[#F28C18] focus:ring-1 focus:ring-[#F28C18] outline-none font-mono"
                data-testid="settings-tally-endpoint" />
              <p className="text-[11px] text-[#5C6670] mt-1">e.g. http://tally-server.local:9000</p>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#5C6670] mb-1.5">Auto Sync Interval (min)</label>
              <input type="number" value={settings.sync_interval_min ?? 30} onChange={(e) => set("sync_interval_min", Number(e.target.value))}
                className="w-full h-10 px-3 rounded-md border border-[#E5E7EB] text-sm focus:border-[#F28C18] focus:ring-1 focus:ring-[#F28C18] outline-none" />
            </div>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!settings.auto_sync_enabled} onChange={(e) => set("auto_sync_enabled", e.target.checked)}
                className="w-4 h-4 accent-[#F28C18]" data-testid="settings-auto-sync" />
              Auto-sync enabled
            </label>
          </div>
        </PageSection>
      </div>

      <div className="mt-6 flex justify-end">
        <button onClick={save} className="h-10 px-5 rounded-md gradient-brand-accent text-white text-sm font-semibold" data-testid="save-settings">
          Save Changes
        </button>
      </div>
    </AppShell>
  );
}
