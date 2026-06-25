import React, { useState } from "react";
import { Link } from "react-router-dom";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr(""); setMsg(""); setBusy(true);
    try {
      const { data } = await api.post("/auth/forgot-password", { identifier });
      setMsg(data.message || "If account exists, reset email sent.");
    } catch (e2) {
      setErr(formatApiError(e2.response?.data?.detail) || e2.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F4F0] flex items-center justify-center p-6">
      <div className="w-full max-w-md rxt-card p-8">
        <h2 className="font-display text-2xl font-semibold">Forgot password?</h2>
        <p className="text-sm text-[#5A6566] mt-1">
          Enter your email — we&apos;ll send a reset link valid for 1 hour.
        </p>
        <form onSubmit={onSubmit} className="space-y-4 mt-6">
          <div>
            <Label htmlFor="fp-id">Email or Mobile</Label>
            <Input
              id="fp-id"
              data-testid="fp-identifier-input"
              className="mt-1.5 h-11 bg-white"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />
          </div>
          {msg && (
            <div data-testid="fp-success" className="text-sm text-[#3A7D44] bg-[#3A7D44]/10 border border-[#3A7D44]/20 rounded-lg px-3 py-2">
              {msg}
            </div>
          )}
          {err && (
            <div className="text-sm text-[#D04238] bg-[#D04238]/10 border border-[#D04238]/20 rounded-lg px-3 py-2">
              {err}
            </div>
          )}
          <Button
            type="submit"
            data-testid="fp-submit-btn"
            disabled={busy}
            className="w-full h-11 bg-[#2B4C3B] hover:bg-[#1F382A] text-white"
          >
            {busy ? "Sending…" : "Send reset link"}
          </Button>
          <div className="text-center">
            <Link to="/login" className="text-sm text-[#2B4C3B] hover:underline">
              Back to login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
