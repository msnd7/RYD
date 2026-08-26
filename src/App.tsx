import { BrowserRouter, HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { DbProvider, useDb } from './store/db'
import { AuthProvider, useAuth } from './store/auth'
import { LogoMark } from './components/Brand'
import { ToastHost } from './components/ui'
import { MosqueLayout, ComplexLayout } from './components/Layout'
import { Runtime } from './components/Runtime'

import Login from './pages/Login'
import ComplexHome from './pages/ComplexHome'
import ComplexDashboard from './pages/ComplexDashboard'
import ComplexSettings from './pages/ComplexSettings'
import MosqueSettings from './pages/MosqueSettings'
import Dashboard from './pages/Dashboard'
import Tasks from './pages/Tasks'
import Attendance from './pages/Attendance'
import Staff from './pages/Staff'
import Committees from './pages/Committees'
import Teachers from './pages/Teachers'
import Meetings from './pages/Meetings'
import Reports from './pages/Reports'
import Announcements from './pages/Announcements'
import Finance from './pages/Finance'
import MyPage from './pages/MyPage'
import ChangePassword from './pages/ChangePassword'

function Booting() {
  return (
    <div className="min-h-[100dvh] grid place-items-center bg-canvas">
      <div className="flex flex-col items-center gap-4">
        <LogoMark h={84} className="animate-pulse" />
        <p className="text-[12px] font-bold text-ink-400">جارٍ تحميل بيانات المجمع…</p>
      </div>
    </div>
  )
}

function Guard({ children }: { children: JSX.Element }) {
  const { user, mustChangePassword, authReady } = useAuth()
  const loc = useLocation()
  if (!authReady) return <Booting />
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  // إلزام بتغيير الرمز المبدئي قبل الدخول لأي شاشة
  if (mustChangePassword && loc.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }
  return children
}

function RequireSession({ children }: { children: JSX.Element }) {
  const { user, authReady } = useAuth()
  if (!authReady) return <Booting />
  if (!user) return <Navigate to="/login" replace />
  return children
}

/** لا تُعرض شاشة الدخول قبل معرفة هل توجد جلسة قائمة على الخادم */
function LoginGate() {
  const { user, authReady, mustChangePassword } = useAuth()
  if (!authReady) return <Booting />
  if (user) return <Navigate to={mustChangePassword ? '/change-password' : '/'} replace />
  return <Login />
}

function Shell() {
  return (
    <Routes>
      <Route path="/login" element={<LoginGate />} />
      <Route path="/change-password" element={<RequireSession><ChangePassword /></RequireSession>} />
      <Route path="/me" element={<Guard><MyPage /></Guard>} />

      <Route path="/" element={<Guard><ComplexLayout /></Guard>}>
        <Route index element={<ComplexHome />} />
        <Route path="complex/dashboard" element={<ComplexDashboard />} />
        <Route path="complex/tasks" element={<Tasks scope="complex" />} />
        <Route path="complex/attendance" element={<Attendance scope="complex" />} />
        <Route path="complex/staff" element={<Staff scope="complex" />} />
        <Route path="complex/meetings" element={<Meetings scope="complex" />} />
        <Route path="complex/reports" element={<Reports scope="complex" />} />
        <Route path="complex/announcements" element={<Announcements scope="complex" />} />
        <Route path="complex/finance" element={<Finance scope="complex" />} />
        <Route path="complex/settings" element={<ComplexSettings />} />
      </Route>

      <Route path="/m/:mid" element={<Guard><MosqueLayout /></Guard>}>
        <Route index element={<Dashboard />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="staff" element={<Staff />} />
        <Route path="committees" element={<Committees />} />
        <Route path="teachers" element={<Teachers />} />
        <Route path="meetings" element={<Meetings />} />
        <Route path="reports" element={<Reports />} />
        <Route path="announcements" element={<Announcements />} />
        <Route path="finance" element={<Finance />} />
        <Route path="settings" element={<MosqueSettings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

// HashRouter يعمل عند الرفع على أي استضافة ثابتة بدون إعدادات خادم
const Router = import.meta.env.DEV ? BrowserRouter : HashRouter

export default function App() {
  return (
    <DbProvider>
      <AuthProvider>
        <ToastHost>
          <Router>
            <Shell />
            <Runtime />
          </Router>
        </ToastHost>
      </AuthProvider>
    </DbProvider>
  )
}
