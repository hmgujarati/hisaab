# RapidXT Hisaab — PRD

## Problem Statement
Build a mobile-first SaaS PWA for interior designers, colour/painting/civil contractors. Manage ongoing projects, clients, suppliers/workers/labour, project givers, payments received/paid, pending receivables/payables, project-wise profit/loss, Indian financial year profit report, bill photos & documents, project stages, extra work/change orders, project-wise material tracking, and payment reminders.

Goal: "Project ka paisa aaya kitna, gaya kitna, pending kitna, aur profit kitna."

## Architecture
- **Backend**: FastAPI + Motor (async MongoDB) + JWT cookies + bcrypt + Pillow image compression + SMTP for password reset
- **Frontend**: React 19 + Tailwind + shadcn/ui + lucide-react + sonner toasts + axios + PWA (manifest + service worker)
- **Multi-tenant**: every row has `business_id` and every query filters by it. Super Admin has `business_id=null` and role `super_admin`.
- **Theme**: Organic & Earthy — Deep Forest Green `#2B4C3B` + Terracotta `#D96C4A` on warm off-white `#F5F4F0`. Outfit + Inter fonts.

## User Personas
1. **Super Admin** — owns the SaaS. Manages customer businesses, plan dates, suspend/activate, password reset, SMTP settings.
2. **Business Owner (Contractor)** — uses the actual product on mobile at site or in office.

## Core Implementation (Feb 2026)
- Single login page for both roles (email or mobile + password)
- Forgot password + SMTP-based reset email + admin manual reset
- Super Admin panel: customer list (with live status: Active/Expired/Suspended/days_remaining), add/edit, extend expiry, suspend/activate, reset password, SMTP settings + test send
- Business plan expiry enforcement: expired accounts can read but cannot write (HTTP 403 on write endpoints)
- Mobile-first PWA: manifest, service worker, bottom nav with FAB Quick Action sheet
- Dashboard: pending receivable, pending payable, this month received/paid, FY profit, today/overdue reminders, recent transactions
- Projects CRUD with tabs (Overview, Transactions, Extra Work, Stages, Materials, Documents)
- Clients, Parties (suppliers/workers/contractors), References (with commission %/amount tracking)
- Transactions (Received/Paid) with project, party, category, payment mode, date, notes, bill upload
- Bill scanner: browser camera capture + enhance (contrast/brightness) + client compression to ~600KB + server-side Pillow compression backup
- Extra Work/Change Orders (only Approved items added to revised project value)
- Project Stages Master (CRUD + reorder up/down + active toggle); per-project stage history timeline
- Project-wise Materials (no central inventory by design)
- Project Documents with categories (Quotation, Bill, Site Photos, Drawings, etc.)
- Reminders with filters (Today, Overdue, Week, Month, Completed)
- Reports: FY profit (with month-wise trend), Project P/L, Receivables, Payables; CSV export
- Indian currency formatting (₹1,25,000) via Intl.NumberFormat('en-IN')
- Indian FY logic (April–March), `current_fy_label`, `fy_range`

## What's Implemented (Feb 2026)
- All MVP features in scope above
- Default super-admin seeded on startup (admin@rapidxt.com / Admin@123)
- Default project stages auto-created for each new business

## Backlog (P1)
- WhatsApp / SMS / Email reminders (structure ready, only in-app for now)
- Manual crop UI for the bill scanner (currently uses native camera + auto-enhance)
- Offline draft queue with background sync (PWA SW is cache-first read-only currently)
- Multi-staff users per business (owner role works; structure for `staff` exists)
- Stage drag-and-drop reorder (currently up/down arrows)

## Backlog (P2)
- Razorpay subscription billing (deferred per MVP — manual collection)
- Multi-plan pricing, MRR analytics, feature-based plan gating
- Central warehouse inventory (only project-wise materials in MVP)
- Full GST-compliant invoicing
