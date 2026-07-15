import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";
import { PageSection, StatusBadge, EmptyState } from "@/components/common/Common";
import { Plus, PencilSimple, Trash } from "@phosphor-icons/react";
import { toast } from "@/components/ui/sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

export default function WarehousesPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ code: "", name: "", address: "", city: "", state: "", manager: "" });

  const load = async () => {
    setLoading(true);
    const { data } = await api.get("/warehouses");
    setItems(data); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      if (editing) await api.put(`/warehouses/${editing.id}`, form);
      else await api.post("/warehouses", form);
      toast.success("Saved");
      setDialogOpen(false); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  return (
    <AppShell title="Warehouses" subtitle={`${items.length} locations`}
      actions={
        <button onClick={() => { setEditing(null); setForm({ code: "", name: "", address: "", city: "", state: "", manager: "" }); setDialogOpen(true); }}
          className="inline-flex items-center gap-2 px-4 h-9 rounded-md gradient-brand-accent text-white text-sm font-semibold" data-testid="new-warehouse-button">
          <Plus size={14} weight="bold" /> New Warehouse
        </button>
      }
    >
      <PageSection title="Locations">
        {loading ? <div className="p-8 text-center text-sm text-[#5C6670]">Loading…</div>
          : items.length === 0 ? <EmptyState title="No warehouses" />
          : (
            <table className="yf-table w-full">
              <thead><tr><th>Code</th><th>Name</th><th>City</th><th>State</th><th>Manager</th><th>Address</th><th></th></tr></thead>
              <tbody>
                {items.map((w) => (
                  <tr key={w.id} data-testid={`warehouse-row-${w.code}`}>
                    <td className="font-mono text-xs">{w.code}</td>
                    <td className="font-medium">{w.name}</td>
                    <td>{w.city}</td>
                    <td>{w.state}</td>
                    <td>{w.manager || "—"}</td>
                    <td className="text-[#5C6670]">{w.address || "—"}</td>
                    <td className="text-right">
                      <button onClick={() => { setEditing(w); setForm({ ...w }); setDialogOpen(true); }}
                        className="p-1.5 rounded hover:bg-[#F4F5F7] text-[#5C6670]"><PencilSimple size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </PageSection>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit" : "New"} Warehouse</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            {[
              ["code", "Code"], ["name", "Name"], ["city", "City"], ["state", "State"],
              ["manager", "Manager"],
            ].map(([k, l]) => (
              <div key={k}>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#5C6670] mb-1.5">{l}</label>
                <input value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                  className="w-full h-10 px-3 rounded-md border border-[#E5E7EB] text-sm focus:border-[#F28C18] focus:ring-1 focus:ring-[#F28C18] outline-none" />
              </div>
            ))}
            <div className="col-span-2">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#5C6670] mb-1.5">Address</label>
              <input value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full h-10 px-3 rounded-md border border-[#E5E7EB] text-sm focus:border-[#F28C18] focus:ring-1 focus:ring-[#F28C18] outline-none" />
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setDialogOpen(false)} className="h-9 px-4 rounded-md border border-[#E5E7EB] text-sm">Cancel</button>
            <button onClick={save} className="h-9 px-4 rounded-md gradient-brand-accent text-white text-sm font-semibold">Save</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
