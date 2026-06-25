import React, { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, HandCoins } from "lucide-react";
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const REF_TYPES = ["Architect", "Builder", "Broker", "Old Client", "Direct", "Other"];

export default function ReferencesPage() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    const { data } = await api.get("/references");
    setItems(data);
  };
  useEffect(() => { load(); }, []);

  const remove = async (r) => {
    if (!confirm(`Delete reference "${r.name}"?`)) return;
    await api.delete(`/references/${r.id}`); toast.success("Deleted"); load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-[#5A6566]">Network</div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold mt-1">Project Givers / References</h1>
          <p className="text-[#5A6566] mt-1">Architects, builders, brokers who give you work + their commission status.</p>
        </div>
        <Button data-testid="add-ref-btn" onClick={() => { setEditing(null); setOpen(true); }} className="h-10 bg-[#2B4C3B] hover:bg-[#1F382A]">
          <Plus size={16} className="mr-1.5" /> Add Reference
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="rxt-card p-12 text-center text-[#5A6566]">No references added yet.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {items.map((r) => (
            <div key={r.id} className="rxt-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-[#F5A623]/10 text-[#F5A623] grid place-items-center"><HandCoins size={16} /></div>
                  <div>
                    <div className="font-display font-semibold text-base">{r.name}</div>
                    <div className="text-xs text-[#5A6566]">{r.type} · {r.mobile || "—"}</div>
                    {r.commission_type !== "none" && (
                      <div className="text-xs text-[#2B4C3B] mt-1">
                        Commission: {r.commission_type === "percentage" ? `${r.commission_value}%` : formatINR(r.commission_value)}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <button onClick={() => { setEditing(r); setOpen(true); }} className="text-[#5A6566] hover:text-[#1C2B2D] p-1" data-testid={`edit-ref-${r.id}`}><Pencil size={13} /></button>
                  <button onClick={() => remove(r)} className="text-[#D04238]/70 hover:text-[#D04238] p-1" data-testid={`delete-ref-${r.id}`}><Trash2 size={13} /></button>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-[#E2E0D8]">
                <Mini label="Projects" v={r.projects_count} />
                <Mini label="Value" v={formatINR(r.total_project_value)} />
                <Mini label="Paid" v={formatINR(r.commission_paid)} c="text-[#3A7D44]" />
                <Mini label="Pending" v={formatINR(r.commission_pending)} c="text-[#D04238]" />
              </div>
            </div>
          ))}
        </div>
      )}

      <RefDialog open={open} ref0={editing} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); load(); }} />
    </div>
  );
}

function Mini({ label, v, c }) {
  return <div><div className="text-[10px] uppercase tracking-widest text-[#5A6566]">{label}</div><div className={`font-display text-sm font-semibold mt-0.5 ${c || ""}`}>{v}</div></div>;
}

function RefDialog({ open, ref0, onClose, onSaved }) {
  const [form, setForm] = useState({ name: "", mobile: "", type: "Direct", commission_type: "none", commission_value: 0, notes: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setForm(ref0 ? {
      name: ref0.name || "", mobile: ref0.mobile || "", type: ref0.type || "Direct",
      commission_type: ref0.commission_type || "none",
      commission_value: ref0.commission_value || 0, notes: ref0.notes || "",
    } : { name: "", mobile: "", type: "Direct", commission_type: "none", commission_value: 0, notes: "" });
  }, [open, ref0]);
  const submit = async () => {
    setBusy(true);
    try {
      const payload = { ...form, commission_value: Number(form.commission_value) || 0 };
      if (ref0) { await api.put(`/references/${ref0.id}`, payload); toast.success("Updated"); }
      else { await api.post("/references", payload); toast.success("Added"); }
      onSaved();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{ref0 ? "Edit Reference" : "Add Reference"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <F label="Name" req><Input data-testid="ref-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></F>
          <F label="Mobile"><Input data-testid="ref-mobile-input" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></F>
          <F label="Type">
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
              <SelectTrigger data-testid="ref-type-select"><SelectValue /></SelectTrigger>
              <SelectContent>{REF_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </F>
          <div className="grid grid-cols-2 gap-3">
            <F label="Commission type">
              <Select value={form.commission_type} onValueChange={(v) => setForm({ ...form, commission_type: v })}>
                <SelectTrigger data-testid="ref-ctype-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="amount">Fixed Amount</SelectItem>
                  <SelectItem value="percentage">Percentage</SelectItem>
                </SelectContent>
              </Select>
            </F>
            <F label={form.commission_type === "percentage" ? "Commission %" : "Commission (₹)"}>
              <Input data-testid="ref-cvalue-input" type="number" value={form.commission_value} onChange={(e) => setForm({ ...form, commission_value: e.target.value })} />
            </F>
          </div>
          <F label="Notes"><Textarea data-testid="ref-notes-input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></F>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button data-testid="ref-save-btn" disabled={busy || !form.name} onClick={submit} className="bg-[#2B4C3B] hover:bg-[#1F382A]">{busy ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function F({ label, req, children }) {
  return <div><Label className="text-sm">{label}{req && <span className="text-[#D04238]"> *</span>}</Label><div className="mt-1.5">{children}</div></div>;
}
