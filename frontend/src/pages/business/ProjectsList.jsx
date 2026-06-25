import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, Briefcase, MapPin } from "lucide-react";
import { toast } from "sonner";
import api, { formatApiError } from "@/lib/api";
import { formatINR, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const STATUS_BADGE = {
  Ongoing: "bg-[#3A7D44]/10 text-[#3A7D44] border-[#3A7D44]/20",
  Hold: "bg-[#F5A623]/10 text-[#F5A623] border-[#F5A623]/20",
  Completed: "bg-[#2B4C3B]/10 text-[#2B4C3B] border-[#2B4C3B]/20",
  Cancelled: "bg-[#D04238]/10 text-[#D04238] border-[#D04238]/20",
};

const WORK_TYPES = ["Interior", "Painting", "POP", "Furniture", "Civil", "Colour", "Other"];

export default function ProjectsList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/projects");
      setItems(data);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = items.filter((p) => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (!q) return true;
    const s = q.toLowerCase();
    return [p.project_name, p.client_name, p.site_address].filter(Boolean).join(" ").toLowerCase().includes(s);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-[#5A6566]">Work</div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold mt-1">Projects</h1>
          <p className="text-[#5A6566] mt-1">{items.length} total · {items.filter(p => p.status === "Ongoing").length} ongoing</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A6566]" />
            <Input
              data-testid="projects-search-input"
              placeholder="Search projects, clients, sites"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9 h-10 sm:w-72 bg-white"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-10 w-full sm:w-40 bg-white" data-testid="projects-status-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="Ongoing">Ongoing</SelectItem>
              <SelectItem value="Hold">Hold</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
              <SelectItem value="Cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Button data-testid="add-project-btn" onClick={() => setOpen(true)} className="h-10 bg-[#2B4C3B] hover:bg-[#1F382A]">
            <Plus size={16} className="mr-1.5" /> Add Project
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-[#5A6566] py-12">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="rxt-card p-12 text-center">
          <Briefcase size={32} className="mx-auto text-[#5A6566] mb-3" strokeWidth={1.5} />
          <div className="font-display text-lg font-semibold">No projects yet</div>
          <p className="text-sm text-[#5A6566] mt-1">Add your first project to start tracking payments and profit.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <Link
              key={p.id}
              to={`/projects/${p.id}`}
              data-testid={`project-card-${p.id}`}
              className="rxt-card p-5 rxt-hover-lift block"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-display font-semibold text-lg leading-tight">{p.project_name}</div>
                  <div className="text-sm text-[#5A6566] mt-1">{p.client_name || "—"}</div>
                </div>
                <span className={`shrink-0 text-[11px] px-2.5 py-1 rounded-full border font-medium ${STATUS_BADGE[p.status] || ""}`}>
                  {p.status}
                </span>
              </div>
              {p.site_address && (
                <div className="text-xs text-[#5A6566] mt-2 flex items-start gap-1">
                  <MapPin size={12} className="mt-0.5" /> {p.site_address}
                </div>
              )}
              {p.current_stage && (
                <div className="text-xs mt-3 inline-block bg-[#2B4C3B]/10 text-[#2B4C3B] px-2 py-1 rounded-md">
                  Stage: {p.current_stage}
                </div>
              )}
              <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-[#E2E0D8]">
                <Stat label="Value" value={formatINR(p.summary?.revised_value || p.original_value)} />
                <Stat label="Received" value={formatINR(p.summary?.received || 0)} tone="green" />
                <Stat label="Pending" value={formatINR(p.summary?.pending_receivable || 0)} tone="red" />
              </div>
            </Link>
          ))}
        </div>
      )}

      <AddProjectDialog open={open} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); load(); }} />
    </div>
  );
}

function Stat({ label, value, tone }) {
  const c = tone === "green" ? "text-[#3A7D44]" : tone === "red" ? "text-[#D04238]" : "text-[#1C2B2D]";
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-[#5A6566]">{label}</div>
      <div className={`font-display text-sm font-semibold mt-0.5 ${c}`}>{value}</div>
    </div>
  );
}

function AddProjectDialog({ open, onClose, onSaved }) {
  const [form, setForm] = useState({
    project_name: "", client_id: "", site_address: "", work_type: "Interior",
    reference_id: "", start_date: new Date().toISOString().slice(0, 10),
    expected_completion_date: "", status: "Ongoing", original_value: 0, notes: "",
  });
  const [clients, setClients] = useState([]);
  const [refs, setRefs] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      api.get("/clients").then(({ data }) => setClients(data));
      api.get("/references").then(({ data }) => setRefs(data));
      setForm((f) => ({ ...f, project_name: "", original_value: 0 }));
    }
  }, [open]);

  const submit = async () => {
    setBusy(true);
    try {
      const payload = { ...form, original_value: Number(form.original_value) || 0 };
      if (!payload.client_id) delete payload.client_id;
      if (!payload.reference_id) delete payload.reference_id;
      if (!payload.expected_completion_date) delete payload.expected_completion_date;
      await api.post("/projects", payload);
      toast.success("Project created");
      onSaved();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally { setBusy(false); }
  };

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Project</DialogTitle>
          <DialogDescription>Create a new project with client, site & value.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Project name" required className="sm:col-span-2">
            <Input data-testid="add-project-name-input" value={form.project_name} onChange={(e) => update("project_name", e.target.value)} />
          </Field>
          <Field label="Client">
            <Select value={form.client_id || "_none"} onValueChange={(v) => update("client_id", v === "_none" ? "" : v)}>
              <SelectTrigger data-testid="add-project-client-select"><SelectValue placeholder="Select client (optional)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— None —</SelectItem>
                {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Work type">
            <Select value={form.work_type} onValueChange={(v) => update("work_type", v)}>
              <SelectTrigger data-testid="add-project-worktype-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                {WORK_TYPES.map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Site address" className="sm:col-span-2">
            <Input data-testid="add-project-site-input" value={form.site_address} onChange={(e) => update("site_address", e.target.value)} />
          </Field>
          <Field label="Reference / Given by">
            <Select value={form.reference_id || "_none"} onValueChange={(v) => update("reference_id", v === "_none" ? "" : v)}>
              <SelectTrigger data-testid="add-project-ref-select"><SelectValue placeholder="Select reference" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— Direct —</SelectItem>
                {refs.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Original value (₹)">
            <Input data-testid="add-project-value-input" type="number" value={form.original_value} onChange={(e) => update("original_value", e.target.value)} />
          </Field>
          <Field label="Start date">
            <Input data-testid="add-project-start-input" type="date" value={form.start_date} onChange={(e) => update("start_date", e.target.value)} />
          </Field>
          <Field label="Expected completion">
            <Input data-testid="add-project-end-input" type="date" value={form.expected_completion_date} onChange={(e) => update("expected_completion_date", e.target.value)} />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <Textarea data-testid="add-project-notes-input" value={form.notes} onChange={(e) => update("notes", e.target.value)} rows={2} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button data-testid="add-project-save-btn" disabled={busy || !form.project_name} onClick={submit} className="bg-[#2B4C3B] hover:bg-[#1F382A]">
            {busy ? "Saving…" : "Create project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, required, className = "", children }) {
  return (
    <div className={className}>
      <Label className="text-sm">
        {label}{required && <span className="text-[#D04238]"> *</span>}
      </Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
