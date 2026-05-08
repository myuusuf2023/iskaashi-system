import { useState } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import Dashboard from './pages/Dashboard'
import Donors from './pages/Donors'
import Orphans from './pages/Orphans'
import Payments from './pages/Payments'
import Reports from './pages/Reports'
import History from './pages/History'
import { AuthProvider } from './context/AuthContext'
import { LanguageProvider, useLanguage } from './context/LanguageContext'

function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const { t } = useLanguage()

  const titleKeys = {
    '/':         'title_dashboard',
    '/donors':   'title_donors',
    '/orphans':  'title_orphans',
    '/payments': 'title_payments',
    '/reports':  'title_reports',
    '/history':  'title_history',
  }
  const title = t(titleKeys[location.pathname] || 'title_dashboard')

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title={title} onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className={`flex-1 min-h-0 ${location.pathname === '/' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
            <Routes>
              <Route path="/"         element={<Dashboard />} />
              <Route path="/donors"   element={<Donors />} />
              <Route path="/orphans"  element={<Orphans />} />
              <Route path="/payments" element={<Payments />} />
              <Route path="/reports"  element={<Reports />} />
              <Route path="/history"  element={<History />} />
            </Routes>
          </div>

          {/* Footer — hidden on dashboard so everything fits without scrolling */}
          {location.pathname !== '/' && (
          <footer className="no-print border-t border-gray-700 bg-gray-800">
            <div className="px-4 md:px-6 py-5">
              {/* Top row */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                {/* Brand */}
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
                    <span className="text-white text-xs font-extrabold tracking-tight">IS</span>
                  </div>
                  <div>
                    <p className="font-bold text-gray-100 text-sm leading-tight">URURKA HORUMARINTA WAXBARASHADA</p>
                    <p className="text-[11px] text-emerald-400 font-semibold leading-tight">ISKAASHI — {t('orphan_support_prog')}</p>
                  </div>
                </div>

                {/* Arabic hadith */}
                <div className="text-center sm:text-right">
                  <p className="font-arabic text-gray-300 text-sm leading-relaxed" dir="rtl" lang="ar">
                    أنا وكافل اليتيم كهاتين في الجنة
                  </p>
                  <p className="text-[10px] text-gray-500 mt-0.5">— رواه البخاري</p>
                </div>
              </div>

              {/* Divider */}
              <div className="my-4 border-t border-gray-700" />

              {/* Bottom row */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-gray-400">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span>© {new Date().getFullYear()} Iskaashi Educational Development Org.</span>
                  <span className="hidden sm:inline text-gray-600">|</span>
                  <span>{t('all_rights_reserved')}</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <a href="tel:+252615574777" className="flex items-center gap-1 hover:text-emerald-400 transition">
                    📞 +252 615 57 47 77
                  </a>
                  <span className="text-gray-600 hidden sm:inline">|</span>
                  <span className="text-gray-400">{t('contact_label')} Ali Ahmed Mohamed</span>
                </div>
              </div>
            </div>
          </footer>
          )}
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <Layout />
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  )
}
