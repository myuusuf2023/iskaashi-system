import { Menu, Bell, Printer, ShieldCheck, Eye, Languages } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

const LANGS = [
  { code: "en", label: "English" },
  { code: "ar", label: "العربية" },
  { code: "so", label: "Af Soomaali" },
];

export default function Header({ title, onMenuClick }) {
  const { isAdmin, isSuperAdmin } = useAuth();
  const { lang, setLang, t } = useLanguage();

  return (
    <header className="no-print bg-white border-b border-gray-100 px-4 py-0 flex items-stretch justify-between sticky top-0 z-10 shadow-sm">
      {/* Left: menu + title with emerald accent bar */}
      <div className="flex items-stretch gap-0">
        <button
          onClick={onMenuClick}
          className="lg:hidden px-3 text-gray-500 hover:bg-gray-50 transition border-r border-gray-100"
        >
          <Menu className="w-5 h-5" />
        </button>
        {/* Emerald accent stripe */}
        <div className="w-1 bg-emerald-500 rounded-r my-2 mr-3 hidden sm:block" />
        <div className="flex flex-col justify-center py-2.5">
          <h1 className="text-base font-bold text-gray-800 leading-tight">{title}</h1>
          <p className="text-[11px] text-gray-400 leading-tight hidden sm:block">
            Iskaashi Educational Development Org.
          </p>
        </div>
      </div>

      {/* Right: language switcher + role badge + actions + avatar */}
      <div className="flex items-center gap-1.5">

        {/* Language switcher dropdown */}
        <div className="relative flex items-center mr-1">
          <Languages className="absolute left-2 w-3.5 h-3.5 text-emerald-500 pointer-events-none z-10" />
          <select
            value={lang}
            onChange={e => setLang(e.target.value)}
            className="pl-7 pr-2.5 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-xl outline-none focus:ring-2 focus:ring-emerald-300 cursor-pointer hover:bg-emerald-100 transition appearance-none"
          >
            {LANGS.map(({ code, label }) => (
              <option key={code} value={code}>{label}</option>
            ))}
          </select>
        </div>

        {/* Role pill */}
        <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
          isAdmin
            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
            : "bg-gray-100 text-gray-500 border border-gray-200"
        }`}>
          {isAdmin
            ? <ShieldCheck className="w-3 h-3" />
            : <Eye className="w-3 h-3" />}
          {isSuperAdmin ? "Super Admin" : isAdmin ? t("admin_label") : t("viewer_label")}
        </div>

        <button
          onClick={() => window.print()}
          title="Print / Save as PDF"
          className="p-2 rounded-lg text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition"
        >
          <Printer className="w-4.5 h-4.5" />
        </button>

        <button className="relative p-2 rounded-lg text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition">
          <Bell className="w-4.5 h-4.5" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-rose-500 rounded-full" />
        </button>

        {/* Avatar */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm ${
          isSuperAdmin ? "bg-gradient-to-br from-purple-500 to-purple-800" : isAdmin ? "bg-gradient-to-br from-emerald-500 to-emerald-700" : "bg-gradient-to-br from-gray-400 to-gray-600"
        }`}>
          IS
        </div>
      </div>
    </header>
  );
}
