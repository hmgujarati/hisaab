import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Send } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export default function AdminSmtp() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    host: "", port: 587, username: "", password: "",
    encryption: "TLS", from_email: "", from_name: "RapidXT Hisaab",
  });
  const [busy, setBusy] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    api.get("/admin/smtp").then(({ data }) => {
      if (data?.configured) {
        setForm((f) => ({ ...f, ...data, password: "" }));
      }
    }).catch(() => {});
  }, []);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setBusy(true);
    try {
      await api.put("/admin/smtp", { ...form, port: Number(form.port) });
      toast.success("SMTP settings saved");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally { setBusy(false); }
  };

  const sendTest = async () => {
    if (!testTo) return toast.error("Enter test email address");
    setTesting(true);
    try {
      const { data } = await api.post("/admin/smtp/test", { to: testTo });
      if (data.ok) toast.success("Test email sent!");
      else toast.error(data.message || "Failed");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally { setTesting(false); }
  };

  return (
    <div className="min-h-screen bg-[#F5F4F0]">
      <header className="rxt-glass sticky top-0 z-30">
        <div className="px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <Link to="/admin" data-testid="back-to-admin-btn" className="flex items-center gap-2 text-[#1C2B2D]">
            <ArrowLeft size={18} />
            <span className="font-medium">Back to Admin</span>
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="text-xs uppercase tracking-widest text-[#5A6566]">Admin</div>
        <h1 className="font-display text-3xl font-semibold mt-1">SMTP Settings</h1>
        <p className="text-[#5A6566] mt-1">
          Used to send password reset emails. Supports Gmail, SendGrid, Zoho, etc.
        </p>

        <div className="rxt-card p-6 mt-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="SMTP Host">
              <Input data-testid="smtp-host-input" value={form.host} onChange={(e) => update("host", e.target.value)} placeholder="smtp.gmail.com" />
            </Field>
            <Field label="Port">
              <Input data-testid="smtp-port-input" type="number" value={form.port} onChange={(e) => update("port", e.target.value)} />
            </Field>
            <Field label="Username">
              <Input data-testid="smtp-username-input" value={form.username} onChange={(e) => update("username", e.target.value)} />
            </Field>
            <Field label="Password">
              <Input data-testid="smtp-password-input" type="password" value={form.password} onChange={(e) => update("password", e.target.value)} placeholder="App password" />
            </Field>
            <Field label="Encryption">
              <Select value={form.encryption} onValueChange={(v) => update("encryption", v)}>
                <SelectTrigger data-testid="smtp-enc-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TLS">TLS (587)</SelectItem>
                  <SelectItem value="SSL">SSL (465)</SelectItem>
                  <SelectItem value="NONE">None</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="From Name">
              <Input data-testid="smtp-from-name-input" value={form.from_name} onChange={(e) => update("from_name", e.target.value)} />
            </Field>
            <Field label="From Email" className="sm:col-span-2">
              <Input data-testid="smtp-from-email-input" type="email" value={form.from_email} onChange={(e) => update("from_email", e.target.value)} placeholder="noreply@yourdomain.com" />
            </Field>
          </div>
          <div className="flex justify-end pt-2">
            <Button data-testid="smtp-save-btn" disabled={busy} onClick={save} className="bg-[#2B4C3B] hover:bg-[#1F382A]">
              {busy ? "Saving…" : "Save settings"}
            </Button>
          </div>
        </div>

        <div className="rxt-card p-6 mt-6">
          <h3 className="font-display font-semibold text-lg">Send test email</h3>
          <p className="text-sm text-[#5A6566] mt-1">Verify your SMTP settings before going live.</p>
          <div className="flex gap-2 mt-4">
            <Input data-testid="smtp-test-to-input" type="email" placeholder="Send test to..." value={testTo} onChange={(e) => setTestTo(e.target.value)} />
            <Button data-testid="smtp-test-btn" disabled={testing} onClick={sendTest} variant="outline">
              <Send size={14} className="mr-1.5" /> {testing ? "Sending…" : "Send test"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

function Field({ label, className = "", children }) {
  return (
    <div className={className}>
      <Label className="text-[#1C2B2D] text-sm">{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
