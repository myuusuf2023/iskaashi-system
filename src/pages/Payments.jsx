import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { PlusCircle, Search, Trash2, X, Save, DollarSign, Upload, CheckCircle2 } from "lucide-react";
import {
  getDonors, saveDonors, getPayments, savePayments, addPayment, deletePayment,
  PAYMENT_TYPES, PAYMENT_METHODS
} from "../data/store";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

const EMPTY_FORM = {
  donorId: "", donorName: "", amount: "", type: "ANNUAL",
  date: "", method: "Transfer", ref: "", notes: ""
};

export default function Payments() {
  const { isAdmin, isSuperAdmin } = useAuth();
  const { t } = useLanguage();
  const [payments, setPayments] = useState([]);
  const [donors, setDonors]     = useState([]);
  const [search, setSearch]     = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [confirmDelete, setConfirmDelete]         = useState(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [selected, setSelected]                   = useState(new Set());

  const fileRef = useRef();
  const [importResult, setImportResult] = useState(null);

  const reload = () => { setPayments(getPayments()); setDonors(getDonors()); };
  useEffect(() => { reload(); }, []);

  function handleImportExcel(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const wb    = XLSX.read(ev.target.result, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];

      // Read as raw 2D array so we can handle multi-row titles
      const all = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

      // Find the actual header row — looks for MAGACA, NAME, or DONOR
      const headerKeywords = ["magaca", "name", "donor"];
      let headerIdx = all.findIndex(row =>
        row.some(cell => headerKeywords.includes(String(cell).toLowerCase().trim()))
      );
      if (headerIdx === -1) headerIdx = 0;

      const headers = all[headerIdx].map(h =>
        String(h).toLowerCase().trim().replace(/\s+/g, "_")
      );

      // Build normalised row objects from data rows only
      const rows = all.slice(headerIdx + 1)
        .map(row => {
          const obj = {};
          headers.forEach((h, i) => { obj[h] = String(row[i] ?? "").trim(); });
          return obj;
        })
        .filter(row => Object.values(row).some(v => v !== ""));

      // Pick first matching non-empty key
      const pick = (row, ...keys) => {
        for (const k of keys) if (row[k] !== undefined && row[k] !== "") return row[k];
        return "";
      };

      // Strip currency symbols / commas then parse
      const parseAmt = raw => parseFloat(String(raw).replace(/[^0-9.]/g, "")) || 0;

      const today    = new Date().toISOString().split("T")[0];
      const base     = Date.now();
      let currentDonors = getDonors();
      const currentPayments = getPayments();
      const newDonors   = [];
      const newPayments = [];

      rows.forEach((row, i) => {
        const name   = pick(row, "magaca", "name", "full_name", "donor_name", "donor");
        const amtRaw = pick(row, "baxshay", "paid", "amount", "$", "xogta_xisaabta");
        const amount = parseAmt(amtRaw);
        if (!name || amount <= 0) return;

        // Match existing donor (case-insensitive) or prepare a new one
        let donor = [...currentDonors, ...newDonors]
          .find(d => d.name.toLowerCase() === name.toLowerCase());

        if (!donor) {
          const country  = pick(row, "country", "dal", "wadan") || "Somalia";
          const location = (country.toLowerCase().trim() === "somalia" || !country.trim())
            ? "local" : "qurbajoog";
          donor = {
            id: base + i,
            name, type: "ANNUAL", orphans: 1,
            committed: amount, paid: 0,
            date: today, phone: "", notes: "",
            location, country, frequency: "yearly",
          };
          newDonors.push(donor);
        }

        newPayments.push({
          id: base + i + 100000,
          donorId: donor.id, donorName: donor.name,
          amount,
          type: donor.type || "ANNUAL",
          date:   pick(row, "date", "taariikhda") || today,
          method: pick(row, "method", "habka") || "Transfer",
          ref:    pick(row, "ref", "txn", "reference") || "",
          notes:  pick(row, "notes", "faallo") || "",
        });
      });

      // Batch-save everything at once — no race conditions
      if (newDonors.length > 0) {
        saveDonors([...currentDonors, ...newDonors]);
        currentDonors = getDonors();
      }

      // Save all payments and update each donor's paid total
      savePayments([...currentPayments, ...newPayments]);
      const updatedDonors = currentDonors.map(d => {
        const total = newPayments
          .filter(p => p.donorId === d.id)
          .reduce((s, p) => s + p.amount, 0);
        return total > 0 ? { ...d, paid: d.paid + total } : d;
      });
      saveDonors(updatedDonors);

      setImportResult({ created: newPayments.length, skipped: rows.length - newPayments.length, filename: file.name });
      reload();
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  }

  const filtered = payments.filter(p =>
    p.donorName.toLowerCase().includes(search.toLowerCase()) ||
    (p.ref || "").toLowerCase().includes(search.toLowerCase())
  );

  const allFilteredSelected = filtered.length > 0 && filtered.every(p => selected.has(p.id));
  const someSelected        = selected.size > 0;

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allFilteredSelected) {
      setSelected(prev => { const next = new Set(prev); filtered.forEach(p => next.delete(p.id)); return next; });
    } else {
      setSelected(prev => { const next = new Set(prev); filtered.forEach(p => next.add(p.id)); return next; });
    }
  }

  function deleteSelected() {
    selected.forEach(id => deletePayment(id));
    setSelected(new Set());
    setConfirmBulkDelete(false);
    reload();
  }

  function handleDonorChange(id) {
    const donor = donors.find(d => d.id === +id);
    setForm(f => ({
      ...f,
      donorId: id,
      donorName: donor?.name || "",
      type: donor?.type || "ZAKTUL_FIDRI",
      amount: donor ? donor.committed - donor.paid : ""
    }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    addPayment({ ...form, donorId: +form.donorId, amount: +form.amount });
    setShowModal(false);
    reload();
  }

  function handleDelete(id) {
    deletePayment(id);
    setConfirmDelete(null);
    reload();
  }

  const totalAmount = payments.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="p-4 md:p-6 space-y-5">

      {/* Import result toast */}
      {importResult && (
        <div className="flex items-center justify-between gap-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="text-sm font-semibold">
              Imported <strong>{importResult.created}</strong> payment{importResult.created !== 1 ? "s" : ""} from <em>{importResult.filename}</em>
              {importResult.skipped > 0 && <span className="text-amber-600 ml-2">· {importResult.skipped} rows skipped (missing name or amount)</span>}
            </span>
          </div>
          <button onClick={() => setImportResult(null)} className="text-emerald-400 hover:text-emerald-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: t("total_transactions"),   val: payments.length,            bg: "from-emerald-500 to-emerald-600" },
          { label: t("total_collected_stat"), val: `$${totalAmount.toLocaleString()}`, bg: "from-blue-500 to-blue-600" },
          { label: t("this_month"),           val: `$${payments
              .filter(p => p.date?.startsWith(new Date().toISOString().slice(0, 7)))
              .reduce((s, p) => s + p.amount, 0)}`, bg: "from-purple-500 to-purple-600" },
        ].map(({ label, val, bg }) => (
          <div key={label} className={`bg-gradient-to-br ${bg} rounded-2xl p-4 text-white shadow-md`}>
            <DollarSign className="w-5 h-5 opacity-70 mb-1" />
            <p className="text-2xl font-bold">{val}</p>
            <p className="text-xs opacity-80 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="no-print p-3 md:p-4 border-b border-gray-100 space-y-3">
          <div className="flex gap-2 items-center justify-between">
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 flex-1 min-w-0">
              <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t("search_payments_ph")}
                className="bg-transparent text-sm outline-none w-full"
              />
            </div>
            {isSuperAdmin && someSelected && (
              <button onClick={() => setConfirmBulkDelete(true)}
                className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-3 py-2 rounded-xl text-xs font-semibold shadow transition flex-shrink-0">
                <Trash2 className="w-3.5 h-3.5" /> Delete ({selected.size})
              </button>
            )}
            {isAdmin && (
              <>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportExcel} />
                <button onClick={() => fileRef.current.click()}
                  className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-2 rounded-xl text-xs font-semibold transition flex-shrink-0">
                  <Upload className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Import Excel</span>
                </button>
                <button
                  onClick={() => { setForm({ ...EMPTY_FORM, date: new Date().toISOString().split("T")[0] }); setShowModal(true); }}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-xl text-xs font-semibold shadow transition flex-shrink-0"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t("add_payment")}</span>
                  <span className="sm:hidden">{t("add")}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-gray-100">
          {filtered.length === 0 && (
            <p className="px-4 py-8 text-center text-gray-400 text-sm">{t("no_payments_found")}</p>
          )}
          {filtered.map((p) => (
            <div key={p.id} className={`p-4 space-y-2 ${selected.has(p.id) ? "bg-rose-50" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  {isSuperAdmin && (
                    <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)}
                      className="mt-1 w-4 h-4 accent-rose-500 flex-shrink-0 cursor-pointer" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 truncate">{p.donorName}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{p.date} · {p.method}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="font-bold text-emerald-600">${p.amount.toLocaleString()}</span>
                  {isAdmin && (
                    <button onClick={() => setConfirmDelete(p.id)}
                      className="p-1.5 hover:bg-rose-50 text-rose-400 rounded-lg transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 text-xs">
                <span className="bg-blue-50 text-blue-700 font-medium px-2 py-0.5 rounded-lg">{PAYMENT_TYPES[p.type] || p.type}</span>
                <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-lg">{p.method}</span>
                {p.ref && <span className="text-gray-400 font-mono">{p.ref}</span>}
              </div>
            </div>
          ))}
          {filtered.length > 0 && (
            <div className="px-4 py-3 bg-gray-50 flex justify-between text-xs font-semibold text-gray-600">
              <span>{t("total_x_payments", { count: filtered.length })}</span>
              <span className="text-emerald-700">${filtered.reduce((s, p) => s + p.amount, 0).toLocaleString()}</span>
            </div>
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {isSuperAdmin && (
                  <th className="px-4 py-3">
                    <input type="checkbox" checked={allFilteredSelected} onChange={toggleSelectAll}
                      className="w-4 h-4 accent-rose-500 cursor-pointer" />
                  </th>
                )}
                {["#", t("donor_name_label"), t("payment_type_col"), t("amount"), t("method"), t("ref"), t("date"), ...(isAdmin ? [t("actions")] : [])].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">{t("no_payments_found")}</td></tr>
              )}
              {filtered.map((p, i) => (
                <tr key={p.id} className={`transition-colors ${selected.has(p.id) ? "bg-rose-50" : "hover:bg-gray-50"}`}>
                  {isSuperAdmin && (
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)}
                        className="w-4 h-4 accent-rose-500 cursor-pointer" />
                    </td>
                  )}
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">{i + 1}</td>
                  <td className="px-4 py-3 font-semibold text-gray-800 min-w-[160px]">{p.donorName}</td>
                  <td className="px-4 py-3">
                    <span className="bg-blue-50 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-lg">
                      {PAYMENT_TYPES[p.type] || p.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-bold text-emerald-600">${p.amount.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-lg">{p.method}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">{p.ref || "—"}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{p.date}</td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <button onClick={() => setConfirmDelete(p.id)}
                        className="p-1.5 hover:bg-rose-50 text-rose-400 rounded-lg transition">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            {filtered.length > 0 && (
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">{t("total")}</td>
                  <td className="px-4 py-3 font-bold text-emerald-700 text-base">
                    ${filtered.reduce((s, p) => s + p.amount, 0).toLocaleString()}
                  </td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl">
            {/* Gradient Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-4 rounded-t-3xl relative">
              <button onClick={() => setShowModal(false)} className="absolute top-3.5 right-4 p-1.5 bg-white/20 hover:bg-white/30 rounded-xl transition">
                <X className="w-4 h-4 text-white" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-white font-bold text-base leading-tight">{t("record_payment_title")}</h2>
                  <p className="text-white/70 text-xs">Iskaashi Educational Development Org.</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-5">
              <div className="grid grid-cols-2 gap-4">
                {/* Left column */}
                <div className="space-y-3">
                  <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-100 space-y-2.5">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t("donor_label")}</p>
                    <select required value={form.donorId}
                      onChange={e => handleDonorChange(e.target.value)}
                      className="w-full border border-gray-200 bg-white rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300 shadow-sm transition">
                      <option value="">{t("select_donor_ph")}</option>
                      {donors.map(d => (
                        <option key={d.id} value={d.id}>{d.name} (owes ${d.committed - d.paid})</option>
                      ))}
                    </select>
                  </div>

                  <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-100 space-y-2.5">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t("amount_label")}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">{t("amount_label")}</label>
                        <input required type="number" min="1" value={form.amount}
                          onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                          className="w-full border border-gray-200 bg-white rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300 shadow-sm transition" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">{t("payment_type_col")}</label>
                        <select value={form.type}
                          onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                          className="w-full border border-gray-200 bg-white rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300 shadow-sm transition">
                          {Object.entries(PAYMENT_TYPES).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right column */}
                <div className="space-y-3">
                  <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-100 space-y-2.5">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t("method_label")}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">{t("method_label")}</label>
                        <select value={form.method}
                          onChange={e => setForm(f => ({ ...f, method: e.target.value }))}
                          className="w-full border border-gray-200 bg-white rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300 shadow-sm transition">
                          {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">{t("date")} *</label>
                        <input required type="date" value={form.date}
                          onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                          className="w-full border border-gray-200 bg-white rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300 shadow-sm transition" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">{t("ref_label")}</label>
                      <input value={form.ref}
                        onChange={e => setForm(f => ({ ...f, ref: e.target.value }))}
                        placeholder={t("ref_ph")}
                        className="w-full border border-gray-200 bg-white rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300 shadow-sm transition" />
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-100 space-y-2.5">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t("notes_label")}</p>
                    <textarea rows={4} value={form.notes}
                      onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                      className="w-full border border-gray-200 bg-white rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300 shadow-sm transition resize-none" />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-4">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-2xl font-semibold text-sm hover:bg-gray-50 transition">
                  {t("cancel")}
                </button>
                <button type="submit"
                  className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white py-2.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg hover:shadow-blue-200 active:scale-[0.98] transition-all">
                  <Save className="w-4 h-4" /> {t("save_payment_btn")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Delete confirm */}
      {confirmBulkDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-gradient-to-r from-rose-500 to-rose-600 px-6 py-5 flex justify-center">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
                <Trash2 className="w-7 h-7 text-white" />
              </div>
            </div>
            <div className="p-6 text-center">
              <h3 className="font-bold text-gray-800 text-lg">Delete {selected.size} Payments?</h3>
              <p className="text-gray-500 text-sm mt-2">{t("cannot_undo")}</p>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setConfirmBulkDelete(false)}
                  className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-2xl font-semibold text-sm hover:bg-gray-50 transition">{t("cancel")}</button>
                <button onClick={deleteSelected}
                  className="flex-1 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white py-3 rounded-2xl font-bold text-sm shadow-lg active:scale-[0.98] transition-all">{t("delete")}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-gradient-to-r from-rose-500 to-rose-600 px-6 py-5 flex justify-center">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
                <Trash2 className="w-7 h-7 text-white" />
              </div>
            </div>
            <div className="p-6 text-center">
              <h3 className="font-bold text-gray-800 text-lg">{t("delete_payment_title")}</h3>
              <p className="text-gray-500 text-sm mt-2">{t("donor_balance_note")}</p>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setConfirmDelete(null)}
                  className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-2xl font-semibold text-sm hover:bg-gray-50 transition">{t("cancel")}</button>
                <button onClick={() => handleDelete(confirmDelete)}
                  className="flex-1 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white py-3 rounded-2xl font-bold text-sm shadow-lg active:scale-[0.98] transition-all">{t("delete")}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
