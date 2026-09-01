const API = '/api';

async function req(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `API ${method} ${path} → ${res.status}`);
  }
  return res.json();
}

const get  = path        => req('GET',    path);
const post = (path, b)   => req('POST',   path, b);
const put  = (path, b)   => req('PUT',    path, b);
const del  = path        => req('DELETE', path);

// ─── Donors ───────────────────────────────────────────────────
export const getDonors    = ()  => get('/donors');
export const addDonor     = d   => post('/donors', d);
export const updateDonor  = d   => put(`/donors/${d.id}`, d);
export const deleteDonor  = id  => del(`/donors/${id}`);
export const importDonors = rows => post('/donors/import', rows);
export const saveDonors   = donors => put('/bulk/donors', donors);

// ─── Payments ─────────────────────────────────────────────────
export const getPayments   = ()  => get('/payments');
export const addPayment    = p   => post('/payments', p);
export const deletePayment = id  => del(`/payments/${id}`);
export const savePayments  = payments => put('/bulk/payments', payments);

// ─── Orphans ──────────────────────────────────────────────────
export const getOrphans    = ()          => get('/orphans');
export const addOrphan     = o           => post('/orphans', o);
export const updateOrphan  = o           => put(`/orphans/${o.id}`, o);
export const deleteOrphan  = id          => del(`/orphans/${id}`);
export const importOrphans = (rows, ctx) => post('/orphans/import', { rows, contextLevel: ctx ?? null });
export const saveOrphans   = orphans     => put('/bulk/orphans', orphans);
export const markStudentPaid   = id => post(`/orphans/${id}/mark-paid`, {});
export const markStudentUnpaid = id => post(`/orphans/${id}/mark-unpaid`, {});

// ─── Orphan Payments (quarterly/semester fee ledger) ───────────
export const getOrphanPayments   = ()  => get('/orphan-payments');
export const addOrphanPayment    = p   => post('/orphan-payments', p);
export const deleteOrphanPayment = id  => del(`/orphan-payments/${id}`);

// ─── Orphan Support (Eid gifts, clothing, special assistance) ──
export const SUPPORT_TYPES = {
  EID_GIFT:  'Eid Gift',
  CLOTHING:  'Clothing',
  SPECIAL:   'Special Assistance',
  OTHER:     'Other',
};
export const getOrphanSupport    = ()  => get('/orphan-support');
export const addOrphanSupport    = p   => post('/orphan-support', p);
export const deleteOrphanSupport = id  => del(`/orphan-support/${id}`);

// Age is computed from date of birth when known (so eligibility for the
// Under-16 list stays accurate automatically as time passes); falls back to
// the manually-entered age field for older records that predate DOB capture.
export function effectiveAge(o) {
  if (o.dob) {
    const dob = new Date(o.dob);
    if (!isNaN(dob)) {
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const m = today.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
      return age;
    }
  }
  return o.age > 0 ? o.age : null;
}

// ─── Donation Accounts ────────────────────────────────────────
export const getDonationAccounts   = ()  => get('/donation-accounts');
export const addDonationAccount    = a   => post('/donation-accounts', a);
export const updateDonationAccount = a   => put(`/donation-accounts/${a.id}`, a);
export const deleteDonationAccount = id  => del(`/donation-accounts/${id}`);

// ─── Settings ─────────────────────────────────────────────────
export const getTarget = () =>
  get('/settings/isk_target')
    .then(v => v ?? { amount: 3350, label: 'Education Fund ' + new Date().getFullYear() });
export const setTarget = t => post('/settings/isk_target', t);

// ─── Per-charity fundraising goals (Ramadan, Ciidsiinta Agoonta, Other) ──
export const getCharityTarget = type =>
  get(`/settings/isk_target_${type}`)
    .then(v => v ?? { amount: 0, label: (PAYMENT_TYPES[type] || type) + ' ' + new Date().getFullYear() });
export const setCharityTarget = (type, t) => post(`/settings/isk_target_${type}`, t);

export const getStudentBudget = () =>
  get('/settings/isk_student_budget').then(v => Number(v) || 0);
export const setStudentBudget = amount => post('/settings/isk_student_budget', Number(amount) || 0);

// ─── History ──────────────────────────────────────────────────
export const getHistory  = ()      => get('/history');
export const saveHistory = history => post('/history', history);

// ─── Budget Summary ───────────────────────────────────────────
export const getBudgetSummary = () => get('/budget-summary');

// ─── Clear all (Super Admin) ──────────────────────────────────
export const clearAllData = () => post('/clear-all', {});

// ─── No-op legacy helpers (no longer needed with DB) ─────────
export const redistributeJanPayments = () => Promise.resolve(0);
export const reconcileDonorPaid      = () => Promise.resolve();

// ─── CSV parse utility (unchanged) ───────────────────────────
export function parseCSV(text) {
  const lines   = text.trim().split('\n');
  const headers = lines[0].split(',').map(h =>
    h.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''));
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    return Object.fromEntries(headers.map((h, i) => [h, values[i] || '']));
  });
}

// ─── Constants ────────────────────────────────────────────────
export const TOTAL_ORPHANS = 134;
export const ORPHAN_COST   = 25;

export const PAYMENT_TYPES = {
  EDUCATION: 'Education Fund',
  RAMADAN:   'Ramadan',
  EID_ORPHAN: 'Ciidsiinta Agoonta',
  OTHER:     'Other Charity',
};

export const PAYMENT_METHODS = ['Transfer', 'Cash', 'EVC', 'Zaad', 'Bank', 'Other'];

export const FREQUENCIES = {
  monthly:   'Monthly',
  quarterly: 'Quarterly',
  yearly:    'Yearly',
  ramadan:   'Ramadan Only',
  eid:       'Eid Only',
  onetime:   'One-time',
};

export const LOCATIONS = {
  local:     'Local (Somalia)',
  qurbajoog: 'Diaspora',
};

// School students are billed quarterly (Q1-Q4 of a given year); university
// students are billed per semester across an 8-semester program.
export const QUARTER_OPTIONS  = year => [1, 2, 3, 4].map(q => `Q${q} ${year}`);
export const SEMESTER_OPTIONS = Array.from({ length: 8 }, (_, i) => `Semester ${i + 1}`);
export const applicablePeriods = o =>
  o.level === 'university' ? SEMESTER_OPTIONS : QUARTER_OPTIONS(o.year || new Date().getFullYear());

export const DISTRICTS = [
  'Abdicasis', 'Daru Salam', 'Dharkenley', 'Garasbaaleey',
  'Heliwa', 'Hodan', 'Howlwadaag', 'Huriwaa', 'Jamhuriya',
  'Jiiro Garob', 'Kaaraan', 'Karaan', 'Madina', 'Madiino',
  'Marka', 'Shalaan-bood', 'Shibis', 'Suuqbacad',
  'Suuq Xoolaha', 'Wadajir', 'Wardhigley', 'Xamarweyne',
  'Yaqshiid', 'Yaqshid', 'Other',
];
