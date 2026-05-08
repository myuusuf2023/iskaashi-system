import { useState, useEffect, useRef } from "react";
import html2canvas from "html2canvas";
import * as XLSX from "xlsx";
import {
  PieChart, Pie, Cell,
  Tooltip, ResponsiveContainer
} from "recharts";
import {
  GraduationCap, Search, UserPlus, Pencil, Trash2, X, Save,
  Upload, Download, CheckCircle2, MapPin, School,
  Users, DollarSign, ChevronRight, CreditCard, ImageDown
} from "lucide-react";
import {
  getOrphans, addOrphan, updateOrphan, deleteOrphan, importOrphans,
  parseCSV, DISTRICTS, markStudentPaid, markStudentUnpaid, getBudgetSummary
} from "../data/store";
import { useAuth } from "../context/AuthContext";

const COLORS = ["#10b981","#3b82f6","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#ec4899","#84cc16"];
const SCHOOL_COLORS     = ["#3b82f6","#60a5fa","#1d4ed8","#2563eb","#93c5fd","#1e40af","#bfdbfe","#172554"];
const UNIVERSITY_COLORS = ["#8b5cf6","#a78bfa","#6d28d9","#7c3aed","#c4b5fd","#5b21b6","#ddd6fe","#2e1065"];

const ENROLLMENT_STATUSES = {
  active:     { label: "Active",           color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  new:        { label: "New",              color: "bg-blue-100 text-blue-700",       dot: "bg-blue-500" },
  assessment: { label: "Under Assessment", color: "bg-amber-100 text-amber-700",    dot: "bg-amber-500" },
  dropout:    { label: "Dropout",          color: "bg-rose-100 text-rose-700",       dot: "bg-rose-500" },
  family:     { label: "Family Sponsored", color: "bg-teal-100 text-teal-700",       dot: "bg-teal-500" },
};

const LEVELS = {
  school:     { label: "School",     icon: "🏫", color: "bg-blue-50 text-blue-700 border-blue-200",    dot: "bg-blue-500"   },
  university: { label: "University", icon: "🎓", color: "bg-violet-50 text-violet-700 border-violet-200", dot: "bg-violet-500" },
};

const EMPTY_FORM = {
  name: "", school: "", grade: "", district: "",
  monthlySupport: "", threeMonthSupport: "",
  guardian: "", phone: "", notes: "",
  enrollmentStatus: "active",
  level: "school",
  age: "", gender: "male", donorId: null, status: "unsponsored",
  year: new Date().getFullYear()
};

// ─── Mini stat card ───────────────────────────────────────────
function KPI({ icon: Icon, label, value, sub, color, bg }) {
  return (
    <div className={`${bg} rounded-2xl p-4 border border-white/60 shadow-sm flex items-start gap-3`}>
      <div className={`w-10 h-10 ${color} bg-white/70 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-black text-gray-800 leading-tight">{value}</p>
        <p className="text-xs font-semibold text-gray-600 leading-tight">{label}</p>
        {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function Orphans() {
  const { isAdmin, isSuperAdmin } = useAuth();
  const [orphans, setOrphans]     = useState([]);
  const [search,  setSearch]      = useState("");
  const [filterLevel,           setFilterLevel]     = useState("ALL");
  const [filterDistrict,        setDistrict]        = useState("ALL");
  const [filterSchool,          setSchool]          = useState("ALL");
  const [filterEnrollment,      setFilterEnrollment] = useState("ALL");
  const [showModal,  setShowModal]  = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [confirmDelete,     setConfirmDelete]     = useState(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [selected,   setSelected]   = useState(new Set());
  const [importResult, setImportResult] = useState(null);
  const [activeTab,     setActiveTab]     = useState("list"); // "list" | "analytics"
  const [analyticsLevel, setAnalyticsLevel] = useState("ALL"); // "ALL" | "school" | "university"
  const fileRef         = useRef();
  const [budgetSummary, setBudgetSummaryState] = useState(() => getBudgetSummary());
  const refreshBudget   = () => setBudgetSummaryState(getBudgetSummary());
  const refCoverage     = useRef();
  const refDistrict     = useRef();
  const refEnrollment   = useRef();
  const refFundSummary  = useRef();
  const refInstitution  = useRef();
  const refAllCharts    = useRef();

  async function downloadChart(ref, filename) {
    if (!ref.current) return;
    const canvas = await html2canvas(ref.current, { backgroundColor: "#ffffff", scale: 2, useCORS: true, logging: false });
    const link = document.createElement("a");
    link.download = `${filename}-${analyticsLevel}-${new Date().getFullYear()}.jpg`;
    link.href = canvas.toDataURL("image/jpeg", 0.95);
    link.click();
  }

  const reload = () => {
    const all = getOrphans();
    const seen = new Set();
    setOrphans(all.filter(o => {
      const key = (o.name || "").toLowerCase().trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }));
  };
  useEffect(() => { reload(); }, []);

  // ── analytics pool — respects analyticsLevel switcher ────────
  const schoolStudents     = orphans.filter(o => !o.level || o.level === "school");
  const universityStudents = orphans.filter(o => o.level === "university");
  const aPool = analyticsLevel === "school"     ? schoolStudents
              : analyticsLevel === "university"  ? universityStudents
              : orphans;

  const totalMonthly   = aPool.reduce((s, o) => s + (o.monthlySupport || 0), 0);
  const total3Month    = aPool.reduce((s, o) => s + (o.threeMonthSupport || 0), 0);
  const withSupport    = analyticsLevel === "university"
    ? aPool.filter(o => (o.threeMonthSupport || 0) > 0).length
    : aPool.filter(o => (o.monthlySupport || 0) > 0 || (o.threeMonthSupport || 0) > 0).length;
  const withoutSupport = aPool.length - withSupport;

  const enrollmentCounts = {
    active:     aPool.filter(o => !o.enrollmentStatus || o.enrollmentStatus === "active").length,
    new:        aPool.filter(o => o.enrollmentStatus === "new").length,
    assessment: aPool.filter(o => o.enrollmentStatus === "assessment").length,
    dropout:    aPool.filter(o => o.enrollmentStatus === "dropout").length,
    family:     aPool.filter(o => o.enrollmentStatus === "family").length,
  };

  const levelPool       = filterLevel === "ALL" ? orphans : orphans.filter(o => (o.level || "school") === filterLevel);
  const schools         = Array.from(new Set(levelPool.map(o => o.school).filter(Boolean)));
  const activeDistricts = Array.from(new Set(levelPool.map(o => o.district).filter(Boolean)));

  const aPoolSchools = Array.from(new Set(aPool.map(o => o.school).filter(Boolean)));
  const bySchool = aPoolSchools.map(s => ({
    name: s.length > 18 ? s.slice(0, 18) + "…" : s,
    fullName: s,
    students: aPool.filter(o => o.school === s).length,
    monthly:  aPool.filter(o => o.school === s).reduce((sum, o) => sum + ((o.monthlySupport || 0) || (o.threeMonthSupport || 0)), 0),
  })).sort((a, b) => b.students - a.students);

  const byDistrict = Array.from(new Set(aPool.map(o => o.district).filter(Boolean)))
    .map(d => ({ name: d, value: aPool.filter(o => o.district === d).length }))
    .filter(d => d.value > 0);

  const supportData = [
    { name: "With Monthly Support", value: withSupport,    fill: "#10b981" },
    { name: "No Support Yet",       value: withoutSupport, fill: "#e5e7eb" },
  ];

  // ── filters ──────────────────────────────────────────────────
  const filtered = orphans.filter(o => {
    const q = search.toLowerCase();
    if (q && !o.name.toLowerCase().includes(q) &&
             !(o.school   || "").toLowerCase().includes(q) &&
             !(o.guardian || "").toLowerCase().includes(q)) return false;
    if (filterLevel      !== "ALL" && (o.level || "school") !== filterLevel) return false;
    if (filterDistrict   !== "ALL" && o.district !== filterDistrict) return false;
    if (filterSchool     !== "ALL" && o.school   !== filterSchool)   return false;
    if (filterEnrollment !== "ALL" && (o.enrollmentStatus || "active") !== filterEnrollment) return false;
    return true;
  });

  const allSelected = filtered.length > 0 && filtered.every(o => selected.has(o.id));

  function toggleSelect(id) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAll() {
    if (allSelected) setSelected(prev => { const n = new Set(prev); filtered.forEach(o => n.delete(o.id)); return n; });
    else             setSelected(prev => { const n = new Set(prev); filtered.forEach(o => n.add(o.id));    return n; });
  }
  function deleteSelected() {
    selected.forEach(id => deleteOrphan(id));
    setSelected(new Set()); setConfirmBulkDelete(false); reload();
  }

  function togglePaid(o) {
    if (o.feePaid) markStudentUnpaid(o.id);
    else markStudentPaid(o.id);
    reload();
    refreshBudget();
  }

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setShowModal(true);
  }
  function openEdit(o) {
    setEditing(o.id);
    setForm({ ...EMPTY_FORM, ...o });
    setShowModal(true);
  }

  function handleSubmit(e) {
    e.preventDefault();
    const monthly = +form.monthlySupport || 0;
    const data = {
      ...form,
      monthlySupport:    monthly,
      threeMonthSupport: +form.threeMonthSupport || monthly * 3,
      status: monthly > 0 ? "sponsored" : "unsponsored",
    };
    if (editing) updateOrphan({ ...data, id: editing });
    else addOrphan(data);
    setShowModal(false); reload();
  }

  function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const isExcel = /\.(xlsx|xls)$/i.test(file.name);
    const reader = new FileReader();
    reader.onload = ev => {
      let totalCount = 0;

      if (isExcel) {
        const wb = XLSX.read(ev.target.result, { type: "array" });

        // Detect file-level context once — if ANY sheet says "jaamacad", whole file is university
        const fileLevel = wb.SheetNames.some(sn => /jaamacad/i.test(sn)) ? "university" : "school";

        for (const sheetName of wb.SheetNames) {
          const raw = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: "" });

          const isDropoutSheet = /dropout/i.test(sheetName);
          const contextLevel   = fileLevel; // all sheets in this file share the same level

          // Handle dropout sheet: no real headers, positional [No, Name, Notes, ...]
          if (isDropoutSheet) {
            const dataRows = raw.filter(r => {
              const name = String(r[1] || "").trim();
              return name && !/^(dropout|no\.|magaca)/i.test(name) && isNaN(Number(name));
            });
            const dropRows = dataRows.map(r => ({
              name:             String(r[1] || "").trim(),
              notes:            String(r[2] || "").trim(),
              faahfaahin:       "dropout",
              level:            contextLevel,
              school:           "",
              grade:            "",
            }));
            totalCount += importOrphans(dropRows.filter(r => r.name), contextLevel);
            continue;
          }

          // Find header row
          const hIdx = raw.findIndex(r => r.some(c => /magaca|name/i.test(String(c))));
          if (hIdx === -1) continue;

          const headers = raw[hIdx].map(h =>
            String(h).toLowerCase().trim()
              .replace(/deegaanka[^a-z]*lacagta/,                        "district")
              .replace(/magaca/,                                          "name")
              .replace(/jaamacadda?|university|college|institution/,     "school")
              .replace(/takhasuska?|faculty|major|specialization/,       "grade")
              .replace(/iskuulka|school name/,                           "school")
              .replace(/fasalka|class|grade/,                            "grade")
              .replace(/xaafadda|district/,                              "district")
              .replace(/payment[^a-z]*semester|semester[^a-z]*payment/,  "threemonthsupport")
              .replace(/bishii/,                                          "monthlysupport")
              .replace(/3-bilood|saddex bilood/,                         "threemonthsupport")
              .replace(/maamulka|administrator|coordinator/,             "guardian")
              .replace(/taleefonka|phone|telephone/,                     "phone")
              .replace(/faahfaahin|status|remarks/,                      "faahfaahin")
              .replace(/heerka|level|type/,                              "level")
              .replace(/\s+/g,"_").replace(/[^a-z0-9_]/g,"")
          );

          const rows = raw.slice(hIdx + 1)
            .filter(r => r.some(c => String(c).trim()))
            .map(r => Object.fromEntries(headers.map((h, i) => [h, String(r[i] ?? "").trim()])));

          totalCount += importOrphans(rows.filter(r => r.name), contextLevel);
        }
      } else {
        totalCount = importOrphans(parseCSV(ev.target.result).filter(r => r.name), null);
      }

      setImportResult({ count: totalCount, filename: file.name });
      reload();
    };
    isExcel ? reader.readAsArrayBuffer(file) : reader.readAsText(file);
    e.target.value = "";
  }

  function handleExport() {
    const rows = [
      ["No", "Full Name", "School", "Class/Grade", "District",
       "Monthly ($)", "3-Month ($)", "Administrator", "Phone", "Notes"],
      ...orphans.map((o, i) => [
        i + 1, o.name, o.school || "", o.grade || "", o.district || "",
        o.monthlySupport || 0, o.threeMonthSupport || 0,
        o.guardian || "", o.phone || "", o.notes || ""
      ])
    ];
    const csv  = rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(blob), download: "iskaashi-students.csv"
    }).click();
  }

  function printStudentId(o) {
    const isUni    = o.level === "university";
    const initials = o.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
    const sid      = o.studentId || `ISK-${new Date().getFullYear()}-????`;
    const qr       = encodeURIComponent(sid);
    const instLbl  = isUni ? "UNIVERSITY" : "SCHOOL";
    const gradeLbl = isUni ? "FACULTY" : "GRADE";
    const instIco  = isUni
      ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`
      : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Student ID – ${o.name}</title><style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#c8d0e0;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif}
.card{width:860px;height:540px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,.3);display:flex;flex-direction:column}
.hdr{height:132px;background:#0b2265;position:relative;display:flex;align-items:center;padding:0 28px;flex-shrink:0;overflow:hidden}
.wave{position:absolute;right:0;top:0;height:100%;width:320px}
.logo-row{display:flex;align-items:center;gap:14px;z-index:2;position:relative}
.org .main{font-size:32px;font-weight:900;color:#fff;letter-spacing:2px;line-height:1}
.org .sub{font-size:12px;font-weight:700;color:#f5a623;letter-spacing:1.2px;margin-top:4px}
.org .tag{font-size:11px;color:rgba(255,255,255,.6);margin-top:5px}
.sid-lbl{position:absolute;right:28px;top:50%;transform:translateY(-50%);z-index:3;font-size:22px;font-weight:900;color:#fff;letter-spacing:3px}
.gold{height:4px;background:linear-gradient(to right,#f5a623 65%,#0b2265);flex-shrink:0}
.body{flex:1;display:flex;padding:20px 24px;gap:20px;position:relative;overflow:hidden}
.wm{position:absolute;right:195px;top:50%;transform:translateY(-50%);opacity:.05;pointer-events:none}
.pcol{display:flex;flex-direction:column;align-items:center;gap:10px;flex-shrink:0}
.pbox{width:130px;height:160px;border:3px solid #1a4db5;border-radius:8px;display:flex;align-items:center;justify-content:center;background:#eef2ff}
.pini{font-size:42px;font-weight:900;color:#1a4db5;letter-spacing:-1px}
.sig{text-align:center}
.sig-name{font-size:18px;color:#333;font-style:italic;font-family:Georgia,serif}
.sig-hr{width:130px;height:1px;background:#bbb;margin:5px auto}
.sig-lbl{font-size:7.5px;color:#888;text-transform:uppercase;letter-spacing:.8px}
.icol{flex:1;display:flex;flex-direction:column;justify-content:center;gap:4px}
.sname{font-size:26px;font-weight:900;color:#0b2265;line-height:1.2}
.uline{width:52px;height:2.5px;background:#1a4db5;margin:8px 0 10px}
.idlbl{font-size:9px;font-weight:700;color:#1a4db5;letter-spacing:1.5px;text-transform:uppercase}
.idnum{font-size:26px;font-weight:900;color:#1a4db5;letter-spacing:2.5px;font-family:'Courier New',monospace;margin-bottom:14px}
.irows{display:flex;flex-direction:column;gap:10px}
.irow{display:flex;align-items:flex-start;gap:20px}
.iblock{display:flex;align-items:flex-start;gap:8px}
.iico{width:28px;height:28px;background:#1a4db5;border-radius:6px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.il{font-size:9px;font-weight:700;color:#1a4db5;text-transform:uppercase;letter-spacing:.8px}
.iv{font-size:12px;font-weight:600;color:#1a2035;margin-top:2px;max-width:130px}
.vsep{width:1px;background:#e5e7eb;align-self:stretch;margin:0 4px}
.qcol{flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:6px}
.qbox{border:2px solid #1a4db5;border-radius:10px;padding:7px;background:#fff}
.qlbl{font-size:9px;font-weight:700;color:#1a4db5;letter-spacing:.5px;text-transform:uppercase;text-align:center}
.ftr{height:46px;background:#0b2265;display:flex;align-items:center;justify-content:center;gap:20px;flex-shrink:0}
.fi{display:flex;align-items:center;gap:6px;color:rgba(255,255,255,.85);font-size:10.5px}
.fd{width:1px;height:18px;background:rgba(255,255,255,.2)}
@media print{body{background:#fff;min-height:0}.card{box-shadow:none;width:100%;height:auto;min-height:540px}}
</style></head><body>
<div class="card">
<div class="hdr">
  <svg class="wave" viewBox="0 0 320 132" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
    <path d="M320,0 L320,132 L55,132 Q185,66 55,0 Z" fill="rgba(26,77,181,.55)"/>
    <path d="M320,0 L320,132 L125,132 Q240,66 125,0 Z" fill="rgba(26,77,181,.35)"/>
  </svg>
  <div class="logo-row">
    <svg width="72" height="80" viewBox="0 0 72 80" xmlns="http://www.w3.org/2000/svg">
      <path d="M36,2 L68,14 L68,42 Q68,66 36,78 Q4,66 4,42 L4,14 Z" fill="#1a4db5" stroke="rgba(255,255,255,.25)" stroke-width="1.5"/>
      <path d="M14,26 Q10,34 12,44" stroke="#f5a623" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      <path d="M12,44 Q9,52 13,58" stroke="#f5a623" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      <path d="M58,26 Q62,34 60,44" stroke="#f5a623" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      <path d="M60,44 Q63,52 59,58" stroke="#f5a623" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      <rect x="20" y="28" width="32" height="23" rx="3" fill="white" opacity=".9"/>
      <line x1="36" y1="28" x2="36" y2="51" stroke="#1a4db5" stroke-width="1.5"/>
      <line x1="23" y1="33" x2="34" y2="33" stroke="#1a4db5" stroke-width="1" opacity=".4"/>
      <line x1="23" y1="37" x2="34" y2="37" stroke="#1a4db5" stroke-width="1" opacity=".4"/>
      <line x1="23" y1="41" x2="34" y2="41" stroke="#1a4db5" stroke-width="1" opacity=".4"/>
      <line x1="38" y1="33" x2="49" y2="33" stroke="#1a4db5" stroke-width="1" opacity=".4"/>
      <line x1="38" y1="37" x2="49" y2="37" stroke="#1a4db5" stroke-width="1" opacity=".4"/>
      <line x1="38" y1="41" x2="49" y2="41" stroke="#1a4db5" stroke-width="1" opacity=".4"/>
      <path d="M36,18 Q39,11 36,6 Q33,11 34,15 Q31,10 33,6 Q28,12 32,19" fill="#f5a623" opacity=".95"/>
      <text x="36" y="62" text-anchor="middle" fill="white" font-size="5.5" font-weight="700" letter-spacing=".5" font-family="Arial,sans-serif">ISKAASHI</text>
      <text x="36" y="69" text-anchor="middle" fill="rgba(255,255,255,.6)" font-size="4.5" font-family="Arial,sans-serif">EST. 2024</text>
    </svg>
    <div class="org">
      <div class="main">ISKAASHI</div>
      <div class="sub">URURKA HORUMARINTA WAXBARASHADA</div>
      <div class="tag">Empowering Education, Building Futures</div>
    </div>
  </div>
  <div class="sid-lbl">STUDENT ID</div>
</div>
<div class="gold"></div>
<div class="body">
  <div class="wm">
    <svg width="190" height="210" viewBox="0 0 72 80" xmlns="http://www.w3.org/2000/svg">
      <path d="M36,2 L68,14 L68,42 Q68,66 36,78 Q4,66 4,42 L4,14 Z" fill="#0b2265"/>
      <rect x="20" y="28" width="32" height="23" rx="3" fill="#0b2265"/>
      <line x1="36" y1="28" x2="36" y2="51" stroke="white" stroke-width="1.5" opacity=".3"/>
    </svg>
  </div>
  <div class="pcol">
    <div class="pbox"><span class="pini">${initials}</span></div>
    <div class="sig">
      <div class="sig-name">Iskaashi</div>
      <div class="sig-hr"></div>
      <div class="sig-lbl">Authorized Signature</div>
    </div>
  </div>
  <div class="icol">
    <div class="sname">${o.name.toUpperCase()}</div>
    <div class="uline"></div>
    <div class="idlbl">STUDENT ID</div>
    <div class="idnum">${sid}</div>
    <div class="irows">
      <div class="irow">
        <div class="iblock">
          <div class="iico">${instIco}</div>
          <div>
            <div class="il">${instLbl}</div>
            <div class="iv">${o.school || "—"}</div>
          </div>
        </div>
        <div class="vsep"></div>
        <div>
          <div class="il">${gradeLbl}</div>
          <div class="iv">${o.grade || "—"}</div>
        </div>
      </div>
      <div class="irow">
        <div class="iblock">
          <div class="iico"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg></div>
          <div>
            <div class="il">DISTRICT</div>
            <div class="iv">${o.district || "—"}</div>
          </div>
        </div>
        <div class="vsep"></div>
        <div>
          <div class="il">ACADEMIC YEAR</div>
          <div class="iv">${o.year || new Date().getFullYear()}</div>
        </div>
      </div>
    </div>
  </div>
  <div class="qcol">
    <div class="qbox"><img src="https://api.qrserver.com/v1/create-qr-code/?size=96x96&data=${qr}&color=0b2265&bgcolor=ffffff&qzone=1" width="96" height="96" alt="QR"/></div>
    <div class="qlbl">SCAN TO VERIFY</div>
  </div>
</div>
<div class="ftr">
  <div class="fi"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.8)" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg> www.iskaashi.edu.so</div>
  <div class="fd"></div>
  <div class="fi"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.8)" stroke-width="2" stroke-linecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> info@iskaashi.edu.so</div>
  <div class="fd"></div>
  <div class="fi"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.8)" stroke-width="2" stroke-linecap="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg> +252 615 57 47 77</div>
</div>
</div>
<script>window.onload=function(){window.print()}</script>
</body></html>`;
    const win = window.open("", "_blank", "width=960,height=680");
    win.document.write(html);
    win.document.close();
  }

  return (
    <div className="p-4 md:p-6 space-y-5">

      {/* ── Page header ───────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-rose-500" />
            Student Registry
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Iskaashi Educational Development Org. · {orphans.length} students enrolled
          </p>
        </div>
        <div className="flex gap-2">
          {/* Tab switcher */}
          <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
            {[["list","List"], ["analytics","Analytics"]].map(([tab, label]) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === tab ? "bg-white text-gray-800 shadow" : "text-gray-500 hover:text-gray-700"
                }`}>{label}</button>
            ))}
          </div>
          {isAdmin && (
            <button onClick={openAdd}
              className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-3 py-2 rounded-xl text-xs font-bold shadow transition">
              <UserPlus className="w-3.5 h-3.5" /> Register Student
            </button>
          )}
        </div>
      </div>

      {/* ── KPI row ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI icon={Users}      label="Total Students"    value={orphans.length}           sub="enrolled"                bg="bg-blue-50"    color="text-blue-600" />
        <KPI icon={School}     label="School Students"   value={schoolStudents.length}    sub="primary & secondary"      bg="bg-sky-50"     color="text-sky-600" />
        <KPI icon={GraduationCap} label="University"     value={universityStudents.length} sub="higher education"        bg="bg-violet-50"  color="text-violet-600" />
        <KPI icon={DollarSign} label="Monthly Total"     value={`$${totalMonthly}`}       sub="education support"        bg="bg-emerald-50" color="text-emerald-600" />
      </div>

      {/* ── ANALYTICS TAB ────────────────────────────────────── */}
      {activeTab === "analytics" && (
        <div className="space-y-4">

          {/* Level switcher + Download All */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400 font-semibold">Viewing:</span>
              <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
                {[
                  ["ALL",        "All Students",    `${orphans.length}`],
                  ["school",     "🏫 School",        `${schoolStudents.length}`],
                  ["university", "🎓 University",    `${universityStudents.length}`],
                ].map(([val, lbl, count]) => (
                  <button key={val} onClick={() => setAnalyticsLevel(val)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      analyticsLevel === val ? "bg-white text-gray-800 shadow" : "text-gray-500 hover:text-gray-700"
                    }`}>
                    {lbl} <span className="opacity-50 font-normal">{count}</span>
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => downloadChart(refAllCharts, "analytics-report")}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow transition">
              <ImageDown className="w-3.5 h-3.5" /> Download All
            </button>
          </div>

          {/* All charts — captured together for Download All */}
          <div ref={refAllCharts} className="space-y-4 bg-gray-50 rounded-2xl p-4">

          {/* Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Support status donut */}
            <div ref={refCoverage} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col items-center relative">
              <div className="flex items-start justify-between w-full mb-1">
                <h3 className="font-bold text-gray-800 text-sm">Support Coverage</h3>
                <button onClick={() => downloadChart(refCoverage, "support-coverage")} className="p-1 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition flex-shrink-0" title="Download JPG"><ImageDown className="w-3.5 h-3.5"/></button>
              </div>
              <p className="text-xs text-gray-400 self-start mb-3">Monthly education support status</p>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={supportData} cx="50%" cy="50%" innerRadius={48} outerRadius={68}
                    dataKey="value" startAngle={90} endAngle={-270}>
                    {supportData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <p className="text-3xl font-black text-gray-800 -mt-5">
                {aPool.length > 0 ? Math.round(withSupport / aPool.length * 100) : 0}%
              </p>
              <p className="text-xs text-gray-400 mt-0.5 mb-3">
                {analyticsLevel === "university" ? "receiving semester support" : "receiving monthly support"}
              </p>
              <div className="flex gap-6 text-center w-full justify-around">
                <div>
                  <p className="text-lg font-bold text-emerald-600">{withSupport}</p>
                  <p className="text-[10px] text-gray-400">Supported</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-400">{withoutSupport}</p>
                  <p className="text-[10px] text-gray-400">Pending</p>
                </div>
              </div>
            </div>

            {/* By district */}
            <div ref={refDistrict} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col">
              <div className="flex items-start justify-between mb-0.5">
                <h3 className="font-bold text-gray-800 text-sm">Students by District</h3>
                <button onClick={() => downloadChart(refDistrict, "district-breakdown")} className="p-1 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition flex-shrink-0" title="Download JPG"><ImageDown className="w-3.5 h-3.5"/></button>
              </div>
              <p className="text-xs text-gray-400 mb-3">Geographic distribution · {byDistrict.length} districts</p>
              {byDistrict.length === 0 ? (
                <p className="text-gray-400 text-xs text-center py-8">No district data yet</p>
              ) : (
                <div className="flex gap-3 flex-1">
                  {/* Compact donut — no legend */}
                  <div className="flex-shrink-0 flex items-center justify-center">
                    <ResponsiveContainer width={110} height={110}>
                      <PieChart>
                        <Pie data={byDistrict} cx="50%" cy="50%"
                          innerRadius={30} outerRadius={50}
                          dataKey="value" startAngle={90} endAngle={-270}>
                          {byDistrict.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v, n) => [`${v} students`, n]}
                          contentStyle={{ borderRadius: 10, border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.1)", fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Ranked list */}
                  <div className="flex-1 overflow-y-auto max-h-[200px] space-y-1.5 pr-1
                    scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
                    {[...byDistrict].sort((a, b) => b.value - a.value).map((d, i) => {
                      const max = byDistrict.reduce((m, x) => Math.max(m, x.value), 0);
                      const pct = Math.round(d.value / max * 100);
                      return (
                        <div key={d.name} className="flex items-center gap-2 group">
                          <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                            style={{ background: COLORS[i % COLORS.length] }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center mb-0.5">
                              <span className="text-[11px] font-semibold text-gray-600 truncate">{d.name}</span>
                              <span className="text-[11px] font-black ml-2 flex-shrink-0"
                                style={{ color: COLORS[i % COLORS.length] }}>{d.value}</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-1.5">
                              <div className="h-1.5 rounded-full transition-all duration-500"
                                style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Enrollment status */}
            <div ref={refEnrollment} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-gray-800 text-sm">Enrollment Status</h3>
                  <p className="text-xs text-gray-400">Student programme standing</p>
                </div>
                <button onClick={() => downloadChart(refEnrollment, "enrollment-status")} className="p-1 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition flex-shrink-0" title="Download JPG"><ImageDown className="w-3.5 h-3.5"/></button>
              </div>
              <div className="space-y-3">
                {Object.entries(ENROLLMENT_STATUSES).map(([key, cfg]) => {
                  const count = enrollmentCounts[key] || 0;
                  const pct   = aPool.length > 0 ? Math.round(count / aPool.length * 100) : 0;
                  return (
                    <div key={key}>
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                          <span className="text-xs font-semibold text-gray-600">{cfg.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">{pct}%</span>
                          <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${cfg.color}`}>{count}</span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className={`${cfg.dot} h-2 rounded-full transition-all duration-500`}
                          style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Fund summary — context-aware */}
            <div ref={refFundSummary} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-gray-800 text-sm">
                    {analyticsLevel === "university" ? "University Fund Summary" : "Education Fund Summary"}
                  </h3>
                  <p className="text-xs text-gray-400">
                    {analyticsLevel === "university" ? "Semester fee commitments" : "Support commitment overview"}
                  </p>
                </div>
                <button onClick={() => downloadChart(refFundSummary, "fund-summary")} className="p-1 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition flex-shrink-0" title="Download JPG"><ImageDown className="w-3.5 h-3.5"/></button>
              </div>
              {analyticsLevel === "university" ? (
                // University: semester-based stats
                [
                  { label: "Semester Total",      val: total3Month,  color: "bg-violet-500" },
                  { label: "Avg per Student",      val: aPool.length > 0 ? Math.round(total3Month / aPool.length) : 0, color: "bg-indigo-400" },
                  { label: "Students in Programme", val: aPool.length, color: "bg-fuchsia-400", isDirect: true },
                ].map(({ label, val, color, isDirect }) => (
                  <div key={label}>
                    <div className="flex justify-between text-xs font-semibold text-gray-600 mb-1">
                      <span>{label}</span>
                      <span className="font-black text-gray-800">{isDirect ? val : `$${val.toLocaleString()}`}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5">
                      <div className={`${color} h-2.5 rounded-full`} style={{ width: "100%" }} />
                    </div>
                  </div>
                ))
              ) : (
                // School / All: monthly-based stats
                [
                  { label: "Monthly Support",  val: totalMonthly, color: "bg-emerald-500" },
                  { label: "Quarterly (3-mo)", val: total3Month,  color: "bg-blue-500" },
                  { label: "Per Student Avg",  val: aPool.length > 0 ? Math.round(totalMonthly / aPool.length) : 0, color: "bg-amber-500" },
                ].map(({ label, val, color }) => (
                  <div key={label}>
                    <div className="flex justify-between text-xs font-semibold text-gray-600 mb-1">
                      <span>{label}</span>
                      <span className="font-black text-gray-800">${val.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5">
                      <div className={`${color} h-2.5 rounded-full`} style={{ width: "100%" }} />
                    </div>
                  </div>
                ))
              )}
              <div className="pt-3 border-t border-gray-100 grid grid-cols-3 gap-2">
                <div className={`flex flex-col items-center rounded-xl py-3 px-2 ${analyticsLevel === "university" ? "bg-violet-50" : "bg-indigo-50"}`}>
                  {analyticsLevel === "university"
                    ? <GraduationCap className="w-4 h-4 text-violet-500 mb-1" />
                    : <School className="w-4 h-4 text-indigo-500 mb-1" />}
                  <span className={`text-xl font-black ${analyticsLevel === "university" ? "text-violet-700" : "text-indigo-700"}`}>
                    {aPoolSchools.length}
                  </span>
                  <span className={`text-[10px] font-semibold text-center leading-tight mt-0.5 ${analyticsLevel === "university" ? "text-violet-400" : "text-indigo-400"}`}>
                    {analyticsLevel === "university" ? "Universities" : "Schools Covered"}
                  </span>
                </div>
                <div className="flex flex-col items-center bg-emerald-50 rounded-xl py-3 px-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 mb-1" />
                  <span className="text-xl font-black text-emerald-700">{withSupport}</span>
                  <span className="text-[10px] font-semibold text-emerald-400 text-center leading-tight mt-0.5">
                    {analyticsLevel === "university" ? "With Funding" : "With Support"}
                  </span>
                </div>
                <div className="flex flex-col items-center bg-amber-50 rounded-xl py-3 px-2">
                  <Users className="w-4 h-4 text-amber-500 mb-1" />
                  <span className="text-xl font-black text-amber-700">{withoutSupport}</span>
                  <span className="text-[10px] font-semibold text-amber-400 text-center leading-tight mt-0.5">Pending</span>
                </div>
              </div>
            </div>
          </div>


          {/* Institution breakdown — dot-matrix + donut panel */}
          {bySchool.length > 0 && (
            <div ref={refInstitution} className="bg-gray-950 rounded-2xl overflow-hidden shadow-xl max-w-3xl">
              {/* Header */}
              <div className="px-4 py-3 border-b border-gray-800 flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-white text-sm">
                    {analyticsLevel === "university" ? "University Breakdown" : analyticsLevel === "school" ? "School Breakdown" : "Institution Breakdown"}
                  </h3>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    {analyticsLevel === "ALL" ? (
                      <>
                        <span className="text-blue-400 font-semibold">{schoolStudents.length} school</span>
                        {" · "}
                        <span className="text-violet-400 font-semibold">{universityStudents.length} university</span>
                        {" · each dot = 1 student"}
                      </>
                    ) : analyticsLevel === "university" ? (
                      <span className="text-violet-400 font-semibold">{aPool.length} students · {aPoolSchools.length} universities · each dot = 1 student</span>
                    ) : (
                      <span className="text-blue-400 font-semibold">{aPool.length} students · {aPoolSchools.length} schools · each dot = 1 student</span>
                    )}
                  </p>
                </div>
                <button onClick={() => downloadChart(refInstitution, "institution-breakdown")} className="p-1 hover:bg-gray-800 rounded-lg text-gray-500 hover:text-gray-300 transition flex-shrink-0" title="Download JPG"><ImageDown className="w-3.5 h-3.5"/></button>
              </div>

              <div className="flex">

                {/* Left: dot-matrix rows */}
                <div className="flex-1 px-4 py-3 space-y-2 min-w-0">
                  {(() => {
                    let si = 0, ui = 0, rank = 0;
                    const maxFund = bySchool[0]?.monthly || 1;
                    return bySchool.map((s) => {
                      const pct = Math.round((s.monthly / maxFund) * 100);
                      const isUni = analyticsLevel === "university"
                        || (analyticsLevel === "ALL" && !!aPool.find(o => o.school === s.fullName && o.level === "university"));
                      const color = isUni
                        ? UNIVERSITY_COLORS[(ui++) % UNIVERSITY_COLORS.length]
                        : SCHOOL_COLORS[(si++) % SCHOOL_COLORS.length];
                      rank++;
                      // For university, s.monthly holds threeMonthSupport values (set in bySchool computation)
                      const fundDisplay = s.monthly > 0 ? `$${s.monthly}` : "—";
                      return (
                        <div key={s.fullName} className="flex items-center gap-2 min-w-0">
                          <span className="text-gray-600 text-[10px] w-3 flex-shrink-0 font-mono">{rank}</span>

                          <div className="w-24 flex-shrink-0 flex items-center gap-1">
                            <p className="text-white text-[10px] font-semibold truncate">{s.fullName}</p>
                            <span className={`text-[8px] flex-shrink-0 ${isUni ? "text-violet-400" : "text-blue-400"}`}>
                              {isUni ? "🎓" : "🏫"}
                            </span>
                          </div>

                          <div className="w-20 flex-shrink-0 bg-gray-800 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full transition-all duration-700"
                              style={{ width: `${pct || 8}%`, background: color }} />
                          </div>

                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            {Array.from({ length: Math.min(s.students, 12) }).map((_, j) => (
                              <div key={j} className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                style={{ background: color, opacity: 0.85 }} />
                            ))}
                            {s.students > 12 && (
                              <span className="text-[9px] font-bold ml-0.5" style={{ color }}>+{s.students - 12}</span>
                            )}
                          </div>

                          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
                            <span className="text-[11px] font-black" style={{ color }}>{fundDisplay}</span>
                            <span className="text-gray-600 text-[9px] whitespace-nowrap">{s.students}st</span>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>

                {/* Right: summary + donut */}
                {(() => {
                  const panelColors = analyticsLevel === "university" ? UNIVERSITY_COLORS : analyticsLevel === "school" ? SCHOOL_COLORS : COLORS;
                  const fundLabel   = analyticsLevel === "university" ? "Semester Disbursed" : "Monthly Disbursed";
                  const fundVal     = analyticsLevel === "university" ? total3Month : totalMonthly;
                  const instLabel   = analyticsLevel === "university" ? "universities" : analyticsLevel === "school" ? "schools" : "institutions";
                  return (
                    <div className="lg:w-52 border-t lg:border-t-0 lg:border-l border-gray-800 p-4 flex-shrink-0 space-y-3">
                      <div>
                        <p className="text-gray-500 text-[9px] uppercase tracking-widest font-bold">{fundLabel}</p>
                        <p className="text-white text-2xl font-black mt-0.5">${fundVal.toLocaleString()}</p>
                        <p className="text-gray-600 text-[10px]">across all {instLabel}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-[9px] uppercase tracking-widest font-bold">Total Students</p>
                        <p className="text-white text-2xl font-black mt-0.5">{aPool.length}</p>
                        <p className="text-gray-600 text-[10px]">in {bySchool.length} {instLabel}</p>
                      </div>

                      {/* Donut */}
                      <div>
                        <p className="text-gray-500 text-[9px] uppercase tracking-widest font-bold mb-1">Share by Institution</p>
                        <div className="relative">
                          <ResponsiveContainer width="100%" height={120}>
                            <PieChart>
                              <Pie data={bySchool.slice(0, 8)} cx="50%" cy="50%"
                                innerRadius={32} outerRadius={52}
                                dataKey="students" startAngle={90} endAngle={-270}>
                                {bySchool.slice(0, 8).map((_, i) => (
                                  <Cell key={i} fill={panelColors[i % panelColors.length]} />
                                ))}
                              </Pie>
                              <Tooltip
                                formatter={(v, _n, p) => [`${v} students`, p.payload.fullName]}
                                contentStyle={{ background: "#1f2937", border: "none", borderRadius: 10, color: "#fff", fontSize: 11 }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-white text-lg font-black leading-none">{bySchool.length}</span>
                            <span className="text-gray-500 text-[9px]">{instLabel}</span>
                          </div>
                        </div>

                        {/* Legend */}
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-1.5">
                          {bySchool.slice(0, 8).map((s, i) => (
                            <div key={s.fullName} className="flex items-center gap-1.5 min-w-0">
                              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                style={{ background: panelColors[i % panelColors.length] }} />
                              <span className="text-gray-500 text-[9px] truncate">{s.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}

              </div>
            </div>
          )}

          </div>{/* end refAllCharts */}
        </div>
      )}

      {/* ── LIST TAB ─────────────────────────────────────────── */}
      {activeTab === "list" && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

          {/* Toolbar */}
          <div className="p-3 md:p-4 border-b border-gray-100 space-y-3">
            <div className="flex gap-2 items-center">
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 flex-1 min-w-0">
                <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search name, school, coordinator…" className="bg-transparent text-sm outline-none w-full" />
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {isAdmin && (
                  <>
                    <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleImport} />
                    <button onClick={() => fileRef.current.click()}
                      className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-2.5 py-2 rounded-xl text-xs font-semibold transition">
                      <Upload className="w-3.5 h-3.5" /> Import
                    </button>
                  </>
                )}
                <button onClick={handleExport}
                  className="flex items-center gap-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 px-2.5 py-2 rounded-xl text-xs font-semibold transition">
                  <Download className="w-3.5 h-3.5" /> Export
                </button>
                {isSuperAdmin && selected.size > 0 && (
                  <button onClick={() => setConfirmBulkDelete(true)}
                    className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-3 py-2 rounded-xl text-xs font-semibold shadow transition">
                    <Trash2 className="w-3.5 h-3.5" /> Delete ({selected.size})
                  </button>
                )}
              </div>
            </div>

            {/* Level filter tabs */}
            <div className="flex gap-1.5 bg-gray-100 rounded-xl p-1 w-fit">
              {[["ALL","All"], ["school","🏫 School"], ["university","🎓 University"]].map(([val, lbl]) => (
                <button key={val} onClick={() => { setFilterLevel(val); setDistrict("ALL"); setSchool("ALL"); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    filterLevel === val ? "bg-white text-gray-800 shadow" : "text-gray-500 hover:text-gray-700"
                  }`}>{lbl}
                  <span className="ml-1 text-[10px] font-normal opacity-60">
                    {val === "ALL" ? orphans.length : orphans.filter(o => (o.level || "school") === val).length}
                  </span>
                </button>
              ))}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <select value={filterDistrict} onChange={e => setDistrict(e.target.value)}
                className="flex-1 min-w-[130px] bg-gray-50 border border-gray-200 rounded-xl px-2 py-1.5 text-xs outline-none text-gray-600">
                <option value="ALL">All Districts</option>
                {activeDistricts.map(d => <option key={d}>{d}</option>)}
              </select>
              <select value={filterSchool} onChange={e => setSchool(e.target.value)}
                className="flex-1 min-w-[160px] bg-gray-50 border border-gray-200 rounded-xl px-2 py-1.5 text-xs outline-none text-gray-600">
                <option value="ALL">{filterLevel === "university" ? "All Universities" : filterLevel === "school" ? "All Schools" : "All Institutions"}</option>
                {schools.map(s => <option key={s}>{s}</option>)}
              </select>
              <select value={filterEnrollment} onChange={e => setFilterEnrollment(e.target.value)}
                className="flex-1 min-w-[140px] bg-gray-50 border border-gray-200 rounded-xl px-2 py-1.5 text-xs outline-none text-gray-600">
                <option value="ALL">All Statuses</option>
                {Object.entries(ENROLLMENT_STATUSES).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Import result toast */}
          {importResult && (
            <div className="flex items-center justify-between bg-emerald-50 border-b border-emerald-200 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <p className="text-xs text-emerald-800 font-medium">
                  Imported {importResult.count} students from {importResult.filename}
                </p>
              </div>
              <button onClick={() => setImportResult(null)} className="text-emerald-400 hover:text-emerald-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Budget disbursement banner */}
          {budgetSummary.total > 0 && (
            <div className={`flex flex-wrap items-center gap-4 px-4 py-3 border-b text-xs font-semibold ${
              budgetSummary.status === "negative" ? "bg-rose-50 border-rose-200" :
              budgetSummary.status === "partial"  ? "bg-amber-50 border-amber-200" :
              "bg-emerald-50 border-emerald-200"
            }`}>
              <div className="flex items-center gap-1.5">
                <DollarSign className={`w-3.5 h-3.5 ${budgetSummary.status === "negative" ? "text-rose-500" : budgetSummary.status === "partial" ? "text-amber-500" : "text-emerald-500"}`} />
                <span className="text-gray-500">Collected:</span>
                <span className="text-gray-800 font-black">${budgetSummary.total.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1 text-gray-500">
                <span>Disbursed:</span>
                <span className="text-gray-800 font-black">${budgetSummary.disbursed.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1 text-gray-500">
                <span>Available:</span>
                <span className={`font-black ${budgetSummary.status === "negative" ? "text-rose-600" : "text-emerald-700"}`}>
                  ${budgetSummary.remaining.toLocaleString()}
                </span>
              </div>
              {budgetSummary.shortfall > 0 && (
                <div className="flex items-center gap-1 text-amber-600">
                  <span>Still needed:</span>
                  <span className="font-black">${budgetSummary.shortfall.toLocaleString()}</span>
                </div>
              )}
              <div className="flex items-center gap-1 text-gray-500">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                <span className="text-emerald-700 font-black">{budgetSummary.paidCount}</span>
                <span>students paid</span>
              </div>
            </div>
          )}

          {/* Tables */}
          {filtered.length === 0 && (
            <div className="px-4 py-16 text-center">
              <GraduationCap className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">No students found</p>
            </div>
          )}

          {/* ── School students table ── */}
          {filtered.filter(o => (o.level || "school") === "school").length > 0 && (
            <div className="overflow-x-auto">
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border-y border-blue-100">
                <span className="text-sm">🏫</span>
                <span className="text-[11px] font-black uppercase tracking-widest text-blue-700">School Students</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  {filtered.filter(o => (o.level || "school") === "school").length}
                </span>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {isSuperAdmin && <th className="px-3 py-2.5"><input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-4 h-4 accent-rose-500 cursor-pointer" /></th>}
                    {["No","Full Name","School","Grade","District","Monthly ($)","3-Month ($)","Administrator","Phone","Status",...(isAdmin?["Actions"]:[])].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.filter(o => (o.level || "school") === "school").map((o, i) => (
                    <tr key={o.id} className={`transition-colors ${selected.has(o.id) ? "bg-rose-50" : "hover:bg-gray-50/70"}`}>
                      {isSuperAdmin && <td className="px-3 py-3"><input type="checkbox" checked={selected.has(o.id)} onChange={() => toggleSelect(o.id)} className="w-4 h-4 accent-rose-500 cursor-pointer" /></td>}
                      <td className="px-3 py-3 text-gray-400 font-mono text-xs">{i + 1}</td>
                      <td className="px-3 py-3 min-w-[160px]">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 ${o.feePaid ? "bg-emerald-100" : "bg-blue-100"}`}>
                            <span className={`font-black text-[10px] ${o.feePaid ? "text-emerald-600" : "text-blue-600"}`}>{o.name.split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase()}</span>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-gray-800 text-xs truncate">{o.name}</span>
                              {o.feePaid && <span className="flex-shrink-0 text-[8px] font-black bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full uppercase tracking-wide">Paid</span>}
                            </div>
                            <span className="text-[9px] font-mono text-blue-400">{o.studentId || "—"}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-600 max-w-[140px]"><span className="truncate block" title={o.school}>{o.school || "—"}</span></td>
                      <td className="px-3 py-3">{o.grade ? <span className="bg-purple-50 text-purple-700 text-[10px] font-bold px-2 py-0.5 rounded-lg">{o.grade}</span> : <span className="text-gray-300 text-xs">—</span>}</td>
                      <td className="px-3 py-3">{o.district ? <span className="bg-amber-50 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-lg">{o.district}</span> : <span className="text-gray-300 text-xs">—</span>}</td>
                      <td className="px-3 py-3 text-center">{(o.monthlySupport||0)>0 ? <span className="font-black text-emerald-600">${o.monthlySupport}</span> : <span className="bg-rose-50 text-rose-500 text-[10px] font-bold px-2 py-0.5 rounded-lg">Pending</span>}</td>
                      <td className="px-3 py-3 font-bold text-blue-600 text-center text-xs">${o.threeMonthSupport || 0}</td>
                      <td className="px-3 py-3 text-gray-600 text-xs min-w-[110px]">{o.guardian || "—"}</td>
                      <td className="px-3 py-3 text-gray-500 text-xs whitespace-nowrap">{o.phone || "—"}</td>
                      <td className="px-3 py-3">{(() => { const cfg = ENROLLMENT_STATUSES[o.enrollmentStatus||"active"]||ENROLLMENT_STATUSES.active; return <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg ${cfg.color}`}><div className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}/>{cfg.label}</span>; })()}</td>
                      {isAdmin && <td className="px-3 py-3"><div className="flex gap-1"><button onClick={()=>printStudentId(o)} className="p-1.5 hover:bg-emerald-50 text-emerald-400 hover:text-emerald-600 rounded-lg transition" title="Print ID Card"><CreditCard className="w-3.5 h-3.5"/></button><button onClick={()=>togglePaid(o)} className={`p-1.5 rounded-lg transition ${o.feePaid ? "bg-emerald-100 text-emerald-600 hover:bg-emerald-200" : "hover:bg-gray-100 text-gray-300 hover:text-emerald-500"}`} title={o.feePaid ? "Mark Unpaid" : "Mark Paid"}><CheckCircle2 className="w-3.5 h-3.5"/></button><button onClick={()=>openEdit(o)} className="p-1.5 hover:bg-blue-50 text-blue-400 hover:text-blue-600 rounded-lg transition"><Pencil className="w-3.5 h-3.5"/></button><button onClick={()=>setConfirmDelete(o.id)} className="p-1.5 hover:bg-rose-50 text-rose-400 hover:text-rose-600 rounded-lg transition"><Trash2 className="w-3.5 h-3.5"/></button></div></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── University students table ── */}
          {filtered.filter(o => o.level === "university").length > 0 && (() => {
            const uniStudents = filtered.filter(o => o.level === "university");

            function uniStatus(o) {
              const n = (o.notes || "").toLowerCase();
              if (n.includes("dhameeye") || n.includes("graduated"))  return { key: "graduated", label: "Graduated",        cls: "bg-emerald-50 text-emerald-700" };
              if (n.includes("wareegay") || o.enrollmentStatus === "family")
                                                                       return { key: "family",    label: "Family Sponsored", cls: "bg-teal-50 text-teal-700" };
              if (n.includes("dropout") || o.enrollmentStatus === "dropout")
                                                                       return { key: "dropout",   label: "Dropout",          cls: "bg-rose-50 text-rose-600" };
              const sem = (o.grade || o.notes || "").match(/semester\s*\d+/i);
              if (sem) return { key: "enrolled", label: sem[0].replace(/semester/i, "Semester"), cls: "bg-blue-50 text-blue-700" };
              if (n.includes("hadda") || n.includes("enrolled"))       return { key: "enrolled",  label: "Enrolled",         cls: "bg-blue-50 text-blue-700" };
              return { key: "active", label: "Active", cls: "bg-gray-100 text-gray-600" };
            }

            return (
              <div className="overflow-x-auto border-t border-gray-100">
                <div className="flex items-center gap-2 px-4 py-2 bg-violet-50 border-y border-violet-100">
                  <span className="text-sm">🎓</span>
                  <span className="text-[11px] font-black uppercase tracking-widest text-violet-700">University Students</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">{uniStudents.length}</span>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {isSuperAdmin && <th className="px-3 py-2.5"><input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-4 h-4 accent-violet-500 cursor-pointer"/></th>}
                      {["No","Full Name","Faculty","University","Status","District","Payment per Semester",...(isAdmin?["Actions"]:[])].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {uniStudents.map((o, i) => {
                      const st = uniStatus(o);
                      return (
                        <tr key={o.id} className={`transition-colors ${selected.has(o.id) ? "bg-violet-50" : "hover:bg-gray-50/70"}`}>
                          {isSuperAdmin && <td className="px-3 py-3"><input type="checkbox" checked={selected.has(o.id)} onChange={() => toggleSelect(o.id)} className="w-4 h-4 accent-violet-500 cursor-pointer"/></td>}
                          {/* No */}
                          <td className="px-3 py-3 text-gray-400 font-mono text-xs">{i + 1}</td>
                          {/* Name */}
                          <td className="px-3 py-3 min-w-[160px]">
                            <div className="flex items-center gap-2">
                              <div className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 ${o.feePaid ? "bg-emerald-100" : "bg-violet-100"}`}>
                                <span className={`font-black text-[10px] ${o.feePaid ? "text-emerald-600" : "text-violet-600"}`}>{o.name.split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase()}</span>
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-gray-800 text-xs truncate">{o.name}</span>
                                  {o.feePaid && <span className="flex-shrink-0 text-[8px] font-black bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full uppercase tracking-wide">Paid</span>}
                                </div>
                                <span className="text-[9px] font-mono text-violet-400">{o.studentId || "—"}</span>
                              </div>
                            </div>
                          </td>
                          {/* Faculty */}
                          <td className="px-3 py-3">{o.grade ? <span className="bg-violet-50 text-violet-700 text-[10px] font-semibold px-2 py-0.5 rounded-lg">{o.grade}</span> : <span className="text-gray-300 text-xs">—</span>}</td>
                          {/* University */}
                          <td className="px-3 py-3 text-xs text-gray-700 font-medium max-w-[140px]"><span className="truncate block" title={o.school}>{o.school || "—"}</span></td>
                          {/* Status */}
                          <td className="px-3 py-3">
                            <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-lg ${st.cls}`}>{st.label}</span>
                          </td>
                          {/* District */}
                          <td className="px-3 py-3">{o.district ? <span className="bg-amber-50 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-lg">{o.district}</span> : <span className="text-gray-300 text-xs">—</span>}</td>
                          {/* Per Semester */}
                          {(() => {
                            const amt = (o.threeMonthSupport || 0) || (o.monthlySupport || 0);
                            return (
                              <td className="px-3 py-3 text-center">
                                {amt > 0
                                  ? <span className="font-black text-violet-600">${amt}</span>
                                  : st.key === "graduated"
                                    ? <span className="bg-emerald-50 text-emerald-600 text-[10px] font-bold px-2 py-0.5 rounded-lg">Completed</span>
                                    : st.key === "dropout"
                                      ? <span className="bg-gray-100 text-gray-400 text-[10px] font-bold px-2 py-0.5 rounded-lg">Discontinued</span>
                                      : st.key === "family"
                                        ? <span className="bg-teal-50 text-teal-600 text-[10px] font-bold px-2 py-0.5 rounded-lg">External</span>
                                        : <span className="bg-amber-50 text-amber-500 text-[10px] font-bold px-2 py-0.5 rounded-lg">Pending</span>}
                              </td>
                            );
                          })()}
                          {/* Actions */}
                          {isAdmin && <td className="px-3 py-3"><div className="flex gap-1"><button onClick={()=>printStudentId(o)} className="p-1.5 hover:bg-emerald-50 text-emerald-400 hover:text-emerald-600 rounded-lg transition" title="Print ID Card"><CreditCard className="w-3.5 h-3.5"/></button><button onClick={()=>togglePaid(o)} className={`p-1.5 rounded-lg transition ${o.feePaid ? "bg-emerald-100 text-emerald-600 hover:bg-emerald-200" : "hover:bg-gray-100 text-gray-300 hover:text-emerald-500"}`} title={o.feePaid ? "Mark Unpaid" : "Mark Paid"}><CheckCircle2 className="w-3.5 h-3.5"/></button><button onClick={()=>openEdit(o)} className="p-1.5 hover:bg-violet-50 text-violet-400 hover:text-violet-600 rounded-lg transition"><Pencil className="w-3.5 h-3.5"/></button><button onClick={()=>setConfirmDelete(o.id)} className="p-1.5 hover:bg-rose-50 text-rose-400 hover:text-rose-600 rounded-lg transition"><Trash2 className="w-3.5 h-3.5"/></button></div></td>}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}

          <div className="px-4 py-2.5 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-400">Showing {filtered.length} of {orphans.length} students</p>
          </div>
        </div>
      )}

      {/* ── Registration Modal ───────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">

            {/* Header */}
            <div className={`bg-gradient-to-r ${editing ? "from-blue-600 to-indigo-700" : "from-rose-500 to-pink-600"} px-6 py-5 rounded-t-3xl relative flex-shrink-0`}>
              <button onClick={() => setShowModal(false)}
                className="absolute top-4 right-4 p-1.5 bg-white/20 hover:bg-white/30 rounded-xl transition">
                <X className="w-4 h-4 text-white" />
              </button>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                  <GraduationCap className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-white font-black text-lg leading-tight">
                    {editing ? "Edit Student Record" : "Register New Student"}
                  </h2>
                  <p className="text-white/70 text-xs mt-0.5">Iskaashi Educational Development Org.</p>
                </div>
              </div>
              {/* Progress dots */}
              <div className="flex gap-1.5 mt-4">
                {["Student Info","School Info","Support & Contact"].map((s, i) => (
                  <div key={s} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-white/60" />
                    <span className="text-white/60 text-[10px]">{s}</span>
                    {i < 2 && <ChevronRight className="w-3 h-3 text-white/30" />}
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-4">

              {/* Section 1: Student Info */}
              <div className="rounded-2xl border border-gray-100 overflow-hidden">
                <div className="bg-rose-50 px-4 py-2.5 border-b border-rose-100 flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-rose-500" />
                  <p className="text-xs font-bold text-rose-700 uppercase tracking-widest">Student Information</p>
                </div>
                <div className="p-4 grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5">Full Name <span className="text-rose-500">*</span></label>
                    <input required value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-rose-300 focus:bg-white transition"
                      placeholder="Student full name" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5">Enrollment Status</label>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(ENROLLMENT_STATUSES).map(([key, cfg]) => (
                        <button key={key} type="button"
                          onClick={() => setForm(f => ({ ...f, enrollmentStatus: key }))}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-xs font-bold transition ${
                            form.enrollmentStatus === key
                              ? `border-current ${cfg.color} shadow-sm`
                              : "border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300"
                          }`}>
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${form.enrollmentStatus === key ? cfg.dot : "bg-gray-300"}`} />
                          {cfg.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1.5">Age</label>
                      <input type="number" min="3" max="25" value={form.age}
                        onChange={e => setForm(f => ({ ...f, age: e.target.value }))}
                        className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-rose-300 focus:bg-white transition"
                        placeholder="Age" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1.5">Gender</label>
                      <div className="flex gap-2">
                        {["male","female"].map(g => (
                          <button key={g} type="button"
                            onClick={() => setForm(f => ({ ...f, gender: g }))}
                            className={`flex-1 py-2.5 rounded-xl text-xs font-bold border-2 transition ${
                              form.gender === g
                                ? "border-rose-500 bg-rose-50 text-rose-700"
                                : "border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300"
                            }`}>
                            {g === "male" ? "👦 Male" : "👧 Female"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Institution Info */}
              <div className="rounded-2xl border border-gray-100 overflow-hidden">
                <div className={`px-4 py-2.5 border-b flex items-center gap-2 ${
                  form.level === "university" ? "bg-violet-50 border-violet-100" : "bg-blue-50 border-blue-100"
                }`}>
                  {form.level === "university"
                    ? <GraduationCap className="w-3.5 h-3.5 text-violet-500" />
                    : <School className="w-3.5 h-3.5 text-blue-500" />}
                  <p className={`text-xs font-bold uppercase tracking-widest ${
                    form.level === "university" ? "text-violet-700" : "text-blue-700"
                  }`}>
                    {form.level === "university" ? "University Information" : "School Information"}
                  </p>
                </div>
                <div className="p-4 grid grid-cols-2 gap-3">
                  {/* Level selector */}
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-gray-500 mb-1.5">Education Level</label>
                    <div className="flex gap-2">
                      {Object.entries(LEVELS).map(([key, cfg]) => (
                        <button key={key} type="button"
                          onClick={() => setForm(f => ({ ...f, level: key }))}
                          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-xs font-bold transition ${
                            form.level === key
                              ? `${cfg.color} shadow-sm`
                              : "border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300"
                          }`}>
                          <span>{cfg.icon}</span> {cfg.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-gray-500 mb-1.5">
                      {form.level === "university" ? "University Name" : "School Name"}
                    </label>
                    <input value={form.school}
                      onChange={e => setForm(f => ({ ...f, school: e.target.value }))}
                      className={`w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-2.5 text-sm outline-none focus:bg-white transition ${
                        form.level === "university" ? "focus:ring-2 focus:ring-violet-300" : "focus:ring-2 focus:ring-blue-300"
                      }`}
                      placeholder={form.level === "university" ? "e.g. Benadir University, SIMAD" : "e.g. Benadir Academy, AL-HILAAL"} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5">
                      {form.level === "university" ? "Faculty / Year" : "Class / Grade"}
                    </label>
                    <input value={form.grade}
                      onChange={e => setForm(f => ({ ...f, grade: e.target.value }))}
                      className={`w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-2.5 text-sm outline-none focus:bg-white transition ${
                        form.level === "university" ? "focus:ring-2 focus:ring-violet-300" : "focus:ring-2 focus:ring-blue-300"
                      }`}
                      placeholder={form.level === "university" ? "e.g. Engineering Yr 2, Law Yr 3" : "e.g. Grade 4, Class 2"} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5">District <MapPin className="w-3 h-3 inline ml-1 text-gray-400" /></label>
                    <select value={form.district}
                      onChange={e => setForm(f => ({ ...f, district: e.target.value }))}
                      className={`w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-2.5 text-sm outline-none focus:bg-white transition ${
                        form.level === "university" ? "focus:ring-2 focus:ring-violet-300" : "focus:ring-2 focus:ring-blue-300"
                      }`}>
                      <option value="">Select district…</option>
                      {DISTRICTS.map(d => <option key={d}>{d}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 3: Support & Contact */}
              <div className="rounded-2xl border border-gray-100 overflow-hidden">
                <div className="bg-emerald-50 px-4 py-2.5 border-b border-emerald-100 flex items-center gap-2">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                  <p className="text-xs font-bold text-emerald-700 uppercase tracking-widest">Support & Contact</p>
                </div>
                <div className="p-4 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5">Monthly Support ($)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">$</span>
                      <input type="number" min="0" value={form.monthlySupport}
                        onChange={e => {
                          const v = +e.target.value || 0;
                          setForm(f => ({ ...f, monthlySupport: v, threeMonthSupport: v * 3 }));
                        }}
                        className="w-full border border-gray-200 bg-gray-50 rounded-xl pl-7 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-300 focus:bg-white transition"
                        placeholder="0" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5">3-Month Support ($) <span className="text-gray-300 font-normal">auto</span></label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">$</span>
                      <input type="number" min="0" value={form.threeMonthSupport}
                        onChange={e => setForm(f => ({ ...f, threeMonthSupport: +e.target.value || 0 }))}
                        className="w-full border border-gray-200 bg-gray-50 rounded-xl pl-7 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-300 focus:bg-white transition"
                        placeholder="0" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5">Administrator / Coordinator</label>
                    <input value={form.guardian}
                      onChange={e => setForm(f => ({ ...f, guardian: e.target.value }))}
                      className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-300 focus:bg-white transition"
                      placeholder="e.g. Mr. Nur, Mr. Amiin" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5">Phone Number</label>
                    <input value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-300 focus:bg-white transition"
                      placeholder="+252 61…" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-gray-500 mb-1.5">Notes</label>
                    <textarea rows={2} value={form.notes}
                      onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                      className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-300 focus:bg-white transition resize-none" />
                  </div>
                </div>
              </div>

              {/* Monthly preview */}
              {(+form.monthlySupport > 0) && (
                <div className="bg-gradient-to-r from-emerald-50 to-blue-50 rounded-2xl p-4 border border-emerald-100 flex gap-6">
                  <div className="text-center">
                    <p className="text-2xl font-black text-emerald-700">${+form.monthlySupport}</p>
                    <p className="text-[10px] text-emerald-600 font-semibold">per month</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-black text-blue-700">${+form.threeMonthSupport || (+form.monthlySupport)*3}</p>
                    <p className="text-[10px] text-blue-600 font-semibold">per quarter</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-black text-purple-700">${(+form.monthlySupport) * 12}</p>
                    <p className="text-[10px] text-purple-600 font-semibold">per year</p>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 border-2 border-gray-200 text-gray-600 py-3 rounded-2xl font-bold text-sm hover:bg-gray-50 transition">
                  Cancel
                </button>
                <button type="submit"
                  className={`flex-2 flex-1 bg-gradient-to-r ${editing ? "from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800" : "from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700"} text-white py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all`}>
                  <Save className="w-4 h-4" />
                  {editing ? "Update Record" : "Register Student"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm bulk delete */}
      {confirmBulkDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-gradient-to-r from-rose-500 to-rose-600 px-6 py-5 flex justify-center">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
                <Trash2 className="w-7 h-7 text-white" />
              </div>
            </div>
            <div className="p-6 text-center">
              <h3 className="font-bold text-gray-800 text-lg">Delete {selected.size} Students?</h3>
              <p className="text-gray-500 text-sm mt-2">This cannot be undone.</p>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setConfirmBulkDelete(false)}
                  className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-2xl font-semibold text-sm hover:bg-gray-50 transition">Cancel</button>
                <button onClick={deleteSelected}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-3 rounded-2xl font-bold text-sm shadow-lg active:scale-[0.98] transition-all">Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm single delete */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-gradient-to-r from-rose-500 to-rose-600 px-6 py-5 flex justify-center">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
                <Trash2 className="w-7 h-7 text-white" />
              </div>
            </div>
            <div className="p-6 text-center">
              <h3 className="font-bold text-gray-800 text-lg">Remove Student Record?</h3>
              <p className="text-gray-500 text-sm mt-2">This cannot be undone.</p>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setConfirmDelete(null)}
                  className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-2xl font-semibold text-sm hover:bg-gray-50 transition">Cancel</button>
                <button onClick={() => { deleteOrphan(confirmDelete); setConfirmDelete(null); reload(); }}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-3 rounded-2xl font-bold text-sm shadow-lg active:scale-[0.98] transition-all">Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
