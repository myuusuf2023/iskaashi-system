import { createContext, useContext, useState, useEffect, useCallback } from "react";
import translations from "../i18n/translations";

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    return localStorage.getItem("isk_lang") || "en";
  });

  // Apply RTL direction + lang attr to document
  useEffect(() => {
    document.documentElement.dir  = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
    localStorage.setItem("isk_lang", lang);
  }, [lang]);

  const setLang = useCallback((l) => {
    if (["en", "ar", "so"].includes(l)) setLangState(l);
  }, []);

  // t(key, params?) — returns translated string with optional {placeholder} replacement
  const t = useCallback((key, params) => {
    const dict = translations[lang] || translations.en;
    let str = dict[key] ?? translations.en[key] ?? key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      });
    }
    return str;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
}
