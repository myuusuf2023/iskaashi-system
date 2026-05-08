import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import {
  UserPlus, Search, Pencil, Trash2, CheckCircle2,
  Clock, AlertCircle, X, Save, Globe, MapPin,
  Upload, Download
} from "lucide-react";
import {
  getDonors, addDonor, updateDonor, deleteDonor, importDonors,
  parseCSV, PAYMENT_TYPES, FREQUENCIES, LOCATIONS
} from "../data/store";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

const EMPTY_FORM = {
  name: "", type: "EDUCATION", committed: 0, paid: 0,
  date: "", phone: "", notes: "", location: "local", country: "Somalia", frequency: "yearly"
};

function Badge({ status, t }) {
  if (status === "paid")
    return <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 text-xs font-semibold px-2.5 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" />{t("paid_status")}</span>;
  if (status === "partial")
    return <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-xs font-semibold px-2.5 py-0.5 rounded-full"><Clock className="w-3 h-3" />{t("partial_status")}</span>;
  return <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-700 text-xs font-semibold px-2.5 py-0.5 rounded-full"><AlertCircle className="w-3 h-3" />{t("pending_status")}</span>;
}

function LocationBadge({ location, t }) {
  return location === "qurbajoog"
    ? <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-lg"><Globe className="w-3 h-3" />{t("qurbajoog_label")}</span>
    : <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-xs font-medium px-2 py-0.5 rounded-lg"><MapPin className="w-3 h-3" />{t("local_label")}</span>;
}

function getStatus(d) {
  if (d.paid >= d.committed && d.committed > 0) return "paid";
  if (d.paid > 0) return "partial";
  return "pending";
}

export default function Donors() {
  const { isAdmin, isSuperAdmin } = useAuth();
  const { t } = useLanguage();
  const [donors, setDonors]       = useState([]);
  const [search, setSearch]       = useState("");
  const [filterType, setFilter]   = useState("ALL");
  const [filterLoc, setFilterLoc] = useState("ALL");
  const [filterFreq, setFilterFreq] = useState("ALL");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [confirmDelete, setConfirmDelete]     = useState(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [selected, setSelected]               = useState(new Set());
  const [importResult, setImportResult]       = useState(null);
  const fileRef = useRef();

  const reload = () => setDonors(getDonors());
  useEffect(() => { reload(); }, []);

  const filtered = donors.filter(d => {
    const matchSearch = d.name.toLowerCase().includes(search.toLowerCase()) ||
                        (d.country || "").toLowerCase().includes(search.toLowerCase());
    const matchType   = filterType === "ALL" || d.type === filterType;
    const matchLoc    = filterLoc  === "ALL" || d.location === filterLoc;
    const matchFreq   = filterFreq === "ALL" || d.frequency === filterFreq;
    return matchSearch && matchType && matchLoc && matchFreq;
  });

  const allFilteredSelected = filtered.length > 0 && filtered.every(d => selected.has(d.id));
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
      setSelected(prev => {
        const next = new Set(prev);
        filtered.forEach(d => next.delete(d.id));
        return next;
      });
    } else {
      setSelected(prev => {
        const next = new Set(prev);
        filtered.forEach(d => next.add(d.id));
        return next;
      });
    }
  }

  function deleteSelected() {
    selected.forEach(id => deleteDonor(id));
    setSelected(new Set());
    setConfirmBulkDelete(false);
    reload();
  }

  const qurbajoogCount = donors.filter(d => d.location === "qurbajoog").length;
  const localCount     = donors.filter(d => d.location === "local").length;
  const totalCommitted = donors.reduce((s, d) => s + d.committed, 0);
  const totalPaid      = donors.reduce((s, d) => s + d.paid, 0);

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, date: new Date().toISOString().split("T")[0] });
    setShowModal(true);
  }

  function openEdit(d) {
    setEditing(d.id);
    setForm({ ...d });
    setShowModal(true);
  }

  function handleSubmit(e) {
    e.preventDefault();
    const data = { ...form, committed: +form.committed, paid: +form.paid };
    if (editing) updateDonor({ ...data, id: editing });
    else addDonor(data);
    setShowModal(false);
    reload();
  }

  function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const isExcel = /\.(xlsx|xls)$/i.test(file.name);
    const reader = new FileReader();
    reader.onload = ev => {
      let rows;
      if (isExcel) {
        const wb    = XLSX.read(ev.target.result, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const data  = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        rows = data.map(r => {
          const lower = {};
          Object.keys(r).forEach(k => { lower[k.toLowerCase().replace(/\s+/g,"_")] = String(r[k]); });
          return lower;
        });
      } else {
        rows = parseCSV(ev.target.result);
      }
      const count = importDonors(rows);
      setImportResult({ count, filename: file.name });
      reload();
    };
    isExcel ? reader.readAsArrayBuffer(file) : reader.readAsText(file);
    e.target.value = "";
  }

  function handleExport() {
    const rows = [
      ["#", "Name", "Location", "Country", "Type", "Frequency", "Orphans", "Committed ($)", "Paid ($)", "Balance ($)", "Status", "Phone", "Date", "Notes"],
      ...donors.map((d, i) => [
        i + 1, d.name, LOCATIONS[d.location] || d.location, d.country || "",
        PAYMENT_TYPES[d.type] || d.type, FREQUENCIES[d.frequency] || d.frequency,
        d.orphans, d.committed, d.paid, d.committed - d.paid,
        d.paid >= d.committed ? "Paid" : d.paid > 0 ? "Partial" : "Pending",
        d.phone || "", d.date || "", d.notes || ""
      ])
    ];
    const csv  = rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a    = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "iskaashi-donors.csv" });
    a.click();
  }

  return (
    <div className="p-4 md:p-6 space-y-5">

      {/* Qurbajoog vs Local banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl p-5 text-white shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <Globe className="w-6 h-6 mb-2 opacity-80" />
              <p className="text-3xl font-bold">{qurbajoogCount}</p>
              <p className="text-blue-200 text-sm mt-0.5">{t("qurbajoog_diaspora")}</p>
              <p className="text-blue-300 text-xs">{t("donors_outside")}</p>
            </div>
            <div className="text-right">
              <p className="text-4xl font-bold opacity-20">{donors.length > 0 ? (qurbajoogCount / donors.length * 100).toFixed(0) : 0}%</p>
            </div>
          </div>
          <div className="mt-3 bg-white/20 rounded-full h-2">
            <div className="h-2 rounded-full bg-white transition-all duration-500"
              style={{ width: donors.length > 0 ? `${qurbajoogCount / donors.length * 100}%` : "0%" }} />
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl p-5 text-white shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <MapPin className="w-6 h-6 mb-2 opacity-80" />
              <p className="text-3xl font-bold">{localCount}</p>
              <p className="text-emerald-200 text-sm mt-0.5">{t("local_somalia")}</p>
              <p className="text-emerald-300 text-xs">{t("donors_inside")}</p>
            </div>
            <div className="text-right">
              <p className="text-4xl font-bold opacity-20">{donors.length > 0 ? (localCount / donors.length * 100).toFixed(0) : 0}%</p>
            </div>
          </div>
          <div className="mt-3 bg-white/20 rounded-full h-2">
            <div className="h-2 rounded-full bg-white transition-all duration-500"
              style={{ width: donors.length > 0 ? `${localCount / donors.length * 100}%` : "0%" }} />
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: t("total_donors_stat"),  val: donors.length,                        color: "bg-purple-50 text-purple-700" },
          { label: t("committed"),          val: `$${totalCommitted.toLocaleString()}`, color: "bg-amber-50 text-amber-700" },
          { label: t("collected"),          val: `$${totalPaid.toLocaleString()}`,      color: "bg-emerald-50 text-emerald-700" },
        ].map(({ label, val, color }) => (
          <div key={label} className={`${color} rounded-2xl p-4 border border-white shadow-sm`}>
            <p className="text-xl font-bold">{val}</p>
            <p className="text-xs opacity-70 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Import result toast */}
      {importResult && (
        <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <p className="text-sm text-emerald-800 font-medium">
              {t("imported_donors", { count: importResult.count, file: importResult.filename })}
            </p>
          </div>
          <button onClick={() => setImportResult(null)} className="text-emerald-400 hover:text-emerald-600"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Table card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Toolbar */}
        <div className="no-print p-3 md:p-4 border-b border-gray-100 space-y-3">
          {/* Row 1: search + action buttons */}
          <div className="flex gap-2 items-center justify-between">
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 flex-1 min-w-0">
              <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder={t("search_donors_ph")} className="bg-transparent text-sm outline-none w-full" />
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {isAdmin && (
                <>
                  <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleImport} />
                  <button onClick={() => fileRef.current.click()}
                    className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-2.5 py-2 rounded-xl text-xs font-semibold transition">
                    <Upload className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{t("import")}</span>
                  </button>
                </>
              )}
              <button onClick={handleExport}
                className="flex items-center gap-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 px-2.5 py-2 rounded-xl text-xs font-semibold transition">
                <Download className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{t("export")}</span>
              </button>
              {isSuperAdmin && someSelected && (
                <button onClick={() => setConfirmBulkDelete(true)}
                  className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-3 py-2 rounded-xl text-xs font-semibold shadow transition">
                  <Trash2 className="w-3.5 h-3.5" /> Delete ({selected.size})
                </button>
              )}
              {isAdmin && (
                <button onClick={openAdd}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-xl text-xs font-semibold shadow transition">
                  <UserPlus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{t("add_donor")}</span><span className="sm:hidden">{t("add")}</span>
                </button>
              )}
            </div>
          </div>
          {/* Row 2: filters */}
          <div className="flex flex-wrap gap-2">
            <select value={filterLoc} onChange={e => setFilterLoc(e.target.value)}
              className="flex-1 min-w-[110px] bg-gray-50 border border-gray-200 rounded-xl px-2 py-1.5 text-xs outline-none text-gray-600">
              <option value="ALL">{t("all_locations")}</option>
              <option value="local">{t("local_label")}</option>
              <option value="qurbajoog">{t("qurbajoog_label")}</option>
            </select>
            <select value={filterFreq} onChange={e => setFilterFreq(e.target.value)}
              className="flex-1 min-w-[110px] bg-gray-50 border border-gray-200 rounded-xl px-2 py-1.5 text-xs outline-none text-gray-600">
              <option value="ALL">{t("all_frequencies")}</option>
              {Object.entries(FREQUENCIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>

        {/* CSV hint */}
        {isAdmin && (
          <div className="no-print px-4 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-700">
            CSV columns: <strong>name, committed, paid, location, country, frequency, phone, date, notes</strong>
          </div>
        )}

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-gray-100">
          {filtered.length === 0 && (
            <p className="px-4 py-8 text-center text-gray-400 text-sm">{t("no_donors_found")}</p>
          )}
          {filtered.map((d) => {
            const balance = d.committed - d.paid;
            return (
              <div key={d.id} className={`p-4 space-y-2 ${selected.has(d.id) ? "bg-rose-50" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    {isSuperAdmin && (
                      <input type="checkbox" checked={selected.has(d.id)} onChange={() => toggleSelect(d.id)}
                        className="mt-1 w-4 h-4 accent-rose-500 flex-shrink-0 cursor-pointer" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 truncate">{d.name}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        <LocationBadge location={d.location} t={t} />
                        <Badge status={getStatus(d)} t={t} />
                      </div>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => openEdit(d)}
                        className="p-1.5 hover:bg-blue-50 text-blue-500 rounded-lg transition">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => setConfirmDelete(d.id)}
                        className="p-1.5 hover:bg-rose-50 text-rose-500 rounded-lg transition">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500">
                  <span><span className="font-medium text-gray-700">{t("country")}:</span> {d.country || "—"}</span>
                  <span><span className="font-medium text-gray-700">{t("frequency")}:</span> {FREQUENCIES[d.frequency] || "—"}</span>
                </div>
                <div className="flex gap-3 text-xs pt-1">
                  <span className="text-gray-500">{t("committed")}: <span className="font-bold text-gray-700">${d.committed}</span></span>
                  <span className="text-gray-500">{t("paid")}: <span className="font-bold text-emerald-600">${d.paid}</span></span>
                  {balance > 0 && <span className="text-gray-500">{t("due")}: <span className="font-bold text-rose-500">${balance}</span></span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {isSuperAdmin && (
                  <th className="px-3 py-3">
                    <input type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 accent-rose-500 cursor-pointer" />
                  </th>
                )}
                {["#", t("name"), t("location"), t("country"), t("type"), t("frequency"), t("committed"), t("paid"), t("balance"), t("status"), ...(isAdmin ? [t("actions")] : [])].map(h => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr><td colSpan={12} className="px-4 py-8 text-center text-gray-400">{t("no_donors_found")}</td></tr>
              )}
              {filtered.map((d, i) => {
                const balance = d.committed - d.paid;
                return (
                  <tr key={d.id} className={`transition-colors ${selected.has(d.id) ? "bg-rose-50" : "hover:bg-gray-50"}`}>
                    {isSuperAdmin && (
                      <td className="px-3 py-3">
                        <input type="checkbox" checked={selected.has(d.id)} onChange={() => toggleSelect(d.id)}
                          className="w-4 h-4 accent-rose-500 cursor-pointer" />
                      </td>
                    )}
                    <td className="px-3 py-3 text-gray-400 font-mono text-xs">{i + 1}</td>
                    <td className="px-3 py-3 font-semibold text-gray-800 min-w-[150px]">{d.name}</td>
                    <td className="px-3 py-3"><LocationBadge location={d.location} t={t} /></td>
                    <td className="px-3 py-3 text-gray-500 text-xs">{d.country || "—"}</td>
                    <td className="px-3 py-3">
                      <span className="bg-emerald-50 text-emerald-700 text-xs font-medium px-2 py-0.5 rounded-lg">
                        {PAYMENT_TYPES[d.type] || d.type}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="bg-purple-50 text-purple-700 text-xs font-medium px-2 py-0.5 rounded-lg">
                        {FREQUENCIES[d.frequency] || d.frequency || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-semibold text-gray-700">${d.committed}</td>
                    <td className="px-3 py-3 font-semibold text-emerald-600">${d.paid}</td>
                    <td className="px-3 py-3 font-semibold text-rose-500">{balance > 0 ? `$${balance}` : "—"}</td>
                    <td className="px-3 py-3"><Badge status={getStatus(d)} t={t} /></td>
                    {isAdmin && (
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(d)}
                            className="p-1.5 hover:bg-blue-50 text-blue-500 rounded-lg transition">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setConfirmDelete(d.id)}
                            className="p-1.5 hover:bg-rose-50 text-rose-500 rounded-lg transition">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
          {t("showing_donors", { x: filtered.length, y: donors.length })}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl">
            {/* Gradient Header */}
            <div className={`bg-gradient-to-r ${editing ? "from-blue-600 to-indigo-700" : "from-emerald-500 to-emerald-700"} px-6 py-4 rounded-t-3xl relative`}>
              <button onClick={() => setShowModal(false)} className="absolute top-3.5 right-4 p-1.5 bg-white/20 hover:bg-white/30 rounded-xl transition">
                <X className="w-4 h-4 text-white" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-white font-bold text-base leading-tight">{editing ? t("edit_donor_title") : t("register_donor_title")}</h2>
                  <p className="text-white/70 text-xs">Iskaashi Educational Development Org.</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-5">
              <div className="grid grid-cols-2 gap-4">
                {/* Left column */}
                <div className="space-y-3">
                  <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-100 space-y-2.5">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t("full_name_label")}</p>
                    <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full border border-gray-200 bg-white rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-300 shadow-sm transition placeholder:text-gray-300"
                      placeholder={t("full_name_ph")} />
                  </div>

                  <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-100 space-y-2.5">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t("location_label")}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { val: "local",     labelKey: "local_option",     icon: MapPin, color: "emerald" },
                        { val: "qurbajoog", labelKey: "qurbajoog_option",  icon: Globe,  color: "blue" },
                      ].map(({ val, labelKey, icon: Icon, color }) => (
                        <button key={val} type="button"
                          onClick={() => setForm(f => ({ ...f, location: val, country: val === "local" ? "Somalia" : f.country === "Somalia" ? "" : f.country }))}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-xs font-semibold transition ${
                            form.location === val
                              ? color === "emerald" ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm" : "border-blue-500 bg-blue-50 text-blue-700 shadow-sm"
                              : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                          }`}>
                          <Icon className="w-3.5 h-3.5" /> {t(labelKey)}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">{t("country_label")}</label>
                        <input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
                          className="w-full border border-gray-200 bg-white rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-300 shadow-sm transition"
                          placeholder={t("country_ph")} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">{t("frequency_label")}</label>
                        <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}
                          className="w-full border border-gray-200 bg-white rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-300 shadow-sm transition">
                          {Object.entries(FREQUENCIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-100 space-y-2.5">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t("contact_label")}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">{t("date_label")}</label>
                        <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                          className="w-full border border-gray-200 bg-white rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-300 shadow-sm transition" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">{t("phone_label")}</label>
                        <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                          className="w-full border border-gray-200 bg-white rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-300 shadow-sm transition"
                          placeholder="+252..." />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right column */}
                <div className="space-y-3">
                  <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-100 space-y-2.5">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Education Fund</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">{t("committed_label")} ($)</label>
                        <input required type="number" min="0" value={form.committed}
                          onChange={e => setForm(f => ({ ...f, committed: +e.target.value }))}
                          className="w-full border border-gray-200 bg-white rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-300 shadow-sm transition" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">{t("already_paid_label")} ($)</label>
                        <input type="number" min="0" value={form.paid}
                          onChange={e => setForm(f => ({ ...f, paid: +e.target.value }))}
                          className="w-full border border-gray-200 bg-white rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-300 shadow-sm transition" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-100 space-y-2.5">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t("notes_label")}</p>
                    <textarea rows={4} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                      className="w-full border border-gray-200 bg-white rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-300 shadow-sm transition resize-none" />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-4">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-2xl font-semibold text-sm hover:bg-gray-50 transition">
                  {t("cancel")}
                </button>
                <button type="submit"
                  className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-700 hover:from-emerald-600 hover:to-emerald-800 text-white py-2.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg hover:shadow-emerald-200 active:scale-[0.98] transition-all">
                  <Save className="w-4 h-4" /> {editing ? t("update") : t("register")}
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
              <h3 className="font-bold text-gray-800 text-lg">Delete {selected.size} Donors?</h3>
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
              <h3 className="font-bold text-gray-800 text-lg">{t("delete_donor_title")}</h3>
              <p className="text-gray-500 text-sm mt-2">{t("cannot_undo")}</p>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setConfirmDelete(null)}
                  className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-2xl font-semibold text-sm hover:bg-gray-50 transition">{t("cancel")}</button>
                <button onClick={() => { deleteDonor(confirmDelete); setConfirmDelete(null); reload(); }}
                  className="flex-1 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white py-3 rounded-2xl font-bold text-sm shadow-lg active:scale-[0.98] transition-all">{t("delete")}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
