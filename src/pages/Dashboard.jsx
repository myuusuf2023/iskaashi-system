import { useState, useEffect } from "react";
import {
  ComposedChart, Area, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import {
  Users, DollarSign, TrendingUp,
  AlertCircle, CheckCircle2, Clock, ArrowRight,
  Target, Pencil, X, Save, Plus, CreditCard
} from "lucide-react";
import StatCard from "../components/StatCard";
import { getDonors, getPayments, PAYMENT_TYPES, getTarget, setTarget,
         getDonationAccounts, addDonationAccount, updateDonationAccount, deleteDonationAccount,
         getBudgetSummary, redistributeJanPayments,
         getStudentBudget, setStudentBudget, reconcileDonorPaid } from "../data/store";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"];

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function Dashboard() {
  const { isAdmin } = useAuth();
  const { t } = useLanguage();
  const [donors, setDonors]   = useState([]);
  const [payments, setPayments] = useState([]);
  const [goal, setGoal]         = useState(() => getTarget());
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalForm, setGoalForm]       = useState({ amount: "", label: "" });

  const [accounts, setAccounts]           = useState(() => getDonationAccounts());
  const [managingAccounts, setManagingAccounts] = useState(false);
  const [accountForm, setAccountForm]     = useState({ accountName: "Iskaashi", provider: "", accountNumber: "", phone: "", notes: "" });
  const [editingAccount, setEditingAccount] = useState(null);

  const [editingStudentBudget, setEditingStudentBudget] = useState(false);
  const [studentBudgetInput, setStudentBudgetInput]     = useState(() => String(getStudentBudget() || ""));

  const budgetSummary = getBudgetSummary();

  const thisYear = new Date().getFullYear();
  const selectedYear = thisYear;

  useEffect(() => {
    reconcileDonorPaid();
    redistributeJanPayments();
    setDonors(getDonors());
    setPayments(getPayments());
  }, []);

  function openGoalEdit() {
    setGoalForm({ amount: goal.amount, label: goal.label });
    setEditingGoal(true);
  }

  function saveGoal() {
    const updated = { amount: +goalForm.amount || 0, label: goalForm.label || goal.label };
    setTarget(updated);
    setGoal(updated);
    setEditingGoal(false);
  }

  function openNewAccount() {
    setEditingAccount(null);
    setAccountForm({ accountName: "Iskaashi", provider: "", accountNumber: "", phone: "", notes: "" });
  }

  function openEditAccount(acc) {
    setEditingAccount(acc.id);
    setAccountForm({ accountName: acc.accountName, provider: acc.provider, accountNumber: acc.accountNumber, phone: acc.phone, notes: acc.notes });
  }

  function saveAccount() {
    if (!accountForm.provider || !accountForm.accountNumber) return;
    if (editingAccount === null) {
      const added = addDonationAccount(accountForm);
      setAccounts(prev => [...prev, added]);
    } else {
      updateDonationAccount({ ...accountForm, id: editingAccount });
      setAccounts(getDonationAccounts());
    }
    setAccountForm({ accountName: "Iskaashi", provider: "", accountNumber: "", phone: "", notes: "" });
    setManagingAccounts(false);
  }

  function removeAccount(id) {
    deleteDonationAccount(id);
    setAccounts(prev => prev.filter(a => a.id !== id));
  }


  // Filter data by selected year
  const yearDonors   = donors.filter(d => new Date(d.date).getFullYear() === selectedYear);
  const yearPayments = payments.filter(p => new Date(p.date).getFullYear() === selectedYear);

  const totalCommitted = yearDonors.reduce((s, d) => s + d.committed, 0);
  const totalPaid      = yearPayments.reduce((s, p) => s + p.amount, 0);
  const pctCollected   = totalCommitted > 0 ? (totalPaid / totalCommitted) * 100 : 0;
  // Net in account = collected from donors minus what has been paid out to students
  const netInAccount   = totalPaid - (budgetSummary.disbursed || 0);

  // Payment type breakdown for selected year
  const typeBreakdown = Object.entries(
    yearDonors.reduce((acc, d) => {
      acc[d.type] = (acc[d.type] || 0) + d.committed;
      return acc;
    }, {})
  ).map(([type, amount]) => ({ name: PAYMENT_TYPES[type] || type, value: amount }));

  // Donor status breakdown for selected year
  const fullyPaid = yearDonors.filter(d => d.paid >= d.committed && d.committed > 0).length;
  const partial   = yearDonors.filter(d => d.paid > 0 && d.paid < d.committed).length;
  const unpaid    = yearDonors.filter(d => d.paid === 0).length;

  // Cumulative monthly trend — donors registered, committed, and collected
  const isCurrentYear = selectedYear === thisYear;
  let cumDonors = 0, cumCommitted = 0, cumCollected = 0;
  const monthlyTrend = MONTH_NAMES.map((month, i) => {
    const moDonors   = yearDonors.filter(d => new Date(d.date).getMonth() === i);
    const moPayments = yearPayments.filter(p => new Date(p.date).getMonth() === i);
    cumDonors    += moDonors.length;
    cumCommitted += moDonors.reduce((s, d) => s + (d.committed || 0), 0);
    cumCollected += moPayments.reduce((s, p) => s + p.amount, 0);
    return { month, donors: cumDonors, committed: cumCommitted, collected: cumCollected };
  }).filter((_, i) => !isCurrentYear || i <= new Date().getMonth());

  const recentPayments = [...yearPayments]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  const pendingDonors = yearDonors
    .filter(d => d.paid < d.committed)
    .slice(0, 5);

  return (
    <div className="h-full flex flex-col overflow-hidden p-3 gap-2">

      {/* Banner */}
      <div className="flex-shrink-0 bg-gradient-to-r from-emerald-600 to-emerald-800 rounded-2xl px-4 py-3 text-white shadow-lg">
        <div className="flex items-center justify-between gap-4 mb-2">
          <h2 className="text-sm font-bold leading-tight">URURKA HORUMARINTA WAXBARASHADA ISKAASHI</h2>


          <p
            className="text-center font-extrabold tracking-wide flex-shrink-0"
            dir="rtl" lang="ar"
            style={{
              fontSize: "1rem",
              background: "linear-gradient(90deg, #ffffff 0%, #d1fae5 40%, #ffffff 70%, #a7f3d0 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              filter: "drop-shadow(0 0 6px rgba(255,255,255,0.55))",
            }}
          >
            منظمة إسكااشي لتطوير التعليم
          </p>
        </div>
        {/* Hadith — centered, golden shine */}
        <p
          className="text-center font-extrabold tracking-wide w-full"
          dir="rtl" lang="ar"
          style={{
            fontSize: "0.85rem",
            background: "linear-gradient(90deg, #f59e0b 0%, #fef08a 30%, #fbbf24 55%, #fef9c3 75%, #f59e0b 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            filter: "drop-shadow(0 0 8px rgba(251,191,36,0.8)) drop-shadow(0 0 16px rgba(245,158,11,0.5))",
          }}
        >
          ✦ أنا وكافل اليتيم كهاتين في الجنة، وأشار ﷺ بالسبابة والوسطى ✦
        </p>
      </div>

      {/* Stat cards — compact */}
      <div className="flex-shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard compact icon={Users}      label={t("total_donors_label")}    value={yearDonors.length}                      sub={t("reg_contributors")}                                    color="green" />
        <StatCard compact icon={DollarSign} label={t("total_committed_label")} value={`$${totalCommitted.toLocaleString()}`}  sub={t("pledged_amount")}                                      color="blue" />
        <StatCard compact icon={TrendingUp} label={t("collected")}             value={`$${totalPaid.toLocaleString()}`}       sub={t("pct_of_committed", { pct: pctCollected.toFixed(0) })}  color="amber" trend={pctCollected} />
        <StatCard compact icon={CreditCard} label="Balance in Iskaashi Account" value={`$${netInAccount.toLocaleString()}`}  sub={budgetSummary.disbursed > 0 ? `after $${budgetSummary.disbursed.toLocaleString()} paid to students` : "no student payments yet"} color={netInAccount < 0 ? "red" : "green"} />
      </div>

      {/* Goal tracker — single compact row */}
      <div className="flex-shrink-0 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <div className="w-7 h-7 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <Target className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="flex-shrink-0">
            <p className="font-bold text-gray-800 text-xs leading-tight">{t("fundraising_goal")}</p>
            <p className="text-[10px] text-gray-400 leading-tight">{goal.label}</p>
          </div>
          <div className="flex-1 min-w-0 px-2">
            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
              <div className="h-3 rounded-full relative transition-all duration-700" style={{
                width: `${Math.min(100, goal.amount > 0 ? (totalPaid / goal.amount) * 100 : 0)}%`,
                background: "linear-gradient(90deg, #10b981, #34d399)"
              }}>
                {totalPaid > 0 && (
                  <span className="absolute right-2 top-0 bottom-0 flex items-center text-white text-[9px] font-bold">
                    {goal.amount > 0 ? ((totalPaid / goal.amount) * 100).toFixed(0) : 0}%
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex-shrink-0 text-right">
            <p className="text-sm font-bold text-gray-800 leading-tight">${totalPaid.toLocaleString()} <span className="text-gray-400 text-xs font-normal">/ ${goal.amount.toLocaleString()}</span></p>
            <p className="text-[10px] text-gray-400 leading-tight">
              <span className="text-emerald-600 font-semibold">{t("collected")}: ${totalPaid.toLocaleString()}</span>
              {" · "}
              <span className="text-rose-500 font-semibold">{t("remaining")}: ${Math.max(0, goal.amount - totalPaid).toLocaleString()}</span>
            </p>
          </div>
          {isAdmin && (
            <button onClick={openGoalEdit}
              className="flex-shrink-0 flex items-center gap-1 bg-gradient-to-br from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-white px-2.5 py-1.5 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95">
              <Pencil className="w-3 h-3" />
              <span>{t("set_goal_btn")}</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Financial Summary ──────────────────────────────────── */}
      {(() => {
        const { total, disbursed, remaining, needed, shortfall, paidCount, status } = budgetSummary;
        // % of student fees covered by collected donor money
        const fundedPct = needed > 0 ? Math.min(100, Math.round((total / needed) * 100)) : 0;
        const statusCfg = {
          sufficient: { label: "Fully Funded",        cls: "bg-emerald-100 text-emerald-700" },
          partial:    { label: `${fundedPct}% Funded`, cls: "bg-amber-100 text-amber-700"    },
          negative:   { label: "Overspent",            cls: "bg-rose-100 text-rose-700"      },
          unset:      { label: "No Payments Yet",      cls: "bg-gray-100 text-gray-500"      },
        }[status];
        return (
          <div className="flex-shrink-0 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Header row */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-50">
              <div className="w-6 h-6 bg-violet-50 rounded-lg flex items-center justify-center">
                <DollarSign className="w-3.5 h-3.5 text-violet-500" />
              </div>
              <span className="text-xs font-bold text-gray-800">Student Disbursement Fund</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusCfg.cls}`}>{statusCfg.label}</span>
            </div>

            {/* 4-column: Budget → Collected → Balance → Disbursed */}
            <div className="grid grid-cols-4 divide-x divide-gray-100">

              {/* 1 — Annual Budget (what students need this year) */}
              <div className="px-4 py-3 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
                  <Target className="w-3.5 h-3.5 text-violet-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-gray-400 font-semibold leading-tight">Annual Budget</p>
                  {editingStudentBudget ? (
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-xs text-violet-400 font-bold">$</span>
                      <input
                        type="number" min="0"
                        value={studentBudgetInput}
                        onChange={e => setStudentBudgetInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") {
                            setStudentBudget(+studentBudgetInput || 0);
                            setEditingStudentBudget(false);
                          }
                          if (e.key === "Escape") setEditingStudentBudget(false);
                        }}
                        className="w-24 text-sm font-black text-violet-600 border-b border-violet-300 bg-transparent outline-none"
                        autoFocus
                      />
                      <button onClick={() => { setStudentBudget(+studentBudgetInput || 0); setEditingStudentBudget(false); }}
                        className="text-emerald-500 hover:text-emerald-600"><Save className="w-3 h-3" /></button>
                      <button onClick={() => setEditingStudentBudget(false)}
                        className="text-gray-400 hover:text-gray-600"><X className="w-3 h-3" /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <p className="text-base font-black text-violet-600 leading-tight">${needed.toLocaleString()}</p>
                      {isAdmin && (
                        <button onClick={() => { setStudentBudgetInput(String(needed || "")); setEditingStudentBudget(true); }}
                          className="text-gray-300 hover:text-violet-400 transition"><Pencil className="w-2.5 h-2.5" /></button>
                      )}
                    </div>
                  )}
                  <p className="text-[9px] text-gray-300">total student fees</p>
                </div>
              </div>

              {/* 2 — In Account (collected from donors) */}
              <div className="px-4 py-3 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-semibold leading-tight">In Account</p>
                  <p className="text-base font-black text-emerald-600 leading-tight">${total.toLocaleString()}</p>
                  <p className="text-[9px] text-gray-300">from donors · {fundedPct}% of budget</p>
                </div>
              </div>

              {/* 3 — Balance (remaining after disbursements) */}
              <div className="px-4 py-3 flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${remaining < 0 ? "bg-rose-50" : "bg-blue-50"}`}>
                  <TrendingUp className={`w-3.5 h-3.5 ${remaining < 0 ? "text-rose-500" : "text-blue-500"}`} />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-semibold leading-tight">Balance</p>
                  <p className={`text-base font-black leading-tight ${remaining < 0 ? "text-rose-600" : "text-blue-600"}`}>${remaining.toLocaleString()}</p>
                  <p className="text-[9px] text-gray-300">{remaining < 0 ? "overspent" : "available to disburse"}</p>
                </div>
              </div>

              {/* 4 — Paid to Students */}
              <div className="px-4 py-3 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-500" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-semibold leading-tight">Paid to Students</p>
                  <p className="text-base font-black text-amber-600 leading-tight">${disbursed.toLocaleString()}</p>
                  <p className="text-[9px] text-gray-300">{paidCount} students marked paid</p>
                </div>
              </div>

            </div>

            {/* Progress bar */}
            {needed > 0 && (
              <div className="px-4 pb-3">
                <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                  <div className="h-1.5 rounded-full transition-all duration-700"
                    style={{ width: `${fundedPct}%`, background: status === "negative" ? "#ef4444" : status === "sufficient" ? "linear-gradient(90deg,#10b981,#059669)" : "linear-gradient(90deg,#f59e0b,#d97706)" }} />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[9px] text-gray-400">{fundedPct}% of annual budget collected</span>
                  {shortfall > 0
                    ? <span className="text-[9px] text-amber-500 font-semibold">${shortfall.toLocaleString()} still needed from pending donors</span>
                    : <span className="text-[9px] text-emerald-500 font-semibold">Fully funded ✓</span>
                  }
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Donation Accounts — scrolling ticker */}
      <style>{`
        @keyframes ticker-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes num-blink {
          0%, 48% { opacity: 1; color: #fde68a; }
          50%, 98% { opacity: 0.3; color: #fde68a; }
          100%     { opacity: 1; }
        }
        .ticker-track { animation: ticker-scroll 18s linear infinite; }
        .ticker-track:hover { animation-play-state: paused; }
        .num-blink { animation: num-blink 1.2s step-start infinite; }
      `}</style>

      <div className="flex-shrink-0 flex items-center rounded-xl overflow-hidden shadow-md" style={{ height: "30px", background: "linear-gradient(90deg,#064e3b,#065f46,#064e3b)" }}>

        {/* static label */}
        <div className="flex-shrink-0 flex items-center gap-1.5 px-3 h-full border-r border-emerald-700/60"
          style={{ background: "#043927" }}>
          <CreditCard className="w-3 h-3 text-yellow-300 flex-shrink-0" />
          <span className="text-[9px] font-black uppercase tracking-widest text-yellow-300 whitespace-nowrap">Donate To</span>
        </div>

        {/* scrolling area */}
        <div className="flex-1 overflow-hidden relative h-full flex items-center">
          {accounts.length === 0 ? (
            <span className="text-emerald-400 text-[10px] italic px-3">No accounts added yet.</span>
          ) : (
            <div className="ticker-track flex items-center gap-0 whitespace-nowrap">
              {/* duplicate for seamless loop */}
              {[...accounts, ...accounts].map((acc, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 px-4 text-[11px]">
                  <span className="text-emerald-300 font-bold">{acc.provider}</span>
                  <span className="text-white/30">·</span>
                  <span className="text-white font-semibold">{acc.accountName}</span>
                  <span className="text-white/30">·</span>
                  <span className="num-blink font-mono font-black text-[12px]">{acc.accountNumber}</span>
                  {acc.phone && <>
                    <span className="text-white/30">·</span>
                    <span className="text-emerald-200 text-[10px]">{acc.phone}</span>
                  </>}
                  <span className="text-emerald-700 mx-3">★</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* admin button */}
        {isAdmin && (
          <button onClick={() => { setManagingAccounts(true); openNewAccount(); }}
            className="flex-shrink-0 flex items-center justify-center w-7 h-full border-l border-emerald-700/60 text-emerald-300 hover:text-white hover:bg-emerald-700/40 transition-colors"
            title="Manage accounts">
            <Plus className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Add / Edit Account Modal */}
      {managingAccounts && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between bg-gradient-to-r from-emerald-600 to-emerald-700 px-5 py-4">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-white" />
                <p className="text-white font-bold text-sm">{editingAccount === undefined ? "" : editingAccount === null ? "Add Donation Account" : "Edit Donation Account"}</p>
              </div>
              <button onClick={() => setManagingAccounts(false)} className="text-white/70 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">

              {/* Existing accounts list */}
              {accounts.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Existing Accounts</p>
                  {accounts.map(acc => (
                    <div key={acc.id} className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                      <div>
                        <span className="text-xs font-bold text-emerald-700">{acc.provider}</span>
                        <span className="text-xs text-gray-400 mx-1">·</span>
                        <span className="text-xs text-gray-700">{acc.accountName}</span>
                        <span className="text-xs text-gray-400 mx-1">·</span>
                        <span className="text-xs font-mono text-gray-600">{acc.accountNumber}</span>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => openEditAccount(acc)} className="p-1 hover:text-emerald-600 text-gray-400 transition">
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button onClick={() => removeAccount(acc.id)} className="p-1 hover:text-rose-500 text-gray-400 transition">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                {editingAccount === null ? "Add New Account" : "Edit Account"}
              </p>
              {[
                { field: "accountName",   label: "Account Name",    ph: "e.g. Iskaashi" },
                { field: "provider",      label: "Provider / Bank",  ph: "e.g. AMA, EVC, Zaad, Bank" },
                { field: "accountNumber", label: "Account Number",   ph: "e.g. 30294777" },
                { field: "phone",         label: "Phone (optional)", ph: "e.g. +252 615 57 47 77" },
              ].map(({ field, label, ph }) => (
                <div key={field} className="bg-gray-50 rounded-2xl p-3 border border-gray-100 space-y-1.5">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</label>
                  <input
                    value={accountForm[field]}
                    onChange={e => setAccountForm(f => ({ ...f, [field]: e.target.value }))}
                    className="w-full border border-gray-200 bg-white rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-300 shadow-sm transition"
                    placeholder={ph}
                  />
                </div>
              ))}
              <div className="flex gap-3 pt-1">
                <button onClick={() => setManagingAccounts(false)}
                  className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-2xl font-semibold text-sm hover:bg-gray-50 transition">
                  Cancel
                </button>
                <button onClick={saveAccount}
                  className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white py-2.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all">
                  <Save className="w-4 h-4" /> Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Goal Modal */}
      {editingGoal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-4">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-white" />
                <p className="text-white font-bold text-sm">{t("set_fundraising_target")}</p>
              </div>
              <button onClick={() => setEditingGoal(false)} className="text-white/70 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-100 space-y-2">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t("goal_label")}</label>
                <input
                  value={goalForm.label}
                  onChange={e => setGoalForm(f => ({ ...f, label: e.target.value }))}
                  className="w-full border border-gray-200 bg-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-300 shadow-sm transition"
                  placeholder={t("goal_label_ph", { year: new Date().getFullYear() })}
                />
              </div>
              <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-100 space-y-2">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t("target_amount_label")}</label>
                <input
                  type="number" min="0"
                  value={goalForm.amount}
                  onChange={e => setGoalForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full border border-gray-200 bg-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-300 shadow-sm transition"
                  placeholder={t("target_amount_ph")}
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setEditingGoal(false)}
                  className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-2xl font-semibold text-sm hover:bg-gray-50 transition">
                  {t("cancel")}
                </button>
                <button onClick={saveGoal}
                  className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white py-2.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg hover:shadow-amber-200 active:scale-[0.98] transition-all">
                  <Save className="w-4 h-4" /> {t("save_goal_btn")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Charts + Tables — fills remaining height */}
      <div className="flex-1 min-h-0 flex flex-col gap-2">

        {/* Charts row */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-2">

          {/* Composed chart — 2/3 width */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-3 shadow-sm border border-gray-100 flex flex-col min-h-0">
            <div className="flex-shrink-0 flex items-center justify-between mb-1">
              <h3 className="font-bold text-gray-800 text-sm">Donors & Expected Payments</h3>
              <div className="flex items-center gap-3 text-[10px] font-semibold text-gray-400">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block bg-blue-200"/> Donors</span>
                <span className="flex items-center gap-1"><span className="w-6 h-0.5 inline-block bg-amber-400 border-dashed border-t-2 border-amber-400"/> Committed</span>
                <span className="flex items-center gap-1"><span className="w-6 h-0.5 inline-block bg-emerald-500"/> Collected</span>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyTrend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="committedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="collectedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  {/* Left axis: dollar amounts */}
                  <YAxis yAxisId="amt" tick={{ fontSize: 10 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} width={38} />
                  {/* Right axis: donor count */}
                  <YAxis yAxisId="cnt" orientation="right" tick={{ fontSize: 10 }} width={28} />
                  <Tooltip
                    contentStyle={{ borderRadius: 10, border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.1)", fontSize: 11 }}
                    formatter={(v, name) => name === "Donors" ? [`${v} donors`, name] : [`$${v.toLocaleString()}`, name]}
                  />
                  {/* Donors — bars on right axis */}
                  <Bar yAxisId="cnt" dataKey="donors" name="Donors" fill="#bfdbfe" radius={[3,3,0,0]} barSize={18} />
                  {/* Committed — dashed amber line */}
                  <Area yAxisId="amt" type="monotone" dataKey="committed" name="Committed" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 4" fill="url(#committedGrad)" dot={false} />
                  {/* Collected — solid green line */}
                  <Area yAxisId="amt" type="monotone" dataKey="collected" name="Collected" stroke="#10b981" strokeWidth={2.5} fill="url(#collectedGrad)" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Right column: Pie + Donor status stacked */}
          <div className="flex flex-col gap-2 min-h-0">

            {/* Pie chart */}
            <div className="flex-1 min-h-0 bg-white rounded-2xl p-3 shadow-sm border border-gray-100 flex flex-col">
              <h3 className="flex-shrink-0 font-bold text-gray-800 text-sm mb-1">{t("by_payment_type")}</h3>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={typeBreakdown} cx="50%" cy="50%" innerRadius={35} outerRadius={55}
                      dataKey="value" nameKey="name">
                      {typeBreakdown.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => `$${v}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-shrink-0 space-y-1 mt-1">
                {typeBreakdown.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-gray-500 truncate max-w-[90px]">{item.name}</span>
                    </div>
                    <span className="font-bold text-gray-800">${item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Donor status */}
            <div className="flex-shrink-0 bg-white rounded-2xl p-3 shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-800 text-sm mb-2">{t("donor_payment_status")}</h3>
              <div className="flex justify-around text-center">
                {[
                  { label: t("fully_paid_label"), val: fullyPaid, color: "text-emerald-600", bg: "bg-emerald-50", icon: CheckCircle2 },
                  { label: t("partial_label"),    val: partial,   color: "text-amber-600",   bg: "bg-amber-50",   icon: Clock },
                  { label: t("unpaid_label"),     val: unpaid,    color: "text-rose-600",    bg: "bg-rose-50",    icon: AlertCircle },
                ].map(({ label, val, color, bg, icon: Icon }) => (
                  <div key={label} className="flex flex-col items-center gap-0.5">
                    <div className={`w-8 h-8 ${bg} rounded-xl flex items-center justify-center`}>
                      <Icon className={`w-4 h-4 ${color}`} />
                    </div>
                    <p className={`text-lg font-bold ${color} leading-tight`}>{val}</p>
                    <p className="text-[9px] text-gray-400 leading-tight text-center">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom row — compact fixed height */}
        <div className="flex-shrink-0 grid grid-cols-1 lg:grid-cols-2 gap-2">

          {/* Recent payments */}
          <div className="bg-white rounded-2xl px-4 py-2.5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="font-bold text-gray-800 text-sm">{t("recent_payments_title")}</h3>
              <a href="/payments" className="text-emerald-600 text-xs flex items-center gap-1 hover:underline">
                {t("view_all")} <ArrowRight className="w-3 h-3" />
              </a>
            </div>
            <div className="divide-y divide-gray-50">
              {recentPayments.length === 0 && (
                <p className="text-gray-400 text-xs text-center py-2">{t("no_payments_yet")}</p>
              )}
              {recentPayments.slice(0, 3).map(p => (
                <div key={p.id} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-800 truncate max-w-[160px]">{p.donorName}</p>
                      <p className="text-[10px] text-gray-400">{p.date} · {p.method}</p>
                    </div>
                  </div>
                  <span className="text-emerald-600 font-bold text-xs">${p.amount}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Pending donors */}
          <div className="bg-white rounded-2xl px-4 py-2.5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="font-bold text-gray-800 text-sm">{t("pending_payments_title")}</h3>
              <span className="bg-rose-100 text-rose-600 text-xs font-bold px-2 py-0.5 rounded-full">{pendingDonors.length}</span>
            </div>
            <div className="divide-y divide-gray-50">
              {pendingDonors.length === 0 && (
                <p className="text-gray-400 text-xs text-center py-2">{t("all_donors_paid")}</p>
              )}
              {pendingDonors.slice(0, 3).map(d => (
                <div key={d.id} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-rose-50 flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-800 truncate max-w-[160px]">{d.name}</p>
                      <p className="text-[10px] text-gray-400">{PAYMENT_TYPES[d.type]} · {d.orphans} {t("nav_orphans").toLowerCase()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-rose-500 font-bold text-xs">${d.committed - d.paid}</p>
                    <p className="text-[10px] text-gray-400">{t("due")}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
