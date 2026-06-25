import React, { useEffect, useState } from "react";
import { Plus, Search, Pencil, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import api, { formatApiError } from "@/lib/api";
import { formatINR } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

export default function ClientsPage() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detail, setDetail] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/clients");
      setItems(data);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = items.filter((c) =>
    !q || [c.name, c.mobile, c.email].filter(Boolean).join(" ").toLowerCase().includes(q.toLowerCase())
  );

  const remove = async (c) => {
    if (!confirm(`Delete client "${c.name}"? Existing projects keep their data.`)) return;
    await api.delete(`/clients/${c.id}`);
    toast.success("Client deleted");
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-[#5A6566]">Customers</div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold mt-1">Clients</h1>
          <p className="text-[#5A6566] mt-1">{items.length} total clients</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A6566]" />
            <Input data-testid="clients-search" placeholder="Search by name, mobile" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 h-10 sm:w-72 bg-white" />
          </div>
          <Button data-testid="add-client-btn" onClick={() => { setEditing(null); setOpen(true); }} className="h-10 bg-[#2B4C3B] hover:bg-[#1F382A]">
            <Plus size={16} className="mr-1.5" /> Add Client
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-[#5A6566] py-12">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="rxt-card p-12 text-center text-[#5A6566]">No clients yet.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((c) => (
            <div key={c.id} data-testid={`client-card-${c.id}`} className="rxt-card p-4 rxt-hover-lift">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-[#2B4C3B]/10 text-[#2B4C3B] grid place-items-center">
                  <User size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <button onClick={() => setDetail(c)} className="text-left w-full">
                    <div className="font-display font-semibold text-base truncate">{c.name}</div>
                    <div className="text-xs text-[#5A6566] truncate">{c.mobile || "—"} · {c.email || ""}</div>
                  </button>
                </div>
                <div className="flex flex-col gap-1">
                  <button onClick={() => { setEditing(c); setOpen(true); }} className="text-[#5A6566] hover:text-[#1C2B2D] p-1" data-testid={`edit-client-${c.id}`}><Pencil size={13} /></button>
                  <button onClick={() => remove(c)} className="text-[#D04238]/70 hover:text-[#D04238] p-1" data-testid={`delete-client-${c.id}`}><Trash2 size={13} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ClientDialog
        open={open}
        client={editing}
        onClose={() => setOpen(false)}
        onSaved={() => { setOpen(false); load(); }}
      />
      <ClientDetailDialog
        client={detail}
        onClose={() => setDetail(null)}
      />
    </div>
  );
}

function ClientDialog({ open, client, onClose, onSaved }) {
  const [form, setForm] = useState({ name: "", mobile: "", email: "", address: "", gst: "", notes: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setForm(client ? {
      name: client.name || "", mobile: client.mobile || "", email: client.email || "",
      address: client.address || "", gst: client.gst || "", notes: client.notes || "",
    } : { name: "", mobile: "", email: "", address: "", gst: "", notes: "" });
  }, [open, client]);
  const submit = async () => {
    setBusy(true);
    try {
      if (client) {
        await api.put(`/clients/${client.id}`, form);
        toast.success("Client updated");
      } else {
        await api.post("/clients", form);
        toast.success("Client added");
      }
      onSaved();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{client ? "Edit Client" : "Add Client"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <F label="Name" req><Input data-testid="client-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></F>
          <F label="Mobile"><Input data-testid="client-mobile-input" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></F>
          <F label="Email"><Input data-testid="client-email-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></F>
          <F label="Address"><Input data-testid="client-address-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></F>
          <F label="GST (optional)"><Input data-testid="client-gst-input" value={form.gst} onChange={(e) => setForm({ ...form, gst: e.target.value })} /></F>
          <F label="Notes"><Textarea data-testid="client-notes-input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></F>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button data-testid="client-save-btn" disabled={busy || !form.name} onClick={submit} className="bg-[#2B4C3B] hover:bg-[#1F382A]">{busy ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ClientDetailDialog({ client, onClose }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (client) api.get(`/clients/${client.id}`).then(({ data }) => setData(data));
    else setData(null);
  }, [client]);
  if (!client) return null;
  return (
    <Dialog open={!!client} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{client.name}</DialogTitle></DialogHeader>
        {!data ? <div className="text-sm text-[#5A6566]">Loading…</div> : (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Projects" v={data.projects_count} />
              <Stat label="Lifetime value" v={formatINR(data.revised_value)} />
              <Stat label="Received" v={formatINR(data.lifetime_received)} c="text-[#3A7D44]" />
              <Stat label="Pending" v={formatINR(data.lifetime_pending_receivable)} c="text-[#D04238]" />
            </div>
            <div className="pt-2 border-t border-[#E2E0D8]">
              <div className="rxt-tiny-label mb-2">Projects</div>
              {data.projects.length === 0 ? <div className="text-[#5A6566] text-xs">No projects yet.</div> : (
                <div className="space-y-1.5">
                  {data.projects.map((p) => (
                    <div key={p.id} className="flex items-center justify-between bg-[#F5F4F0] rounded-md px-3 py-2">
                      <div className="text-sm font-medium">{p.project_name}</div>
                      <div className="text-xs text-[#5A6566]">{p.status} · {formatINR(p.original_value)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, v, c }) {
  return <div><div className="rxt-tiny-label">{label}</div><div className={`font-display text-lg font-semibold mt-0.5 ${c || ""}`}>{v}</div></div>;
}
function F({ label, req, children }) {
  return <div><Label className="text-sm">{label}{req && <span className="text-[#D04238]"> *</span>}</Label><div className="mt-1.5">{children}</div></div>;
}
