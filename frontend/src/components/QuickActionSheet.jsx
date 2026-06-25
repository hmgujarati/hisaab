import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Receipt, Briefcase, Bell, Camera, X, ArrowRight } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import TransactionForm from "@/components/TransactionForm";
import BillScanner from "@/components/BillScanner";

export default function QuickActionSheet({ open, onClose }) {
  const navigate = useNavigate();
  const [txOpen, setTxOpen] = useState(false);
  const [txType, setTxType] = useState("received");
  const [scannerOpen, setScannerOpen] = useState(false);

  const go = (path) => { onClose(); navigate(path); };

  const startTx = (type) => {
    setTxType(type);
    onClose();
    setTxOpen(true);
  };

  const items = [
    { key: "received", label: "Add Received Payment", desc: "Money came from client", icon: Receipt, color: "#3A7D44", onClick: () => startTx("received") },
    { key: "paid", label: "Add Expense / Paid", desc: "Money paid to supplier or worker", icon: Receipt, color: "#D04238", onClick: () => startTx("paid") },
    { key: "scan", label: "Scan Bill", desc: "Click photo, auto-enhance, save", icon: Camera, color: "#2B4C3B", onClick: () => { onClose(); setScannerOpen(true); } },
    { key: "project", label: "Add Project", desc: "Create new project entry", icon: Briefcase, color: "#2B4C3B", onClick: () => go("/projects") },
    { key: "reminder", label: "Add Reminder", desc: "Set payment / deadline reminder", icon: Bell, color: "#F5A623", onClick: () => go("/reminders") },
  ];

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent side="bottom" className="rounded-t-2xl border-t border-[#E2E0D8] max-h-[80vh] overflow-y-auto">
          <SheetHeader className="flex flex-row items-center justify-between mb-3">
            <SheetTitle className="font-display text-xl">Quick Actions</SheetTitle>
          </SheetHeader>
          <div className="space-y-2 pb-6">
            {items.map((it) => {
              const Icon = it.icon;
              return (
                <button
                  key={it.key}
                  data-testid={`quick-${it.key}`}
                  onClick={it.onClick}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-[#E2E0D8] hover:bg-[#F5F4F0]/60 transition-colors active:scale-[0.98]"
                >
                  <div className="h-10 w-10 rounded-lg grid place-items-center" style={{ background: `${it.color}1a`, color: it.color }}>
                    <Icon size={18} />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-sm font-medium text-[#1C2B2D]">{it.label}</div>
                    <div className="text-[11px] text-[#5A6566]">{it.desc}</div>
                  </div>
                  <ArrowRight size={14} className="text-[#5A6566]" />
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
      <TransactionForm
        open={txOpen}
        defaultType={txType}
        onClose={() => setTxOpen(false)}
        onSaved={() => setTxOpen(false)}
      />
      <BillScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onCapture={(f) => {
          // After scanning, just close — user can attach to a transaction next
          setScannerOpen(false);
          // ideally bridge to tx form; keep simple for now
        }}
      />
    </>
  );
}
