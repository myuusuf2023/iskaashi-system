import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const db  = new Database(join(__dirname, 'iskaashi.db'));

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ─── Schema ────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS donors (
    id INTEGER PRIMARY KEY,
    name TEXT, type TEXT DEFAULT 'EDUCATION',
    orphans INTEGER DEFAULT 1,
    committed REAL DEFAULT 0, paid REAL DEFAULT 0,
    date TEXT, phone TEXT DEFAULT '', notes TEXT DEFAULT '',
    location TEXT DEFAULT 'local', country TEXT DEFAULT 'Somalia',
    frequency TEXT DEFAULT 'yearly'
  );
  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY,
    donorId INTEGER, donorName TEXT,
    amount REAL DEFAULT 0, type TEXT DEFAULT 'EDUCATION',
    date TEXT, method TEXT DEFAULT 'Transfer',
    ref TEXT DEFAULT '', notes TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS orphans (
    id INTEGER PRIMARY KEY,
    studentId TEXT, name TEXT, school TEXT DEFAULT '',
    grade TEXT DEFAULT '', district TEXT DEFAULT '',
    monthlySupport REAL DEFAULT 0,
    threeMonthSupport REAL DEFAULT 0,
    guardian TEXT DEFAULT '', phone TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    enrollmentStatus TEXT DEFAULT 'active',
    level TEXT DEFAULT 'school',
    donorId INTEGER, status TEXT DEFAULT 'unsponsored',
    age INTEGER DEFAULT 0, gender TEXT DEFAULT 'male',
    year INTEGER,
    feePaid INTEGER DEFAULT 0,
    paidAmount REAL DEFAULT 0, paidDate TEXT,
    period TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS orphan_payments (
    id INTEGER PRIMARY KEY,
    orphanId INTEGER NOT NULL,
    period TEXT NOT NULL,
    amount REAL DEFAULT 0,
    date TEXT,
    notes TEXT DEFAULT ''
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_orphan_payments_unique ON orphan_payments(orphanId, period);
  CREATE TABLE IF NOT EXISTS donation_accounts (
    id INTEGER PRIMARY KEY,
    accountName TEXT, provider TEXT,
    accountNumber TEXT, phone TEXT DEFAULT '', notes TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY, value TEXT
  );
  CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT
  );
`);

// Migrate: add 'period' column to orphans if it doesn't exist yet (older DBs)
if (!db.prepare("PRAGMA table_info(orphans)").all().some(c => c.name === 'period')) {
  db.exec("ALTER TABLE orphans ADD COLUMN period TEXT DEFAULT ''");
}

// Seed default donation account
if (!db.prepare('SELECT 1 FROM donation_accounts LIMIT 1').get()) {
  db.prepare(`INSERT INTO donation_accounts (id, accountName, provider, accountNumber, phone, notes)
    VALUES (1, 'Iskaashi', 'AMA', '30294777', '+252 615 57 47 77', '')`).run();
}

// ─── Helpers ───────────────────────────────────────────────────
function nextStudentId(existing) {
  const yr     = new Date().getFullYear();
  const prefix = `ISK-${yr}-`;
  const nums   = existing
    .map(o => o.studentId || '')
    .filter(id => id.startsWith(prefix))
    .map(id => parseInt(id.replace(prefix, ''), 10))
    .filter(n => !isNaN(n));
  const num = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `${prefix}${String(num).padStart(4, '0')}`;
}

function parseEnrollmentStatus(raw) {
  const v = String(raw || '').toLowerCase().trim();
  if (v.includes('dropout') || v.includes('drop out')) return 'dropout';
  if (v.includes('pending') || v.includes('assessment') || v.includes('under')) return 'assessment';
  if (v.includes('new')) return 'new';
  if (v.includes('jaamacad dhameeye') || v.includes('jaamacad hadda ku jiraan')) return 'active';
  if (v.includes('wareegay') || v.includes('sponsored by') || v.includes('family')) return 'family';
  return 'active';
}

function inferLocation(country) {
  const c = (country || '').toLowerCase().trim();
  return (!c || c === 'somalia') ? 'local' : 'qurbajoog';
}

function boolCol(v) { return v ? 1 : 0; }
function toOrphan(o) { return { ...o, feePaid: !!o.feePaid }; }

// Keep the orphan row's legacy feePaid/paidAmount/paidDate summary fields in sync
// with its quarter-by-quarter payment ledger (orphan_payments), so existing views
// that read those columns (Reports, list badges) stay accurate without change.
function syncOrphanPaidSummary(orphanId) {
  const rows  = db.prepare('SELECT * FROM orphan_payments WHERE orphanId=? ORDER BY date DESC, id DESC').all(orphanId);
  const total = rows.reduce((s, r) => s + (r.amount || 0), 0);
  db.prepare('UPDATE orphans SET feePaid=?, paidAmount=?, paidDate=? WHERE id=?')
    .run(rows.length > 0 ? 1 : 0, total, rows.length > 0 ? rows[0].date : null, orphanId);
}

// ─── Donors ────────────────────────────────────────────────────
app.get('/api/donors', (req, res) => {
  res.json(db.prepare('SELECT * FROM donors ORDER BY id').all());
});

app.post('/api/donors', (req, res) => {
  const d  = req.body;
  const id = d.id || Date.now();
  db.prepare(`INSERT OR REPLACE INTO donors
    (id,name,type,orphans,committed,paid,date,phone,notes,location,country,frequency)
    VALUES (@id,@name,@type,@orphans,@committed,@paid,@date,@phone,@notes,@location,@country,@frequency)`)
    .run({ id, name: d.name || '', type: d.type || 'EDUCATION', orphans: d.orphans || 1,
           committed: d.committed || 0, paid: d.paid || 0,
           date: d.date || new Date().toISOString().split('T')[0],
           phone: d.phone || '', notes: d.notes || '',
           location: d.location || inferLocation(d.country),
           country: d.country || 'Somalia', frequency: d.frequency || 'yearly' });
  res.json({ ...d, id });
});

app.put('/api/donors/:id', (req, res) => {
  const d = req.body;
  db.prepare(`UPDATE donors SET name=@name,type=@type,orphans=@orphans,committed=@committed,
    paid=@paid,date=@date,phone=@phone,notes=@notes,location=@location,
    country=@country,frequency=@frequency WHERE id=@id`)
    .run({ ...d, id: +req.params.id });
  res.json({ ok: true });
});

app.delete('/api/donors/:id', (req, res) => {
  db.prepare('DELETE FROM donors WHERE id=?').run(+req.params.id);
  res.json({ ok: true });
});

// Bulk import donors (append)
app.post('/api/donors/import', (req, res) => {
  const rows   = req.body;
  const insert = db.prepare(`INSERT INTO donors
    (id,name,type,orphans,committed,paid,date,phone,notes,location,country,frequency)
    VALUES (@id,@name,@type,@orphans,@committed,@paid,@date,@phone,@notes,@location,@country,@frequency)`);
  const insertMany = db.transaction(rows => {
    rows.forEach((r, i) => {
      const country = r.country || 'Somalia';
      insert.run({ id: Date.now() + i, name: r.name || '', type: r.type || 'EDUCATION',
        orphans: +r.orphans || 1, committed: +r.committed || 25, paid: +r.paid || 0,
        date: r.date || new Date().toISOString().split('T')[0],
        phone: r.phone || '', notes: r.notes || '',
        location: r.location && r.location !== 'local' ? r.location : inferLocation(country),
        country, frequency: r.frequency || 'yearly' });
    });
  });
  insertMany(rows);
  res.json({ count: rows.length });
});

// ─── Payments ──────────────────────────────────────────────────
app.get('/api/payments', (req, res) => {
  res.json(db.prepare('SELECT * FROM payments ORDER BY date DESC, id DESC').all());
});

app.post('/api/payments', (req, res) => {
  const p  = req.body;
  const id = p.id || Date.now();
  db.prepare(`INSERT OR REPLACE INTO payments
    (id,donorId,donorName,amount,type,date,method,ref,notes)
    VALUES (@id,@donorId,@donorName,@amount,@type,@date,@method,@ref,@notes)`)
    .run({ id, donorId: p.donorId || null, donorName: p.donorName || '',
           amount: p.amount || 0, type: p.type || 'EDUCATION',
           date: p.date || new Date().toISOString().split('T')[0],
           method: p.method || 'Transfer', ref: p.ref || '', notes: p.notes || '' });
  // Update donor paid total — only payments matching the donor's own fund type count,
  // so a payment logged under a different charity (e.g. Ciidsiinta) never inflates
  // another fund's (e.g. Education) donor balance.
  const donor = db.prepare('SELECT * FROM donors WHERE id=?').get(p.donorId);
  if (donor) {
    const total = db.prepare('SELECT COALESCE(SUM(amount),0) as t FROM payments WHERE donorId=? AND COALESCE(type,\'EDUCATION\')=?')
      .get(p.donorId, donor.type || 'EDUCATION').t;
    db.prepare('UPDATE donors SET paid=? WHERE id=?').run(total, p.donorId);
  }
  res.json({ ...p, id });
});

app.delete('/api/payments/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM payments WHERE id=?').get(+req.params.id);
  if (p) {
    db.prepare('DELETE FROM payments WHERE id=?').run(+req.params.id);
    const donor = db.prepare('SELECT * FROM donors WHERE id=?').get(p.donorId);
    if (donor) {
      const total = db.prepare('SELECT COALESCE(SUM(amount),0) as t FROM payments WHERE donorId=? AND COALESCE(type,\'EDUCATION\')=?')
        .get(p.donorId, donor.type || 'EDUCATION').t;
      db.prepare('UPDATE donors SET paid=? WHERE id=?').run(total, p.donorId);
    }
  }
  res.json({ ok: true });
});

// ─── Orphans ───────────────────────────────────────────────────
app.get('/api/orphans', (req, res) => {
  res.json(db.prepare('SELECT * FROM orphans ORDER BY id').all().map(toOrphan));
});

app.post('/api/orphans', (req, res) => {
  const o  = req.body;
  const id = o.id || Date.now();
  const existing = db.prepare('SELECT * FROM orphans').all();
  const studentId = o.studentId || nextStudentId(existing);
  db.prepare(`INSERT OR REPLACE INTO orphans
    (id,studentId,name,school,grade,district,monthlySupport,threeMonthSupport,
     guardian,phone,notes,enrollmentStatus,level,donorId,status,age,gender,year,feePaid,paidAmount,paidDate,period)
    VALUES (@id,@studentId,@name,@school,@grade,@district,@monthlySupport,@threeMonthSupport,
     @guardian,@phone,@notes,@enrollmentStatus,@level,@donorId,@status,@age,@gender,@year,@feePaid,@paidAmount,@paidDate,@period)`)
    .run({ id, studentId, name: o.name || '', school: o.school || '',
           grade: o.grade || '', district: o.district || '',
           monthlySupport: o.monthlySupport || 0, threeMonthSupport: o.threeMonthSupport || 0,
           guardian: o.guardian || '', phone: o.phone || '', notes: o.notes || '',
           enrollmentStatus: o.enrollmentStatus || 'active', level: o.level || 'school',
           donorId: o.donorId || null, status: o.status || 'unsponsored',
           age: o.age || 0, gender: o.gender || 'male',
           year: o.year || new Date().getFullYear(),
           feePaid: boolCol(o.feePaid), paidAmount: o.paidAmount || 0, paidDate: o.paidDate || null,
           period: o.period || '' });
  res.json(toOrphan({ ...o, id, studentId }));
});

app.put('/api/orphans/:id', (req, res) => {
  const o = req.body;
  db.prepare(`UPDATE orphans SET studentId=@studentId,name=@name,school=@school,grade=@grade,
    district=@district,monthlySupport=@monthlySupport,threeMonthSupport=@threeMonthSupport,
    guardian=@guardian,phone=@phone,notes=@notes,enrollmentStatus=@enrollmentStatus,level=@level,
    donorId=@donorId,status=@status,age=@age,gender=@gender,year=@year,
    feePaid=@feePaid,paidAmount=@paidAmount,paidDate=@paidDate,period=@period WHERE id=@id`)
    .run({ ...o, id: +req.params.id, feePaid: boolCol(o.feePaid), period: o.period || '' });
  res.json({ ok: true });
});

app.delete('/api/orphans/:id', (req, res) => {
  db.prepare('DELETE FROM orphans WHERE id=?').run(+req.params.id);
  db.prepare('DELETE FROM orphan_payments WHERE orphanId=?').run(+req.params.id);
  res.json({ ok: true });
});

app.post('/api/orphans/:id/mark-paid', (req, res) => {
  const o = db.prepare('SELECT * FROM orphans WHERE id=?').get(+req.params.id);
  if (!o) return res.status(404).json({ error: 'Not found' });
  const paidAmount = o.threeMonthSupport || o.monthlySupport || 0;
  db.prepare('UPDATE orphans SET feePaid=1,paidAmount=?,paidDate=? WHERE id=?')
    .run(paidAmount, new Date().toISOString().split('T')[0], +req.params.id);
  res.json({ ok: true });
});

app.post('/api/orphans/:id/mark-unpaid', (req, res) => {
  db.prepare('UPDATE orphans SET feePaid=0,paidAmount=0,paidDate=NULL WHERE id=?').run(+req.params.id);
  res.json({ ok: true });
});

// ─── Orphan Payments (quarterly/semester fee disbursement ledger) ─
app.get('/api/orphan-payments', (req, res) => {
  res.json(db.prepare('SELECT * FROM orphan_payments ORDER BY date DESC, id DESC').all());
});

app.post('/api/orphan-payments', (req, res) => {
  const p = req.body;
  const orphanId = +p.orphanId;
  const period = (p.period || '').trim();
  if (!orphanId || !period) return res.status(400).json({ error: 'orphanId and period are required' });

  const orphan = db.prepare('SELECT id FROM orphans WHERE id=?').get(orphanId);
  if (!orphan) return res.status(404).json({ error: 'Student not found' });

  const existing = db.prepare('SELECT 1 FROM orphan_payments WHERE orphanId=? AND period=?').get(orphanId, period);
  if (existing) return res.status(409).json({ error: `${period} has already been paid for this student` });

  const id   = p.id || Date.now();
  const date = p.date || new Date().toISOString().split('T')[0];
  db.prepare(`INSERT INTO orphan_payments (id,orphanId,period,amount,date,notes)
    VALUES (@id,@orphanId,@period,@amount,@date,@notes)`)
    .run({ id, orphanId, period, amount: p.amount || 0, date, notes: p.notes || '' });

  syncOrphanPaidSummary(orphanId);
  res.json({ id, orphanId, period, amount: p.amount || 0, date, notes: p.notes || '' });
});

app.delete('/api/orphan-payments/:id', (req, res) => {
  const rec = db.prepare('SELECT * FROM orphan_payments WHERE id=?').get(+req.params.id);
  if (rec) {
    db.prepare('DELETE FROM orphan_payments WHERE id=?').run(+req.params.id);
    syncOrphanPaidSummary(rec.orphanId);
  }
  res.json({ ok: true });
});

// Bulk import orphans (append, deduplicate by name)
app.post('/api/orphans/import', (req, res) => {
  const { rows, contextLevel } = req.body;
  const existing    = db.prepare('SELECT * FROM orphans').all();
  const yr          = new Date().getFullYear();
  const prefix      = `ISK-${yr}-`;
  const nums        = existing.map(o => o.studentId || '')
    .filter(id => id.startsWith(prefix))
    .map(id => parseInt(id.replace(prefix, ''), 10)).filter(n => !isNaN(n));
  let idCounter     = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  const existingNames = new Set(existing.map(o => (o.name || '').toLowerCase().trim()));
  const batchSeen   = new Set();
  const uniqueRows  = rows.filter(r => {
    const key = (r.name || '').toLowerCase().trim();
    if (!key || existingNames.has(key) || batchSeen.has(key)) return false;
    batchSeen.add(key);
    return true;
  });
  const insert = db.prepare(`INSERT INTO orphans
    (id,studentId,name,school,grade,district,monthlySupport,threeMonthSupport,
     guardian,phone,notes,enrollmentStatus,level,donorId,status,age,gender,year,feePaid,paidAmount,paidDate)
    VALUES (@id,@studentId,@name,@school,@grade,@district,@monthlySupport,@threeMonthSupport,
     @guardian,@phone,@notes,@enrollmentStatus,@level,@donorId,@status,@age,@gender,@year,0,0,NULL)`);
  const insertMany = db.transaction(rows => {
    rows.forEach((r, i) => {
      const rawStatus = r.faahfaahin || r.notes || r.status || r.remarks || '';
      const explicitLevel = (r.level || '').toLowerCase();
      const level = contextLevel ||
        (explicitLevel.includes('uni') ? 'university' : explicitLevel.includes('school') ? 'school' : 'school');
      const monthlySupport = +r.monthlysupport || +r.monthly_support || 0;
      const threeMonthSupport = +r.threemonthsupport || +r.three_month_support || +r.payment_per_semester || +r.persemester || (monthlySupport * 3) || 0;
      insert.run({
        id: Date.now() + i, studentId: `${prefix}${String(idCounter++).padStart(4, '0')}`,
        name: r.name || '', school: r.school || '',
        grade: r.grade || r.class || r.faculty || '',
        district: r.district || r.neighborhood || '',
        monthlySupport, threeMonthSupport,
        guardian: r.guardian || r.administrator || r.coordinator || '',
        phone: r.phone || '', notes: rawStatus,
        enrollmentStatus: parseEnrollmentStatus(rawStatus), level,
        donorId: r.donorid ? +r.donorid : null,
        status: 'unsponsored', age: +r.age || 0,
        gender: r.gender || 'male', year: +r.year || yr,
      });
    });
  });
  insertMany(uniqueRows);
  res.json({ count: uniqueRows.length });
});

// ─── Donation Accounts ─────────────────────────────────────────
app.get('/api/donation-accounts', (req, res) => {
  res.json(db.prepare('SELECT * FROM donation_accounts ORDER BY id').all());
});

app.post('/api/donation-accounts', (req, res) => {
  const a  = req.body;
  const id = a.id || Date.now();
  db.prepare(`INSERT INTO donation_accounts (id,accountName,provider,accountNumber,phone,notes)
    VALUES (@id,@accountName,@provider,@accountNumber,@phone,@notes)`)
    .run({ id, accountName: a.accountName || '', provider: a.provider || '',
           accountNumber: a.accountNumber || '', phone: a.phone || '', notes: a.notes || '' });
  res.json({ ...a, id });
});

app.put('/api/donation-accounts/:id', (req, res) => {
  const a = req.body;
  db.prepare(`UPDATE donation_accounts SET accountName=@accountName,provider=@provider,
    accountNumber=@accountNumber,phone=@phone,notes=@notes WHERE id=@id`)
    .run({ ...a, id: +req.params.id });
  res.json({ ok: true });
});

app.delete('/api/donation-accounts/:id', (req, res) => {
  db.prepare('DELETE FROM donation_accounts WHERE id=?').run(+req.params.id);
  res.json({ ok: true });
});

// ─── Settings ──────────────────────────────────────────────────
app.get('/api/settings/:key', (req, res) => {
  const row = db.prepare('SELECT value FROM settings WHERE key=?').get(req.params.key);
  if (!row) return res.json(null);
  try { res.json(JSON.parse(row.value)); } catch { res.json(row.value); }
});

app.post('/api/settings/:key', (req, res) => {
  db.prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)')
    .run(req.params.key, JSON.stringify(req.body));
  res.json({ ok: true });
});

// ─── History ───────────────────────────────────────────────────
app.get('/api/history', (req, res) => {
  res.json(db.prepare('SELECT data FROM history ORDER BY id').all().map(r => JSON.parse(r.data)));
});

app.post('/api/history', (req, res) => {
  db.prepare('DELETE FROM history').run();
  if (Array.isArray(req.body)) {
    const ins = db.prepare('INSERT INTO history (data) VALUES (?)');
    const insertAll = db.transaction(items => items.forEach(item => ins.run(JSON.stringify(item))));
    insertAll(req.body);
  }
  res.json({ ok: true });
});

// ─── Budget Summary ────────────────────────────────────────────
app.get('/api/budget-summary', (req, res) => {
  const payments = db.prepare('SELECT * FROM payments').all()
    .filter(p => (p.type || 'EDUCATION') === 'EDUCATION');
  const orphans  = db.prepare('SELECT * FROM orphans').all();
  const budgetRow = db.prepare("SELECT value FROM settings WHERE key='isk_student_budget'").get();
  const manualBudget = budgetRow ? Number(JSON.parse(budgetRow.value)) || 0 : 0;
  const collected  = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const disbursed  = db.prepare('SELECT COALESCE(SUM(amount),0) as t FROM orphan_payments').get().t;
  const paidCount  = db.prepare('SELECT COUNT(DISTINCT orphanId) as c FROM orphan_payments').get().c;
  const remaining  = collected - disbursed;
  const needed     = manualBudget > 0 ? manualBudget : orphans.reduce((s, o) => {
    if (o.monthlySupport > 0) return s + o.monthlySupport * 12;
    return s + (o.threeMonthSupport || 0) * 4;
  }, 0);
  const shortfall  = Math.max(0, needed - collected);
  res.json({
    total: collected, disbursed, remaining, needed, shortfall,
    paidCount, totalStudents: orphans.length,
    status: collected === 0 ? 'unset'
          : disbursed > collected ? 'negative'
          : collected >= needed   ? 'sufficient'
          : 'partial',
  });
});

// ─── Bulk replace (SuperAdmin imports) ────────────────────────
app.put('/api/bulk/donors', (req, res) => {
  const donors = req.body;
  const replace = db.transaction(donors => {
    db.prepare('DELETE FROM donors').run();
    const ins = db.prepare(`INSERT INTO donors
      (id,name,type,orphans,committed,paid,date,phone,notes,location,country,frequency)
      VALUES (@id,@name,@type,@orphans,@committed,@paid,@date,@phone,@notes,@location,@country,@frequency)`);
    donors.forEach(d => ins.run({
      id: d.id, name: d.name || '', type: d.type || 'EDUCATION',
      orphans: d.orphans || 1, committed: d.committed || 0, paid: d.paid || 0,
      date: d.date || '', phone: d.phone || '', notes: d.notes || '',
      location: d.location || 'local', country: d.country || 'Somalia',
      frequency: d.frequency || 'yearly',
    }));
  });
  replace(donors);
  res.json({ ok: true });
});

app.put('/api/bulk/orphans', (req, res) => {
  const orphans = req.body;
  const replace = db.transaction(orphans => {
    db.prepare('DELETE FROM orphans').run();
    const ins = db.prepare(`INSERT INTO orphans
      (id,studentId,name,school,grade,district,monthlySupport,threeMonthSupport,
       guardian,phone,notes,enrollmentStatus,level,donorId,status,age,gender,year,feePaid,paidAmount,paidDate)
      VALUES (@id,@studentId,@name,@school,@grade,@district,@monthlySupport,@threeMonthSupport,
       @guardian,@phone,@notes,@enrollmentStatus,@level,@donorId,@status,@age,@gender,@year,@feePaid,@paidAmount,@paidDate)`);
    orphans.forEach(o => ins.run({ ...o, feePaid: boolCol(o.feePaid) }));
  });
  replace(orphans);
  res.json({ ok: true });
});

app.put('/api/bulk/payments', (req, res) => {
  const payments = req.body;
  const replace  = db.transaction(payments => {
    db.prepare('DELETE FROM payments').run();
    const ins = db.prepare(`INSERT INTO payments
      (id,donorId,donorName,amount,type,date,method,ref,notes)
      VALUES (@id,@donorId,@donorName,@amount,@type,@date,@method,@ref,@notes)`);
    payments.forEach(p => ins.run({
      id: p.id, donorId: p.donorId || null, donorName: p.donorName || '',
      amount: p.amount || 0, type: p.type || 'EDUCATION', date: p.date || '',
      method: p.method || 'Transfer', ref: p.ref || '', notes: p.notes || '',
    }));
    // Reconcile donor paid totals — only count payments matching the donor's own fund type
    const donors = db.prepare('SELECT * FROM donors').all();
    const upd = db.prepare('UPDATE donors SET paid=? WHERE id=?');
    donors.forEach(d => {
      const dType = d.type || 'EDUCATION';
      const total = payments
        .filter(p => p.donorId === d.id && (p.type || 'EDUCATION') === dType)
        .reduce((s, p) => s + (p.amount || 0), 0);
      upd.run(total, d.id);
    });
  });
  replace(payments);
  res.json({ ok: true });
});

// ─── Clear all ─────────────────────────────────────────────────
app.post('/api/clear-all', (req, res) => {
  db.prepare('DELETE FROM donors').run();
  db.prepare('DELETE FROM payments').run();
  db.prepare('DELETE FROM orphans').run();
  db.prepare('DELETE FROM orphan_payments').run();
  db.prepare('DELETE FROM history').run();
  db.prepare('DELETE FROM donation_accounts').run();
  db.prepare("DELETE FROM settings WHERE key IN ('isk_target','isk_fund_budget')").run();
  db.prepare(`INSERT INTO donation_accounts (id,accountName,provider,accountNumber,phone,notes)
    VALUES (1,'Iskaashi','AMA','30294777','+252 615 57 47 77','')`).run();
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Iskaashi API running on port ${PORT}`));
