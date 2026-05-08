import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import {
  ShieldAlert, X, Trash2, Upload, AlertTriangle,
  CheckCircle2, Users, Baby, CreditCard, FileSpreadsheet,
  Zap, ChevronRight, Shuffle
} from "lucide-react";
import {
  clearAllData,
  getDonors, saveDonors,
  getOrphans, saveOrphans,
  getPayments, savePayments,
  parseCSV
} from "../data/store";

// ─── Column key aliases ───────────────────────────────────────
const pick = (row, ...keys) => {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && String(v).trim() !== "") return String(v).trim();
  }
  return "";
};

const parseAmt = raw =>
  parseFloat(String(raw).replace(/[^0-9.]/g, "")) || 0;

const inferLocation = country => {
  const c = (country || "").toLowerCase().trim();
  return (!c || c === "somalia") ? "local" : "qurbajoog";
};

// ─── Type detection from normalised column keys ───────────────
function detectType(keys) {
  const has = (...ks) => ks.some(k => keys.includes(k));

  const isOrphan  = has("school", "grade", "district", "guardian",
                        "monthlysupport", "monthly_support",
                        "threemonthsupport", "three_month_support");

  const isPayment = has("method", "ref", "txn", "reference") &&
                    has("amount", "baxshay", "paid") &&
                    has("donorname", "donor_name", "donor", "magaca", "name");

  if (isOrphan)  return "orphan";
  if (isPayment) return "payment";
  return "donor";
}

// ─── Parse one sheet into typed rows ─────────────────────────
function parseSheet(rawSheet) {
  const all = XLSX.utils.sheet_to_json(rawSheet, { header: 1, defval: "" });

  // Find header row: the row that has most text-like cells
  const headerKeywords = ["magaca","name","donor","orphan","school","amount","baxshay","committed"];
  let headerIdx = all.findIndex(row =>
    row.some(cell => headerKeywords.includes(String(cell).toLowerCase().trim()))
  );
  if (headerIdx === -1) headerIdx = 0;

  const headers = all[headerIdx].map(h =>
    String(h).toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")
  );

  const dataRows = all.slice(headerIdx + 1)
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => { if (h) obj[h] = String(row[i] ?? "").trim(); });
      return obj;
    })
    .filter(row => Object.values(row).some(v => v !== ""));

  const type = detectType(headers);
  return { type, headers, rows: dataRows };
}

// ─── Map a raw row → typed record ────────────────────────────
function mapDonor(row, i) {
  const base  = Date.now();
  const country = pick(row, "country", "dal", "wadan") || "Somalia";
  return {
    id:        base + i,
    name:      pick(row, "magaca", "name", "full_name", "donor_name", "donor"),
    type:      "EDUCATION",
    committed: parseAmt(pick(row, "committed", "amount", "$")),
    paid:      parseAmt(pick(row, "paid", "baxshay")),
    date:      normalizeDate(pick(row, "date", "taariikhda", "year", "period", "sannad", "muddada") || new Date().toISOString().split("T")[0]),
    phone:     pick(row, "phone", "tel", "tell") || "",
    notes:     pick(row, "notes", "faallo") || "",
    location:  inferLocation(country),
    country,
    frequency: pick(row, "frequency") || "yearly",
  };
}

function mapOrphan(row, i) {
  return {
    id:               Date.now() + i,
    name:             pick(row, "name", "magaca"),
    school:           pick(row, "school", "dugsi") || "",
    grade:            pick(row, "grade", "class", "fasalka") || "",
    district:         pick(row, "district", "degmo", "neighborhood") || "",
    monthlySupport:   parseAmt(pick(row, "monthlysupport", "monthly_support", "monthly")),
    threeMonthSupport:parseAmt(pick(row, "threemonthsupport", "three_month_support")),
    guardian:         pick(row, "guardian", "administrator", "coordinator", "waalidka") || "",
    phone:            pick(row, "phone", "tel") || "",
    notes:            pick(row, "notes") || "",
    donorId:          null,
    status:           pick(row, "status") || "unsponsored",
    age:              +pick(row, "age") || 0,
    gender:           pick(row, "gender") || "male",
    year:             +pick(row, "year") || new Date().getFullYear(),
  };
}

function mapPayment(row, i, donorList) {
  const name   = pick(row, "magaca", "donorname", "donor_name", "donor", "name");
  const amount = parseAmt(pick(row, "baxshay", "paid", "amount", "$"));
  const donor  = donorList.find(d => d.name.toLowerCase() === name.toLowerCase());
  return {
    id:        Date.now() + i + 100000,
    donorId:   donor?.id || null,
    donorName: name,
    amount,
    type:      "EDUCATION",
    date:      normalizeDate(pick(row, "date", "taariikhda", "year", "period", "sannad", "muddada") || new Date().toISOString().split("T")[0]),
    method:    pick(row, "method", "habka") || "Transfer",
    ref:       pick(row, "ref", "txn", "reference") || "",
    notes:     pick(row, "notes") || "",
  };
}

// ─── Known countries for raw detection ───────────────────────
const COUNTRIES = new Set([
  "somalia","usa","uk","united kingdom","united states","canada","australia",
  "norway","sweden","finland","denmark","germany","france","austria","belgium",
  "netherlands","switzerland","italy","spain","uae","qatar","saudi arabia",
  "kenya","ethiopia","djibouti","south africa","egypt","turkey","oman","kuwait",
]);

// ─── Cell content classifiers ─────────────────────────────────
// Somali financial/summary phrases that must never be treated as donor names
const SOMALI_NON_NAMES = new Set([
  // full phrases
  "inta la baxshay","inta dhiman","lacag bixinta","lacag bixinta agoonta",
  "wadarta guud","wadarta lacagta","grand total","sub total","subtotal",
  // single words
  "lacag","lacagta","wadarta","guud","tirada","xisaab","xisaabta",
  "jumlad","muddada","agoonta","bixinta","daryeel","magaca","tiro",
  "faallo","kala sooc","maamul","total","summary","paid","unpaid",
  "balance","amount","name","xisaabta guud","waxbixinta","bixiyay",
  "hadhay","hadhka","kharash","dakhli","kharashka","lacagaha",
]);

const isLikelyName = v => {
  const s = String(v).trim();
  // Normalize: strip arrow decorators (e.g. "-->" in "REER SWEDEN --> ADER CARAAYE")
  const cleaned = s.replace(/--+>?|<--+/g, " ").replace(/\s+/g, " ").trim();
  const lower = cleaned.toLowerCase();
  if (SOMALI_NON_NAMES.has(lower)) return false;
  if (lower.split(/\s+/).some(w => SOMALI_NON_NAMES.has(w))) return false;
  const words = cleaned.split(/\s+/);
  // Allow parentheses for names like "MARYAN GACAL (SHURUKI)" or "ALI JIMALE (JOON)"
  return cleaned.length >= 4 && cleaned.length <= 80 &&
    /^[a-zA-Z\u0600-\u06FF\s\.\-\'\(\)]+$/.test(cleaned) &&
    words.length >= 2 && words.length <= 8;
};
const isLikelyAmount = v => {
  const n = parseFloat(String(v).replace(/[^0-9.]/g, ""));
  return !isNaN(n) && n > 0 && n < 1000000;
};
const isLikelyPhone = v => /^\+?[\d\s\-]{7,15}$/.test(String(v).trim());
const isLikelyDate = v => {
  const s = String(v).trim();
  if (/\d{1,4}[-\/]\d{1,2}[-\/]\d{1,4}/.test(s)) return true;
  if (/^20[0-3]\d$/.test(s)) return true; // year-only: 2020–2030
  if (/^[A-Za-z]{3,9}\s+20[0-3]\d$/.test(s)) return true; // "Jan 2024"
  return false;
};

// Normalise any recognised date string to YYYY-MM-DD
function normalizeDate(v) {
  const s = String(v).trim();
  // Excel serial number (dates between ~2009–2036 are serials 40000–50000)
  const n = Number(s);
  if (!isNaN(n) && n > 40000 && n < 60000) {
    return new Date(Math.round((n - 25569) * 86400000)).toISOString().split("T")[0];
  }
  if (/^20[0-3]\d$/.test(s)) return `${s}-01-01`;
  const monthYear = s.match(/^([A-Za-z]{3,9})\s+(20[0-3]\d)$/);
  if (monthYear) {
    const months = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
    const mo = months[monthYear[1].toLowerCase().slice(0, 3)] || 1;
    return `${monthYear[2]}-${String(mo).padStart(2, "0")}-01`;
  }
  return s;
}
const isLikelyCountry = v => COUNTRIES.has(String(v).toLowerCase().trim());

// ─── Raw row → donor record ───────────────────────────────────
function extractFromRawRow(cells, idx, contextYear = new Date().getFullYear()) {
  const vals = cells.map(c => String(c ?? "").trim()).filter(Boolean);
  if (vals.length < 2) return null;

  let name = "", phone = "", country = "Somalia", amounts = [], date = "";

  vals.forEach(v => {
    if (!name  && isLikelyName(v)) {
      // Store cleaned name — strip arrow decorators like "-->"
      name = v.replace(/--+>?|<--+/g, " ").replace(/\s+/g, " ").trim();
      return;
    }
    // Only treat as a date if it's a full date pattern — year-only values handled by contextYear
    if (!date  && /\d{1,4}[-\/]\d{1,2}[-\/]\d{1,4}/.test(String(v))) { date = v; return; }
    if (!phone && isLikelyPhone(v))   { phone = v; return; }
    if (isLikelyCountry(v))           { country = v; return; }
    if (isLikelyAmount(v)) {
      const n = parseFloat(String(v).replace(/[^0-9.]/g, ""));
      // Skip values that look like years (2020–2030) — they belong to contextYear
      if (n >= 2020 && n <= 2030) return;
      amounts.push(n);
    }
  });

  if (!name) return null;

  // Strip leading row/serial number: a small integer (≤200) followed only by
  // money-like amounts (≥25) is almost certainly the row number, not a donation.
  if (amounts.length >= 2) {
    const first = amounts[0];
    const rest  = amounts.slice(1);
    if (Number.isInteger(first) && first <= 200 && rest.every(a => a >= 25)) {
      amounts.shift();
    }
  }

  const committed = amounts[0] || 25;
  const paid      = amounts[1] || 0;
  const resolvedDate = date ? normalizeDate(date) : `${contextYear}-01-01`;

  return {
    id:        Date.now() + idx + 500000,
    name,
    type:      "EDUCATION",
    committed,
    paid,
    date:      resolvedDate,
    phone,
    notes:     "",
    location:  inferLocation(country),
    country,
    frequency: "yearly",
  };
}

// ─── Main Component ───────────────────────────────────────────
export default function SuperAdminPanel({ onClose }) {
  const [confirmText, setConfirmText] = useState("");
  const [cleared, setCleared]         = useState(false);
  const smartRef = useRef();
  const rawRef   = useRef();

  // Smart import state
  const [preview,   setPreview]   = useState(null);
  const [importing, setImporting] = useState(false);
  const [result,    setResult]    = useState(null);

  // Raw import state
  const [rawPreview,  setRawPreview]  = useState(null);
  const [rawResult,   setRawResult]   = useState(null);

  function handleClearAll() {
    if (confirmText !== "DELETE") return;
    clearAllData();
    setCleared(true);
    setConfirmText("");
    setPreview(null);
    setResult(null);
  }

  function handleRawUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setRawPreview(null);
    setRawResult(null);
    const isExcel = /\.(xlsx|xls)$/i.test(file.name);
    const reader  = new FileReader();

    reader.onload = ev => {
      const wb = XLSX.read(ev.target.result, { type: isExcel ? "array" : "string" });
      const donors = [];

      wb.SheetNames.forEach(sheetName => {
        const all = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: "" });

        // Extract year from sheet name first (e.g. "2024", "2025 payments", "Year 2026")
        const sheetYearMatch = sheetName.match(/20[0-3]\d/);
        let contextYear = sheetYearMatch ? +sheetYearMatch[0] : new Date().getFullYear();

        all.forEach((row) => {
          if (!Array.isArray(row)) return;

          // Also catch inline year-section rows (single cell with a year)
          const nonEmpty = row.map(c => String(c ?? "").trim()).filter(Boolean);
          if (nonEmpty.length === 1 && /^20[0-3]\d$/.test(nonEmpty[0])) {
            contextYear = +nonEmpty[0];
            return;
          }

          const record = extractFromRawRow(row, donors.length, contextYear);
          if (record) donors.push(record);
        });
      });

      // Also extract payments for any donor with paid > 0
      const payments = donors
        .filter(d => d.paid > 0)
        .map((d, i) => ({
          id:        Date.now() + i + 600000,
          donorId:   d.id,
          donorName: d.name,
          amount:    d.paid,
          type:      "ANNUAL",
          date:      d.date,
          method:    "Transfer",
          ref:       "",
          notes:     "",
        }));

      setRawPreview({ donors, payments, filename: file.name });
    };

    isExcel ? reader.readAsArrayBuffer(file) : reader.readAsText(file);
    e.target.value = "";
  }

  function confirmRawImport() {
    if (!rawPreview) return;
    const { donors, payments } = rawPreview;
    if (donors.length > 0)   saveDonors([...getDonors(), ...donors]);
    if (payments.length > 0) {
      const updated = getDonors().map(d => {
        const total = payments.filter(p => p.donorId === d.id).reduce((s, p) => s + p.amount, 0);
        // Use total from payment records as authoritative paid amount (not additive, to prevent double-count)
        return total > 0 ? { ...d, paid: total } : d;
      });
      saveDonors(updated);
      savePayments([...getPayments(), ...payments]);
    }
    setRawResult({ donors: donors.length, payments: payments.length });
    setRawPreview(null);
  }

  function handleSmartUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setPreview(null);
    setResult(null);
    const isExcel = /\.(xlsx|xls)$/i.test(file.name);
    const reader  = new FileReader();

    reader.onload = ev => {
      let sheets = [];

      if (isExcel) {
        const wb = XLSX.read(ev.target.result, { type: "array" });
        sheets = wb.SheetNames.map(n => ({ name: n, sheet: wb.Sheets[n] }));
      } else {
        // CSV — single sheet
        const wb = XLSX.read(ev.target.result, { type: "string" });
        sheets = wb.SheetNames.map(n => ({ name: n, sheet: wb.Sheets[n] }));
      }

      const allDonors   = [];
      const allOrphans  = [];
      const allPayments = [];

      sheets.forEach(({ sheet }) => {
        const { type, rows } = parseSheet(sheet);

        rows.forEach((row, i) => {
          const name = pick(row, "magaca", "name", "donor_name", "donorname", "donor");
          if (!name) return;

          if (type === "orphan") {
            allOrphans.push(mapOrphan(row, allOrphans.length));

          } else if (type === "payment") {
            const amount = parseAmt(pick(row, "baxshay", "paid", "amount", "$"));
            if (amount > 0) allPayments.push(mapPayment(row, allPayments.length, getDonors()));

          } else {
            // donor — also extract payment if baxshay/paid > 0
            const donor  = mapDonor(row, allDonors.length);
            if (donor.name) {
              allDonors.push(donor);
              const paidAmt = parseAmt(pick(row, "baxshay", "paid"));
              if (paidAmt > 0) {
                allPayments.push({
                  id:        Date.now() + allPayments.length + 200000,
                  donorId:   donor.id,
                  donorName: donor.name,
                  amount:    paidAmt,
                  type:      donor.type || "ANNUAL",
                  date:      donor.date,
                  method:    "Transfer",
                  ref:       "",
                  notes:     "",
                });
              }
            }
          }
        });
      });

      setPreview({
        donors:   allDonors,
        orphans:  allOrphans,
        payments: allPayments,
        filename: file.name,
      });
    };

    isExcel ? reader.readAsArrayBuffer(file) : reader.readAsText(file);
    e.target.value = "";
  }

  function confirmImport() {
    if (!preview) return;
    setImporting(true);

    const { donors, orphans, payments } = preview;

    if (donors.length > 0) {
      const existing = getDonors();
      saveDonors([...existing, ...donors]);
    }
    if (orphans.length > 0) {
      const existing = getOrphans();
      saveOrphans([...existing, ...orphans]);
    }
    if (payments.length > 0) {
      const existing = getPayments();
      // Update donor paid totals
      const updatedDonors = getDonors().map(d => {
        const total = payments.filter(p => p.donorId === d.id).reduce((s, p) => s + p.amount, 0);
        return total > 0 ? { ...d, paid: total } : d;
      });
      saveDonors(updatedDonors);
      savePayments([...existing, ...payments]);
    }

    setResult({ donors: donors.length, orphans: orphans.length, payments: payments.length });
    setPreview(null);
    setImporting(false);
  }

  const canDelete = confirmText === "DELETE";

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between bg-gradient-to-r from-purple-700 to-purple-900 px-5 py-4 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">System Control</p>
              <p className="text-purple-300 text-xs">Super Admin Panel</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">

          {/* ── Smart Universal Import ───────────────────────── */}
          <div className="border-2 border-purple-200 rounded-2xl overflow-hidden">
            <div className="bg-purple-50 px-4 py-3 flex items-center gap-2 border-b border-purple-200">
              <Zap className="w-4 h-4 text-purple-600" />
              <p className="text-purple-700 font-bold text-sm">Smart Universal Import</p>
              <span className="ml-auto text-[10px] bg-purple-200 text-purple-700 font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">Super Admin Only</span>
            </div>

            <div className="p-4 space-y-4">
              <p className="text-gray-500 text-xs leading-relaxed">
                Upload any Excel or CSV file — no pre-formatting needed. The system will automatically detect and route <strong>Donors</strong>, <strong>Orphans</strong>, and <strong>Payments</strong> to the correct locations.
              </p>

              {/* Upload zone */}
              <input ref={smartRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleSmartUpload} />
              <button
                onClick={() => smartRef.current?.click()}
                className="w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-purple-300 hover:border-purple-500 bg-purple-50 hover:bg-purple-100 rounded-2xl py-6 transition-all group"
              >
                <FileSpreadsheet className="w-8 h-8 text-purple-400 group-hover:text-purple-600 transition-colors" />
                <p className="text-purple-600 font-bold text-sm">Click to upload Excel or CSV</p>
                <p className="text-purple-400 text-xs">.xlsx · .xls · .csv — any format, any columns</p>
              </button>

              {/* Preview */}
              {preview && (
                <div className="space-y-3">
                  <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                    <p className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-1">
                      <FileSpreadsheet className="w-3 h-3" /> {preview.filename}
                    </p>
                    <div className="space-y-2">
                      {[
                        { icon: Users,      label: "Donors",   count: preview.donors.length,   color: "emerald" },
                        { icon: Baby,       label: "Orphans",  count: preview.orphans.length,  color: "blue"    },
                        { icon: CreditCard, label: "Payments", count: preview.payments.length, color: "amber"   },
                      ].map(({ icon: Icon, label, count, color }) => {
                        const colors = {
                          emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
                          blue:    "bg-blue-50 text-blue-700 border-blue-200",
                          amber:   "bg-amber-50 text-amber-700 border-amber-200",
                        };
                        return (
                          <div key={label} className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-semibold ${colors[color]}`}>
                            <div className="flex items-center gap-1.5">
                              <Icon className="w-3.5 h-3.5" />
                              <span>{label} detected</span>
                            </div>
                            <span className="font-black text-base">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                    {(preview.donors.length + preview.orphans.length + preview.payments.length) === 0 && (
                      <p className="text-center text-gray-400 text-xs py-2">No recognisable data found. Check column headers.</p>
                    )}
                  </div>

                  {(preview.donors.length + preview.orphans.length + preview.payments.length) > 0 && (
                    <button
                      onClick={confirmImport}
                      disabled={importing}
                      className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 disabled:opacity-50 text-white py-2.5 rounded-xl font-bold text-sm transition active:scale-[0.98] shadow-lg"
                    >
                      <ChevronRight className="w-4 h-4" />
                      Confirm & Import All Data
                    </button>
                  )}
                </div>
              )}

              {/* Result */}
              {result && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-1">
                  <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4" /> Import successful
                  </div>
                  <p className="text-emerald-600 text-xs">
                    {result.donors} donors · {result.orphans} orphans · {result.payments} payments saved.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── Raw Unorganised Import ──────────────────────── */}
          <div className="border-2 border-orange-200 rounded-2xl overflow-hidden">
            <div className="bg-orange-50 px-4 py-3 flex items-center gap-2 border-b border-orange-200">
              <Shuffle className="w-4 h-4 text-orange-600" />
              <p className="text-orange-700 font-bold text-sm">Raw / Unorganised Data Import</p>
              <span className="ml-auto text-[10px] bg-orange-200 text-orange-700 font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">Super Admin Only</span>
            </div>

            <div className="p-4 space-y-4">
              <p className="text-gray-500 text-xs leading-relaxed">
                Upload <strong>any messy or unformatted</strong> file — no column headers required. The system scans every cell, detects names, amounts, phones, countries, and dates automatically, then filters and routes each record to the correct location.
              </p>

              <input ref={rawRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleRawUpload} />
              <button
                onClick={() => rawRef.current?.click()}
                className="w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-orange-300 hover:border-orange-500 bg-orange-50 hover:bg-orange-100 rounded-2xl py-6 transition-all group"
              >
                <Shuffle className="w-8 h-8 text-orange-400 group-hover:text-orange-600 transition-colors" />
                <p className="text-orange-600 font-bold text-sm">Upload Raw Unorganised File</p>
                <p className="text-orange-400 text-xs">No formatting needed · system detects everything</p>
              </button>

              {rawPreview && (
                <div className="space-y-3">
                  <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                    <p className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-1">
                      <FileSpreadsheet className="w-3 h-3" /> {rawPreview.filename}
                    </p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-semibold bg-emerald-50 text-emerald-700 border-emerald-200">
                        <div className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /><span>Donors extracted</span></div>
                        <span className="font-black text-base">{rawPreview.donors.length}</span>
                      </div>
                      <div className="flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-semibold bg-amber-50 text-amber-700 border-amber-200">
                        <div className="flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5" /><span>Payments extracted</span></div>
                        <span className="font-black text-base">{rawPreview.payments.length}</span>
                      </div>
                    </div>

                    {/* Sample preview — first 3 donors */}
                    {rawPreview.donors.length > 0 && (
                      <div className="mt-3 space-y-1">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Sample (first 3)</p>
                        {rawPreview.donors.slice(0, 3).map((d, i) => (
                          <div key={i} className="text-[11px] text-gray-600 bg-white border border-gray-100 rounded-lg px-2.5 py-1.5 flex justify-between">
                            <span className="font-semibold truncate max-w-[55%]">{d.name}</span>
                            <span className="text-gray-400">{d.country} · <span className="text-emerald-600 font-bold">${d.committed}</span>{d.paid > 0 && <span className="text-blue-500"> · paid ${d.paid}</span>}</span>
                          </div>
                        ))}
                        {rawPreview.donors.length > 3 && (
                          <p className="text-[10px] text-gray-400 text-center">…and {rawPreview.donors.length - 3} more</p>
                        )}
                      </div>
                    )}

                    {rawPreview.donors.length === 0 && (
                      <p className="text-center text-gray-400 text-xs py-2 mt-2">No records found. The file may be empty or unreadable.</p>
                    )}
                  </div>

                  {rawPreview.donors.length > 0 && (
                    <button
                      onClick={confirmRawImport}
                      className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white py-2.5 rounded-xl font-bold text-sm transition active:scale-[0.98] shadow-lg"
                    >
                      <ChevronRight className="w-4 h-4" />
                      Confirm & Save Extracted Data
                    </button>
                  )}
                </div>
              )}

              {rawResult && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-1">
                  <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4" /> Raw import successful
                  </div>
                  <p className="text-emerald-600 text-xs">
                    {rawResult.donors} donors · {rawResult.payments} payments saved.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── Danger Zone ─────────────────────────────────── */}
          <div className="border-2 border-rose-200 rounded-2xl overflow-hidden">
            <div className="bg-rose-50 px-4 py-3 flex items-center gap-2 border-b border-rose-200">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <p className="text-rose-700 font-bold text-sm">Danger Zone — Clear All Data</p>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-gray-500 text-xs leading-relaxed">
                Permanently deletes <strong>all donors, orphans, and payments</strong>. Type <span className="font-mono font-bold text-rose-600">DELETE</span> to confirm.
              </p>
              {cleared && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl px-3 py-2">
                  <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                  All data cleared successfully.
                </div>
              )}
              <input
                type="text"
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                placeholder='Type "DELETE" to confirm'
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-rose-300 font-mono"
              />
              <button
                onClick={handleClearAll}
                disabled={!canDelete}
                className="w-full flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-bold text-sm transition active:scale-[0.98]"
              >
                <Trash2 className="w-4 h-4" /> Clear All Data
              </button>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-gray-100 px-5 py-3">
          <button onClick={onClose}
            className="w-full border border-gray-200 text-gray-600 py-2.5 rounded-xl font-semibold text-sm hover:bg-gray-50 transition">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
