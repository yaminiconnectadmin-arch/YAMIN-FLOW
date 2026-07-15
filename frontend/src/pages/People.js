import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";
import { PageSection, StatusBadge, EmptyState } from "@/components/common/Common";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, PencilSimple, Trash } from "@phosphor-icons/react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

/** Reusable people manager for dealers/suppliers/mnp. */
export function PeoplePage({ role, title, fields, endpoint }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});

  const empty = fields.reduce((acc, f) => ({ ...acc, [f.key]: f.default ?? "" }), {});

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(endpoint);
      setItems(data);
    } catch { toast.error("Failed to load"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(empty); setDialogOpen(true); };
  const openEdit = (i) => { setEditing(i); setForm({ ...empty, ...i }); setDialogOpen(true); };
  const save = async () => {
    try {
      if (editing) await api.put(`${endpoint}/${editing.id}`, form);
      else await api.post(endpoint, form);
      toast.success("Saved");
      setDialogOpen(false); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };
  const del = async (i) => {
    if (!window.confirm(`Delete ${i.name}?`)) return;
    await api.delete(`${endpoint}/${i.id}`);
    load(); toast.success("Deleted");
  };

  const filtered = q ? items.filter((i) =>
    Object.values(i).some((v) => String(v || "").toLowerCase().includes(q.toLowerCase()))
  ) : items;

  return (
    <AppShell title={title} subtitle={`${items.length} ${role} in network`}
      actions={
        isAdmin && (
          <button onClick={openNew} className="inline-flex items-center gap-2 px-4 h-9 rounded-md gradient-brand-accent text-white text-sm font-semibold" data-testid={`new-${role}-button`}>
            <Plus size={14} weight="bold" /> New {role}
          </button>
        )
      }
    >
      <PageSection
        title={`${role} directory`}
        actions={
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…"
            className="h-9 px-3 rounded-md border border-[#E5E7EB] text-sm w-[280px] focus:border-[#F28C18] focus:ring-1 focus:ring-[#F28C18] outline-none"
            data-testid={`${role}-search`} />
        }
      >
        {loading ? <div className="p-8 text-center text-sm text-[#5C6670]">Loading…</div>
          : filtered.length === 0 ? <EmptyState title={`No ${role} yet`} />
          : (
            <div className="overflow-x-auto">
              <table className="yf-table w-full">
                <thead>
                  <tr>
                    {fields.filter(f => !f.hideInTable).map((f) => <th key={f.key}>{f.label}</th>)}
                    <th>Status</th>
                    {isAdmin && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((i) => (
                    <tr key={i.id} data-testid={`${role}-row-${i.email}`}>
                      {fields.filter(f => !f.hideInTable).map((f) => (
                        <td key={f.key} className={f.mono ? "font-mono text-xs" : f.strong ? "font-medium" : ""}>
                          {f.format ? f.format(i[f.key]) : (i[f.key] ?? "—")}
                        </td>
                      ))}
                      <td><StatusBadge status={i.status || "active"} /></td>
                      {isAdmin && (
                        <td className="text-right">
                          <div className="flex justify-end gap-1">
                            <button onClick={() => openEdit(i)} className="p-1.5 rounded hover:bg-[#F4F5F7] text-[#5C6670]"><PencilSimple size={14} /></button>
                            <button onClick={() => del(i)} className="p-1.5 rounded hover:bg-red-50 text-red-500"><Trash size={14} /></button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </PageSection>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit" : "New"} {role}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2 max-h-[60vh] overflow-y-auto">
            {fields.filter(f => !editing || f.key !== "password").map((f) => (
              <div key={f.key} className={f.wide ? "col-span-2" : ""}>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#5C6670] mb-1.5">{f.label}</label>
                <input type={f.type || "text"} value={form[f.key] ?? ""}
                  onChange={(e) => setForm({ ...form, [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value })}
                  className="w-full h-10 px-3 rounded-md border border-[#E5E7EB] text-sm focus:border-[#F28C18] focus:ring-1 focus:ring-[#F28C18] outline-none"
                  data-testid={`${role}-form-${f.key}`} />
              </div>
            ))}
          </div>
          <DialogFooter>
            <button onClick={() => setDialogOpen(false)} className="h-9 px-4 rounded-md border border-[#E5E7EB] text-sm">Cancel</button>
            <button onClick={save} className="h-9 px-4 rounded-md gradient-brand-accent text-white text-sm font-semibold" data-testid={`save-${role}-button`}>
              Save
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

const DEALER_FIELDS = [
  { key: "name", label: "Contact Name", strong: true },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "company", label: "Company" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "gstin", label: "GSTIN", mono: true },
  { key: "credit_limit", label: "Credit Limit (₹)", type: "number", format: (v) => v ? fmt.inr(v) : "—", default: 0 },
  { key: "password", label: "Initial Password", wide: true, default: "Dealer@123" },
];

const SUPPLIER_FIELDS = [
  { key: "name", label: "Contact Name", strong: true },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "company", label: "Company" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "gstin", label: "GSTIN", mono: true },
  { key: "lead_time_days", label: "Lead Time (days)", type: "number", default: 7 },
  { key: "password", label: "Initial Password", wide: true, default: "Supplier@123" },
];

const MNP_FIELDS = [
  { key: "name", label: "Name", strong: true },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "area", label: "Area" },
  { key: "state", label: "State" },
  { key: "target_monthly", label: "Monthly Target (₹)", type: "number", format: (v) => v ? fmt.inr(v) : "—", default: 0 },
  { key: "password", label: "Initial Password", wide: true, default: "Mnp@123" },
];

export const DealersPage = () => <PeoplePage role="dealer" title="Dealers" fields={DEALER_FIELDS} endpoint="/dealers" />;
export const SuppliersPage = () => <PeoplePage role="supplier" title="Suppliers" fields={SUPPLIER_FIELDS} endpoint="/suppliers" />;
export const MnpPage = () => <PeoplePage role="mnp" title="MNP Personnel" fields={MNP_FIELDS} endpoint="/mnp" />;
