import { useState, useEffect } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import {
  TrendingUp, Users, Heart, DollarSign,
  ChevronLeft, ChevronRight, Globe, MapPin
} from "lucide-react";
import { getHistory, getDonors, getOrphans, getPayments, PAYMENT_TYPES } from "../data/store";
import { useLanguage } from "../context/LanguageContext";

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const CURRENT_YEAR = new Date().getFullYear();

export default function History() {
  const { t } = useLanguage();
  const [donors,        setDonors]        = useState([]);
  const [orphans,       setOrphans]       = useState([]);
  const [payments,      setPayments]      = useState([]);
  const [staticHistory, setStaticHistory] = useState([]);

  useEffect(() => {
    setDonors(getDonors());
    setOrphans(getOrphans());
    setPayments(getPayments());
    setStaticHistory(getHistory());
  }, []);

  // Build current year entry from live data
  const sponsored      = orphans.filter(o => o.status === "sponsored").length;
  const qurbajoog      = donors.filter(d => d.location === "qurbajoog").length;
  const local          = donors.filter(d => d.location === "local").length;
  const totalCollected = payments.reduce((s, p) => s + p.amount, 0);
  const totalCommitted = donors.reduce((s, d) => s + d.committed, 0);

  const byTypeMap = {};
  payments.forEach(p => {
    if (!byTypeMap[p.type]) byTypeMap[p.type] = { name: PAYMENT_TYPES[p.type] || p.type, donors: 0, amount: 0 };
    byTypeMap[p.type].donors++;
    byTypeMap[p.type].amount += p.amount;
  });

  const monthlyMap = {};
  payments.forEach(p => {
    if (p.date) {
      const m = MONTH_NAMES[parseInt(p.date.split("-")[1]) - 1];
      if (!monthlyMap[m]) monthlyMap[m] = { month: m, collected: 0 };
      monthlyMap[m].collected += p.amount;
    }
  });

  const currentYearEntry = {
    year:             CURRENT_YEAR,
    totalOrphans:     orphans.length,
    sponsored,
    totalDonors:      donors.length,
    totalCollected,
    totalCommitted,
    qurbajoog,
    local,
    byType:           Object.values(byTypeMap),
    monthlyBreakdown: MONTH_NAMES.filter(m => monthlyMap[m]).map(m => monthlyMap[m]),
  };

  // Merge: stored history for past years + live data for current year
  const allHistory = [
    ...staticHistory.filter(h => h.year !== CURRENT_YEAR),
    currentYearEntry,
  ].sort((a, b) => a.year - b.year);

  const yoyData = allHistory.map(y => ({
    year:      String(y.year),
    orphans:   y.totalOrphans,
    sponsored: y.sponsored,
    donors:    y.totalDonors,
    collected: y.totalCollected,
    committed: y.totalCommitted,
    qurbajoog: y.qurbajoog,
    local:     y.local,
    rate:      y.totalOrphans > 0 ? Math.round(y.sponsored / y.totalOrphans * 100) : 0,
  }));

  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const yearData = allHistory.find(h => h.year === selectedYear);
  const prevYear = allHistory.find(h => h.year === selectedYear - 1);

  function delta(curr, prev) {
    if (!prev) return null;
    const diff = curr - prev;
    return { diff, pct: ((diff / prev) * 100).toFixed(0), up: diff >= 0 };
  }

  if (allHistory.length === 0 || (allHistory.length === 1 && currentYearEntry.totalOrphans === 0 && currentYearEntry.totalDonors === 0)) {
    return (
      <div className="p-4 md:p-6 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center">
          <TrendingUp className="w-8 h-8 text-gray-300" />
        </div>
        <p className="text-gray-400 font-semibold text-base">No historical data</p>
        <p className="text-gray-400 text-sm text-center max-w-xs">All data has been cleared. Add new donors, orphans, and payments to build history.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-5 text-white shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">{t("historical_data")}</h2>
            <p className="text-blue-200 text-sm mt-0.5">{t("year_over_year_perf")}</p>
          </div>
          {/* Year selector */}
          <div className="flex items-center gap-2 bg-white/20 rounded-xl px-3 py-2 backdrop-blur">
            <button
              onClick={() => setSelectedYear(y => Math.max(allHistory[0].year, y - 1))}
              className="p-1 hover:bg-white/20 rounded-lg transition"
              disabled={selectedYear === allHistory[0].year}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-bold text-lg w-16 text-center">{selectedYear}</span>
            <button
              onClick={() => setSelectedYear(y => Math.min(allHistory[allHistory.length - 1].year, y + 1))}
              className="p-1 hover:bg-white/20 rounded-lg transition"
              disabled={selectedYear === allHistory[allHistory.length - 1].year}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Year KPIs */}
      {yearData && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: Heart,      label: t("orphans_sponsored_kpi"), curr: yearData.sponsored,      prev: prevYear?.sponsored,      suffix: "",  color: "bg-rose-50 text-rose-600" },
            { icon: Users,      label: t("total_donors_hist"),     curr: yearData.totalDonors,    prev: prevYear?.totalDonors,    suffix: "",  color: "bg-blue-50 text-blue-600" },
            { icon: DollarSign, label: t("collected_hist"),        curr: yearData.totalCollected, prev: prevYear?.totalCollected, prefix: "$", color: "bg-emerald-50 text-emerald-600" },
            { icon: TrendingUp, label: t("coverage_rate_kpi"),     curr: yearData.totalOrphans > 0 ? Math.round(yearData.sponsored / yearData.totalOrphans * 100) : 0, prev: prevYear && prevYear.totalOrphans > 0 ? Math.round(prevYear.sponsored / prevYear.totalOrphans * 100) : null, suffix: "%", color: "bg-amber-50 text-amber-600" },
          ].map(({ icon: Icon, label, curr, prev, prefix = "", suffix, color }) => {
            const d = delta(curr, prev);
            return (
              <div key={label} className={`${color} rounded-2xl p-4 border border-white shadow-sm`}>
                <Icon className="w-5 h-5 mb-2 opacity-70" />
                <p className="text-2xl font-bold text-gray-800">{prefix}{curr?.toLocaleString()}{suffix}</p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                {d && (
                  <p className={`text-xs font-semibold mt-1 ${d.up ? "text-emerald-600" : "text-rose-500"}`}>
                    {d.up ? "+" : ""}{d.diff} ({d.up ? "+" : ""}{d.pct}%) vs {selectedYear - 1}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Qurbajoog vs Local for selected year */}
      {yearData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-500" /> {t("qurbajoog_vs_local", { year: selectedYear })}
            </h3>
            <div className="space-y-4">
              {[
                { label: t("qurbajoog_diaspora"), val: yearData.qurbajoog, color: "bg-blue-500",    icon: Globe,  text: "text-blue-600" },
                { label: t("local_somalia"),      val: yearData.local,     color: "bg-emerald-500", icon: MapPin, text: "text-emerald-600" },
              ].map(({ label, val, color, icon: Icon, text }) => {
                const pct = yearData.totalDonors > 0 ? (val / yearData.totalDonors * 100) : 0;
                return (
                  <div key={label}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${text}`} />
                        <span className="text-sm font-medium text-gray-700">{label}</span>
                      </div>
                      <span className={`text-sm font-bold ${text}`}>{val} donors ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3">
                      <div className={`h-3 rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 text-center">
              <p className="text-gray-400 text-xs">{t("total_donors_in_year", { year: selectedYear })} <strong className="text-gray-700">{yearData.totalDonors}</strong></p>
            </div>
          </div>

          {/* Payment type breakdown for year */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-800 mb-4">{t("payment_types_year", { year: selectedYear })}</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={yearData.byType} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={95} />
                <Tooltip formatter={(v, n) => [n === "amount" ? `$${v}` : v, n === "amount" ? "Amount ($)" : "Donors"]} />
                <Legend />
                <Bar dataKey="donors" fill="#10b981" radius={[0, 4, 4, 0]} name="Donors" />
                <Bar dataKey="amount" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Amount ($)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Monthly breakdown for selected year */}
      {yearData && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-4">{t("monthly_collections", { year: selectedYear })}</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={yearData.monthlyBreakdown}>
              <defs>
                <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={v => `$${v}`} />
              <Area type="monotone" dataKey="collected" stroke="#10b981" fill="url(#histGrad)"
                strokeWidth={2} name="Collected ($)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Year-over-year comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-4">{t("orphan_by_year")}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={yoyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="year" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="orphans"   fill="#e5e7eb" radius={[4, 4, 0, 0]} name="Total Orphans" />
              <Bar dataKey="sponsored" fill="#10b981" radius={[4, 4, 0, 0]} name="Sponsored" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-4">{t("collections_vs_comm")}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={yoyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="year" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={v => `$${v}`} />
              <Legend />
              <Bar dataKey="committed"  fill="#93c5fd" radius={[4, 4, 0, 0]} name="Committed ($)" />
              <Bar dataKey="collected"  fill="#3b82f6" radius={[4, 4, 0, 0]} name="Collected ($)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Donors growth line chart */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h3 className="font-bold text-gray-800 mb-4">{t("donor_growth")}</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={yoyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="year" tick={{ fontSize: 12 }} />
            <YAxis yAxisId="left"  tick={{ fontSize: 12 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} unit="%" />
            <Tooltip formatter={(v, n) => [n === "Coverage %" ? `${v}%` : v, n]} />
            <Legend />
            <Line yAxisId="left"  type="monotone" dataKey="donors"    stroke="#8b5cf6" strokeWidth={2} dot={{ r: 5 }} name="Total Donors" />
            <Line yAxisId="left"  type="monotone" dataKey="qurbajoog" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} strokeDasharray="5 5" name="Diaspora" />
            <Line yAxisId="left"  type="monotone" dataKey="local"     stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} strokeDasharray="5 5" name="Local" />
            <Line yAxisId="right" type="monotone" dataKey="rate"      stroke="#f59e0b" strokeWidth={2} dot={{ r: 5 }} name="Coverage %" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Summary table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-800">{t("yoy_summary_table")}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {[t("year"), t("total_orphans_col"), t("sponsored_col"), t("coverage_col"), t("donors_col"), t("qurbajoog_col"), t("local_label"), t("committed"), t("collected"), t("rate")].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {allHistory.map(y => (
                <tr key={y.year}
                  onClick={() => setSelectedYear(y.year)}
                  className={`hover:bg-gray-50 transition-colors cursor-pointer ${y.year === selectedYear ? "bg-blue-50" : ""}`}>
                  <td className="px-4 py-3 font-bold text-blue-700">{y.year}</td>
                  <td className="px-4 py-3 text-gray-700">{y.totalOrphans}</td>
                  <td className="px-4 py-3 text-emerald-600 font-semibold">{y.sponsored}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-200 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full bg-emerald-500"
                          style={{ width: `${y.totalOrphans > 0 ? (y.sponsored / y.totalOrphans * 100).toFixed(0) : 0}%` }} />
                      </div>
                      <span className="text-xs text-gray-600">{y.totalOrphans > 0 ? (y.sponsored / y.totalOrphans * 100).toFixed(0) : 0}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{y.totalDonors}</td>
                  <td className="px-4 py-3 text-blue-600">{y.qurbajoog}</td>
                  <td className="px-4 py-3 text-emerald-600">{y.local}</td>
                  <td className="px-4 py-3 text-gray-700">${y.totalCommitted.toLocaleString()}</td>
                  <td className="px-4 py-3 font-semibold text-emerald-700">${y.totalCollected.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold ${y.totalCommitted > 0 && (y.totalCollected / y.totalCommitted * 100) >= 80 ? "text-emerald-600" : "text-amber-600"}`}>
                      {y.totalCommitted > 0 ? (y.totalCollected / y.totalCommitted * 100).toFixed(0) : 0}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
