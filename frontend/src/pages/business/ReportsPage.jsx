import React, { useEffect, useState } from "react";
import { Download, TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import api from "@/lib/api";
import { formatINR, currentFY, fyOptions } from "@/lib/format";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export default function ReportsPage() {
  const [tab, setTab] = useState("fy");
  const [fy, setFy] = useState(currentFY());
  const [fyData, setFyData] = useState(null);
  const [recv, setRecv] = useState([]);
  const [pay, setPay] = useState([]);
  const [pl, setPl] = useState([]);

  useEffect(() => {
    api.get(`/reports/fy-profit?fy=${fy}`).then(({ data }) => setFyData(data));
  }, [fy]);
  useEffect(() => {
    api.get(`/reports/receivables`).then(({ data }) => setRecv(data));
    api.get(`/reports/payables`).then(({ data }) => setPay(data));
    api.get(`/reports/project-pl`).then(({ data }) => setPl(data));
  }, []);

  const exportCsv = (rows, headers, filename) => {
    if (!rows.length) return;
    const lines = [headers.join(",")];
    rows.forEach((r) => lines.push(headers.map((h) => JSON.stringify(r[h] ?? "")).join(",")));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-widest text-[#5A6566]">Insights</div>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold mt-1">Reports</h1>
        <p className="text-[#5A6566] mt-1">Indian Financial Year profit, receivables & payables.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-white border border-[#E2E0D8] p-1 rounded-xl h-auto flex-wrap w-full justify-start gap-1">
          <TabsTrigger value="fy" data-testid="report-tab-fy" className="data-[state=active]:bg-[#2B4C3B] data-[state=active]:text-white">FY Profit</TabsTrigger>
          <TabsTrigger value="pl" data-testid="report-tab-pl" className="data-[state=active]:bg-[#2B4C3B] data-[state=active]:text-white">Project P/L</TabsTrigger>
          <TabsTrigger value="receivables" data-testid="report-tab-receivables" className="data-[state=active]:bg-[#2B4C3B] data-[state=active]:text-white">Receivables</TabsTrigger>
          <TabsTrigger value="payables" data-testid="report-tab-payables" className="data-[state=active]:bg-[#2B4C3B] data-[state=active]:text-white">Payables</TabsTrigger>
        </TabsList>

        <TabsContent value="fy" className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-sm text-[#5A6566]">Financial year:</span>
              <Select value={fy} onValueChange={setFy}>
                <SelectTrigger data-testid="report-fy-select" className="h-10 w-40 bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>{fyOptions(6).map((y) => <SelectItem key={y} value={y}>FY {y}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {fyData?.month_wise?.length > 0 && (
              <Button variant="outline" onClick={() => exportCsv(fyData.month_wise, ["month", "received", "paid", "profit"], `fy-${fy}-monthly.csv`)} data-testid="export-fy-csv">
                <Download size={14} className="mr-1.5" /> Export CSV
              </Button>
            )}
          </div>
          {fyData && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Card label="Total Received" value={formatINR(fyData.received)} tone="green" icon={TrendingUp} />
                <Card label="Total Paid" value={formatINR(fyData.paid)} tone="red" icon={TrendingDown} />
                <Card label="Actual Cash Profit" value={formatINR(fyData.actual_cash_profit)} tone={fyData.actual_cash_profit >= 0 ? "primary" : "red"} icon={BarChart3} />
              </div>
              <div className="rxt-card overflow-hidden">
                <div className="px-5 py-3 border-b border-[#E2E0D8] font-display font-semibold">Month-wise Trend</div>
                {fyData.month_wise.length === 0 ? (
                  <div className="py-10 text-center text-sm text-[#5A6566]">No transactions in this FY yet.</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-[#5A6566] bg-[#F5F4F0]/60">
                      <th className="px-4 py-2 font-medium">Month</th>
                      <th className="px-4 py-2 font-medium text-right">Received</th>
                      <th className="px-4 py-2 font-medium text-right">Paid</th>
                      <th className="px-4 py-2 font-medium text-right">Profit</th>
                    </tr></thead>
                    <tbody>
                      {fyData.month_wise.map((m) => (
                        <tr key={m.month} className="border-t border-[#E2E0D8]">
                          <td className="px-4 py-2">{m.month}</td>
                          <td className="px-4 py-2 text-right text-[#3A7D44]">{formatINR(m.received)}</td>
                          <td className="px-4 py-2 text-right text-[#D04238]">{formatINR(m.paid)}</td>
                          <td className={`px-4 py-2 text-right font-medium ${m.profit >= 0 ? "text-[#2B4C3B]" : "text-[#D04238]"}`}>{formatINR(m.profit)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="pl" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button variant="outline" onClick={() => exportCsv(pl, ["project_name","client_name","status","revised_value","received","pending_receivable","paid","actual_cash_profit","book_profit"], "project-pl.csv")} data-testid="export-pl-csv">
              <Download size={14} className="mr-1.5" /> Export CSV
            </Button>
          </div>
          <DataTable
            rows={pl}
            cols={[
              { key: "project_name", label: "Project", align: "left" },
              { key: "client_name", label: "Client", align: "left" },
              { key: "status", label: "Status", align: "left" },
              { key: "revised_value", label: "Value", fmt: formatINR },
              { key: "received", label: "Received", fmt: formatINR, c: "text-[#3A7D44]" },
              { key: "pending_receivable", label: "Pending", fmt: formatINR, c: "text-[#D04238]" },
              { key: "paid", label: "Paid", fmt: formatINR },
              { key: "actual_cash_profit", label: "Cash Profit", fmt: formatINR, bold: true },
            ]}
          />
        </TabsContent>

        <TabsContent value="receivables" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button variant="outline" onClick={() => exportCsv(recv, ["project_name","client_name","revised_value","received","pending"], "receivables.csv")} data-testid="export-recv-csv">
              <Download size={14} className="mr-1.5" /> Export CSV
            </Button>
          </div>
          <DataTable rows={recv} cols={[
            { key: "project_name", label: "Project", align: "left" },
            { key: "client_name", label: "Client", align: "left" },
            { key: "revised_value", label: "Value", fmt: formatINR },
            { key: "received", label: "Received", fmt: formatINR, c: "text-[#3A7D44]" },
            { key: "pending", label: "Pending", fmt: formatINR, c: "text-[#D04238]", bold: true },
          ]} />
        </TabsContent>

        <TabsContent value="payables" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button variant="outline" onClick={() => exportCsv(pay, ["name","type","total_commission","paid","pending"], "payables.csv")} data-testid="export-pay-csv">
              <Download size={14} className="mr-1.5" /> Export CSV
            </Button>
          </div>
          <DataTable rows={pay} cols={[
            { key: "name", label: "Reference", align: "left" },
            { key: "type", label: "Type", align: "left" },
            { key: "total_commission", label: "Commission", fmt: formatINR },
            { key: "paid", label: "Paid", fmt: formatINR, c: "text-[#3A7D44]" },
            { key: "pending", label: "Pending", fmt: formatINR, c: "text-[#D04238]", bold: true },
          ]} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Card({ label, value, tone, icon: Icon }) {
  const cls = tone === "green" ? "text-[#3A7D44]" : tone === "red" ? "text-[#D04238]" : "text-[#2B4C3B]";
  return (
    <div className="rxt-card p-5">
      <div className="flex items-center justify-between">
        <div className="rxt-tiny-label">{label}</div>
        <div className={`h-8 w-8 rounded-md grid place-items-center bg-current/10 ${cls}`}><Icon size={15} /></div>
      </div>
      <div className={`font-display text-2xl font-semibold mt-2 ${cls}`}>{value}</div>
    </div>
  );
}

function DataTable({ rows, cols }) {
  return (
    <div className="rxt-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-[#5A6566] bg-[#F5F4F0]/60">
            {cols.map((c) => <th key={c.key} className={`px-4 py-2 font-medium ${c.align === "left" ? "text-left" : "text-right"}`}>{c.label}</th>)}
          </tr></thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={cols.length} className="px-4 py-12 text-center text-[#5A6566]">No data</td></tr>
            ) : rows.map((r, i) => (
              <tr key={r.project_id || r.reference_id || i} className="border-t border-[#E2E0D8]">
                {cols.map((c) => (
                  <td key={c.key} className={`px-4 py-2 ${c.align === "left" ? "text-left" : "text-right"} ${c.bold ? "font-display font-semibold" : ""} ${c.c || ""}`}>
                    {c.fmt ? c.fmt(r[c.key]) : (r[c.key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
