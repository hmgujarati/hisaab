import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Toaster } from "sonner";

import LoginPage from "@/pages/LoginPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import AdminPanel from "@/pages/admin/AdminPanel";
import AdminSmtp from "@/pages/admin/AdminSmtp";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/business/Dashboard";
import ProjectsList from "@/pages/business/ProjectsList";
import ProjectDetail from "@/pages/business/ProjectDetail";
import ClientsPage from "@/pages/business/ClientsPage";
import PartiesPage from "@/pages/business/PartiesPage";
import ReferencesPage from "@/pages/business/ReferencesPage";
import RemindersPage from "@/pages/business/RemindersPage";
import ReportsPage from "@/pages/business/ReportsPage";
import SettingsPage from "@/pages/business/SettingsPage";

function Protected({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[#5A6566]">
        Loading…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    return user.role === "super_admin" ? (
      <Navigate to="/admin" replace />
    ) : (
      <Navigate to="/" replace />
    );
  }
  return children;
}

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "super_admin") return <Navigate to="/admin" replace />;
  return <Navigate to="/dashboard" replace />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-center" richColors />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Super admin */}
          <Route
            path="/admin"
            element={
              <Protected roles={["super_admin"]}>
                <AdminPanel />
              </Protected>
            }
          />
          <Route
            path="/admin/smtp"
            element={
              <Protected roles={["super_admin"]}>
                <AdminSmtp />
              </Protected>
            }
          />

          {/* Business owner */}
          <Route
            element={
              <Protected roles={["owner", "staff"]}>
                <Layout />
              </Protected>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/projects" element={<ProjectsList />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
            <Route path="/clients" element={<ClientsPage />} />
            <Route path="/parties" element={<PartiesPage />} />
            <Route path="/references" element={<ReferencesPage />} />
            <Route path="/reminders" element={<RemindersPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>

          <Route path="/" element={<RootRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
