import React, { useEffect, useState } from "react";
import { Plus, Bell, Check, Trash2, AlertCircle, Calendar } from "lucide-react";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";
import api, { formatApiError } from "@/lib/api";
import { formatINR, formatDate, daysFromNow } from "@/lib/format";
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

const TYPES = ["Client Payment", "Supplier Payment", "Worker Payment", "Commission", "Extra Work Payment", "Project Deadline", "Final Payment"];
const FILTERS = [
  { v: "all", label: "All Pending" },
  { v: "today", label: "Today" },
  { v: "overdue", label: "Overdue" },
  { v: "week", label: "This Week" },
  { v: "month", label: "This Month" },
  { v: "completed", label: "Completed" },
];

export default function RemindersPage() {
  const [params] = useSearchParams();
  const [filter, setFilter] = useState(params.get("filter") || "all");
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState([]);

  const load = async () => {
    const q = filter && filter !== "all" ? `?filter=${filter}` : "";
    const { data } = await api.get(`/reminders${q}`);
    if (filter === "all") {
      setItems(data.filter(r => r.status === "Pending"));
    } else {
      setItems(data);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);
  useEffect(() => { api.get("/projects").then(({ data }) => setProjects(data)); }, []);

  const complete = async (id) => {
    await api.post(`/reminders/${id}/complete`); toast.success("Marked complete"); load();
  };
  const remove = async (id) => {
    if (!confirm("Delete reminder?")) return;
    await api.delete(`/reminders/${id}`); toast.success("Deleted"); load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-[#5A6566]">Don't miss payments</div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold mt-1">Reminders</h1>
          <p className="text-[#5A6566] mt-1">Track upcoming payment dues and project deadlines.</p>
        </div>
        <Button data-testid="add-reminder-btn" onClick={() => setOpen(true)} className="h-10 bg-[#2B4C3B] hover:bg-[#1F382A]">
          <Plus size={16} className="mr-1.5" /> Add Reminder
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.v}
            data-testid={`reminder-filter-${f.v}`}
            onClick={() => setFilter(f.v)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm border transition-colors ${
              filter === f.v
                ? "bg-[#2B4C3B] text-white border-[#2B4C3B]"
                : "bg-white text-[#5A6566] border-[#E2E0D8] hover:text-[#1C2B2D]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="rxt-card p-12 text-center text-[#5A6566]">No reminders.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map((r) => {
            const days = daysFromNow(r.due_date);
            const overdue = r.status === "Pending" && days != null && days < 0;
            return (
              <div key={r.id} className="rxt-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`h-10 w-10 rounded-lg grid place-items-center ${overdue ? "bg-[#D04238]/10 text-[#D04238]" : "bg-[#F5A623]/10 text-[#F5A623]"}`}>
                      {overdue ? <AlertCircle size={16} /> : <Bell size={16} />}
                    </div>
                    <div className="min-w-0">
                      <div className="font-display font-semibold truncate">{r.title}</div>
                      <div className="text-xs text-[#5A6566]">
                        {r.type} · {formatDate(r.due_date)}
                        {r.amount ? ` · ${formatINR(r.amount)}` : ""}
                      </div>
                      <div className="text-xs mt-1">
                        {r.status === "Completed" ? (
                          <span className="text-[#3A7D44]">Completed</span>
                        ) : days < 0 ? (
                          <span className="text-[#D04238]">{-days} days overdue</span>
                        ) : days === 0 ? (
                          <span className="text-[#F5A623]">Due today</span>
                        ) : (
                          <span className="text-[#5A6566]">In {days} days</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {r.status === "Pending" && (
                      <button onClick={() => complete(r.id)} className="p-1 text-[#3A7D44] hover:bg-[#3A7D44]/10 rounded" data-testid={`complete-reminder-${r.id}`}>
                        <Check size={14} />
                      </button>
                    )}
                    <button onClick={() => remove(r.id)} className="p-1 text-[#D04238]/70 hover:text-[#D04238] hover:bg-[#D04238]/10 rounded" data-testid={`delete-reminder-${r.id}`}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                {r.notes && <div className="text-xs text-[#5A6566] mt-2 pt-2 border-t border-[#E2E0D8]">{r.notes}</div>}
              </div>
            );
          })}
        </div>
      )}

      <AddReminderDialog open={open} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); load(); }} projects={projects} />
    </div>
  );
}

function AddReminderDialog({ open, onClose, onSaved, projects }) {
  const [form, setForm] = useState({
    title: "", project_id: "", type: "Client Payment",
    amount: "", due_date: new Date().toISOString().slice(0, 10),
    notes: "", status: "Pending",
  });
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setForm({ ...form, title: "", amount: "", notes: "" }); /* eslint-disable-next-line */ }, [open]);
  const submit = async () => {
    setBusy(true);
    try {
      const payload = {
        ...form,
        amount: Number(form.amount) || 0,
        project_id: form.project_id || null,
      };
      await api.post("/reminders", payload); toast.success("Reminder added"); onSaved();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add Reminder</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <F label="Title" req><Input data-testid="rem-title-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Patel sir — final payment" /></F>
          <F label="Type">
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
              <SelectTrigger data-testid="rem-type-select"><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </F>
          <F label="Project">
            <Select value={form.project_id || "_none"} onValueChange={(v) => setForm({ ...form, project_id: v === "_none" ? "" : v })}>
              <SelectTrigger data-testid="rem-project-select"><SelectValue placeholder="Select project (optional)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— None —</SelectItem>
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.project_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </F>
          <div className="grid grid-cols-2 gap-3">
            <F label="Amount (₹)"><Input data-testid="rem-amount-input" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></F>
            <F label="Due date" req><Input data-testid="rem-date-input" type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></F>
          </div>
          <F label="Notes"><Textarea data-testid="rem-notes-input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></F>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button data-testid="rem-save-btn" disabled={busy || !form.title} onClick={submit} className="bg-[#2B4C3B] hover:bg-[#1F382A]">{busy ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function F({ label, req, children }) {
  return <div><Label className="text-sm">{label}{req && <span className="text-[#D04238]"> *</span>}</Label><div className="mt-1.5">{children}</div></div>;
}
