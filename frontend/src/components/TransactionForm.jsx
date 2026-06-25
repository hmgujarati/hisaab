import React, { useEffect, useState } from "react";
import { Camera, Image as ImageIcon, X } from "lucide-react";
import { toast } from "sonner";
import api, { formatApiError } from "@/lib/api";
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
import BillScanner from "@/components/BillScanner";

const CATEGORIES = ["Labour", "Material", "Commission", "Transport", "Advance", "Final Payment", "Other"];
const MODES = ["Cash", "UPI", "Bank", "Cheque", "Other"];

export default function TransactionForm({ open, onClose, onSaved, projectId, defaultType }) {
  const [form, setForm] = useState({
    project_id: projectId || "",
    type: defaultType || "received",
    party_kind: "client",
    party_id: "",
    category: "Final Payment",
    amount: 0,
    payment_mode: "Cash",
    date: new Date().toISOString().slice(0, 10),
    notes: "",
    bill_url: "",
  });
  const [projects, setProjects] = useState([]);
  const [parties, setParties] = useState({ client: [], supplier: [], worker: [], reference: [] });
  const [busy, setBusy] = useState(false);
  const [billFile, setBillFile] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm((f) => ({
      ...f,
      project_id: projectId || "",
      type: defaultType || f.type,
      amount: 0,
      notes: "",
      bill_url: "",
    }));
    setBillFile(null);
    Promise.all([
      api.get("/projects"),
      api.get("/clients"),
      api.get("/parties"),
      api.get("/references"),
    ]).then(([p, c, pa, r]) => {
      setProjects(p.data);
      const sup = pa.data.filter((x) => x.type === "Supplier");
      const wk = pa.data.filter((x) => x.type !== "Supplier");
      setParties({ client: c.data, supplier: sup, worker: wk, reference: r.data });
    });
    // eslint-disable-next-line
  }, [open]);

  const partyList = () => {
    if (form.party_kind === "client") return parties.client;
    if (form.party_kind === "supplier") return parties.supplier;
    if (form.party_kind === "worker") return parties.worker;
    if (form.party_kind === "reference") return parties.reference;
    return [];
  };

  const submit = async () => {
    if (!form.amount) return toast.error("Amount required");
    setBusy(true);
    try {
      let billUrl = "";
      if (billFile) {
        const fd = new FormData(); fd.append("file", billFile);
        const { data } = await api.post("/uploads", fd);
        billUrl = data.url;
      }
      const payload = {
        ...form,
        amount: Number(form.amount),
        bill_url: billUrl || null,
        project_id: form.project_id || null,
        party_id: form.party_id || null,
      };
      await api.post("/transactions", payload);
      toast.success("Transaction saved");
      onSaved && onSaved();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Transaction</DialogTitle>
            <DialogDescription>Track money received or paid for a project.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2 mb-2">
            <button
              data-testid="tx-type-received"
              className={`h-10 rounded-lg border text-sm font-medium transition-colors ${
                form.type === "received"
                  ? "bg-[#3A7D44] text-white border-[#3A7D44]"
                  : "bg-white border-[#E2E0D8] text-[#5A6566]"
              }`}
              onClick={() => setForm({ ...form, type: "received" })}
            >
              + Received
            </button>
            <button
              data-testid="tx-type-paid"
              className={`h-10 rounded-lg border text-sm font-medium transition-colors ${
                form.type === "paid"
                  ? "bg-[#D04238] text-white border-[#D04238]"
                  : "bg-white border-[#E2E0D8] text-[#5A6566]"
              }`}
              onClick={() => setForm({ ...form, type: "paid" })}
            >
              − Paid
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Project" cls="sm:col-span-2">
              <Select value={form.project_id || "_none"} onValueChange={(v) => setForm({ ...form, project_id: v === "_none" ? "" : v })}>
                <SelectTrigger data-testid="tx-project-select"><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— Not linked —</SelectItem>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.project_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Party type">
              <Select value={form.party_kind} onValueChange={(v) => setForm({ ...form, party_kind: v, party_id: "" })}>
                <SelectTrigger data-testid="tx-partykind-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="supplier">Supplier</SelectItem>
                  <SelectItem value="worker">Worker / Labour</SelectItem>
                  <SelectItem value="reference">Reference</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Party">
              <Select value={form.party_id || "_none"} onValueChange={(v) => setForm({ ...form, party_id: v === "_none" ? "" : v })}>
                <SelectTrigger data-testid="tx-party-select"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— None —</SelectItem>
                  {partyList().map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Category">
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger data-testid="tx-cat-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Payment mode">
              <Select value={form.payment_mode} onValueChange={(v) => setForm({ ...form, payment_mode: v })}>
                <SelectTrigger data-testid="tx-mode-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Amount (₹)" req>
              <Input data-testid="tx-amount-input" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </Field>
            <Field label="Date">
              <Input data-testid="tx-date-input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
            <Field label="Notes" cls="sm:col-span-2">
              <Textarea data-testid="tx-notes-input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
            <Field label="Bill / Receipt" cls="sm:col-span-2">
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Input data-testid="tx-bill-file-input" type="file" accept="image/*,application/pdf" onChange={(e) => setBillFile(e.target.files?.[0] || null)} />
                  <Button type="button" variant="outline" onClick={() => setScannerOpen(true)} data-testid="tx-scan-btn">
                    <Camera size={14} className="mr-1.5" /> Scan with camera
                  </Button>
                </div>
                {billFile && (
                  <div className="text-xs text-[#5A6566] flex items-center gap-1">
                    <ImageIcon size={12} /> {billFile.name} · {Math.round(billFile.size / 1024)} KB
                    <button onClick={() => setBillFile(null)} className="ml-1 text-[#D04238]"><X size={12} /></button>
                  </div>
                )}
              </div>
            </Field>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button data-testid="tx-save-btn" disabled={busy} onClick={submit} className="bg-[#2B4C3B] hover:bg-[#1F382A]">
              {busy ? "Saving…" : "Save Transaction"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <BillScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onCapture={(f) => { setBillFile(f); setScannerOpen(false); }} />
    </>
  );
}

function Field({ label, req, cls = "", children }) {
  return (
    <div className={cls}>
      <Label className="text-sm">{label}{req && <span className="text-[#D04238]"> *</span>}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
