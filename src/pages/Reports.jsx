import { useState, useEffect } from "react";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { Download, TrendingUp, Users, DollarSign, Search, Filter, FileText } from "lucide-react";
import { getDonors, getPayments, getOrphans, getBudgetSummary, PAYMENT_TYPES, LOCATIONS } from "../data/store";
import { useLanguage } from "../context/LanguageContext";

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

export default function Reports() {
  useLanguage();
  const [donors,   setDonors]   = useState([]);
  const [payments, setPayments] = useState([]);

  const thisYear = new Date().getFullYear();
  const [selectedYear,   setSelectedYear]   = useState("all");
  const [selectedLoc,    setSelectedLoc]    = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [search,         setSearch]         = useState("");

  useEffect(() => {
    setDonors(getDonors());
    setPayments(getPayments());
  }, []);

  // Available years from data
  const availableYears = Array.from(new Set([
    thisYear,
    ...donors.map(d => new Date(d.date).getFullYear()).filter(y => !isNaN(y)),
    ...payments.map(p => new Date(p.date).getFullYear()).filter(y => !isNaN(y)),
  ])).sort((a, b) => b - a);

  // Apply filters
  const filtered = donors.filter(d => {
    if (selectedYear !== "all" && new Date(d.date).getFullYear() !== +selectedYear) return false;
    if (selectedLoc  !== "all" && d.location !== selectedLoc) return false;
    if (selectedStatus === "paid"    && !(d.paid >= d.committed && d.committed > 0)) return false;
    if (selectedStatus === "partial" && !(d.paid > 0 && d.paid < d.committed))       return false;
    if (selectedStatus === "unpaid"  && d.paid !== 0)                                 return false;
    if (search && !d.name.toLowerCase().includes(search.toLowerCase()))               return false;
    return true;
  });

  // Payments filtered by year (for KPIs)
  const filteredPayments = selectedYear === "all"
    ? payments
    : payments.filter(p => new Date(p.date).getFullYear() === +selectedYear);

  const totalCommitted = filtered.reduce((s, d) => s + d.committed, 0);
  const totalPaid      = filteredPayments.reduce((s, p) => s + p.amount, 0);

  const fullyPaid = filtered.filter(d => d.paid >= d.committed && d.committed > 0).length;
  const partial   = filtered.filter(d => d.paid > 0 && d.paid < d.committed).length;
  const unpaid    = filtered.filter(d => d.paid === 0).length;

  const byLocation = Object.entries(
    filtered.reduce((acc, d) => {
      const label = LOCATIONS[d.location] || d.location || "Unknown";
      acc[label] = (acc[label] || 0) + d.committed;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  const topDonors = [...filtered]
    .sort((a, b) => b.committed - a.committed)
    .slice(0, 10)
    .map(d => ({ name: d.name.split(" ").slice(0, 2).join(" "), committed: d.committed, paid: d.paid }));

  function handleExport() {
    const label = selectedYear === "all" ? "all-years" : selectedYear;
    const rows = [
      ["#", "Name", "Type", "Location", "Committed ($)", "Paid ($)", "Balance ($)", "Status", "Date"],
      ...filtered.map((d, i) => [
        i + 1, d.name, PAYMENT_TYPES[d.type] || d.type,
        LOCATIONS[d.location] || d.location,
        d.committed, d.paid, d.committed - d.paid,
        d.paid >= d.committed ? "Paid" : d.paid > 0 ? "Partial" : "Pending",
        d.date,
      ])
    ];
    const csv  = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `iskaashi-report-${label}.csv`; a.click();
  }

  function exportPDF() {
    const yearLabel  = selectedYear === "all" ? "All Years" : selectedYear;
    const locLabel   = selectedLoc  === "all" ? "All Locations" : selectedLoc === "local" ? "Local (Somalia)" : "Diaspora";
    const stLabel    = selectedStatus === "all" ? "All Statuses" : selectedStatus.charAt(0).toUpperCase() + selectedStatus.slice(1);
    const now        = new Date();
    const dateStr    = now.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
    const timeStr    = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    const collRate   = totalCommitted > 0 ? (totalPaid / totalCommitted * 100).toFixed(1) : "0.0";
    const balance    = Math.max(0, totalCommitted - totalPaid);
    const fullyPaidN = filtered.filter(d => d.paid >= d.committed && d.committed > 0).length;
    const partialN   = filtered.filter(d => d.paid > 0 && d.paid < d.committed).length;
    const unpaidN    = filtered.filter(d => d.paid === 0).length;

    const rows = filtered.map((d, i) => {
      const status = d.paid >= d.committed && d.committed > 0 ? "Paid"
                   : d.paid > 0 ? "Partial" : "Pending";
      const bal    = d.committed - d.paid;
      const rate   = d.committed > 0 ? Math.min(100, (d.paid / d.committed) * 100) : 0;
      const statusColor = status === "Paid" ? "#065f46" : status === "Partial" ? "#92400e" : "#9f1239";
      const statusBg    = status === "Paid" ? "#d1fae5" : status === "Partial" ? "#fef3c7" : "#ffe4e6";
      return `
        <tr style="background:${i % 2 === 0 ? "#ffffff" : "#f8fafc"}">
          <td style="padding:8px 10px;color:#94a3b8;font-size:11px;text-align:center">${i + 1}</td>
          <td style="padding:8px 10px;font-weight:600;color:#1e293b;font-size:12px">${d.name}</td>
          <td style="padding:8px 10px;font-size:11px;color:#475569">${d.country || (d.location === "local" ? "Somalia" : "—")}</td>
          <td style="padding:8px 10px;font-size:12px;text-align:right;font-weight:600;color:#1e293b">$${d.committed.toLocaleString()}</td>
          <td style="padding:8px 10px;font-size:12px;text-align:right;font-weight:700;color:#059669">$${d.paid.toLocaleString()}</td>
          <td style="padding:8px 10px;font-size:12px;text-align:right;font-weight:600;color:${bal > 0 ? "#e11d48" : "#94a3b8"}">$${bal.toLocaleString()}</td>
          <td style="padding:8px 10px;text-align:center">
            <div style="display:inline-flex;align-items:center;gap:6px">
              <div style="width:52px;height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden">
                <div style="width:${rate}%;height:100%;background:${rate===100?"#10b981":"#3b82f6"};border-radius:3px"></div>
              </div>
              <span style="font-size:10px;font-weight:700;background:${statusBg};color:${statusColor};padding:2px 6px;border-radius:4px">${status}</span>
            </div>
          </td>
        </tr>`;
    }).join("");

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Iskaashi Donor Report — ${yearLabel}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Inter', sans-serif; background:#f1f5f9; color:#1e293b; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    @page { size:A4 landscape; margin:0; }
    @media print {
      body { background:#fff; }
      .no-print { display:none !important; }
    }
    .page { max-width:1050px; margin:0 auto; background:#fff; min-height:100vh; }

    /* ── Header ── */
    .header { background:linear-gradient(135deg,#064e3b 0%,#065f46 50%,#047857 100%); padding:28px 36px 24px; position:relative; overflow:hidden; }
    .header::before { content:''; position:absolute; top:-40px; right:-40px; width:200px; height:200px; background:rgba(255,255,255,0.04); border-radius:50%; }
    .header::after  { content:''; position:absolute; bottom:-60px; left:30%; width:280px; height:280px; background:rgba(255,255,255,0.03); border-radius:50%; }
    .org-name { color:#6ee7b7; font-size:11px; font-weight:700; letter-spacing:3px; text-transform:uppercase; margin-bottom:4px; }
    .report-title { color:#ffffff; font-size:26px; font-weight:900; letter-spacing:-0.5px; }
    .report-subtitle { color:#a7f3d0; font-size:13px; margin-top:4px; }
    .header-meta { display:flex; gap:20px; margin-top:16px; flex-wrap:wrap; }
    .meta-pill { background:rgba(255,255,255,0.1); color:#d1fae5; font-size:10px; font-weight:600; padding:4px 10px; border-radius:20px; border:1px solid rgba(255,255,255,0.15); }

    /* ── KPI row ── */
    .kpi-row { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; padding:20px 36px 0; }
    .kpi { background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:14px 16px; }
    .kpi-label { font-size:10px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px; }
    .kpi-value { font-size:22px; font-weight:900; color:#1e293b; line-height:1; }
    .kpi-sub   { font-size:10px; color:#94a3b8; margin-top:4px; }
    .kpi.green { border-left:3px solid #10b981; } .kpi.green .kpi-value { color:#059669; }
    .kpi.blue  { border-left:3px solid #3b82f6; } .kpi.blue .kpi-value  { color:#2563eb; }
    .kpi.amber { border-left:3px solid #f59e0b; } .kpi.amber .kpi-value { color:#d97706; }
    .kpi.rose  { border-left:3px solid #f43f5e; } .kpi.rose .kpi-value  { color:#e11d48; }

    /* ── Status bar ── */
    .status-bar { display:flex; gap:10px; padding:14px 36px; align-items:center; }
    .status-label { font-size:10px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:1px; margin-right:4px; }
    .chip { font-size:11px; font-weight:700; padding:5px 12px; border-radius:20px; }
    .chip.paid    { background:#d1fae5; color:#065f46; }
    .chip.partial { background:#fef3c7; color:#92400e; }
    .chip.unpaid  { background:#ffe4e6; color:#9f1239; }

    /* ── Table ── */
    .table-wrap { padding:0 36px 36px; }
    .section-title { font-size:12px; font-weight:800; color:#475569; text-transform:uppercase; letter-spacing:1.5px; margin:0 0 10px; padding-top:4px; border-top:2px solid #f1f5f9; }
    table { width:100%; border-collapse:collapse; border-radius:12px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.06); }
    thead tr { background:linear-gradient(90deg,#064e3b,#065f46); }
    thead th { padding:10px 10px; text-align:left; font-size:10px; font-weight:700; color:#6ee7b7; text-transform:uppercase; letter-spacing:1px; }
    thead th:last-child { text-align:center; }
    tfoot tr { background:#f1f5f9; border-top:2px solid #e2e8f0; }
    tfoot td { padding:10px 10px; font-size:12px; font-weight:700; color:#334155; }

    /* ── Footer ── */
    .footer { background:#f8fafc; border-top:1px solid #e2e8f0; padding:14px 36px; display:flex; justify-content:space-between; align-items:center; }
    .footer-left  { font-size:10px; color:#94a3b8; }
    .footer-right { font-size:10px; color:#94a3b8; text-align:right; }
    .footer-org   { font-size:11px; font-weight:700; color:#059669; }

    /* ── Print button ── */
    .print-btn { display:block; margin:24px auto 0; background:linear-gradient(135deg,#059669,#047857); color:#fff; border:none; padding:12px 32px; border-radius:12px; font-size:14px; font-weight:700; cursor:pointer; letter-spacing:0.5px; box-shadow:0 4px 12px rgba(5,150,105,0.35); }
    .print-btn:hover { background:linear-gradient(135deg,#047857,#065f46); }
  </style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div class="org-name">Iskaashi Educational Development Org.</div>
    <div class="report-title">Donor Report</div>
    <div class="report-subtitle">Education Fund — ${yearLabel}</div>
    <div class="header-meta">
      <span class="meta-pill">📅 ${dateStr} · ${timeStr}</span>
      <span class="meta-pill">📍 ${locLabel}</span>
      <span class="meta-pill">⚡ ${stLabel}</span>
      <span class="meta-pill">👥 ${filtered.length} Donors</span>
    </div>
  </div>

  <!-- KPIs -->
  <div class="kpi-row">
    <div class="kpi green">
      <div class="kpi-label">Total Donors</div>
      <div class="kpi-value">${filtered.length}</div>
      <div class="kpi-sub">in this report</div>
    </div>
    <div class="kpi blue">
      <div class="kpi-label">Total Committed</div>
      <div class="kpi-value">$${totalCommitted.toLocaleString()}</div>
      <div class="kpi-sub">pledged this year</div>
    </div>
    <div class="kpi amber">
      <div class="kpi-label">Total Collected</div>
      <div class="kpi-value">$${totalPaid.toLocaleString()}</div>
      <div class="kpi-sub">${collRate}% of committed</div>
    </div>
    <div class="kpi rose">
      <div class="kpi-label">Outstanding</div>
      <div class="kpi-value">$${balance.toLocaleString()}</div>
      <div class="kpi-sub">pending collection</div>
    </div>
  </div>

  <!-- Status bar -->
  <div class="status-bar">
    <span class="status-label">Payment Status:</span>
    <span class="chip paid">✓ ${fullyPaidN} Fully Paid</span>
    <span class="chip partial">◑ ${partialN} Partial</span>
    <span class="chip unpaid">○ ${unpaidN} Pending</span>
  </div>

  <!-- Table -->
  <div class="table-wrap">
    <p class="section-title">Donor Directory</p>
    <table>
      <thead>
        <tr>
          <th style="width:36px">#</th>
          <th>Donor Name</th>
          <th>Location</th>
          <th style="text-align:right">Committed</th>
          <th style="text-align:right">Collected</th>
          <th style="text-align:right">Balance</th>
          <th style="text-align:center">Status</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr>
          <td colspan="3" style="color:#64748b;font-size:11px">TOTALS — ${filtered.length} donors</td>
          <td style="text-align:right;color:#1e293b">$${totalCommitted.toLocaleString()}</td>
          <td style="text-align:right;color:#059669">$${totalPaid.toLocaleString()}</td>
          <td style="text-align:right;color:#e11d48">$${balance.toLocaleString()}</td>
          <td style="text-align:center;color:#2563eb;font-size:11px">${collRate}% collected</td>
        </tr>
      </tfoot>
    </table>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="footer-left">
      <div class="footer-org">Iskaashi Educational Development Org.</div>
      <div>Confidential · For internal use only</div>
    </div>
    <div class="footer-right">
      <div>Generated ${dateStr} at ${timeStr}</div>
      <div>Iskaashi Management System</div>
    </div>
  </div>

  <button class="print-btn no-print" onclick="window.print()">🖨 Save as PDF / Print</button>
  <div style="height:24px"></div>
</div>

<script>
  // Auto-trigger print after fonts load
  window.addEventListener("load", () => setTimeout(() => window.print(), 600));
</script>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (!win) { alert("Please allow pop-ups for this site to export PDF."); return; }
    win.document.write(html);
    win.document.close();
  }

  function exportFinancialReport() {
    const allDonors   = getDonors();
    const allPayments = getPayments();
    const allOrphans  = getOrphans();
    const budget      = getBudgetSummary();
    const now         = new Date();
    const yr          = now.getFullYear();
    const dateStr     = now.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
    const timeStr     = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

    const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const curMo  = now.getMonth();

    // ── Donor metrics ──
    const yrDonors   = allDonors.filter(d => new Date(d.date).getFullYear() === yr);
    const yrPayments = allPayments.filter(p => new Date(p.date).getFullYear() === yr);
    const committed  = yrDonors.reduce((s, d) => s + d.committed, 0);
    const collected  = yrPayments.reduce((s, p) => s + p.amount, 0);
    const outstanding = Math.max(0, committed - collected);
    const collRate   = committed > 0 ? (collected / committed * 100).toFixed(1) : "0.0";
    const diaspora   = yrDonors.filter(d => d.location !== "local");
    const local      = yrDonors.filter(d => d.location === "local");
    const fullyPaid  = yrDonors.filter(d => d.paid >= d.committed && d.committed > 0);
    const partial    = yrDonors.filter(d => d.paid > 0 && d.paid < d.committed);
    const pending    = yrDonors.filter(d => d.paid === 0);

    // ── Budget metrics ──
    const { needed, disbursed, remaining, paidCount } = budget;
    const budgetPct  = needed > 0 ? Math.min(100, (collected / needed) * 100).toFixed(1) : "0.0";

    // ── Monthly trend (cumulative) ──
    let cumCollected = 0;
    const monthRows = MONTHS.slice(0, curMo + 1).map((mo, i) => {
      const moAmt = yrPayments.filter(p => new Date(p.date).getMonth() === i).reduce((s, p) => s + p.amount, 0);
      const moDonors = yrDonors.filter(d => new Date(d.date).getMonth() === i).length;
      cumCollected += moAmt;
      return { mo, moAmt, moDonors, cumCollected };
    });

    // ── Country breakdown ──
    const byCountry = Object.entries(
      yrDonors.reduce((acc, d) => {
        const c = d.country || "Unknown";
        if (!acc[c]) acc[c] = { donors: 0, committed: 0, paid: 0 };
        acc[c].donors++;
        acc[c].committed += d.committed;
        acc[c].paid += d.paid;
        return acc;
      }, {})
    ).sort((a, b) => b[1].committed - a[1].committed).slice(0, 10);

    // ── Top donors ──
    const topDonors = [...yrDonors].sort((a, b) => b.committed - a.committed).slice(0, 15);

    // ── Students paid ──
    const paidStudents = allOrphans.filter(o => o.feePaid);
    const schoolPaid   = paidStudents.filter(o => o.level === "school");
    const uniPaid      = paidStudents.filter(o => o.level === "university");

    // ── HTML helpers ──
    const pct = (n, d) => d > 0 ? ((n / d) * 100).toFixed(1) : "0.0";
    const bar = (val, total, color) => {
      const w = total > 0 ? Math.min(100, (val / total) * 100) : 0;
      return `<div style="background:#e2e8f0;border-radius:4px;height:8px;overflow:hidden"><div style="width:${w}%;height:100%;background:${color};border-radius:4px"></div></div>`;
    };

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<title>Iskaashi — Comprehensive Financial Report ${yr}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Inter',sans-serif;background:#f8fafc;color:#1e293b;-webkit-print-color-adjust:exact;print-color-adjust:exact;font-size:12px}
  @page{size:A4;margin:0}
  @media print{body{background:#fff}.no-print{display:none!important}.page-break{page-break-before:always}}

  /* Cover */
  .cover{background:linear-gradient(160deg,#022c22 0%,#064e3b 45%,#065f46 70%,#047857 100%);min-height:100vh;display:flex;flex-direction:column;justify-content:space-between;padding:60px 56px;position:relative;overflow:hidden}
  .cover::before{content:'';position:absolute;top:-80px;right:-80px;width:420px;height:420px;background:rgba(255,255,255,0.03);border-radius:50%}
  .cover::after{content:'';position:absolute;bottom:-120px;left:10%;width:500px;height:500px;background:rgba(255,255,255,0.02);border-radius:50%}
  .cover-badge{display:inline-block;background:rgba(110,231,183,0.15);border:1px solid rgba(110,231,183,0.3);color:#6ee7b7;font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;padding:6px 14px;border-radius:20px;margin-bottom:24px}
  .cover-title{color:#fff;font-size:42px;font-weight:900;line-height:1.1;letter-spacing:-1px;margin-bottom:12px}
  .cover-sub{color:#a7f3d0;font-size:16px;font-weight:500;margin-bottom:40px}
  .cover-divider{width:60px;height:3px;background:linear-gradient(90deg,#34d399,transparent);border-radius:2px;margin-bottom:40px}
  .cover-meta{display:grid;grid-template-columns:1fr 1fr;gap:20px;max-width:500px}
  .cover-meta-item label{display:block;color:#6ee7b7;font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px}
  .cover-meta-item span{color:#fff;font-size:15px;font-weight:700}
  .cover-footer{color:#6ee7b7;font-size:11px;font-weight:500;border-top:1px solid rgba(110,231,183,0.2);padding-top:20px;margin-top:40px}

  /* Content pages */
  .content{max-width:100%;background:#fff}
  .section{padding:32px 40px}
  .section+.section{border-top:1px solid #f1f5f9}

  .section-header{display:flex;align-items:center;gap:10px;margin-bottom:20px}
  .section-dot{width:4px;height:28px;border-radius:2px}
  .section-dot.green{background:linear-gradient(180deg,#10b981,#059669)}
  .section-dot.blue{background:linear-gradient(180deg,#3b82f6,#2563eb)}
  .section-dot.amber{background:linear-gradient(180deg,#f59e0b,#d97706)}
  .section-dot.violet{background:linear-gradient(180deg,#8b5cf6,#6d28d9)}
  .section-dot.rose{background:linear-gradient(180deg,#f43f5e,#e11d48)}
  .section-title{font-size:15px;font-weight:800;color:#0f172a;letter-spacing:-0.3px}
  .section-sub{font-size:10px;color:#94a3b8;margin-top:2px}

  /* KPI grid */
  .kpi-grid{display:grid;gap:12px}
  .kpi-grid-4{grid-template-columns:repeat(4,1fr)}
  .kpi-grid-3{grid-template-columns:repeat(3,1fr)}
  .kpi-grid-2{grid-template-columns:repeat(2,1fr)}
  .kpi{border-radius:12px;padding:16px;border:1px solid}
  .kpi.g{background:#f0fdf4;border-color:#bbf7d0}.kpi.g .kv{color:#059669}
  .kpi.b{background:#eff6ff;border-color:#bfdbfe}.kpi.b .kv{color:#2563eb}
  .kpi.a{background:#fffbeb;border-color:#fde68a}.kpi.a .kv{color:#d97706}
  .kpi.r{background:#fff1f2;border-color:#fecdd3}.kpi.r .kv{color:#e11d48}
  .kpi.v{background:#faf5ff;border-color:#e9d5ff}.kpi.v .kv{color:#7c3aed}
  .kpi.s{background:#f0fdfa;border-color:#99f6e4}.kpi.s .kv{color:#0d9488}
  .kl{font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px}
  .kv{font-size:22px;font-weight:900;line-height:1}
  .ks{font-size:10px;color:#94a3b8;margin-top:4px}

  /* Tables */
  table{width:100%;border-collapse:collapse;border-radius:10px;overflow:hidden}
  thead tr{background:linear-gradient(90deg,#0f172a,#1e293b)}
  thead th{padding:9px 12px;text-align:left;font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px}
  tbody tr:nth-child(even){background:#f8fafc}
  tbody tr:hover{background:#f0fdf4}
  tbody td{padding:8px 12px;font-size:11px;color:#334155;border-bottom:1px solid #f1f5f9}
  tfoot tr{background:#1e293b}
  tfoot td{padding:10px 12px;font-size:11px;font-weight:700;color:#e2e8f0}

  /* Badges */
  .badge{display:inline-block;padding:2px 8px;border-radius:20px;font-size:9px;font-weight:700}
  .badge.paid{background:#d1fae5;color:#065f46}
  .badge.partial{background:#fef3c7;color:#92400e}
  .badge.pending{background:#ffe4e6;color:#9f1239}

  /* Page header strip */
  .page-header{background:linear-gradient(90deg,#064e3b,#065f46);padding:10px 40px;display:flex;justify-content:space-between;align-items:center}
  .page-header span{color:#6ee7b7;font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase}

  /* Footer */
  .report-footer{background:#0f172a;padding:16px 40px;display:flex;justify-content:space-between;align-items:center;margin-top:auto}
  .report-footer .lft{color:#94a3b8;font-size:9px}
  .report-footer .rgt{color:#94a3b8;font-size:9px;text-align:right}
  .report-footer .brand{color:#34d399;font-size:11px;font-weight:700}

  /* Print btn */
  .print-btn{display:block;margin:28px auto;background:linear-gradient(135deg,#059669,#047857);color:#fff;border:none;padding:14px 40px;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 4px 16px rgba(5,150,105,0.4);letter-spacing:0.5px}
</style>
</head>
<body>

<!-- ════ COVER PAGE ════ -->
<div class="cover">
  <div>
    <div class="cover-badge">Confidential Financial Report</div>
    <div class="cover-title">Comprehensive<br/>Financial Report</div>
    <div class="cover-sub">Iskaashi Educational Development Organisation</div>
    <div class="cover-divider"></div>
    <div class="cover-meta">
      <div class="cover-meta-item"><label>Report Period</label><span>January — ${MONTHS[curMo]} ${yr}</span></div>
      <div class="cover-meta-item"><label>Generated</label><span>${dateStr}</span></div>
      <div class="cover-meta-item"><label>Total Donors</label><span>${yrDonors.length} Donors</span></div>
      <div class="cover-meta-item"><label>Students Enrolled</label><span>${allOrphans.length} Students</span></div>
    </div>
  </div>
  <div class="cover-footer">
    Iskaashi Management System &nbsp;·&nbsp; Generated at ${timeStr} &nbsp;·&nbsp; For internal use only
  </div>
</div>

<!-- ════ PAGE 2 — EXECUTIVE SUMMARY ════ -->
<div class="content page-break">
  <div class="page-header">
    <span>Iskaashi Educational Development Org. — Financial Report ${yr}</span>
    <span>Section 1 · Executive Summary</span>
  </div>
  <div class="section">
    <div class="section-header">
      <div class="section-dot green"></div>
      <div><div class="section-title">Executive Summary</div><div class="section-sub">High-level financial snapshot for ${yr}</div></div>
    </div>
    <div class="kpi-grid kpi-grid-4" style="margin-bottom:20px">
      <div class="kpi g"><div class="kl">Total Donors</div><div class="kv">${yrDonors.length}</div><div class="ks">${local.length} local · ${diaspora.length} diaspora</div></div>
      <div class="kpi b"><div class="kl">Total Committed</div><div class="kv">$${committed.toLocaleString()}</div><div class="ks">pledged by donors</div></div>
      <div class="kpi a"><div class="kl">Total Collected</div><div class="kv">$${collected.toLocaleString()}</div><div class="ks">${collRate}% of committed</div></div>
      <div class="kpi r"><div class="kl">Outstanding</div><div class="kv">$${outstanding.toLocaleString()}</div><div class="ks">pending collection</div></div>
    </div>
    <div class="kpi-grid kpi-grid-4">
      <div class="kpi g"><div class="kl">Fully Paid</div><div class="kv">${fullyPaid.length}</div><div class="ks">${pct(fullyPaid.length, yrDonors.length)}% of donors</div></div>
      <div class="kpi a"><div class="kl">Partial Payment</div><div class="kv">${partial.length}</div><div class="ks">${pct(partial.length, yrDonors.length)}% of donors</div></div>
      <div class="kpi r"><div class="kl">No Payment Yet</div><div class="kv">${pending.length}</div><div class="ks">${pct(pending.length, yrDonors.length)}% of donors</div></div>
      <div class="kpi v"><div class="kl">Collection Rate</div><div class="kv">${collRate}%</div><div class="ks">committed vs collected</div></div>
    </div>
  </div>

  <!-- Student Disbursement -->
  <div class="section">
    <div class="section-header">
      <div class="section-dot violet"></div>
      <div><div class="section-title">Student Disbursement Fund</div><div class="section-sub">Annual budget vs funds available vs paid out</div></div>
    </div>
    <div class="kpi-grid kpi-grid-4" style="margin-bottom:16px">
      <div class="kpi v"><div class="kl">Annual Budget</div><div class="kv">$${needed.toLocaleString()}</div><div class="ks">total student fees</div></div>
      <div class="kpi g"><div class="kl">In Account</div><div class="kv">$${collected.toLocaleString()}</div><div class="ks">${budgetPct}% of annual budget</div></div>
      <div class="kpi b"><div class="kl">Balance</div><div class="kv">$${remaining.toLocaleString()}</div><div class="ks">available to disburse</div></div>
      <div class="kpi a"><div class="kl">Paid to Students</div><div class="kv">$${disbursed.toLocaleString()}</div><div class="ks">${paidCount} students marked paid</div></div>
    </div>
    <div style="background:#f8fafc;border-radius:10px;padding:14px 16px">
      <div style="display:flex;justify-content:space-between;font-size:10px;color:#64748b;margin-bottom:6px">
        <span style="font-weight:700">Budget Coverage Progress</span>
        <span>${budgetPct}% of $${needed.toLocaleString()} annual target collected</span>
      </div>
      ${bar(collected, needed, "linear-gradient(90deg,#10b981,#059669)")}
      <div style="display:flex;justify-content:space-between;font-size:9px;color:#94a3b8;margin-top:6px">
        <span>Collected: $${collected.toLocaleString()}</span>
        <span>Remaining: $${Math.max(0, needed - collected).toLocaleString()}</span>
      </div>
    </div>
    <div style="margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="kpi g"><div class="kl">School Students Paid</div><div class="kv">${schoolPaid.length}</div><div class="ks">fees disbursed</div></div>
      <div class="kpi v"><div class="kl">University Students Paid</div><div class="kv">${uniPaid.length}</div><div class="ks">fees disbursed</div></div>
    </div>
  </div>

  <!-- Monthly Trend -->
  <div class="section">
    <div class="section-header">
      <div class="section-dot blue"></div>
      <div><div class="section-title">Monthly Collection Trend</div><div class="section-sub">Jan–${MONTHS[curMo]} ${yr} · month-by-month breakdown</div></div>
    </div>
    <table>
      <thead><tr>
        <th>Month</th><th>New Donors</th><th>Collected</th><th>Cumulative</th><th style="width:200px">Progress</th>
      </tr></thead>
      <tbody>
        ${monthRows.map(({ mo, moAmt, moDonors, cumCollected: cum }) => `
        <tr>
          <td style="font-weight:700;color:#0f172a">${mo} ${yr}</td>
          <td><span style="background:#dbeafe;color:#1d4ed8;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700">${moDonors}</span></td>
          <td style="font-weight:700;color:#059669">$${moAmt.toLocaleString()}</td>
          <td style="font-weight:700;color:#2563eb">$${cum.toLocaleString()}</td>
          <td>${bar(cum, collected || 1, "linear-gradient(90deg,#3b82f6,#2563eb)")}</td>
        </tr>`).join("")}
      </tbody>
      <tfoot><tr>
        <td colspan="2" style="color:#94a3b8">Year Total</td>
        <td>$${collected.toLocaleString()}</td>
        <td>$${collected.toLocaleString()}</td>
        <td style="color:#94a3b8;font-size:9px">${collRate}% of committed</td>
      </tr></tfoot>
    </table>
  </div>
</div>

<!-- ════ PAGE 3 — DONOR BREAKDOWN ════ -->
<div class="content page-break">
  <div class="page-header">
    <span>Iskaashi Educational Development Org. — Financial Report ${yr}</span>
    <span>Section 2 · Donor Breakdown</span>
  </div>

  <!-- By Country -->
  <div class="section">
    <div class="section-header">
      <div class="section-dot amber"></div>
      <div><div class="section-title">Donations by Country</div><div class="section-sub">Top contributing countries</div></div>
    </div>
    <table>
      <thead><tr><th>Country</th><th>Donors</th><th>Committed</th><th>Collected</th><th>Balance</th><th style="width:160px">Collection Rate</th></tr></thead>
      <tbody>
        ${byCountry.map(([country, v]) => {
          const r = v.committed > 0 ? (v.paid / v.committed * 100).toFixed(0) : 0;
          return `<tr>
            <td style="font-weight:700;color:#0f172a">${country}</td>
            <td><span style="background:#dbeafe;color:#1d4ed8;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700">${v.donors}</span></td>
            <td style="font-weight:700">$${v.committed.toLocaleString()}</td>
            <td style="font-weight:700;color:#059669">$${v.paid.toLocaleString()}</td>
            <td style="color:#e11d48;font-weight:600">$${(v.committed - v.paid).toLocaleString()}</td>
            <td>${bar(v.paid, v.committed, "#10b981")}<span style="font-size:9px;color:#64748b">${r}%</span></td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
  </div>

  <!-- Location split -->
  <div class="section">
    <div class="section-header">
      <div class="section-dot rose"></div>
      <div><div class="section-title">Local vs Diaspora</div><div class="section-sub">Contribution split by donor location</div></div>
    </div>
    <div class="kpi-grid kpi-grid-2" style="margin-bottom:16px">
      <div class="kpi g">
        <div class="kl">🇸🇴 Local Donors (Somalia)</div>
        <div class="kv">${local.length}</div>
        <div class="ks">Committed: $${local.reduce((s,d)=>s+d.committed,0).toLocaleString()} · Collected: $${local.reduce((s,d)=>s+d.paid,0).toLocaleString()}</div>
        <div style="margin-top:8px">${bar(local.reduce((s,d)=>s+d.paid,0), local.reduce((s,d)=>s+d.committed,0)||1, "#10b981")}</div>
      </div>
      <div class="kpi b">
        <div class="kl">🌍 Diaspora Donors</div>
        <div class="kv">${diaspora.length}</div>
        <div class="ks">Committed: $${diaspora.reduce((s,d)=>s+d.committed,0).toLocaleString()} · Collected: $${diaspora.reduce((s,d)=>s+d.paid,0).toLocaleString()}</div>
        <div style="margin-top:8px">${bar(diaspora.reduce((s,d)=>s+d.paid,0), diaspora.reduce((s,d)=>s+d.committed,0)||1, "#3b82f6")}</div>
      </div>
    </div>
  </div>

  <!-- Top Donors -->
  <div class="section">
    <div class="section-header">
      <div class="section-dot green"></div>
      <div><div class="section-title">Top 15 Donors by Commitment</div><div class="section-sub">Ranked by committed amount</div></div>
    </div>
    <table>
      <thead><tr><th>#</th><th>Donor Name</th><th>Country</th><th>Committed</th><th>Collected</th><th>Balance</th><th>Status</th></tr></thead>
      <tbody>
        ${topDonors.map((d, i) => {
          const status = d.paid >= d.committed && d.committed > 0 ? "paid" : d.paid > 0 ? "partial" : "pending";
          const bal = d.committed - d.paid;
          return `<tr>
            <td style="color:#94a3b8;font-size:10px;text-align:center">${i+1}</td>
            <td style="font-weight:700;color:#0f172a">${d.name}</td>
            <td style="color:#64748b">${d.country || "—"}</td>
            <td style="font-weight:700">$${d.committed.toLocaleString()}</td>
            <td style="font-weight:700;color:#059669">$${d.paid.toLocaleString()}</td>
            <td style="color:${bal>0?"#e11d48":"#94a3b8"}">$${bal.toLocaleString()}</td>
            <td><span class="badge ${status}">${status.charAt(0).toUpperCase()+status.slice(1)}</span></td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
  </div>
</div>

<!-- ════ PAGE 4 — FULL DONOR LIST ════ -->
<div class="content page-break">
  <div class="page-header">
    <span>Iskaashi Educational Development Org. — Financial Report ${yr}</span>
    <span>Section 3 · Complete Donor Register</span>
  </div>
  <div class="section">
    <div class="section-header">
      <div class="section-dot blue"></div>
      <div><div class="section-title">Complete Donor Register</div><div class="section-sub">${yrDonors.length} donors for ${yr}</div></div>
    </div>
    <table>
      <thead><tr><th>#</th><th>Donor Name</th><th>Country</th><th>Type</th><th>Committed</th><th>Collected</th><th>Balance</th><th>Status</th></tr></thead>
      <tbody>
        ${yrDonors.map((d, i) => {
          const status = d.paid >= d.committed && d.committed > 0 ? "paid" : d.paid > 0 ? "partial" : "pending";
          const bal = d.committed - d.paid;
          return `<tr>
            <td style="color:#94a3b8;font-size:10px;text-align:center">${i+1}</td>
            <td style="font-weight:600;color:#0f172a;font-size:11px">${d.name}</td>
            <td style="color:#64748b;font-size:10px">${d.country || "—"}</td>
            <td style="font-size:10px"><span style="background:#dbeafe;color:#1d4ed8;padding:2px 6px;border-radius:6px;font-size:9px;font-weight:600">${PAYMENT_TYPES[d.type] || d.type}</span></td>
            <td style="font-weight:700;font-size:11px">$${d.committed.toLocaleString()}</td>
            <td style="font-weight:700;color:#059669;font-size:11px">$${d.paid.toLocaleString()}</td>
            <td style="font-weight:600;color:${bal>0?"#e11d48":"#94a3b8"};font-size:11px">$${bal.toLocaleString()}</td>
            <td><span class="badge ${status}">${status.charAt(0).toUpperCase()+status.slice(1)}</span></td>
          </tr>`;
        }).join("")}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="4" style="color:#94a3b8;font-size:10px">TOTALS — ${yrDonors.length} donors</td>
          <td>$${committed.toLocaleString()}</td>
          <td style="color:#34d399">$${collected.toLocaleString()}</td>
          <td style="color:#f87171">$${outstanding.toLocaleString()}</td>
          <td style="color:#94a3b8;font-size:10px">${collRate}%</td>
        </tr>
      </tfoot>
    </table>
  </div>
  <div class="report-footer">
    <div class="lft"><div class="brand">Iskaashi Educational Development Org.</div><div>Confidential · For internal use only · ${dateStr}</div></div>
    <div class="rgt"><div>Iskaashi Management System</div><div>Generated at ${timeStr}</div></div>
  </div>
</div>

<button class="print-btn no-print" onclick="window.print()">🖨&nbsp; Save as PDF / Print</button>
<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),800))</script>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (!win) { alert("Please allow pop-ups for this site to export PDF."); return; }
    win.document.write(html);
    win.document.close();
  }

  const FilterBtn = ({ active, onClick, children }) => (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
        active ? "bg-emerald-600 text-white shadow" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="p-4 md:p-6 space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Reports & Analytics</h2>
          <p className="text-sm text-gray-400">
            Showing {filtered.length} of {donors.length} donors
            {selectedYear !== "all" ? ` · ${selectedYear}` : " · All Years"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-xl font-semibold text-sm transition"
          >
            <Download className="w-4 h-4" /> CSV
          </button>
          <button
            onClick={exportPDF}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm shadow transition"
          >
            <FileText className="w-4 h-4" /> Donor PDF
          </button>
          <button
            onClick={exportFinancialReport}
            className="flex items-center gap-2 bg-gradient-to-br from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm shadow-lg transition"
          >
            <TrendingUp className="w-4 h-4" /> Financial Report
          </button>
        </div>
      </div>

      {/* ── Filter Bar ─────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
          <Filter className="w-3.5 h-3.5" /> Filters
        </div>

        <div className="flex flex-wrap gap-4">

          {/* Year */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Year</p>
            <div className="flex flex-wrap gap-1.5">
              <FilterBtn active={selectedYear === "all"} onClick={() => setSelectedYear("all")}>All Years</FilterBtn>
              {availableYears.map(y => (
                <FilterBtn key={y} active={selectedYear === y} onClick={() => setSelectedYear(y)}>{y}</FilterBtn>
              ))}
            </div>
          </div>

          {/* Location */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Location</p>
            <div className="flex flex-wrap gap-1.5">
              {[["all","All"], ["local","Local (Somalia)"], ["qurbajoog","Diaspora"]].map(([val, label]) => (
                <FilterBtn key={val} active={selectedLoc === val} onClick={() => setSelectedLoc(val)}>{label}</FilterBtn>
              ))}
            </div>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Payment Status</p>
            <div className="flex flex-wrap gap-1.5">
              {[["all","All"], ["paid","Fully Paid"], ["partial","Partial"], ["unpaid","Unpaid"]].map(([val, label]) => (
                <FilterBtn key={val} active={selectedStatus === val} onClick={() => setSelectedStatus(val)}>{label}</FilterBtn>
              ))}
            </div>
          </div>

          {/* Search */}
          <div className="space-y-1.5 flex-1 min-w-[160px]">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Search</p>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name…"
                className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-300 w-full"
              />
            </div>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { icon: Users,      label: "Donors",         val: filtered.length,                          color: "text-emerald-600", bg: "bg-emerald-50" },
          { icon: DollarSign, label: "Committed",       val: `$${totalCommitted.toLocaleString()}`,   color: "text-blue-600",    bg: "bg-blue-50" },
          { icon: TrendingUp, label: "Collection Rate", val: `${totalCommitted > 0 ? (totalPaid / totalCommitted * 100).toFixed(0) : 0}%`, color: "text-amber-600", bg: "bg-amber-50" },
        ].map(({ icon: Icon, label, val, color, bg }) => (
          <div key={label} className={`${bg} rounded-2xl p-4 border border-white shadow-sm`}>
            <Icon className={`w-5 h-5 ${color} mb-2`} />
            <p className="text-xl font-bold text-gray-800">{val}</p>
            <p className="text-xs text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      {/* Status summary pills */}
      <div className="flex gap-3 flex-wrap">
        {[
          { label: "Fully Paid",  val: fullyPaid, color: "bg-emerald-100 text-emerald-700" },
          { label: "Partial",     val: partial,   color: "bg-amber-100 text-amber-700" },
          { label: "Unpaid",      val: unpaid,    color: "bg-rose-100 text-rose-700" },
        ].map(({ label, val, color }) => (
          <div key={label} className={`${color} rounded-xl px-4 py-2 text-sm font-bold`}>
            {val} {label}
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Committed vs Collected */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-1">Committed vs Collected</h3>
          <p className="text-xs text-gray-400 mb-4">Education Fund — {selectedYear === "all" ? "All Years" : selectedYear}</p>
          <div className="space-y-4">
            {[
              { label: "Committed", val: totalCommitted, color: "bg-blue-500",    pct: 100 },
              { label: "Collected", val: totalPaid,      color: "bg-emerald-500", pct: totalCommitted > 0 ? Math.min(100, totalPaid / totalCommitted * 100) : 0 },
              { label: "Balance",   val: Math.max(0, totalCommitted - totalPaid), color: "bg-rose-400", pct: totalCommitted > 0 ? Math.min(100, Math.max(0, totalCommitted - totalPaid) / totalCommitted * 100) : 0 },
            ].map(({ label, val, color, pct }) => (
              <div key={label}>
                <div className="flex justify-between text-xs font-semibold text-gray-600 mb-1">
                  <span>{label}</span>
                  <span>${val.toLocaleString()} <span className="text-gray-400 font-normal">({pct.toFixed(0)}%)</span></span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3">
                  <div className={`${color} h-3 rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* By location */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-4">Committed by Location</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={byLocation} cx="50%" cy="50%" outerRadius={65} dataKey="value">
                {byLocation.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => `$${v.toLocaleString()}`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top donors chart */}
      {topDonors.length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-4">Top Donors by Committed Amount</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topDonors}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => `$${v}`} />
              <Legend />
              <Bar dataKey="committed" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Committed" />
              <Bar dataKey="paid"      fill="#10b981" radius={[4, 4, 0, 0]} name="Paid" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Detailed table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">Donor Detail — {filtered.length} records</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["#", "Name", "Type", "Location", "Committed", "Paid", "Balance", "Rate"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="text-center py-8 text-gray-400 text-sm">No donors match the selected filters.</td></tr>
              )}
              {filtered.map((d, i) => {
                const rate   = d.committed > 0 ? (d.paid / d.committed * 100) : 0;
                const status = d.paid >= d.committed && d.committed > 0 ? "paid"
                             : d.paid > 0 ? "partial" : "unpaid";
                const statusColors = { paid: "bg-emerald-100 text-emerald-700", partial: "bg-amber-100 text-amber-700", unpaid: "bg-rose-100 text-rose-700" };
                return (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-4 py-2.5 font-semibold text-gray-800 max-w-[180px] truncate">{d.name}</td>
                    <td className="px-4 py-2.5 text-xs">
                      <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg font-medium whitespace-nowrap">
                        {PAYMENT_TYPES[d.type] || d.type}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                      {d.location === "local" ? "🇸🇴 Local" : "🌍 Diaspora"}
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-gray-700 whitespace-nowrap">${d.committed.toLocaleString()}</td>
                    <td className="px-4 py-2.5 font-semibold text-emerald-600 whitespace-nowrap">${d.paid.toLocaleString()}</td>
                    <td className="px-4 py-2.5 font-semibold text-rose-500 whitespace-nowrap">${(d.committed - d.paid).toLocaleString()}</td>
                    <td className="px-4 py-2.5 min-w-[110px]">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${Math.min(100, rate)}%` }} />
                        </div>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${statusColors[status]}`}>{rate.toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-50 border-t-2 border-gray-200 font-bold">
              <tr>
                <td colSpan={3} className="px-4 py-3 text-xs text-gray-500 uppercase">Totals ({filtered.length} donors)</td>
                <td className="px-4 py-3 text-gray-800">${totalCommitted.toLocaleString()}</td>
                <td className="px-4 py-3 text-emerald-700">${totalPaid.toLocaleString()}</td>
                <td className="px-4 py-3 text-rose-600">${(totalCommitted - totalPaid).toLocaleString()}</td>
                <td className="px-4 py-3 text-gray-600 text-xs">
                  {totalCommitted > 0 ? (totalPaid / totalCommitted * 100).toFixed(0) : 0}% collected
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
