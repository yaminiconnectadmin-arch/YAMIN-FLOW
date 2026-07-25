import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";
import { PageSection } from "@/components/common/Common";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  Plus, Trash, LockKey, LockKeyOpen, Copy, X, Eye, EyeSlash,
  UserGear, CheckSquare, Square, ArrowClockwise, Check,
} from "@phosphor-icons/react";

// ─── Constants ──────────────────────────────────────────────────────────────

const ALL_TABS = [
  { key: "dashboard",       label: "Dashboard" },
  { key: "analytics",       label: "Analytics" },
  { key: "products",        label: "Products" },
  { key: "inventory",       label: "Inventory" },
  { key: "orders",          label: "Orders" },
  { key: "procurement",     label: "Procurement" },
  { key: "purchase-orders", label: "Purchase Orders" },
  { key: "dealers",         label: "Dealers" },
  { key: "mnp",             label: "MNP Personnel" },
  { key: "suppliers",       label: "Suppliers" },
  { key: "warehouses",      label: "Warehouses" },
  { key: "tally",           label: "Tally Sync" },
  { key: "notifications",   label: "Notifications" },
  { key: "audit",           label: "Audit Logs" },
  { key: "settings",        label: "Settings" },
];

function genPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!";
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function TabCheckbox({ tabKey, label, checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(tabKey)}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
        checked
          ? "bg-[#F28C18]/10 border-[#F28C18]/40 text-[#F28C18]"
          : "bg-white/0 border-[#E5E7EB] text-[#5C6670] hover:border-[#F28C18]/30"
      }`}
    >
      {checked ? <CheckSquare size={15} weight="fill" /> : <Square size={15} />}
      {label}
    </button>
  );
}

function AddStaffModal({ onClose, onCreated }) {
  const [name, setName] = useState("");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("Welcome@2026");
  const [showPwd, setShowPwd] = useState(false);
  const [selectedTabs, setSelectedTabs] = useState([]);
  const [loading, setLoading] = useState(false);

  const toggleTab = (key) =>
    setSelectedTabs((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);

  const selectAll = () => setSelectedTabs(ALL_TABS.map((t) => t.key));
  const clearAll = () => setSelectedTabs([]);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !loginId.trim() || !password.trim()) {
      toast.error("Name, Login ID, and Password are required");
      return;
    }
    if (selectedTabs.length === 0) {
      toast.error("Select at least one tab to grant access");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post("/staff", {
        name: name.trim(),
        login_id: loginId.trim(),
        password,
        allowed_tabs: selectedTabs,
        is_active: true,
      });
      toast.success(`Employee "${data.name}" created!`);
      onCreated(data);
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to create employee");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB] sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2.5">
            <UserGear size={20} weight="fill" className="text-[#F28C18]" />
            <h3 className="font-semibold text-[#1A2233] text-[15px]">Add Employee Access</h3>
          </div>
          <button onClick={onClose} className="text-[#5C6670] hover:text-[#1A2233] transition">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#5C6670] mb-1.5">Full Name</label>
            <input
              value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rahul Sharma"
              className="w-full h-10 px-3 rounded-md border border-[#E5E7EB] text-sm focus:border-[#F28C18] focus:ring-1 focus:ring-[#F28C18] outline-none"
            />
          </div>

          {/* Login ID */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#5C6670] mb-1.5">Login ID</label>
            <input
              value={loginId} onChange={(e) => setLoginId(e.target.value)}
              placeholder="e.g. RAHUL01 (used to log in)"
              className="w-full h-10 px-3 rounded-md border border-[#E5E7EB] text-sm font-mono focus:border-[#F28C18] focus:ring-1 focus:ring-[#F28C18] outline-none"
            />
            <p className="text-[11px] text-[#5C6670] mt-1">Employee uses this ID + password to log in</p>
          </div>

          {/* Password */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#5C6670] mb-1.5">Initial Password</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showPwd ? "text" : "password"}
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-10 px-3 pr-10 rounded-md border border-[#E5E7EB] text-sm font-mono focus:border-[#F28C18] focus:ring-1 focus:ring-[#F28C18] outline-none"
                />
                <button type="button" onClick={() => setShowPwd((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5C6670] hover:text-[#1A2233]">
                  {showPwd ? <EyeSlash size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <button type="button" onClick={() => setPassword(genPassword())}
                className="h-10 px-3 rounded-md border border-[#E5E7EB] text-[12px] text-[#5C6670] hover:border-[#F28C18] hover:text-[#F28C18] transition flex items-center gap-1.5 whitespace-nowrap">
                <ArrowClockwise size={13} /> Generate
              </button>
            </div>
            <p className="text-[11px] text-[#5C6670] mt-1">Employee will be asked to reset this on first login</p>
          </div>

          {/* Tab access */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[#5C6670]">
                Tab Access ({selectedTabs.length}/{ALL_TABS.length} selected)
              </label>
              <div className="flex gap-2">
                <button type="button" onClick={selectAll} className="text-[11px] text-[#F28C18] hover:underline">Select All</button>
                <span className="text-[#E5E7EB]">|</span>
                <button type="button" onClick={clearAll} className="text-[11px] text-[#5C6670] hover:underline">Clear</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {ALL_TABS.map(({ key, label }) => (
                <TabCheckbox key={key} tabKey={key} label={label}
                  checked={selectedTabs.includes(key)} onChange={toggleTab} />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="h-10 px-5 rounded-md border border-[#E5E7EB] text-sm text-[#5C6670] hover:border-[#F28C18] hover:text-[#F28C18] transition">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="h-10 px-5 rounded-md gradient-brand-accent text-white text-sm font-semibold disabled:opacity-50">
              {loading ? "Creating…" : "Create Employee"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditTabsModal({ staff, onClose, onUpdated }) {
  const [selectedTabs, setSelectedTabs] = useState(staff.allowed_tabs || []);
  const [loading, setLoading] = useState(false);

  const toggleTab = (key) =>
    setSelectedTabs((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);

  const save = async () => {
    setLoading(true);
    try {
      const { data } = await api.put(`/staff/${staff.id}`, { allowed_tabs: selectedTabs });
      toast.success("Access updated");
      onUpdated(data);
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to update");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
          <h3 className="font-semibold text-[#1A2233] text-[15px]">Edit Access — {staff.name}</h3>
          <button onClick={onClose}><X size={18} className="text-[#5C6670]" /></button>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 gap-2 mb-5">
            {ALL_TABS.map(({ key, label }) => (
              <TabCheckbox key={key} tabKey={key} label={label}
                checked={selectedTabs.includes(key)} onChange={toggleTab} />
            ))}
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="h-10 px-4 rounded-md border border-[#E5E7EB] text-sm text-[#5C6670]">Cancel</button>
            <button onClick={save} disabled={loading}
              className="h-10 px-5 rounded-md gradient-brand-accent text-white text-sm font-semibold disabled:opacity-50">
              {loading ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StaffRow({ staff, onToggleLock, onDelete, onEditTabs }) {
  const [copying, setCopying] = useState(false);

  const copyLoginInfo = async () => {
    const text = [
      `YAMINI FLOW — Employee Login`,
      `Name: ${staff.name}`,
      `Login ID: ${staff.login_id || staff.email || "—"}`,
      `Password: Welcome@2026 (reset on first login)`,
      `Access: ${(staff.allowed_tabs || []).join(", ")}`,
      `Portal: ${window.location.origin}`,
    ].join("\n");
    await navigator.clipboard.writeText(text);
    setCopying(true);
    setTimeout(() => setCopying(false), 2000);
  };

  const isLocked = staff.status === "disabled" || staff.is_active === false;
  const tabCount = (staff.allowed_tabs || []).length;

  return (
    <div className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
      isLocked ? "bg-[#F9FAFB] border-[#E5E7EB] opacity-60" : "bg-white border-[#E5E7EB] hover:border-[#F28C18]/30 hover:shadow-sm"
    }`}>
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#F28C18]/20 to-[#F28C18]/10 flex items-center justify-center text-[#F28C18] font-bold text-sm flex-shrink-0 border border-[#F28C18]/20">
        {staff.name?.[0]?.toUpperCase() || "?"}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-[#1A2233] text-sm truncate">{staff.name}</span>
          {isLocked && (
            <span className="text-[10px] font-semibold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">Locked</span>
          )}
        </div>
        <div className="text-[12px] text-[#5C6670] font-mono mt-0.5">{staff.login_id || staff.email || "—"}</div>
        <div className="text-[11px] text-[#5C6670] mt-0.5">
          <span className="text-[#F28C18] font-semibold">{tabCount}</span> tab{tabCount !== 1 ? "s" : ""} assigned
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button onClick={onEditTabs} title="Edit tab access"
          className="w-8 h-8 rounded-lg border border-[#E5E7EB] flex items-center justify-center text-[#5C6670] hover:border-[#F28C18] hover:text-[#F28C18] transition">
          <UserGear size={15} />
        </button>
        <button onClick={copyLoginInfo} title="Copy login info"
          className="w-8 h-8 rounded-lg border border-[#E5E7EB] flex items-center justify-center text-[#5C6670] hover:border-[#F28C18] hover:text-[#F28C18] transition">
          {copying ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
        </button>
        <button onClick={onToggleLock}
          title={isLocked ? "Unlock access" : "Lock access"}
          className={`w-8 h-8 rounded-lg border flex items-center justify-center transition ${
            isLocked
              ? "border-green-300 text-green-600 hover:bg-green-50"
              : "border-[#E5E7EB] text-[#5C6670] hover:border-red-300 hover:text-red-500"
          }`}>
          {isLocked ? <LockKeyOpen size={14} /> : <LockKey size={14} />}
        </button>
        <button onClick={onDelete} title="Delete employee"
          className="w-8 h-8 rounded-lg border border-[#E5E7EB] flex items-center justify-center text-[#5C6670] hover:border-red-300 hover:text-red-500 transition">
          <Trash size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Main Settings Page ───────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "admin" && user?.admin_role !== "staff";

  const [settings, setSettings] = useState(null);
  const [staffList, setStaffList] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);

  // Load platform settings
  useEffect(() => {
    (async () => {
      const { data } = await api.get("/settings");
      setSettings(data);
    })();
  }, []);

  // Load staff list
  const loadStaff = useCallback(async () => {
    if (!isSuperAdmin) return;
    setStaffLoading(true);
    try {
      const { data } = await api.get("/staff");
      setStaffList(data);
    } catch {
      // non-critical
    } finally {
      setStaffLoading(false);
    }
  }, [isSuperAdmin]);

  useEffect(() => { loadStaff(); }, [loadStaff]);

  if (!settings) return <AppShell title="Settings"><div className="p-8 text-sm text-[#5C6670]">Loading…</div></AppShell>;

  const save = async () => {
    try {
      const { data } = await api.put("/settings", settings);
      setSettings(data);
      toast.success("Settings saved");
    } catch { toast.error("Failed"); }
  };

  const set = (k, v) => setSettings({ ...settings, [k]: v });

  const handleToggleLock = async (s) => {
    const newActive = s.status === "disabled" || s.is_active === false;
    try {
      const { data } = await api.put(`/staff/${s.id}`, { is_active: newActive });
      setStaffList((prev) => prev.map((x) => x.id === s.id ? data : x));
      toast.success(newActive ? "Access unlocked" : "Access locked");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed");
    }
  };

  const handleDelete = async (s) => {
    if (!window.confirm(`Permanently remove "${s.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/staff/${s.id}`);
      setStaffList((prev) => prev.filter((x) => x.id !== s.id));
      toast.success(`"${s.name}" removed`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed");
    }
  };

  return (
    <AppShell title="Settings" subtitle="Global platform configuration">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Organization ── */}
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

        {/* ── Tally Integration ── */}
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

      {/* ── Staff & Employee Access Control (Super Admin only) ── */}
      {isSuperAdmin && (
        <div className="mt-8">
          <PageSection
            title="Staff & Employee Access"
            subtitle="Manage which admin panel tabs each employee can access"
          >
            <div className="p-5">
              {/* Header row */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-[#5C6670]">
                    <span className="font-semibold text-[#F28C18]">{staffList.length}</span> employee{staffList.length !== 1 ? "s" : ""} with panel access
                  </p>
                </div>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 h-9 px-4 rounded-lg gradient-brand-accent text-white text-sm font-semibold shadow-sm hover:shadow-md transition-all"
                  data-testid="add-employee-btn"
                >
                  <Plus size={15} weight="bold" />
                  Add Employee
                </button>
              </div>

              {/* Staff list */}
              {staffLoading ? (
                <div className="text-center py-8 text-sm text-[#5C6670]">Loading staff…</div>
              ) : staffList.length === 0 ? (
                <div className="text-center py-10 rounded-xl border-2 border-dashed border-[#E5E7EB]">
                  <UserGear size={32} className="mx-auto text-[#CBD5E0] mb-3" />
                  <p className="text-sm font-medium text-[#5C6670]">No employee accounts yet</p>
                  <p className="text-[12px] text-[#9AA5B4] mt-1">Click &quot;Add Employee&quot; to grant limited admin access</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {staffList.map((s) => (
                    <StaffRow
                      key={s.id}
                      staff={s}
                      onToggleLock={() => handleToggleLock(s)}
                      onDelete={() => handleDelete(s)}
                      onEditTabs={() => setEditingStaff(s)}
                    />
                  ))}
                </div>
              )}

              {/* Legend */}
              <div className="mt-5 pt-4 border-t border-[#E5E7EB] flex flex-wrap gap-x-5 gap-y-1">
                {[
                  ["#F28C18", "Super Admin — Full Access"],
                  ["#3B82F6", "Staff — Limited tab access"],
                ].map(([color, label]) => (
                  <div key={label} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                    <span className="text-[11px] text-[#5C6670]">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </PageSection>
        </div>
      )}

      {/* ── Modals ── */}
      {showAddModal && (
        <AddStaffModal
          onClose={() => setShowAddModal(false)}
          onCreated={(newStaff) => setStaffList((prev) => [newStaff, ...prev])}
        />
      )}
      {editingStaff && (
        <EditTabsModal
          staff={editingStaff}
          onClose={() => setEditingStaff(null)}
          onUpdated={(updated) => {
            setStaffList((prev) => prev.map((x) => x.id === updated.id ? updated : x));
            setEditingStaff(null);
          }}
        />
      )}
    </AppShell>
  );
}
