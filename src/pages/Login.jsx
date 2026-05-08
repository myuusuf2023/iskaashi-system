import { useState } from "react";
import { Heart, Lock, ShieldCheck, AlertCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { loginAsAdmin, loginAsViewer } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleAdminLogin(e) {
    e.preventDefault();
    setLoading(true);
    const ok = loginAsAdmin(password);
    setLoading(false);
    if (!ok) {
      setError("Incorrect password. Please try again.");
      setPassword("");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="mb-8">
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-4">
            <img
              src="/Iskaashi%20Educational%20Development%20Organization%20logo.png"
              alt="Iskaashi Educational Development Organization"
              className="w-full object-contain object-center"
              style={{ maxHeight: "88px" }}
            />
          </div>
          <div className="flex items-center justify-center gap-2 bg-emerald-700/50 rounded-xl px-4 py-2 border border-emerald-600">
            <Heart className="w-4 h-4 text-rose-400" />
            <p className="text-white text-xs font-semibold">Orphan Support Programme {new Date().getFullYear()}</p>
          </div>
        </div>

        {/* Cards */}
        <div className="space-y-4">

          {/* Admin card */}
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-5 py-4 flex items-center gap-3">
              <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-white font-bold text-sm">Admin / Management</p>
                <p className="text-emerald-200 text-xs">Full access — add, edit, delete, manage</p>
              </div>
            </div>
            <form onSubmit={handleAdminLogin} className="p-5 space-y-3">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(""); }}
                  placeholder="Enter admin password"
                  className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-300"
                />
              </div>
              {error && (
                <div className="flex items-center gap-2 text-rose-600 text-xs bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={!password || loading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-semibold text-sm transition">
                Login as Admin
              </button>
            </form>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-emerald-600" />
            <span className="text-emerald-400 text-xs">or</span>
            <div className="flex-1 border-t border-emerald-600" />
          </div>

          {/* Viewer card */}
          <div className="bg-white/10 border border-white/20 rounded-2xl p-5 backdrop-blur">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
                <Eye className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-white font-bold text-sm">Viewer Access</p>
                <p className="text-emerald-300 text-xs">View-only — browse all data, no changes</p>
              </div>
            </div>
            <button
              onClick={loginAsViewer}
              className="w-full bg-white/20 hover:bg-white/30 text-white border border-white/30 py-2.5 rounded-xl font-semibold text-sm transition">
              Continue as Viewer
            </button>
          </div>
        </div>

        <p className="text-emerald-500 text-xs text-center mt-6">
          Contact: ALI AHMED MOHAMED · +252 615 57 47 77
        </p>
      </div>
    </div>
  );
}
