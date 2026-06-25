import React, { useEffect, useState } from "react";
import { Plus, Search, Pencil, Trash2, HardHat } from "lucide-react";
import { toast } from "sonner";
import api, { formatApiError } from "@/lib/api";
import { formatINR, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const PARTY_TYPES = ["Supplier", "Worker", "Labour Contractor", "Carpenter", "Painter", "Electrician", "Plumber", "Designer", "Contractor", "Other"];

export default function PartiesPage() {
  const [items, setItems] = useState([]);
  const [type, setType] = useState("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detail, setDetail] = useState(null);

  const load = async () => {
    const { data } = await api.get("/parties");
    setItems(data);
  };
  useEffect(() => { load(); }, []);

  const filtered = items.filter((p) => {
    if (type !== "all" && p.type !== type) return false;
    if (!q) return true;
    return [p.name, p.mobile].filter(Boolean).join(" ").toLowerCase().includes(q.toLowerCase());
  });

  const remove = async (p) => {
    if (!confirm(`Delete ${p.name}?`)) return;
    await api.delete(`/parties/${p.id}`); toast.success("Deleted"); load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-[#5A6566]">Vendors</div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold mt-1">Suppliers & Workers</h1>
          <p className="text-[#5A6566] mt-1">{items.length} total parties</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A6566]" />
            <Input data-testid="parties-search" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 h-10 sm:w-64 bg-white" />
          </div>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="h-10 sm:w-48 bg-white" data-testid="party-type-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {PARTY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button data-testid="add-party-btn" onClick={() => { setEditing(null); setOpen(true); }} className="h-10 bg-[#2B4C3B] hover:bg-[#1F382A]">
            <Plus size={16} className="mr-1.5" /> Add Party
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rxt-card p-12 text-center text-[#5A6566]">No parties yet.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((p) => (
            <div key={p.id} data-testid={`party-card-${p.id}`} className="rxt-card p-4 rxt-hover-lift">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-[#D96C4A]/10 text-[#D96C4A] grid place-items-center"><HardHat size={16} /></div>
                <div className="flex-1 min-w-0">
                  <button onClick={() => setDetail(p)} className="text-left w-full">
                    <div className="font-display font-semibold truncate">{p.name}</div>
                    <div className="text-xs text-[#5A6566] truncate">{p.type} · {p.mobile || "—"}</div>
                  </button>
                </div>
                <div className="flex flex-col gap-1">
                  <button onClick={() => { setEditing(p); setOpen(true); }} className="text-[#5A6566] hover:text-[#1C2B2D] p-1" data-testid={`edit-party-${p.id}`}><Pencil size={13} /></button>
                  <button onClick={() => remove(p)} className="text-[#D04238]/70 hover:text-[#D04238] p-1" data-testid={`delete-party-${p.id}`}><Trash2 size={13} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <PartyDialog open={open} party={editing} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); load(); }} />
      <PartyDetailDialog party={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

function PartyDialog({ open, party, onClose, onSaved }) {
  const [form, setForm] = useState({ name: "", mobile: "", email: "", type: "Supplier", address: "", notes: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setForm(party ? {
      name: party.name || "", mobile: party.mobile || "", email: party.email || "",
      type: party.type || "Supplier", address: party.address || "", notes: party.notes || "",
    } : { name: "", mobile: "", email: "", type: "Supplier", address: "", notes: "" });
  }, [open, party]);
  const submit = async () => {
    setBusy(true);
    try {
      if (party) { await api.put(`/parties/${party.id}`, form); toast.success("Updated"); }
      else { await api.post("/parties", form); toast.success("Added"); }
      onSaved();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{party ? "Edit Party" : "Add Party"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <F label="Name" req><Input data-testid="party-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></F>
          <F label="Type">
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
              <SelectTrigger data-testid="party-type-select"><SelectValue /></SelectTrigger>
              <SelectContent>{PARTY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </F>
          <F label="Mobile"><Input data-testid="party-mobile-input" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></F>
          <F label="Email"><Input data-testid="party-email-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></F>
          <F label="Address"><Input data-testid="party-address-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></F>
          <F label="Notes"><Textarea data-testid="party-notes-input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></F>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button data-testid="party-save-btn" disabled={busy || !form.name} onClick={submit} className="bg-[#2B4C3B] hover:bg-[#1F382A]">{busy ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PartyDetailDialog({ party, onClose }) {
  const [data, setData] = useState(null);
  useEffect(() => { if (party) api.get(`/parties/${party.id}`).then(({ data }) => setData(data)); else setData(null); }, [party]);
  if (!party) return null;
  return (
    <Dialog open={!!party} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{party.name}</DialogTitle></DialogHeader>
        {!data ? <div className="text-sm text-[#5A6566]">Loading…</div> : (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Type" v={party.type} />
              <Stat label="Mobile" v={party.mobile || "—"} />
              <Stat label="Lifetime Paid" v={formatINR(data.lifetime_paid)} c="text-[#D04238]" />
              <Stat label="Last Transaction" v={formatDate(data.last_transaction_date) || "—"} />
            </div>
            <div className="pt-2 border-t border-[#E2E0D8]">
              <div className="rxt-tiny-label mb-2">Recent transactions</div>
              {data.transactions.length === 0 ? <div className="text-[#5A6566] text-xs">No transactions yet.</div> : (
                <div className="space-y-1.5 max-h-60 overflow-auto">
                  {data.transactions.slice(0, 20).map((t) => (
                    <div key={t.id} className="flex items-center justify-between bg-[#F5F4F0] rounded-md px-3 py-2">
                      <div className="text-xs">{formatDate(t.date)} · {t.category} · {t.payment_mode}</div>
                      <div className={`text-sm font-display font-semibold ${t.type === "received" ? "text-[#3A7D44]" : "text-[#D04238]"}`}>
                        {t.type === "received" ? "+" : "-"}{formatINR(t.amount)}
                      </div>
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
  return <div><div className="rxt-tiny-label">{label}</div><div className={`font-display text-base font-semibold mt-0.5 ${c || ""}`}>{v}</div></div>;
}
function F({ label, req, children }) {
  return <div><Label className="text-sm">{label}{req && <span className="text-[#D04238]"> *</span>}</Label><div className="mt-1.5">{children}</div></div>;
}
