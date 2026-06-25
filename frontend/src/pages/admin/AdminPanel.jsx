import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Plus, Pencil, CalendarClock, Power, KeyRound, LogOut, Mail, Search, ShieldCheck, Trash2,
} from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDate, daysFromNow } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const STATUS_BADGE = {
  active: "bg-[#3A7D44]/10 text-[#3A7D44] border-[#3A7D44]/20",
  expired: "bg-[#F5A623]/10 text-[#F5A623] border-[#F5A623]/20",
  suspended: "bg-[#D04238]/10 text-[#D04238] border-[#D04238]/20",
};

export default function AdminPanel() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  // Modals
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [extending, setExtending] = useState(null);
  const [resetting, setResetting] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/businesses");
      setItems(data);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const filtered = items.filter((b) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return [b.business_name, b.owner_name, b.email, b.mobile]
      .filter(Boolean).join(" ").toLowerCase().includes(s);
  });

  const handleLogout = async () => { await logout(); navigate("/login"); };

  const handleStatus = async (biz, status) => {
    try {
      await api.post(`/admin/businesses/${biz.id}/status`, { status });
      toast.success(`Marked ${status}`);
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F4F0]">
      <header className="rxt-glass sticky top-0 z-30">
        <div className="px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[#2B4C3B] grid place-items-center text-white font-display font-semibold">R</div>
            <div>
              <div className="font-display text-base font-semibold flex items-center gap-2">
                Super Admin
                <span className="text-[10px] uppercase tracking-widest text-white bg-[#2B4C3B] px-2 py-0.5 rounded-full">
                  <ShieldCheck size={10} className="inline mr-1" /> Admin
                </span>
              </div>
              <div className="text-[11px] text-[#5A6566]">{user?.email}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/admin/smtp">
              <Button variant="outline" size="sm" data-testid="open-smtp-btn">
                <Mail size={14} className="mr-1.5" /> SMTP Settings
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={handleLogout} data-testid="admin-logout-btn">
              <LogOut size={14} className="mr-1.5" /> Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="px-4 sm:px-6 lg:px-8 py-6 animate-in fade-in">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <div className="text-xs uppercase tracking-widest text-[#5A6566]">Customers</div>
            <h1 className="font-display text-3xl sm:text-4xl font-semibold mt-1">Business Accounts</h1>
            <p className="text-[#5A6566] mt-1">
              {items.length} total · {items.filter((b) => b.live_status === "active").length} active
            </p>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A6566]" />
              <Input
                data-testid="admin-search-input"
                placeholder="Search business, owner, email"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9 h-10 w-72 bg-white"
              />
            </div>
            <Button
              data-testid="add-customer-btn"
              onClick={() => setAddOpen(true)}
              className="h-10 bg-[#2B4C3B] hover:bg-[#1F382A]"
            >
              <Plus size={16} className="mr-1.5" /> Add Customer
            </Button>
          </div>
        </div>

        <div className="rxt-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[#5A6566] bg-[#F5F4F0]/60">
                  <th className="px-4 py-3 font-medium">Business</th>
                  <th className="px-4 py-3 font-medium">Owner</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="p-8 text-center text-[#5A6566]">Loading…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="p-12 text-center text-[#5A6566]">
                    No customers yet. Add your first business to get started.
                  </td></tr>
                ) : (
                  filtered.map((b) => (
                    <tr key={b.id} className="border-t border-[#E2E0D8] hover:bg-[#F5F4F0]/40">
                      <td className="px-4 py-3">
                        <div className="font-medium text-[#1C2B2D]">{b.business_name}</div>
                        <div className="text-[11px] text-[#5A6566]">ID: {b.id.slice(0, 8)}</div>
                      </td>
                      <td className="px-4 py-3">{b.owner_name}</td>
                      <td className="px-4 py-3">
                        <div>{b.mobile}</div>
                        <div className="text-[11px] text-[#5A6566]">{b.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs">{formatDate(b.plan_start_date)} → {formatDate(b.plan_expiry_date)}</div>
                        <div className="text-[11px] text-[#5A6566]">
                          {b.days_remaining != null
                            ? b.days_remaining >= 0 ? `${b.days_remaining} days left` : `${-b.days_remaining} days overdue`
                            : "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block text-[11px] px-2.5 py-1 rounded-full border font-medium capitalize ${STATUS_BADGE[b.live_status] || ""}`}>
                          {b.live_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#5A6566]">{formatDate(b.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <IconBtn title="Edit" onClick={() => setEditing(b)} data-testid={`edit-biz-${b.id}`}>
                            <Pencil size={14} />
                          </IconBtn>
                          <IconBtn title="Extend Expiry" onClick={() => setExtending(b)} data-testid={`extend-biz-${b.id}`}>
                            <CalendarClock size={14} />
                          </IconBtn>
                          <IconBtn
                            title={b.status === "suspended" ? "Activate" : "Suspend"}
                            onClick={() => handleStatus(b, b.status === "suspended" ? "active" : "suspended")}
                            data-testid={`toggle-suspend-${b.id}`}
                          >
                            <Power size={14} />
                          </IconBtn>
                          <IconBtn title="Reset Password" onClick={() => setResetting(b)} data-testid={`reset-pwd-${b.id}`}>
                            <KeyRound size={14} />
                          </IconBtn>
                          <IconBtn
                            title="Delete"
                            onClick={() => setDeleting(b)}
                            data-testid={`delete-biz-${b.id}`}
                            danger
                          >
                            <Trash2 size={14} />
                          </IconBtn>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <AddOrEditCustomer
        open={addOpen || !!editing}
        editing={editing}
        onClose={() => { setAddOpen(false); setEditing(null); }}
        onSaved={() => { setAddOpen(false); setEditing(null); load(); }}
      />
      <ExtendExpiry
        biz={extending}
        onClose={() => setExtending(null)}
        onSaved={() => { setExtending(null); load(); }}
      />
      <ResetPasswordDlg
        biz={resetting}
        onClose={() => setResetting(null)}
        onSaved={() => setResetting(null)}
      />
      <DeleteBusinessDlg
        biz={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={() => { setDeleting(null); load(); }}
      />
    </div>
  );
}

function IconBtn({ children, title, danger, ...rest }) {
  return (
    <button
      title={title}
      className={`h-8 w-8 grid place-items-center rounded-lg transition-colors ${
        danger
          ? "text-[#D04238]/70 hover:bg-[#D04238]/10 hover:text-[#D04238]"
          : "text-[#5A6566] hover:bg-[#E2E0D8]/60 hover:text-[#1C2B2D]"
      }`}
      {...rest}
    >
      {children}
    </button>
  );
}

function AddOrEditCustomer({ open, editing, onClose, onSaved }) {
  const initial = editing || {
    business_name: "", owner_name: "", mobile: "", email: "",
    password: "", plan_start_date: new Date().toISOString().slice(0, 10),
    plan_expiry_date: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
    status: "active",
  };
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setForm(initial); /* eslint-disable-next-line */ }, [editing, open]);

  if (!open) return null;
  const isEdit = !!editing;

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setBusy(true);
    try {
      if (isEdit) {
        const payload = { ...form };
        delete payload.password;
        delete payload.id;
        delete payload.created_at;
        delete payload.live_status;
        delete payload.days_remaining;
        await api.put(`/admin/businesses/${editing.id}`, payload);
        toast.success("Customer updated");
      } else {
        await api.post("/admin/businesses", form);
        toast.success("Customer created");
      }
      onSaved();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit customer" : "Add new customer"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update business and owner details." : "Create a new business account. The owner can login with this email and password."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Business name" required>
            <Input data-testid="biz-name-input" value={form.business_name} onChange={(e) => update("business_name", e.target.value)} />
          </Field>
          <Field label="Owner name" required>
            <Input data-testid="biz-owner-name-input" value={form.owner_name} onChange={(e) => update("owner_name", e.target.value)} />
          </Field>
          <Field label="Mobile" required>
            <Input data-testid="biz-mobile-input" value={form.mobile} onChange={(e) => update("mobile", e.target.value)} />
          </Field>
          <Field label="Email" required>
            <Input data-testid="biz-email-input" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
          </Field>
          {!isEdit && (
            <Field label="Password" required className="sm:col-span-2">
              <Input data-testid="biz-password-input" type="text" value={form.password} onChange={(e) => update("password", e.target.value)} placeholder="Set initial password (min 6)" />
            </Field>
          )}
          <Field label="Plan start">
            <Input data-testid="biz-plan-start-input" type="date" value={form.plan_start_date} onChange={(e) => update("plan_start_date", e.target.value)} />
          </Field>
          <Field label="Plan expiry">
            <Input data-testid="biz-plan-expiry-input" type="date" value={form.plan_expiry_date} onChange={(e) => update("plan_expiry_date", e.target.value)} />
          </Field>
          <Field label="Status" className="sm:col-span-2">
            <Select value={form.status} onValueChange={(v) => update("status", v)}>
              <SelectTrigger data-testid="biz-status-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button data-testid="biz-save-btn" disabled={busy} onClick={submit} className="bg-[#2B4C3B] hover:bg-[#1F382A]">
            {busy ? "Saving…" : isEdit ? "Save changes" : "Create customer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExtendExpiry({ biz, onClose, onSaved }) {
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (biz) {
      // suggest 30 days extension
      const cur = biz.plan_expiry_date ? new Date(biz.plan_expiry_date) : new Date();
      cur.setDate(cur.getDate() + 30);
      setDate(cur.toISOString().slice(0, 10));
    }
  }, [biz]);
  if (!biz) return null;
  const submit = async () => {
    setBusy(true);
    try {
      await api.post(`/admin/businesses/${biz.id}/extend-expiry`, { new_expiry_date: date });
      toast.success("Expiry extended");
      onSaved();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally { setBusy(false); }
  };
  return (
    <Dialog open={!!biz} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Extend expiry</DialogTitle>
          <DialogDescription>{biz.business_name} · Current expiry {formatDate(biz.plan_expiry_date)}</DialogDescription>
        </DialogHeader>
        <Field label="New expiry date">
          <Input data-testid="extend-date-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button data-testid="extend-save-btn" disabled={busy} onClick={submit} className="bg-[#2B4C3B] hover:bg-[#1F382A]">
            {busy ? "Saving…" : "Save new expiry"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDlg({ biz, onClose, onSaved }) {
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);
  if (!biz) return null;
  const submit = async () => {
    setBusy(true);
    try {
      await api.post(`/admin/businesses/${biz.id}/reset-password`, { new_password: pwd });
      toast.success("Password reset");
      onSaved();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally { setBusy(false); }
  };
  return (
    <Dialog open={!!biz} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>Set a new password for {biz.owner_name} ({biz.email}).</DialogDescription>
        </DialogHeader>
        <Field label="New password">
          <Input data-testid="rp-admin-pwd-input" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="Min 6 characters" />
        </Field>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button data-testid="rp-admin-save-btn" disabled={busy || pwd.length < 6} onClick={submit} className="bg-[#2B4C3B] hover:bg-[#1F382A]">
            {busy ? "Saving…" : "Reset password"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, required, className = "", children }) {
  return (
    <div className={className}>
      <Label className="text-[#1C2B2D] text-sm">
        {label}{required && <span className="text-[#D04238]"> *</span>}
      </Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function DeleteBusinessDlg({ biz, onClose, onDeleted }) {
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setConfirm(""); }, [biz]);
  if (!biz) return null;
  const canDelete = confirm.trim().toLowerCase() === biz.business_name.toLowerCase();

  const submit = async () => {
    setBusy(true);
    try {
      await api.delete(`/admin/businesses/${biz.id}`);
      toast.success(`${biz.business_name} deleted`);
      onDeleted();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={!!biz} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#D04238] flex items-center gap-2">
            <Trash2 size={18} /> Delete business
          </DialogTitle>
          <DialogDescription>
            This will permanently delete <span className="font-semibold text-[#1C2B2D]">{biz.business_name}</span> ({biz.owner_name}) and ALL of its data — projects, clients, suppliers, transactions, materials, documents, reminders & stages. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="bg-[#D04238]/5 border border-[#D04238]/20 rounded-lg p-3 text-sm text-[#1C2B2D]">
          Type the business name <span className="font-semibold">{biz.business_name}</span> to confirm:
          <Input
            data-testid="delete-confirm-input"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-2 bg-white"
            placeholder={biz.business_name}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            data-testid="delete-confirm-btn"
            disabled={busy || !canDelete}
            onClick={submit}
            className="bg-[#D04238] hover:bg-[#B03830] text-white disabled:opacity-50"
          >
            {busy ? "Deleting…" : "Delete permanently"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
