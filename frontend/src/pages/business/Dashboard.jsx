import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Bell, AlertCircle, Plus, Briefcase, Wallet, Receipt,
} from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatINR, formatDate, currentFY } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/dashboard").then(({ data }) => {
      setData(data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-64 bg-[#E2E0D8]/60" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 bg-[#E2E0D8]/60" />)}
        </div>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-6 lg:space-y-8">
      <div>
        <div className="text-xs uppercase tracking-widest text-[#5A6566]">Dashboard</div>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold mt-1" data-testid="dashboard-greeting">
          {greeting()}, {firstName(user) || "there"}
        </h1>
        <p className="text-[#5A6566] mt-1">
          Yahaan dekho — paisa aaya kitna, gaya kitna, pending kitna, profit kitna.
        </p>
      </div>

      {/* North-Star Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BigMetric
          tone="positive"
          label="Pending Receivable (All projects)"
          value={data.pending_receivable}
          sub="Money clients still owe you"
          icon={ArrowDownRight}
        />
        <BigMetric
          tone="warning"
          label="Pending Payable (Commissions)"
          value={data.pending_payable}
          sub="Commissions you owe references"
          icon={ArrowUpRight}
        />
      </div>

      {/* This Month + FY */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <SmallMetric label="Received this month" value={data.received_this_month} tone="green" icon={TrendingUp} />
        <SmallMetric label="Paid this month" value={data.paid_this_month} tone="red" icon={TrendingDown} />
        <SmallMetric label={`FY ${data.fy_label} Profit`} value={data.fy_profit} tone="primary" icon={Wallet} />
        <CountMetric label="Ongoing Projects" value={data.ongoing_projects} sub={`${data.completed_projects} completed`} icon={Briefcase} />
      </div>

      {/* Reminders */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ReminderCard
          title="Today's reminders"
          count={data.today_reminders}
          tone="green"
          icon={Bell}
          to="/reminders?filter=today"
        />
        <ReminderCard
          title="Overdue reminders"
          count={data.overdue_reminders}
          tone="red"
          icon={AlertCircle}
          to="/reminders?filter=overdue"
        />
        <Link
          to="/projects"
          data-testid="dash-add-project-card"
          className="rxt-card p-5 flex flex-col justify-between rxt-hover-lift"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="rxt-tiny-label">Quick action</div>
              <div className="font-display text-lg font-semibold mt-1">Manage projects</div>
              <p className="text-sm text-[#5A6566] mt-1">Create new project, update stage, add expense.</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-[#2B4C3B]/10 text-[#2B4C3B] grid place-items-center">
              <Plus size={18} />
            </div>
          </div>
        </Link>
      </div>

      {/* Recent transactions */}
      <div className="rxt-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E0D8]">
          <div>
            <div className="rxt-tiny-label">Recent</div>
            <h3 className="font-display text-lg font-semibold">Transactions</h3>
          </div>
          <Link to="/reports" className="text-sm text-[#2B4C3B] hover:underline">View reports →</Link>
        </div>
        <div>
          {(data.recent_transactions || []).length === 0 ? (
            <div className="px-5 py-12 text-center text-[#5A6566] text-sm">
              No transactions yet. Tap the + button on mobile or open a project to add one.
            </div>
          ) : (
            <div className="divide-y divide-[#E2E0D8]">
              {data.recent_transactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`h-9 w-9 rounded-lg grid place-items-center ${
                      t.type === "received" ? "bg-[#3A7D44]/10 text-[#3A7D44]" : "bg-[#D04238]/10 text-[#D04238]"
                    }`}>
                      <Receipt size={16} />
                    </div>
                    <div>
                      <div className="text-sm font-medium capitalize">
                        {t.type} · {t.category}
                      </div>
                      <div className="text-[11px] text-[#5A6566]">
                        {formatDate(t.date)} · {t.payment_mode}
                      </div>
                    </div>
                  </div>
                  <div className={`text-sm font-display font-semibold ${
                    t.type === "received" ? "text-[#3A7D44]" : "text-[#D04238]"
                  }`}>
                    {t.type === "received" ? "+" : "-"}{formatINR(t.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function firstName(user) {
  if (!user) return "";
  const full = (user.name || "").trim();
  if (full) return full.split(/\s+/)[0];
  if (user.email) return user.email.split("@")[0];
  return "";
}

function BigMetric({ tone, label, value, sub, icon: Icon }) {
  const toneCls = tone === "warning"
    ? "border-[#F5A623]/30 bg-gradient-to-br from-[#F5A623]/8 to-white"
    : "border-[#3A7D44]/30 bg-gradient-to-br from-[#3A7D44]/8 to-white";
  return (
    <div className={`rxt-card p-6 ${toneCls}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="rxt-tiny-label">{label}</div>
          <div className="font-display text-3xl sm:text-4xl font-semibold mt-2 text-[#1C2B2D]">
            {formatINR(value)}
          </div>
          <div className="text-xs text-[#5A6566] mt-1">{sub}</div>
        </div>
        <div className={`h-11 w-11 rounded-xl grid place-items-center ${
          tone === "warning" ? "bg-[#F5A623]/15 text-[#F5A623]" : "bg-[#3A7D44]/15 text-[#3A7D44]"
        }`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

function SmallMetric({ label, value, tone, icon: Icon }) {
  const palette = {
    green: "text-[#3A7D44] bg-[#3A7D44]/10",
    red: "text-[#D04238] bg-[#D04238]/10",
    primary: "text-[#2B4C3B] bg-[#2B4C3B]/10",
  }[tone] || "text-[#5A6566] bg-[#5A6566]/10";
  return (
    <div className="rxt-card p-4">
      <div className="flex items-center justify-between">
        <div className="rxt-tiny-label">{label}</div>
        <div className={`h-7 w-7 rounded-md grid place-items-center ${palette}`}>
          <Icon size={14} />
        </div>
      </div>
      <div className="font-display text-xl sm:text-2xl font-semibold mt-2 text-[#1C2B2D]">
        {formatINR(value)}
      </div>
    </div>
  );
}

function CountMetric({ label, value, sub, icon: Icon }) {
  return (
    <div className="rxt-card p-4">
      <div className="flex items-center justify-between">
        <div className="rxt-tiny-label">{label}</div>
        <div className="h-7 w-7 rounded-md bg-[#2B4C3B]/10 text-[#2B4C3B] grid place-items-center">
          <Icon size={14} />
        </div>
      </div>
      <div className="font-display text-3xl font-semibold mt-2">{value}</div>
      <div className="text-xs text-[#5A6566] mt-0.5">{sub}</div>
    </div>
  );
}

function ReminderCard({ title, count, tone, icon: Icon, to }) {
  const palette = tone === "red" ? "text-[#D04238] bg-[#D04238]/10" : "text-[#3A7D44] bg-[#3A7D44]/10";
  return (
    <Link to={to} className="rxt-card p-5 flex items-center justify-between rxt-hover-lift">
      <div>
        <div className="rxt-tiny-label">{title}</div>
        <div className="font-display text-3xl font-semibold mt-1">{count}</div>
      </div>
      <div className={`h-12 w-12 rounded-xl grid place-items-center ${palette}`}>
        <Icon size={20} />
      </div>
    </Link>
  );
}
