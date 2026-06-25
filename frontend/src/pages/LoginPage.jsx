import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Lock, User, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, user } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  React.useEffect(() => {
    if (user) {
      navigate(user.role === "super_admin" ? "/admin" : "/dashboard", { replace: true });
    }
  }, [user, navigate]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const data = await login(identifier.trim(), password);
      navigate(data.user.role === "super_admin" ? "/admin" : "/dashboard", { replace: true });
    } catch (e2) {
      setErr(formatApiError(e2.response?.data?.detail) || e2.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F4F0] flex flex-col lg:flex-row">
      {/* Left brand panel - hidden on small */}
      <div className="hidden lg:flex flex-col justify-between flex-1 bg-[#2B4C3B] text-white p-12 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-white text-[#2B4C3B] grid place-items-center font-display text-xl font-semibold">
              R
            </div>
            <div>
              <div className="font-display text-2xl font-semibold">RapidXT Hisaab</div>
              <div className="text-xs uppercase tracking-widest text-white/70">
                Project Accounting for Contractors
              </div>
            </div>
          </div>
        </div>
        <div className="relative z-10 max-w-md">
          <h1 className="font-display text-4xl xl:text-5xl font-semibold leading-tight">
            Project ka paisa aaya kitna, gaya kitna,
            <span className="text-[#D96C4A]"> profit kitna.</span>
          </h1>
          <p className="mt-4 text-white/80 text-base">
            Built for interior designers, painting contractors, civil & site
            contractors. Track every project, every rupee — from your phone.
          </p>
        </div>
        <div className="relative z-10 text-xs text-white/60">
          © {new Date().getFullYear()} RapidXT
        </div>
        <div className="pointer-events-none absolute -right-40 -bottom-40 h-[520px] w-[520px] rounded-full bg-[#D96C4A]/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-32 top-1/3 h-[320px] w-[320px] rounded-full bg-white/5 blur-3xl" />
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="h-10 w-10 rounded-xl bg-[#2B4C3B] text-white grid place-items-center font-display text-lg font-semibold">
              R
            </div>
            <div>
              <div className="font-display text-lg font-semibold">RapidXT Hisaab</div>
              <div className="text-[10px] uppercase tracking-widest text-[#5A6566]">
                Project Accounting
              </div>
            </div>
          </div>

          <h2 className="font-display text-3xl font-semibold tracking-tight text-[#1C2B2D]">
            Welcome back
          </h2>
          <p className="text-[#5A6566] mt-2">
            Sign in to manage your projects, payments & profit.
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div>
              <Label htmlFor="identifier" className="text-[#1C2B2D]">
                Email or Mobile
              </Label>
              <div className="relative mt-1.5">
                <User
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A6566]"
                />
                <Input
                  id="identifier"
                  data-testid="login-identifier-input"
                  className="pl-9 h-11 bg-white"
                  placeholder="you@business.com or 98xxxxxxxx"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            </div>
            <div>
              <Label htmlFor="password" className="text-[#1C2B2D]">
                Password
              </Label>
              <div className="relative mt-1.5">
                <Lock
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A6566]"
                />
                <Input
                  id="password"
                  data-testid="login-password-input"
                  type="password"
                  className="pl-9 h-11 bg-white"
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
            {err && (
              <div
                data-testid="login-error"
                className="text-sm text-[#D04238] bg-[#D04238]/10 border border-[#D04238]/20 rounded-lg px-3 py-2"
              >
                {err}
              </div>
            )}
            <Button
              type="submit"
              data-testid="login-submit-btn"
              disabled={busy}
              className="w-full h-11 bg-[#2B4C3B] hover:bg-[#1F382A] text-white font-medium"
            >
              {busy ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
              Sign in
            </Button>
            <div className="flex justify-between text-sm pt-1">
              <Link
                to="/forgot-password"
                data-testid="forgot-password-link"
                className="text-[#2B4C3B] hover:underline"
              >
                Forgot password?
              </Link>
              <span className="text-[#5A6566]">Need access? Contact admin.</span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
