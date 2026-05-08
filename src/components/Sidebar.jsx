import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, Users, CreditCard, BarChart3,
  X, History, Baby,
  ShieldCheck, ShieldAlert, Eye, LogOut, Lock, AlertCircle, Crown
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import SuperAdminPanel from "./SuperAdminPanel";

const navItems = [
  { to: "/",         key: "nav_dashboard", icon: LayoutDashboard },
  { to: "/donors",   key: "nav_donors",    icon: Users },
  { to: "/orphans",  key: "nav_orphans",   icon: Baby },
  { to: "/payments", key: "nav_payments",  icon: CreditCard },
  { to: "/reports",  key: "nav_reports",   icon: BarChart3 },
  { to: "/history",  key: "nav_history",   icon: History },
];

export default function Sidebar({ open, onClose }) {
  const { isAdmin, isSuperAdmin, loginAsAdmin, loginAsSuperAdmin, logout } = useAuth();
  const { t } = useLanguage();

  const [showAdminModal,      setShowAdminModal]      = useState(false);
  const [showSuperAdminModal, setShowSuperAdminModal] = useState(false);
  const [showSuperPanel,      setShowSuperPanel]      = useState(false);
  const [password,   setPassword]   = useState("");
  const [saPassword, setSaPassword] = useState("");
  const [error,      setError]      = useState("");
  const [saError,    setSaError]    = useState("");

  function handleAdminLogin(e) {
    e.preventDefault();
    const ok = loginAsAdmin(password);
    if (ok) {
      setShowAdminModal(false);
      setPassword("");
      setError("");
    } else {
      setError(t("incorrect_password"));
      setPassword("");
    }
  }

  function handleSuperAdminLogin(e) {
    e.preventDefault();
    const ok = loginAsSuperAdmin(saPassword);
    if (ok) {
      setShowSuperAdminModal(false);
      setSaPassword("");
      setSaError("");
    } else {
      setSaError("Incorrect super admin password.");
      setSaPassword("");
    }
  }

  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-full w-72 z-30
          flex flex-col transform transition-transform duration-300
          shadow-2xl
          ${open ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0 lg:static lg:z-auto
        `}
        style={{ background: "linear-gradient(180deg, #0b1f14 0%, #0f2d1c 50%, #0b1f14 100%)" }}
      >
        {/* Logo area */}
        <div className="relative px-5 pt-6 pb-4 border-b border-white/10">
          <button
            onClick={onClose}
            className="lg:hidden absolute top-3 right-3 p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition z-10"
          >
            <X className="w-4 h-4" />
          </button>
          <img
            src="/Iskaashi%20Educational%20Development%20Organization%20logo.png"
            alt="Iskaashi Educational Development Organization"
            className="w-full object-contain object-center"
            style={{ maxHeight: "110px", mixBlendMode: "luminosity", filter: "brightness(1.15) contrast(1.05)" }}
          />
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 h-px bg-emerald-500/25" />
            <span className="text-[10px] font-bold text-emerald-500/50 uppercase tracking-widest whitespace-nowrap">
              {new Date().getFullYear()} · {t("orphan_support_prog")}
            </span>
            <div className="flex-1 h-px bg-emerald-500/25" />
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.15em] px-3 mb-3">Menu</p>
          {navItems.map(({ to, key, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={onClose}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-900/60"
                    : "text-white/50 hover:text-white hover:bg-white/8"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
                    isActive
                      ? "bg-white/20"
                      : "bg-white/5 group-hover:bg-white/10"
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="flex-1 leading-none">{t(key)}</span>
                  {isActive && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white/80 flex-shrink-0" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-3 pb-4 pt-3 border-t border-white/10 space-y-2.5">
          {/* User profile card */}
          <div className={`border rounded-2xl p-3 ${isSuperAdmin ? "bg-purple-900/40 border-purple-500/30" : "bg-white/5 border-white/10"}`}>
            <div className="flex items-center gap-2.5">
              <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-white text-xs font-bold shadow-md ${
                isSuperAdmin
                  ? "bg-gradient-to-br from-purple-400 to-purple-800"
                  : isAdmin
                    ? "bg-gradient-to-br from-emerald-400 to-emerald-700"
                    : "bg-gradient-to-br from-slate-500 to-slate-700"
              }`}>
                IS
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-bold truncate leading-tight">Iskaashi System</p>
                <div className="flex items-center gap-1 mt-0.5">
                  {isSuperAdmin
                    ? <><Crown className="w-3 h-3 text-purple-300" /><span className="text-purple-300 text-[10px] font-semibold">Super Admin</span></>
                    : isAdmin
                      ? <><ShieldCheck className="w-3 h-3 text-emerald-400" /><span className="text-emerald-400 text-[10px] font-semibold">{t("admin_label")}</span></>
                      : <><Eye className="w-3 h-3 text-white/40" /><span className="text-white/40 text-[10px]">{t("viewer_label")}</span></>
                  }
                </div>
              </div>
            </div>
            <p className="text-white/20 text-[10px] mt-2 truncate">ALI AHMED · +252 615 57 47 77</p>
          </div>

          {/* System Control button — super admin only */}
          {isSuperAdmin && (
            <button
              onClick={() => setShowSuperPanel(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl text-xs font-bold transition-all bg-purple-600/20 hover:bg-purple-600/35 border border-purple-500/30 hover:border-purple-400/50 text-purple-300 hover:text-purple-200"
            >
              <ShieldAlert className="w-3.5 h-3.5" /> System Control
            </button>
          )}

          {/* Login / Logout */}
          {isAdmin ? (
            <button onClick={logout}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl text-xs font-bold transition-all bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/25 hover:border-rose-400/40 text-rose-400 hover:text-rose-300">
              <LogOut className="w-3.5 h-3.5" /> {t("sign_out")}
            </button>
          ) : (
            <div className="space-y-2">
              <button
                onClick={() => { setError(""); setPassword(""); setShowAdminModal(true); }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl text-xs font-bold transition-all bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-900/50"
              >
                <Lock className="w-3.5 h-3.5" /> {t("admin_login_btn")}
              </button>
              <button
                onClick={() => { setSaError(""); setSaPassword(""); setShowSuperAdminModal(true); }}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-2xl text-[11px] font-semibold transition-all bg-purple-700/20 hover:bg-purple-700/35 border border-purple-500/20 hover:border-purple-500/40 text-purple-400 hover:text-purple-300"
              >
                <Crown className="w-3 h-3" /> Super Admin
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Admin Login Modal */}
      {showAdminModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-white" />
                <p className="text-white font-bold text-sm">{t("admin_login_title")}</p>
              </div>
              <button onClick={() => setShowAdminModal(false)} className="text-white/70 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAdminLogin} className="p-5 space-y-4">
              <p className="text-gray-500 text-xs">{t("enter_admin_pwd")}</p>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(""); }}
                  placeholder={t("admin_password_ph")}
                  autoFocus
                  className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-300"
                />
              </div>
              {error && (
                <div className="flex items-center gap-2 text-rose-600 text-xs bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  {error}
                </div>
              )}
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowAdminModal(false)}
                  className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-2xl font-semibold text-sm hover:bg-gray-50 transition">
                  {t("cancel")}
                </button>
                <button type="submit" disabled={!password}
                  className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-700 hover:from-emerald-600 hover:to-emerald-800 disabled:opacity-50 text-white py-2.5 rounded-2xl font-bold text-sm shadow-lg active:scale-[0.98] transition-all">
                  {t("login")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Super Admin Login Modal */}
      {showSuperAdminModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-gradient-to-r from-purple-700 to-purple-900 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-white" />
                <p className="text-white font-bold text-sm">Super Admin Login</p>
              </div>
              <button onClick={() => setShowSuperAdminModal(false)} className="text-white/70 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSuperAdminLogin} className="p-5 space-y-4">
              <p className="text-gray-500 text-xs">Enter the super admin password to access system-level controls.</p>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="password"
                  value={saPassword}
                  onChange={e => { setSaPassword(e.target.value); setSaError(""); }}
                  placeholder="Super admin password"
                  autoFocus
                  className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-300"
                />
              </div>
              {saError && (
                <div className="flex items-center gap-2 text-rose-600 text-xs bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  {saError}
                </div>
              )}
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowSuperAdminModal(false)}
                  className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-2xl font-semibold text-sm hover:bg-gray-50 transition">
                  Cancel
                </button>
                <button type="submit" disabled={!saPassword}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 disabled:opacity-50 text-white py-2.5 rounded-2xl font-bold text-sm shadow-lg active:scale-[0.98] transition-all">
                  Login
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Super Admin Panel Modal */}
      {showSuperPanel && (
        <SuperAdminPanel onClose={() => setShowSuperPanel(false)} />
      )}
    </>
  );
}
