import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Plus, Receipt, Wrench, ListChecks, Boxes, Folder, Bell, BarChart3, Camera, Trash2, ImageIcon, Pencil,
} from "lucide-react";
import { toast } from "sonner";
import api, { formatApiError, FILE_BASE } from "@/lib/api";
import { formatINR, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import TransactionForm from "@/components/TransactionForm";
import BillScanner from "@/components/BillScanner";

const TX_BADGE = {
  received: "bg-[#3A7D44]/10 text-[#3A7D44]",
  paid: "bg-[#D04238]/10 text-[#D04238]",
};

const STATUS_COLORS = {
  Pending: "bg-[#F5A623]/10 text-[#F5A623] border-[#F5A623]/20",
  Approved: "bg-[#3A7D44]/10 text-[#3A7D44] border-[#3A7D44]/20",
  Rejected: "bg-[#D04238]/10 text-[#D04238] border-[#D04238]/20",
  Paid: "bg-[#3A7D44]/10 text-[#3A7D44] border-[#3A7D44]/20",
  "Partially Paid": "bg-[#F5A623]/10 text-[#F5A623] border-[#F5A623]/20",
};

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [tab, setTab] = useState("overview");
  const [txns, setTxns] = useState([]);
  const [extras, setExtras] = useState([]);
  const [stages, setStages] = useState([]);
  const [stagesMaster, setStagesMaster] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [docs, setDocs] = useState([]);

  // dialogs
  const [txOpen, setTxOpen] = useState(false);
  const [extraOpen, setExtraOpen] = useState(false);
  const [stageOpen, setStageOpen] = useState(false);
  const [materialOpen, setMaterialOpen] = useState(false);
  const [docOpen, setDocOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const loadProject = async () => {
    try {
      const { data } = await api.get(`/projects/${id}`);
      setProject(data);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  const reload = async () => {
    await loadProject();
    const [t, e, s, sm, m, d] = await Promise.all([
      api.get(`/projects/${id}/transactions`),
      api.get(`/projects/${id}/extra-work`),
      api.get(`/projects/${id}/stage-history`),
      api.get(`/stages-master`),
      api.get(`/projects/${id}/materials`),
      api.get(`/projects/${id}/documents`),
    ]);
    setTxns(t.data); setExtras(e.data); setStages(s.data);
    setStagesMaster(sm.data); setMaterials(m.data); setDocs(d.data);
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [id]);

  if (!project) return <div className="text-[#5A6566]">Loading project…</div>;
  const s = project.summary || {};

  return (
    <div className="space-y-5">
      <Link to="/projects" data-testid="back-to-projects" className="inline-flex items-center gap-1.5 text-sm text-[#5A6566] hover:text-[#1C2B2D]">
        <ArrowLeft size={14} /> All Projects
      </Link>

      {/* Header */}
      <div className="rxt-card p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl sm:text-3xl font-semibold">{project.project_name}</h1>
              <span className="text-[11px] px-2.5 py-1 rounded-full border bg-[#2B4C3B]/10 text-[#2B4C3B] border-[#2B4C3B]/20">
                {project.status}
              </span>
            </div>
            <div className="text-sm text-[#5A6566] mt-1">
              {project.client?.name || "—"} · {project.work_type} · {project.site_address || "No site"}
            </div>
            {project.current_stage && (
              <div className="text-xs text-[#2B4C3B] mt-2">
                Current stage: <span className="font-medium">{project.current_stage.stage_name}</span> · {formatDate(project.current_stage.updated_at)}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setTxOpen(true)} data-testid="add-tx-btn" className="bg-[#2B4C3B] hover:bg-[#1F382A]">
              <Receipt size={14} className="mr-1.5" /> Add Transaction
            </Button>
            <Button variant="outline" onClick={() => setStageOpen(true)} data-testid="update-stage-btn">
              <ListChecks size={14} className="mr-1.5" /> Update Stage
            </Button>
            <Button variant="outline" onClick={() => setEditOpen(true)} data-testid="edit-project-btn">
              <Pencil size={14} className="mr-1.5" /> Edit
            </Button>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(true)}
              data-testid="delete-project-btn"
              className="border-[#D04238]/30 text-[#D04238] hover:bg-[#D04238]/10 hover:text-[#D04238]"
            >
              <Trash2 size={14} className="mr-1.5" /> Delete
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-[#E2E0D8]">
          <Kpi label="Revised value" value={formatINR(s.revised_value)} />
          <Kpi label="Received" value={formatINR(s.received)} tone="green" />
          <Kpi label="Pending Receivable" value={formatINR(s.pending_receivable)} tone="orange" />
          <Kpi label="Cash Profit" value={formatINR(s.actual_cash_profit)} tone={s.actual_cash_profit >= 0 ? "green" : "red"} />
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-white border border-[#E2E0D8] p-1 rounded-xl overflow-x-auto flex-wrap h-auto w-full justify-start gap-1">
          <Tab v="overview" label="Overview" icon={BarChart3} />
          <Tab v="transactions" label="Transactions" icon={Receipt} />
          <Tab v="extras" label="Extra Work" icon={Wrench} />
          <Tab v="stages" label="Stages" icon={ListChecks} />
          <Tab v="materials" label="Materials" icon={Boxes} />
          <Tab v="documents" label="Documents" icon={Folder} />
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rxt-card p-5">
              <div className="rxt-tiny-label">Financial Summary</div>
              <div className="mt-3 space-y-2 text-sm">
                <Row label="Original value" v={formatINR(s.original_value)} />
                <Row label="Approved extra work" v={formatINR(s.approved_extra_value)} />
                <Row label="Revised project value" v={formatINR(s.revised_value)} bold />
                <Row label="Total received" v={formatINR(s.received)} tone="green" />
                <Row label="Pending receivable" v={formatINR(s.pending_receivable)} tone="orange" />
                <Row label="Total paid (expenses)" v={formatINR(s.paid)} tone="red" />
                <Row label="Material cost" v={formatINR(s.material_cost)} />
                <Row label="Actual cash profit" v={formatINR(s.actual_cash_profit)} tone={s.actual_cash_profit >= 0 ? "green" : "red"} bold />
                <Row label="Book profit" v={formatINR(s.book_profit)} />
              </div>
            </div>
            <div className="rxt-card p-5">
              <div className="rxt-tiny-label">Project info</div>
              <div className="mt-3 space-y-2 text-sm text-[#1C2B2D]">
                <Row label="Status" v={project.status} />
                <Row label="Work type" v={project.work_type} />
                <Row label="Start" v={formatDate(project.start_date)} />
                <Row label="Expected end" v={formatDate(project.expected_completion_date)} />
                <Row label="Client" v={project.client?.name || "—"} />
                <Row label="Reference" v={project.reference?.name || "Direct"} />
                {project.notes && <div className="pt-2 border-t border-[#E2E0D8] text-[#5A6566] text-xs">Notes: {project.notes}</div>}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="transactions" className="mt-4">
          <SectionHeader title="Transactions" onAdd={() => setTxOpen(true)} addLabel="Add Transaction" testId="tab-add-tx-btn" />
          <ListCard
            empty="No transactions yet"
            items={txns}
            render={(t) => (
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-lg grid place-items-center ${TX_BADGE[t.type]}`}>
                    <Receipt size={15} />
                  </div>
                  <div>
                    <div className="text-sm font-medium capitalize">{t.type} · {t.category}</div>
                    <div className="text-[11px] text-[#5A6566]">{formatDate(t.date)} · {t.payment_mode}{t.notes ? ` · ${t.notes}` : ""}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {t.bill_url && (
                    <a href={`${FILE_BASE}${t.bill_url}`} target="_blank" rel="noreferrer" className="text-[11px] text-[#2B4C3B] inline-flex items-center gap-1">
                      <ImageIcon size={12} /> Bill
                    </a>
                  )}
                  <div className={`font-display font-semibold text-sm ${t.type === "received" ? "text-[#3A7D44]" : "text-[#D04238]"}`}>
                    {t.type === "received" ? "+" : "-"}{formatINR(t.amount)}
                  </div>
                </div>
              </div>
            )}
          />
        </TabsContent>

        <TabsContent value="extras" className="mt-4">
          <SectionHeader title="Extra Work / Change Orders" onAdd={() => setExtraOpen(true)} addLabel="Add Extra Work" testId="tab-add-extra-btn" />
          <ListCard
            empty="No extra work added yet"
            items={extras}
            render={(e) => (
              <div className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">{e.title}</div>
                    <div className="text-[11px] text-[#5A6566]">{formatDate(e.date)}{e.description ? ` · ${e.description}` : ""}</div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <Pill cls={STATUS_COLORS[e.approval_status]}>Approval: {e.approval_status}</Pill>
                      <Pill cls={STATUS_COLORS[e.payment_status]}>Payment: {e.payment_status}</Pill>
                    </div>
                  </div>
                  <div className="font-display font-semibold">{formatINR(e.amount)}</div>
                </div>
              </div>
            )}
          />
        </TabsContent>

        <TabsContent value="stages" className="mt-4">
          <SectionHeader title="Stage Timeline" onAdd={() => setStageOpen(true)} addLabel="Update Stage" testId="tab-update-stage-btn" />
          <ListCard
            empty="No stage updates yet"
            items={stages}
            render={(st) => (
              <div className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="h-2 w-2 mt-2 rounded-full bg-[#2B4C3B]" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{st.stage_name}</div>
                    <div className="text-[11px] text-[#5A6566]">{formatDate(st.updated_at)} · {st.updated_by || "—"}{st.notes ? ` · ${st.notes}` : ""}</div>
                  </div>
                </div>
              </div>
            )}
          />
        </TabsContent>

        <TabsContent value="materials" className="mt-4">
          <SectionHeader title="Materials" onAdd={() => setMaterialOpen(true)} addLabel="Add Material" testId="tab-add-material-btn" />
          <ListCard
            empty="No materials added yet"
            items={materials}
            render={(m) => (
              <div className="px-4 py-3 flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">{m.name}</div>
                  <div className="text-[11px] text-[#5A6566]">
                    {m.quantity_purchased} {m.unit} @ {formatINR(m.rate)}/{m.unit} · {formatDate(m.purchase_date)}
                    {m.quantity_used ? ` · Used ${m.quantity_used} ${m.unit}` : ""}
                  </div>
                </div>
                <div className="font-display font-semibold text-sm">{formatINR(m.total_amount)}</div>
              </div>
            )}
          />
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <SectionHeader title="Documents Folder" onAdd={() => setDocOpen(true)} addLabel="Upload Document" testId="tab-add-doc-btn" />
          <ListCard
            empty="No documents uploaded yet"
            items={docs}
            render={(d) => (
              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-[#2B4C3B]/10 text-[#2B4C3B] grid place-items-center">
                    <Folder size={15} />
                  </div>
                  <div>
                    <div className="text-sm font-medium">{d.title}</div>
                    <div className="text-[11px] text-[#5A6566]">{d.category} · {formatDate(d.uploaded_at)} · {d.uploaded_by || "—"}</div>
                  </div>
                </div>
                <a href={`${FILE_BASE}${d.file_url}`} target="_blank" rel="noreferrer" className="text-[11px] text-[#2B4C3B] hover:underline">Open</a>
              </div>
            )}
          />
        </TabsContent>
      </Tabs>

      <TransactionForm
        open={txOpen}
        onClose={() => setTxOpen(false)}
        onSaved={() => { setTxOpen(false); reload(); }}
        projectId={id}
      />
      <ExtraWorkDialog
        open={extraOpen} onClose={() => setExtraOpen(false)}
        onSaved={() => { setExtraOpen(false); reload(); }}
        projectId={id}
      />
      <StageDialog
        open={stageOpen} onClose={() => setStageOpen(false)}
        onSaved={() => { setStageOpen(false); reload(); }}
        projectId={id} stagesMaster={stagesMaster}
      />
      <MaterialDialog
        open={materialOpen} onClose={() => setMaterialOpen(false)}
        onSaved={() => { setMaterialOpen(false); reload(); }}
        projectId={id}
      />
      <DocumentDialog
        open={docOpen} onClose={() => setDocOpen(false)}
        onSaved={() => { setDocOpen(false); reload(); }}
        projectId={id}
      />
      <EditProjectDialog
        open={editOpen}
        project={project}
        onClose={() => setEditOpen(false)}
        onSaved={() => { setEditOpen(false); reload(); }}
      />
      <DeleteProjectDialog
        open={deleteOpen}
        project={project}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => { setDeleteOpen(false); navigate("/projects"); }}
      />
    </div>
  );
}

function Tab({ v, label, icon: Icon }) {
  return (
    <TabsTrigger
      value={v}
      data-testid={`tab-${v}`}
      className="data-[state=active]:bg-[#2B4C3B] data-[state=active]:text-white text-sm"
    >
      <Icon size={14} className="mr-1.5" /> {label}
    </TabsTrigger>
  );
}

function Kpi({ label, value, tone }) {
  const c = tone === "green" ? "text-[#3A7D44]"
    : tone === "red" ? "text-[#D04238]"
    : tone === "orange" ? "text-[#F5A623]" : "text-[#1C2B2D]";
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-[#5A6566]">{label}</div>
      <div className={`font-display text-xl font-semibold mt-1 ${c}`}>{value}</div>
    </div>
  );
}

function Row({ label, v, bold, tone }) {
  const c = tone === "green" ? "text-[#3A7D44]" : tone === "red" ? "text-[#D04238]" : tone === "orange" ? "text-[#F5A623]" : "text-[#1C2B2D]";
  return (
    <div className="flex items-center justify-between">
      <div className="text-[#5A6566]">{label}</div>
      <div className={`${bold ? "font-display font-semibold" : ""} ${c}`}>{v}</div>
    </div>
  );
}

function SectionHeader({ title, onAdd, addLabel, testId }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {onAdd && (
        <Button data-testid={testId} onClick={onAdd} size="sm" className="bg-[#2B4C3B] hover:bg-[#1F382A]">
          <Plus size={14} className="mr-1" /> {addLabel}
        </Button>
      )}
    </div>
  );
}

function ListCard({ items, render, empty }) {
  return (
    <div className="rxt-card overflow-hidden">
      {items.length === 0 ? (
        <div className="py-12 text-center text-sm text-[#5A6566]">{empty}</div>
      ) : (
        <div className="divide-y divide-[#E2E0D8]">
          {items.map((it, i) => <div key={it.id || i}>{render(it)}</div>)}
        </div>
      )}
    </div>
  );
}

function Pill({ children, cls = "" }) {
  return <span className={`text-[10px] px-2 py-0.5 rounded-full border ${cls}`}>{children}</span>;
}

function ExtraWorkDialog({ open, onClose, onSaved, projectId }) {
  const [form, setForm] = useState({
    title: "", description: "", amount: 0, date: new Date().toISOString().slice(0, 10),
    approval_status: "Pending", payment_status: "Pending", notes: "",
  });
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setForm((f) => ({ ...f, title: "", amount: 0 })); }, [open]);
  const submit = async () => {
    setBusy(true);
    try {
      await api.post(`/projects/${projectId}/extra-work`, { ...form, amount: Number(form.amount) || 0 });
      toast.success("Extra work added"); onSaved();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Add Extra Work</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <DField label="Title" req cls="sm:col-span-2">
            <Input data-testid="ex-title-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </DField>
          <DField label="Amount (₹)">
            <Input data-testid="ex-amount-input" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </DField>
          <DField label="Date">
            <Input data-testid="ex-date-input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </DField>
          <DField label="Approval">
            <Select value={form.approval_status} onValueChange={(v) => setForm({ ...form, approval_status: v })}>
              <SelectTrigger data-testid="ex-approval-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Approved">Approved</SelectItem>
                <SelectItem value="Rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </DField>
          <DField label="Payment">
            <Select value={form.payment_status} onValueChange={(v) => setForm({ ...form, payment_status: v })}>
              <SelectTrigger data-testid="ex-payment-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Partially Paid">Partially Paid</SelectItem>
                <SelectItem value="Paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </DField>
          <DField label="Description" cls="sm:col-span-2">
            <Textarea data-testid="ex-desc-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
          </DField>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button data-testid="ex-save-btn" disabled={busy} onClick={submit} className="bg-[#2B4C3B] hover:bg-[#1F382A]">{busy ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StageDialog({ open, onClose, onSaved, projectId, stagesMaster }) {
  const [sid, setSid] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open && stagesMaster?.length) setSid(stagesMaster[0].id); }, [open, stagesMaster]);
  const submit = async () => {
    if (!sid) return;
    setBusy(true);
    try {
      const stage = stagesMaster.find((s) => s.id === sid);
      await api.post(`/projects/${projectId}/stage`, { stage_id: sid, stage_name: stage?.name, notes });
      toast.success("Stage updated"); onSaved();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Update Project Stage</DialogTitle>
          <DialogDescription>Select current stage from master.</DialogDescription>
        </DialogHeader>
        <DField label="Stage">
          <Select value={sid} onValueChange={setSid}>
            <SelectTrigger data-testid="stage-select"><SelectValue placeholder="Select stage" /></SelectTrigger>
            <SelectContent>
              {stagesMaster.filter(s => s.active).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </DField>
        <DField label="Notes (optional)">
          <Textarea data-testid="stage-notes-input" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </DField>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button data-testid="stage-save-btn" disabled={busy || !sid} onClick={submit} className="bg-[#2B4C3B] hover:bg-[#1F382A]">{busy ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MaterialDialog({ open, onClose, onSaved, projectId }) {
  const [form, setForm] = useState({
    name: "", category: "", supplier_id: "", quantity_purchased: 0,
    unit: "piece", rate: 0, total_amount: 0,
    purchase_date: new Date().toISOString().slice(0, 10),
    quantity_used: 0, notes: "",
  });
  const [suppliers, setSuppliers] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) api.get("/parties").then(({ data }) => setSuppliers(data)); }, [open]);
  // auto compute total
  useEffect(() => {
    const t = (Number(form.quantity_purchased) || 0) * (Number(form.rate) || 0);
    setForm((f) => ({ ...f, total_amount: t }));
    // eslint-disable-next-line
  }, [form.quantity_purchased, form.rate]);

  const submit = async () => {
    setBusy(true);
    try {
      const payload = {
        ...form,
        quantity_purchased: Number(form.quantity_purchased) || 0,
        rate: Number(form.rate) || 0,
        total_amount: Number(form.total_amount) || 0,
        quantity_used: Number(form.quantity_used) || 0,
        supplier_id: form.supplier_id || null,
      };
      await api.post(`/projects/${projectId}/materials`, payload);
      toast.success("Material added"); onSaved();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Add Material</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <DField label="Material name" req cls="sm:col-span-2">
            <Input data-testid="mat-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </DField>
          <DField label="Category">
            <Input data-testid="mat-cat-input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </DField>
          <DField label="Supplier">
            <Select value={form.supplier_id || "_none"} onValueChange={(v) => setForm({ ...form, supplier_id: v === "_none" ? "" : v })}>
              <SelectTrigger data-testid="mat-supplier-select"><SelectValue placeholder="Select supplier" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— None —</SelectItem>
                {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </DField>
          <DField label="Quantity">
            <Input data-testid="mat-qty-input" type="number" value={form.quantity_purchased} onChange={(e) => setForm({ ...form, quantity_purchased: e.target.value })} />
          </DField>
          <DField label="Unit">
            <Input data-testid="mat-unit-input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="kg, litre, bag…" />
          </DField>
          <DField label="Rate (₹)">
            <Input data-testid="mat-rate-input" type="number" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
          </DField>
          <DField label="Total amount (₹)">
            <Input data-testid="mat-total-input" type="number" value={form.total_amount} onChange={(e) => setForm({ ...form, total_amount: e.target.value })} />
          </DField>
          <DField label="Purchase date">
            <Input data-testid="mat-date-input" type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} />
          </DField>
          <DField label="Quantity used">
            <Input data-testid="mat-used-input" type="number" value={form.quantity_used} onChange={(e) => setForm({ ...form, quantity_used: e.target.value })} />
          </DField>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button data-testid="mat-save-btn" disabled={busy} onClick={submit} className="bg-[#2B4C3B] hover:bg-[#1F382A]">{busy ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DocumentDialog({ open, onClose, onSaved, projectId }) {
  const [form, setForm] = useState({ title: "", category: "Other", notes: "" });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  useEffect(() => { if (open) { setForm({ title: "", category: "Other", notes: "" }); setFile(null); } }, [open]);

  const onScanned = (f) => { setFile(f); if (!form.title) setForm({ ...form, title: f.name.replace(/\.\w+$/, "") }); };

  const submit = async () => {
    if (!file) return toast.error("Please attach a file");
    setBusy(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const { data: up } = await api.post("/uploads", fd);
      await api.post(`/projects/${projectId}/documents`, {
        title: form.title || file.name,
        category: form.category,
        file_url: up.url,
        file_type: file.type,
        notes: form.notes,
      });
      toast.success("Document uploaded"); onSaved();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Upload Document</DialogTitle></DialogHeader>
          <DField label="Title">
            <Input data-testid="doc-title-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Quotation v1, bill 25 Jun…" />
          </DField>
          <DField label="Category">
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger data-testid="doc-cat-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Quotation","Final Bill","Payment Receipts","Bill Photos","Site Photos","Client Approvals","Extra Work Approvals","Drawings","Measurement Sheets","Handover Photos","Other"].map((c) =>
                  <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </DField>
          <DField label="File">
            <div className="space-y-2">
              <Input data-testid="doc-file-input" type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              <Button type="button" variant="outline" onClick={() => setScannerOpen(true)} data-testid="doc-scan-btn" className="w-full">
                <Camera size={14} className="mr-1.5" /> Scan with camera
              </Button>
              {file && <div className="text-xs text-[#5A6566]">Selected: {file.name} · {Math.round(file.size / 1024)} KB</div>}
            </div>
          </DField>
          <DialogFooter>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button data-testid="doc-save-btn" disabled={busy || !file} onClick={submit} className="bg-[#2B4C3B] hover:bg-[#1F382A]">{busy ? "Uploading…" : "Upload"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <BillScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onCapture={(f) => { onScanned(f); setScannerOpen(false); }} />
    </>
  );
}

function DField({ label, req, cls = "", children }) {
  return (
    <div className={cls}>
      <Label className="text-sm">{label}{req && <span className="text-[#D04238]"> *</span>}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}


const WORK_TYPES = ["Interior", "Painting", "POP", "Furniture", "Civil", "Colour", "Other"];
const PROJECT_STATUSES = ["Ongoing", "Hold", "Completed", "Cancelled"];

function EditProjectDialog({ open, project, onClose, onSaved }) {
  const [form, setForm] = useState(null);
  const [clients, setClients] = useState([]);
  const [refs, setRefs] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && project) {
      setForm({
        project_name: project.project_name || "",
        client_id: project.client_id || project.client?.id || "",
        reference_id: project.reference_id || project.reference?.id || "",
        site_address: project.site_address || "",
        work_type: project.work_type || "Interior",
        status: project.status || "Ongoing",
        original_value: project.original_value || 0,
        start_date: (project.start_date || "").slice(0, 10),
        expected_completion_date: (project.expected_completion_date || "").slice(0, 10),
        notes: project.notes || "",
      });
      api.get("/clients").then(({ data }) => setClients(data));
      api.get("/references").then(({ data }) => setRefs(data));
    }
  }, [open, project]);

  if (!open || !form) return null;
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.client_id) {
      toast.error("Please select a client");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        ...form,
        original_value: Number(form.original_value) || 0,
        reference_id: form.reference_id || null,
        expected_completion_date: form.expected_completion_date || null,
        start_date: form.start_date || null,
      };
      await api.put(`/projects/${project.id}`, payload);
      toast.success("Project updated");
      onSaved();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
          <DialogDescription>Update project details. Changes apply immediately.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <DField label="Project name" req cls="sm:col-span-2">
            <Input data-testid="edit-project-name-input" value={form.project_name} onChange={(e) => update("project_name", e.target.value)} />
          </DField>
          <DField label="Client" req>
            <Select value={form.client_id || ""} onValueChange={(v) => update("client_id", v)}>
              <SelectTrigger data-testid="edit-project-client-select"><SelectValue placeholder="Select client" /></SelectTrigger>
              <SelectContent>
                {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </DField>
          <DField label="Work type">
            <Select value={form.work_type} onValueChange={(v) => update("work_type", v)}>
              <SelectTrigger data-testid="edit-project-worktype-select"><SelectValue /></SelectTrigger>
              <SelectContent>{WORK_TYPES.map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}</SelectContent>
            </Select>
          </DField>
          <DField label="Status">
            <Select value={form.status} onValueChange={(v) => update("status", v)}>
              <SelectTrigger data-testid="edit-project-status-select"><SelectValue /></SelectTrigger>
              <SelectContent>{PROJECT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </DField>
          <DField label="Reference / Given by">
            <Select value={form.reference_id || "_none"} onValueChange={(v) => update("reference_id", v === "_none" ? "" : v)}>
              <SelectTrigger data-testid="edit-project-ref-select"><SelectValue placeholder="Select reference" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— Direct —</SelectItem>
                {refs.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </DField>
          <DField label="Site address" cls="sm:col-span-2">
            <Input data-testid="edit-project-site-input" value={form.site_address} onChange={(e) => update("site_address", e.target.value)} />
          </DField>
          <DField label="Original value (₹)">
            <Input data-testid="edit-project-value-input" type="number" value={form.original_value} onChange={(e) => update("original_value", e.target.value)} />
          </DField>
          <DField label="Start date">
            <Input data-testid="edit-project-start-input" type="date" value={form.start_date || ""} onChange={(e) => update("start_date", e.target.value)} />
          </DField>
          <DField label="Expected completion">
            <Input data-testid="edit-project-end-input" type="date" value={form.expected_completion_date || ""} onChange={(e) => update("expected_completion_date", e.target.value)} />
          </DField>
          <DField label="Notes" cls="sm:col-span-2">
            <Textarea data-testid="edit-project-notes-input" value={form.notes} onChange={(e) => update("notes", e.target.value)} rows={2} />
          </DField>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            data-testid="edit-project-save-btn"
            disabled={busy || !form.project_name || !form.client_id}
            onClick={submit}
            className="bg-[#2B4C3B] hover:bg-[#1F382A]"
          >
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteProjectDialog({ open, project, onClose, onDeleted }) {
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setConfirm(""); }, [open]);
  if (!open || !project) return null;
  const canDelete = confirm.trim().toLowerCase() === project.project_name.toLowerCase();

  const submit = async () => {
    setBusy(true);
    try {
      await api.delete(`/projects/${project.id}`);
      toast.success(`${project.project_name} deleted`);
      onDeleted();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#D04238] flex items-center gap-2">
            <Trash2 size={18} /> Delete project
          </DialogTitle>
          <DialogDescription>
            This permanently deletes <span className="font-semibold text-[#1C2B2D]">{project.project_name}</span>. Linked transactions, extra work, materials, documents and stage history will be orphaned (not auto-deleted). This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="bg-[#D04238]/5 border border-[#D04238]/20 rounded-lg p-3 text-sm text-[#1C2B2D]">
          Type the project name <span className="font-semibold">{project.project_name}</span> to confirm:
          <Input
            data-testid="delete-project-confirm-input"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-2 bg-white"
            placeholder={project.project_name}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            data-testid="delete-project-confirm-btn"
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
