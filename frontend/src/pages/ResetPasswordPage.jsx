import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      await api.post("/auth/reset-password", { token, new_password: pwd });
      setOk(true);
      setTimeout(() => navigate("/login"), 1500);
    } catch (e2) {
      setErr(formatApiError(e2.response?.data?.detail) || e2.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F4F0] flex items-center justify-center p-6">
      <div className="w-full max-w-md rxt-card p-8">
        <h2 className="font-display text-2xl font-semibold">Reset password</h2>
        <p className="text-sm text-[#5A6566] mt-1">
          {token ? "Enter your new password below." : "Missing token in link."}
        </p>
        {token && (
          <form onSubmit={onSubmit} className="space-y-4 mt-6">
            <div>
              <Label htmlFor="rp-pwd">New Password</Label>
              <Input
                id="rp-pwd"
                data-testid="rp-password-input"
                type="password"
                className="mt-1.5 h-11 bg-white"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                required
                minLength={6}
              />
            </div>
            {err && (
              <div className="text-sm text-[#D04238] bg-[#D04238]/10 border border-[#D04238]/20 rounded-lg px-3 py-2">
                {err}
              </div>
            )}
            {ok && (
              <div className="text-sm text-[#3A7D44] bg-[#3A7D44]/10 border border-[#3A7D44]/20 rounded-lg px-3 py-2">
                Password reset — redirecting to login…
              </div>
            )}
            <Button
              type="submit"
              data-testid="rp-submit-btn"
              disabled={busy}
              className="w-full h-11 bg-[#2B4C3B] hover:bg-[#1F382A] text-white"
            >
              {busy ? "Saving…" : "Reset Password"}
            </Button>
          </form>
        )}
        <div className="text-center mt-4">
          <Link to="/login" className="text-sm text-[#2B4C3B] hover:underline">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
