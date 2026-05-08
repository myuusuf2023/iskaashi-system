import { createContext, useContext, useState } from "react";

const AuthContext = createContext(null);

export const ADMIN_PASSWORD       = "admin2026";
export const SUPER_ADMIN_PASSWORD = "super2026";

function loadRole() {
  const stored = localStorage.getItem("isk_role");
  if (stored === "superadmin") return "superadmin";
  if (stored === "admin")      return "admin";
  return "viewer";
}

export function AuthProvider({ children }) {
  const [role, setRole] = useState(loadRole);

  function loginAsAdmin(password) {
    if (password !== ADMIN_PASSWORD) return false;
    localStorage.setItem("isk_role", "admin");
    setRole("admin");
    return true;
  }

  function loginAsSuperAdmin(password) {
    if (password !== SUPER_ADMIN_PASSWORD) return false;
    localStorage.setItem("isk_role", "superadmin");
    setRole("superadmin");
    return true;
  }

  function logout() {
    localStorage.removeItem("isk_role");
    setRole("viewer");
  }

  const isAdmin      = role === "admin" || role === "superadmin";
  const isSuperAdmin = role === "superadmin";

  return (
    <AuthContext.Provider value={{ role, isAdmin, isSuperAdmin, loginAsAdmin, loginAsSuperAdmin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
