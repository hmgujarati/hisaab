import React, { useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  HardHat,
  HandCoins,
  Bell,
  BarChart3,
  Settings,
  LogOut,
  Plus,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import QuickActionSheet from "@/components/QuickActionSheet";
import InstallPWAButton from "@/components/InstallPWAButton";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/projects", label: "Projects", icon: Briefcase },
  { to: "/clients", label: "Clients", icon: Users },
  { to: "/parties", label: "Suppliers / Workers", icon: HardHat },
  { to: "/references", label: "References", icon: HandCoins },
  { to: "/reminders", label: "Reminders", icon: Bell },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

const MOBILE_NAV = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/projects", label: "Projects", icon: Briefcase },
  { to: "__quick__", label: "Add", icon: Plus },
  { to: "/reminders", label: "Reminders", icon: Bell },
  { to: "/reports", label: "Reports", icon: BarChart3 },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);

  const isExpired = user?.business?.live_status === "expired";

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-[#F5F4F0]">
      {/* Top bar */}
      <header className="sticky top-0 z-30 rxt-glass">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3">
            <button
              data-testid="open-drawer-btn"
              className="lg:hidden p-2 -ml-2 text-[#2B4C3B]"
              onClick={() => setDrawerOpen(true)}
            >
              <Menu size={22} />
            </button>
            <Link to="/dashboard" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-[#2B4C3B] grid place-items-center text-white font-display font-semibold">
                R
              </div>
              <div className="leading-none">
                <div className="font-display text-base font-semibold text-[#1C2B2D]">
                  RapidXT Hisaab
                </div>
                <div className="text-[10px] uppercase tracking-widest text-[#5A6566]">
                  {user?.business?.business_name || "Business"}
                </div>
              </div>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            {isExpired && (
              <span className="hidden sm:inline-block text-xs px-3 py-1 rounded-full bg-[#D04238]/10 text-[#D04238] border border-[#D04238]/20">
                Plan expired
              </span>
            )}
            <InstallPWAButton />
            <Button
              variant="ghost"
              size="sm"
              data-testid="logout-btn"
              onClick={handleLogout}
              className="text-[#5A6566] hover:text-[#1C2B2D]"
            >
              <LogOut size={16} className="mr-1.5" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
        {isExpired && (
          <div className="bg-[#D04238]/10 text-[#D04238] text-sm px-4 py-2 text-center">
            Your plan has expired. Please contact admin to renew. You can view
            data but cannot add new entries.
          </div>
        )}
      </header>

      <div className="flex">
        {/* Sidebar — desktop */}
        <aside className="hidden lg:block w-64 shrink-0 border-r border-[#E2E0D8] bg-white/60 min-h-[calc(100vh-65px)] p-4">
          <nav className="space-y-1">
            {NAV.map((n) => (
              <NavItem
                key={n.to}
                to={n.to}
                label={n.label}
                Icon={n.icon}
                active={location.pathname.startsWith(n.to)}
              />
            ))}
          </nav>
        </aside>

        {/* Mobile drawer */}
        {drawerOpen && (
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/40"
            onClick={() => setDrawerOpen(false)}
          >
            <div
              className="absolute left-0 top-0 bottom-0 w-72 bg-white p-4 shadow-xl animate-in slide-in-from-left-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="font-display text-lg font-semibold">Menu</div>
                <button
                  data-testid="close-drawer-btn"
                  className="p-2 text-[#5A6566]"
                  onClick={() => setDrawerOpen(false)}
                >
                  <X size={20} />
                </button>
              </div>
              <nav className="space-y-1">
                {NAV.map((n) => (
                  <NavItem
                    key={n.to}
                    to={n.to}
                    label={n.label}
                    Icon={n.icon}
                    active={location.pathname.startsWith(n.to)}
                    onClick={() => setDrawerOpen(false)}
                  />
                ))}
              </nav>
            </div>
          </div>
        )}

        {/* Main */}
        <main className="flex-1 min-w-0 pb-24 lg:pb-8">
          <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 animate-in fade-in duration-300">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 rxt-glass safe-bottom">
        <div className="grid grid-cols-5">
          {MOBILE_NAV.map((m) => {
            const Icon = m.icon;
            if (m.to === "__quick__") {
              return (
                <button
                  key="quick"
                  data-testid="bottom-quick-add"
                  className="flex flex-col items-center justify-center py-2 -mt-6"
                  onClick={() => setQuickOpen(true)}
                >
                  <div className="h-12 w-12 rounded-full bg-[#2B4C3B] text-white grid place-items-center shadow-lg active:scale-95 transition-transform">
                    <Plus size={22} />
                  </div>
                </button>
              );
            }
            const active = location.pathname.startsWith(m.to);
            return (
              <Link
                key={m.to}
                to={m.to}
                data-testid={`bottom-nav-${m.label.toLowerCase()}`}
                className={`flex flex-col items-center justify-center py-2.5 text-[11px] ${
                  active ? "text-[#2B4C3B]" : "text-[#5A6566]"
                }`}
              >
                <Icon size={20} strokeWidth={active ? 2 : 1.5} />
                <span className="mt-1">{m.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <QuickActionSheet open={quickOpen} onClose={() => setQuickOpen(false)} />
    </div>
  );
}

function NavItem({ to, label, Icon, active, onClick }) {
  return (
    <Link
      to={to}
      data-testid={`side-nav-${label.toLowerCase().replace(/[^a-z]/g, "-")}`}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
        active
          ? "bg-[#2B4C3B] text-white"
          : "text-[#1C2B2D] hover:bg-[#E2E0D8]/60"
      }`}
    >
      <Icon size={18} strokeWidth={active ? 2 : 1.5} />
      <span className="font-medium">{label}</span>
    </Link>
  );
}
