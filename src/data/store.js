const SEED_DONORS   = [];
const SEED_PAYMENTS = [];
const SEED_ORPHANS  = [];

// ─── Historical data (previous years) ────────────────────────
export const HISTORY = [];

// ─── Clear all legacy cached data on load ────────────────────
(function clearLegacyData() {
  ["isk_donors","isk_payments","isk_orphans","isk_history","isk_target"].forEach(k => {
    try {
      const raw = localStorage.getItem(k);
      if (raw) {
        const data = JSON.parse(raw);
        // If array has items from old seed data, wipe it
        if (Array.isArray(data) && data.length > 0 && data[0]?.id && data[0].id < 10000) {
          localStorage.removeItem(k);
        }
      }
    } catch {}
  });
})();

// ─── Auto-fix location based on country ──────────────────────
// Runs once on load to correct any donors imported with wrong location
(function fixDonorLocations() {
  try {
    const raw = localStorage.getItem("isk_donors");
    if (!raw) return;
    const donors = JSON.parse(raw);
    let changed = false;
    const fixed = donors.map(d => {
      const c = (d.country || "").toLowerCase().trim();
      const correct = (!c || c === "somalia") ? "local" : "qurbajoog";
      if (d.location !== correct) { changed = true; return { ...d, location: correct }; }
      return d;
    });
    if (changed) localStorage.setItem("isk_donors", JSON.stringify(fixed));
  } catch {}
})();

// ─── localStorage helpers ─────────────────────────────────────
function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function save(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

// ─── Donors ───────────────────────────────────────────────────
export function getDonors() {
  return load("isk_donors", SEED_DONORS);
}

export function saveDonors(donors) {
  save("isk_donors", donors);
}

export function addDonor(donor) {
  const donors = getDonors();
  const newDonor = { ...donor, id: Date.now() };
  saveDonors([...donors, newDonor]);
  return newDonor;
}

export function updateDonor(updated) {
  const donors = getDonors().map(d => d.id === updated.id ? updated : d);
  saveDonors(donors);
}

export function deleteDonor(id) {
  saveDonors(getDonors().filter(d => d.id !== id));
}

// Import donors from parsed CSV rows: [{name, type, orphans, committed, location, country, frequency, phone, notes}]
function inferLocation(country, explicitLocation) {
  if (explicitLocation && explicitLocation !== "local") return explicitLocation;
  const c = (country || "").toLowerCase().trim();
  return (!c || c === "somalia") ? "local" : "qurbajoog";
}

export function importDonors(rows) {
  const existing = getDonors();
  const newDonors = rows.map((r, i) => {
    const country = r.country || "Somalia";
    return {
      id: Date.now() + i,
      name:      r.name      || "",
      type:      r.type      || "ANNUAL",
      orphans:   +r.orphans  || 1,
      committed: +r.committed || 25,
      paid:      +r.paid     || 0,
      date:      r.date      || new Date().toISOString().split("T")[0],
      phone:     r.phone     || "",
      notes:     r.notes     || "",
      location:  inferLocation(country, r.location),
      country,
      frequency: r.frequency || "yearly",
    };
  });
  saveDonors([...existing, ...newDonors]);
  return newDonors.length;
}

// ─── Payments ─────────────────────────────────────────────────
export function getPayments() {
  return load("isk_payments", SEED_PAYMENTS);
}

export function savePayments(payments) {
  save("isk_payments", payments);
}

export function addPayment(payment) {
  const payments  = getPayments();
  const newPayment = { ...payment, id: Date.now() };
  savePayments([...payments, newPayment]);
  const donor = getDonors().find(d => d.id === payment.donorId);
  if (donor) updateDonor({ ...donor, paid: donor.paid + payment.amount });
  return newPayment;
}

export function deletePayment(id) {
  const payment = getPayments().find(p => p.id === id);
  if (payment) {
    savePayments(getPayments().filter(p => p.id !== id));
    const donor = getDonors().find(d => d.id === payment.donorId);
    if (donor) updateDonor({ ...donor, paid: Math.max(0, donor.paid - payment.amount) });
  }
}

// ─── Orphans ──────────────────────────────────────────────────
export function getOrphans() {
  return load("isk_orphans", SEED_ORPHANS);
}

export function saveOrphans(orphans) {
  save("isk_orphans", orphans);
}

// ─── Student ID generation ────────────────────────────────────
function nextStudentIdNum(existing) {
  const year   = new Date().getFullYear();
  const prefix = `ISK-${year}-`;
  const nums   = existing
    .map(o => o.studentId || "")
    .filter(id => id.startsWith(prefix))
    .map(id => parseInt(id.replace(prefix, ""), 10))
    .filter(n => !isNaN(n));
  return { prefix, num: nums.length > 0 ? Math.max(...nums) + 1 : 1 };
}

export function generateStudentId() {
  const { prefix, num } = nextStudentIdNum(getOrphans());
  return `${prefix}${String(num).padStart(4, "0")}`;
}

export function addOrphan(orphan) {
  const orphans   = getOrphans();
  const studentId = orphan.studentId || generateStudentId();
  const newOrphan = { ...orphan, id: Date.now(), studentId };
  saveOrphans([...orphans, newOrphan]);
  return newOrphan;
}

export function updateOrphan(updated) {
  saveOrphans(getOrphans().map(o => o.id === updated.id ? updated : o));
}

export function deleteOrphan(id) {
  saveOrphans(getOrphans().filter(o => o.id !== id));
}

// Parse raw Faahfaahin/notes text into enrollmentStatus
function parseEnrollmentStatus(raw) {
  const v = String(raw || "").toLowerCase().trim();
  if (v.includes("dropout") || v.includes("drop out")) return "dropout";
  if (v.includes("pending") || v.includes("assessment") || v.includes("under")) return "assessment";
  if (v.includes("new")) return "new";
  // Somali university phrases
  if (v.includes("jaamacad dhameeye"))        return "active";   // graduated
  if (v.includes("jaamacad hadda ku jiraan")) return "active";   // currently enrolled
  if (v.includes("wareegay") || v.includes("sponsored by") || v.includes("family")) return "family"; // family/relative support
  return "active";
}

// Import orphans from parsed CSV rows
// contextLevel: "university" | "school" | null — forced level from sheet name detection
export function importOrphans(rows, contextLevel = null) {
  const existing = getOrphans();
  const { prefix, num: startNum } = nextStudentIdNum(existing);
  let idCounter = startNum;

  // Deduplicate: skip rows whose name already exists in storage or earlier in this batch
  const existingNames = new Set(existing.map(o => (o.name || "").toLowerCase().trim()));
  const batchSeen = new Set();
  const uniqueRows = rows.filter(r => {
    const key = (r.name || "").toLowerCase().trim();
    if (!key || existingNames.has(key) || batchSeen.has(key)) return false;
    batchSeen.add(key);
    return true;
  });

  const newOrphans = uniqueRows.map((r, i) => {
    const rawStatus = r.faahfaahin || r.notes || r.status || r.remarks || "";
    const explicitLevel = (r.level || "").toLowerCase();
    const level = contextLevel
      || (explicitLevel.includes("uni") ? "university" : explicitLevel.includes("school") ? "school" : "school");
    const studentId = `${prefix}${String(idCounter++).padStart(4, "0")}`;
    return {
      id:               Date.now() + i,
      studentId,
      name:             r.name             || "",
      school:           r.school           || "",
      grade:            r.grade            || r.class || r.faculty || "",
      district:         r.district         || r.neighborhood || "",
      monthlySupport:   +r.monthlysupport  || +r.monthly_support  || 0,
      threeMonthSupport: +r.threemonthsupport || +r.three_month_support || +r.payment_per_semester || +r.persemester || 0,
      guardian:         r.guardian         || r.administrator || r.coordinator || "",
      phone:            r.phone            || "",
      notes:            rawStatus,
      enrollmentStatus: parseEnrollmentStatus(rawStatus),
      level,
      donorId:  r.donorid ? +r.donorid : null,
      status:   "unsponsored",
      age:      +r.age  || 0,
      gender:   r.gender || "male",
      year:     +r.year  || new Date().getFullYear(),
    };
  });
  saveOrphans([...existing, ...newOrphans]);
  return newOrphans.length;
}

// ─── Historical Data (stored in localStorage so it can be cleared) ───
export function getHistory() {
  return load("isk_history", HISTORY);
}

export function saveHistory(history) {
  save("isk_history", history);
}

// ─── Donation Accounts ────────────────────────────────────────
const SEED_DONATION_ACCOUNTS = [
  { id: 1, accountName: "Iskaashi", provider: "AMA",  accountNumber: "30294777",       phone: "+252 615 57 47 77", notes: "" },
];

export function getDonationAccounts() {
  return load("isk_donation_accounts", SEED_DONATION_ACCOUNTS);
}

export function saveDonationAccounts(accounts) {
  save("isk_donation_accounts", accounts);
}

export function addDonationAccount(account) {
  const accounts = getDonationAccounts();
  const newAccount = { ...account, id: Date.now() };
  saveDonationAccounts([...accounts, newAccount]);
  return newAccount;
}

export function updateDonationAccount(updated) {
  saveDonationAccounts(getDonationAccounts().map(a => a.id === updated.id ? updated : a));
}

export function deleteDonationAccount(id) {
  saveDonationAccounts(getDonationAccounts().filter(a => a.id !== id));
}

// ─── Education Fund Disbursement Budget ──────────────────────
export function getBudget() {
  return load("isk_fund_budget", { total: 0 });
}

export function setBudget(total) {
  save("isk_fund_budget", { total: +total || 0 });
}

export function markStudentPaid(id) {
  const orphans = getOrphans();
  const o = orphans.find(x => x.id === id);
  if (!o) return;
  const paidAmount = (o.threeMonthSupport || 0) || (o.monthlySupport || 0);
  saveOrphans(orphans.map(x =>
    x.id === id
      ? { ...x, feePaid: true, paidAmount, paidDate: new Date().toISOString().split("T")[0] }
      : x
  ));
}

export function markStudentUnpaid(id) {
  saveOrphans(getOrphans().map(o =>
    o.id === id ? { ...o, feePaid: false, paidAmount: 0, paidDate: null } : o
  ));
}

export function getBudgetSummary() {
  // Fund source = total collected from donors (payments), not a manual budget
  const collected = getPayments().reduce((s, p) => s + (p.amount || 0), 0);
  const orphans   = getOrphans();
  const paid      = orphans.filter(o => o.feePaid);
  const disbursed = paid.reduce((s, o) => s + (o.paidAmount || 0), 0);
  const remaining = collected - disbursed;
  // Annual budget: use manually-set value if admin has entered one, else auto-compute from student records
  const manualBudget = getStudentBudget();
  const needed = manualBudget > 0 ? manualBudget : orphans.reduce((s, o) => {
    const monthly = o.monthlySupport || 0;
    if (monthly > 0) return s + monthly * 12;
    const quarterly = o.threeMonthSupport || 0;
    return s + quarterly * 4;
  }, 0);
  // shortfall = how much more donors need to contribute to fully cover student fees
  const shortfall = Math.max(0, needed - collected);
  return {
    total: collected, disbursed, remaining, needed, shortfall,
    paidCount:    paid.length,
    totalStudents: orphans.length,
    status: collected === 0 ? "unset"
          : disbursed > collected ? "negative"
          : collected >= needed   ? "sufficient"
          : "partial",
  };
}

// ─── One-time: spread Jan-01 default dates across Jan–currentMonth ───
// Redistributes both payments and donor registration dates.
// Runs once per year via localStorage flag. Safe to call on every mount.
function spreadDates(items, defaultDate, maxMo, yr, saveFunc) {
  const bulk = items.filter(x => x.date === defaultDate);
  if (bulk.length < 3) return;
  const perMonth = Math.ceil(bulk.length / (maxMo + 1));
  const bulkIds  = new Set(bulk.map(x => x.id));
  let mo = 0, dayStep = 0, count = 0;
  const updated = items.map(x => {
    if (!bulkIds.has(x.id)) return x;
    if (count > 0 && count % perMonth === 0) { mo = Math.min(mo + 1, maxMo); dayStep = 0; }
    const day = Math.min(5 + dayStep * 5, 28);
    dayStep++; count++;
    return { ...x, date: `${yr}-${String(mo + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}` };
  });
  saveFunc(updated);
}

export function redistributeJanPayments() {
  const yr      = new Date().getFullYear();
  const flagKey = `isk_redate_${yr}`;
  if (localStorage.getItem(flagKey)) return 0;
  const defaultDate = `${yr}-01-01`;
  const maxMo = new Date().getMonth();
  spreadDates(getPayments(), defaultDate, maxMo, yr, savePayments);
  spreadDates(getDonors(),   defaultDate, maxMo, yr, saveDonors);
  localStorage.setItem(flagKey, "1");
  return 1;
}

// ─── Super Admin — Nuke All Data ──────────────────────────────
export function clearAllData() {
  save("isk_donors",   []);
  save("isk_payments", []);
  save("isk_orphans",  []);
  save("isk_history",  []);
  save("isk_donation_accounts", []);
  localStorage.removeItem("isk_target");
  localStorage.removeItem("isk_fund_budget");
}

// ─── Fundraising Target ───────────────────────────────────────
export function getTarget() {
  return load("isk_target", { amount: 3350, label: "Education Fund " + new Date().getFullYear() });
}

export function setTarget(target) {
  save("isk_target", target);
}

// ─── Annual Student Budget (manually set by admin) ────────────
export function getStudentBudget() {
  return Number(localStorage.getItem("isk_student_budget") || 0);
}

export function setStudentBudget(amount) {
  localStorage.setItem("isk_student_budget", String(Number(amount) || 0));
}

// ─── One-time fix: reconcile donor.paid from payment records ──
export function reconcileDonorPaid() {
  const flagKey = "isk_reconcile_paid_v2";
  if (localStorage.getItem(flagKey)) return;
  const payments = getPayments();
  const donors   = getDonors();
  const fixed = donors.map(d => {
    const total = payments.filter(p => p.donorId === d.id).reduce((s, p) => s + p.amount, 0);
    return total > 0 ? { ...d, paid: total } : d;
  });
  saveDonors(fixed);
  localStorage.setItem(flagKey, "1");
}
// Run immediately when module loads — fixes any page, not just Dashboard
reconcileDonorPaid();

// ─── CSV Parsing utility ──────────────────────────────────────
export function parseCSV(text) {
  const lines  = text.trim().split("\n");
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""));
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const values = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
    return Object.fromEntries(headers.map((h, i) => [h, values[i] || ""]));
  });
}

// ─── Constants ────────────────────────────────────────────────
export const TOTAL_ORPHANS = 134;
export const ORPHAN_COST   = 25;

export const PAYMENT_TYPES = {
  EDUCATION: "Education Fund",
};

// Migrate all old type keys → EDUCATION
(function migratePaymentTypes() {
  const oldToNew = {
    ZAKTUL_FIDRI: "EDUCATION",
    SADAQO_WLD:   "EDUCATION",
    SADAQO:       "EDUCATION",
    ZAKAH:        "EDUCATION",
    MONTHLY:      "EDUCATION",
    ANNUAL:       "EDUCATION",
    ONETIME:      "EDUCATION",
    SPONSOR:      "EDUCATION",
    OTHER:        "EDUCATION",
  };
  try {
    const dRaw = localStorage.getItem("isk_donors");
    if (dRaw) {
      const donors  = JSON.parse(dRaw);
      const fixed   = donors.map(d => oldToNew[d.type] ? { ...d, type: oldToNew[d.type] } : d);
      if (fixed.some((d, i) => d.type !== donors[i].type))
        localStorage.setItem("isk_donors", JSON.stringify(fixed));
    }
    const pRaw = localStorage.getItem("isk_payments");
    if (pRaw) {
      const payments = JSON.parse(pRaw);
      const fixed    = payments.map(p => oldToNew[p.type] ? { ...p, type: oldToNew[p.type] } : p);
      if (fixed.some((p, i) => p.type !== payments[i].type))
        localStorage.setItem("isk_payments", JSON.stringify(fixed));
    }
  } catch {}
})();

export const PAYMENT_METHODS = ["Transfer", "Cash", "EVC", "Zaad", "Bank", "Other"];

export const FREQUENCIES = {
  monthly:   "Monthly",
  quarterly: "Quarterly",
  yearly:    "Yearly",
  ramadan:   "Ramadan Only",
  eid:       "Eid Only",
  onetime:   "One-time",
};

export const LOCATIONS = {
  local:     "Local (Somalia)",
  qurbajoog: "Diaspora",
};

export const DISTRICTS = [
  "Abdicasis", "Daru Salam", "Dharkenley", "Garasbaaleey",
  "Heliwa", "Hodan", "Howlwadaag", "Huriwaa", "Jamhuriya",
  "Jiiro Garob", "Kaaraan", "Karaan", "Madina", "Madiino",
  "Marka", "Shalaan-bood", "Shibis", "Suuqbacad",
  "Suuq Xoolaha", "Wadajir", "Wardhigley", "Xamarweyne",
  "Yaqshiid", "Yaqshid", "Other"
];
