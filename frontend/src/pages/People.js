import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";
import { PageSection, StatusBadge, EmptyState } from "@/components/common/Common";
import { ExportButton } from "@/lib/csv";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, PencilSimple, Trash, WhatsappLogo, Sparkle, CheckCircle } from "@phosphor-icons/react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

/** Reusable people manager for dealers/distributors/suppliers/mnp. */
export function PeoplePage({ role, title, fields, endpoint }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isMnp = user?.role === "mnp";
  const canManage = isAdmin || (role === "dealer" && isMnp);

  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [createdInfo, setCreatedInfo] = useState(null);

  const empty = fields.reduce((acc, f) => ({ ...acc, [f.key]: f.default ?? "" }), {});

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(endpoint);
      setItems(data);
    } catch { toast.error("Failed to load directory"); }
    finally { setLoading(false); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(empty); setDialogOpen(true); };
  const openEdit = (i) => { setEditing(i); setForm({ ...empty, ...i }); setDialogOpen(true); };
  
  const autoGenPassword = () => {
    const prefix = role === "dealer" ? "Dist" : role === "mnp" ? "Mnp" : "Sup";
    const rand = Math.floor(1000 + Math.random() * 9000);
    setForm((prev) => ({ ...prev, password: `${prefix}@${rand}` }));
    toast.info(`Generated: ${prefix}@${rand}`);
  };

  const save = async () => {
    try {
      let res;
      if (editing) {
        res = await api.put(`${endpoint}/${editing.id}`, form);
        toast.success("Saved successfully");
      } else {
        res = await api.post(endpoint, form);
        toast.success("Created successfully");
        if (res.data) {
          setCreatedInfo({
            name: res.data.name || form.name,
            email: res.data.email || form.email,
            loginCode: res.data.login_id || res.data.user_code || res.data.email || form.email,
            phone: res.data.phone || form.phone,
            password: res.data.raw_password || form.password || "Dist@1234",
            roleName: title.includes("/") ? "Distributor" : title.replace("s", ""),
          });
        }
      }
      setDialogOpen(false);
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed to save"); }
  };

  const del = async (i) => {
    if (!window.confirm(`Delete ${i.name}?`)) return;
    try {
      await api.delete(`${endpoint}/${i.id}`);
      load();
      toast.success("Deleted successfully");
    } catch (e) { toast.error(e.response?.data?.detail || "Failed to delete"); }
  };

  const sendWhatsApp = (item, pwd = null) => {
    const cleanPhone = (item.phone || "").replace(/[^0-9]/g, "");
    if (!cleanPhone) {
      toast.error("No valid phone number provided for WhatsApp");
      return;
    }
    const roleLabel = role === "dealer" ? "Distributor" : role === "mnp" ? "Regional MNP" : "Supplier";
    const codeStr = item.loginCode || item.login_id || item.user_code || item.email;
    let msg = `Hello ${item.name},\n\nWelcome to Yamini Flow as an official ${roleLabel}!\n\nHere are your secure login credentials:\n🌐 Portal URL: https://yaminiflow-frontend.vercel.app\n🏷️ Unique Distributor Login ID: ${codeStr}\n✉️ Email Address: ${item.email}`;
    if (pwd) {
      msg += `\n🔑 Initial Password: ${pwd}`;
    } else {
      msg += `\n🔑 Password: (Your registered/initial account password)`;
    }
    msg += `\n\nYou can use EITHER your Unique Login ID (${codeStr}) OR your Email Address on the login screen. Reach out if you need assistance!`;

    const url = `https://wa.me/${cleanPhone.startsWith("91") ? cleanPhone : "91" + cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  const filtered = q ? items.filter((i) =>
    Object.values(i).some((v) => String(v || "").toLowerCase().includes(q.toLowerCase()))
  ) : items;

  return (
    <AppShell title={title} subtitle={`${items.length} registered in network`}
      actions={
        canManage && (
          <button onClick={openNew} className="inline-flex items-center gap-2 px-4 h-9 rounded-md gradient-brand-accent text-white text-sm font-semibold shadow-sm hover:opacity-95 transition-opacity" data-testid={`new-${role}-button`}>
            <Plus size={14} weight="bold" /> New {title.includes("/") ? "Distributor" : title.replace("s", "")}
          </button>
        )
      }
    >
      <PageSection
        title={`${title} Directory`}
        actions={
          <div className="flex items-center gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search directory…"
              className="h-9 px-3 rounded-md border border-[#E5E7EB] text-sm w-[280px] focus:border-[#F28C18] focus:ring-1 focus:ring-[#F28C18] outline-none"
              data-testid={`${role}-search`} />
            <ExportButton
              filename={`yamini-flow-${role}-{date}.csv`}
              rows={filtered}
              columns={fields.filter(f => !f.hideInTable && f.key !== "password").map(f => ({
                key: f.key, label: f.label, format: f.format,
              }))}
            />
          </div>
        }
      >
        {loading ? <div className="p-8 text-center text-sm text-[#5C6670]">Loading directory…</div>
          : filtered.length === 0 ? <EmptyState title={`No ${title.toLowerCase()} yet`} description={canManage ? "Click the button above to add the first one" : ""} />
          : (
            <div className="overflow-x-auto">
              <table className="yf-table w-full">
                <thead>
                  <tr>
                    {fields.filter(f => !f.hideInTable && f.key !== "password").map((f) => <th key={f.key}>{f.label}</th>)}
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((i) => (
                    <tr key={i.id} data-testid={`${role}-row-${i.email}`}>
                      {fields.filter(f => !f.hideInTable && f.key !== "password").map((f) => (
                        <td key={f.key} className={f.mono ? "font-mono text-xs" : f.strong ? "font-medium text-[#06182F]" : ""}>
                          {f.format ? f.format(i[f.key]) : (i[f.key] ?? "—")}
                        </td>
                      ))}
                      <td><StatusBadge status={i.status || "active"} /></td>
                      <td className="text-right">
                        <div className="flex justify-end items-center gap-1.5">
                          {i.phone && (
                            <button
                              onClick={() => sendWhatsApp(i)}
                              title="Send Login Portal Link via WhatsApp"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#E8F5E9] text-[#2E7D32] hover:bg-[#C8E6C9] text-xs font-medium transition-colors"
                            >
                              <WhatsappLogo size={14} weight="fill" /> WhatsApp
                            </button>
                          )}
                          {canManage && (
                            <>
                              <button onClick={() => openEdit(i)} title="Edit details" className="p-1.5 rounded hover:bg-[#F4F5F7] text-[#5C6670] transition-colors"><PencilSimple size={15} /></button>
                              <button onClick={() => del(i)} title="Delete profile" className="p-1.5 rounded hover:bg-red-50 text-red-500 transition-colors"><Trash size={15} /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </PageSection>

      {/* Create / Edit Modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit" : "Add New"} {title.includes("/") ? "Distributor" : title.replace("s", "")}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2 max-h-[60vh] overflow-y-auto">
            {!editing && (role === "dealer" || role === "mnp") && (
              <div className="col-span-2 bg-[#FFFBEB] border border-[#FDE68A] p-3 rounded-lg text-xs text-[#92400E] flex items-start gap-2.5">
                <span className="text-base">🏷️</span>
                <span>
                  <strong>Automatic Unique Code & Login ID:</strong> Upon saving, the system generates a unique location-indexed code starting from index 100 (e.g., <strong>{role === "mnp" ? "M-RK-MH-101" : "D-ST-MH-101"}</strong>) using initials & state. This code serves as their primary login ID!
                </span>
              </div>
            )}
            {fields.filter(f => (!editing || f.key !== "password") && !f.hideInForm).map((f) => (
              <div key={f.key} className={f.wide ? "col-span-2" : ""}>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#5C6670]">{f.label}</label>
                  {f.key === "password" && !editing && (
                    <button
                      type="button"
                      onClick={autoGenPassword}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#F28C18] hover:underline"
                    >
                      <Sparkle size={12} weight="fill" /> Auto-Generate
                    </button>
                  )}
                </div>
                <input type={f.type || "text"} value={form[f.key] ?? ""}
                  placeholder={f.key === "password" ? "Leave blank for auto-generated password" : f.key === "email" ? "Optional (e.g. d-st-mh-101@distributor.yaminiflow.com)" : ""}
                  onChange={(e) => setForm({ ...form, [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value })}
                  className="w-full h-10 px-3 rounded-md border border-[#E5E7EB] text-sm focus:border-[#F28C18] focus:ring-1 focus:ring-[#F28C18] outline-none"
                  data-testid={`${role}-form-${f.key}`} />
              </div>
            ))}
          </div>
          <DialogFooter>
            <button onClick={() => setDialogOpen(false)} className="h-9 px-4 rounded-md border border-[#E5E7EB] text-sm font-medium hover:bg-[#F4F5F7]">Cancel</button>
            <button onClick={save} className="h-9 px-5 rounded-md gradient-brand-accent text-white text-sm font-semibold shadow-sm hover:opacity-95" data-testid={`save-${role}-button`}>
              Save {title.includes("/") ? "Distributor" : title.replace("s", "")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Post-Creation WhatsApp Modal */}
      {createdInfo && (
        <Dialog open={Boolean(createdInfo)} onOpenChange={() => setCreatedInfo(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <div className="flex items-center gap-2 text-[#2E7D32] mb-1">
                <CheckCircle size={22} weight="fill" />
                <DialogTitle className="text-lg">{createdInfo.roleName} Created!</DialogTitle>
              </div>
            </DialogHeader>
            <div className="py-3 space-y-3 text-sm">
              <p className="text-[#5C6670]">
                <strong>{createdInfo.name}</strong> has been added to the Yamini Flow network. You can instantly share their credentials via WhatsApp:
              </p>
              <div className="bg-[#F4F5F7] p-3 rounded-md border border-[#E5E7EB] font-mono text-xs space-y-1.5">
                <div><span className="text-[#5C6670]">Portal:</span> https://yaminiflow-frontend.vercel.app</div>
                {createdInfo.loginCode && (
                  <div className="flex items-center justify-between bg-[#FEF08A] p-1.5 rounded border border-[#FDE047]">
                    <span className="text-[#854D0E] font-bold">Unique Login ID:</span>
                    <strong className="text-sm text-[#06182F] font-mono">{createdInfo.loginCode}</strong>
                  </div>
                )}
                <div><span className="text-[#5C6670]">Email Address:</span> <strong className="text-[#06182F]">{createdInfo.email}</strong></div>
                <div><span className="text-[#5C6670]">Password:</span> <strong className="text-[#F28C18]">{createdInfo.password}</strong></div>
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2 mt-2">
              <button onClick={() => setCreatedInfo(null)} className="h-9 px-4 rounded-md border border-[#E5E7EB] text-sm font-medium">Close</button>
              <button
                onClick={() => {
                  sendWhatsApp(createdInfo, createdInfo.password);
                  setCreatedInfo(null);
                }}
                className="h-10 px-5 rounded-md bg-[#25D366] hover:bg-[#1EBE5B] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                <WhatsappLogo size={18} weight="fill" /> Send Credentials on WhatsApp
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </AppShell>
  );
}

const DEALER_FIELDS = [
  { key: "name", label: "Distributor / Contact Name", strong: true },
  { key: "login_id", label: "Unique Code (Login ID)", mono: true, hideInForm: true, format: (v, item) => (
    v || item?.user_code ? (
      <span className="bg-[#FEF08A] text-[#854D0E] px-2 py-0.5 rounded font-mono font-bold text-xs shadow-sm">
        {v || item?.user_code}
      </span>
    ) : "Auto-Generated"
  )},
  { key: "email", label: "Email Address (Optional)" },
  { key: "phone", label: "WhatsApp / Phone" },
  { key: "company", label: "Distributorship / Company Name" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "gstin", label: "GSTIN", mono: true },
  { key: "credit_limit", label: "Credit Limit (₹)", type: "number", format: (v) => v ? fmt.inr(v) : "—", default: 100000 },
  { key: "password", label: "Initial Password", wide: true, default: "" },
];

const SUPPLIER_FIELDS = [
  { key: "name", label: "Contact Name", strong: true },
  { key: "email", label: "Email (Login ID)" },
  { key: "phone", label: "WhatsApp / Phone" },
  { key: "company", label: "Company Name" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "gstin", label: "GSTIN", mono: true },
  { key: "lead_time_days", label: "Lead Time (days)", type: "number", default: 7 },
  { key: "password", label: "Initial Password", wide: true, default: "" },
];

const MNP_FIELDS = [
  { key: "name", label: "Regional MNP Name", strong: true },
  { key: "login_id", label: "Unique Code (Login ID)", mono: true, hideInForm: true, format: (v, item) => (
    v || item?.user_code ? (
      <span className="bg-[#BAE6FD] text-[#0369A1] px-2 py-0.5 rounded font-mono font-bold text-xs shadow-sm">
        {v || item?.user_code}
      </span>
    ) : "Auto-Generated"
  )},
  { key: "email", label: "Email Address (Optional)" },
  { key: "phone", label: "WhatsApp / Phone" },
  { key: "company", label: "Company / Agency Name" },
  { key: "area", label: "Assigned Area" },
  { key: "state", label: "State" },
  { key: "target_monthly", label: "Monthly Target (₹)", type: "number", format: (v) => v ? fmt.inr(v) : "—", default: 500000 },
  { key: "password", label: "Initial Password", wide: true, default: "" },
];

export const DealersPage = () => <PeoplePage role="dealer" title="Distributors / Dealers" fields={DEALER_FIELDS} endpoint="/dealers" />;
export const SuppliersPage = () => <PeoplePage role="supplier" title="Suppliers" fields={SUPPLIER_FIELDS} endpoint="/suppliers" />;
export const MnpPage = () => <PeoplePage role="mnp" title="Regional MNPs" fields={MNP_FIELDS} endpoint="/mnp" />;

