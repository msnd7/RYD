import { BrowserRouter, HashRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom'
import { DbProvider } from './store/db'
import { AuthProvider, useAuth } from './store/auth'
import { ThemeProvider } from './store/theme'
import { ToastHost } from './components/ui'
import { MosqueLayout, ComplexLayout, MemberLayout } from './components/Layout'
import { Runtime } from './components/Runtime'
import { LogoMark } from './components/Brand'

import Login from './pages/Login'
import ChangePassword from './pages/ChangePassword'
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
import CommitteeDashboard from './pages/CommitteeDashboard'

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

/** الوجهة الافتراضية لكل صلاحية */
function homeFor(role?: string, mosqueId?: string) {
  if (role === 'director') return '/'
  if (role === 'supervisor') return `/m/${mosqueId}`
  return '/my'
}

function Guard({ children }: { children: JSX.Element }) {
  const { user, mustChangePassword, authReady } = useAuth()
  const loc = useLocation()
  if (!authReady) return <Booting />
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  if (mustChangePassword && loc.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }
  return children
}

/** شاشات مدير المجمع وحده */
function DirectorOnly({ children }: { children: JSX.Element }) {
  const { user } = useAuth()
  if (user && user.role !== 'director') {
    return <Navigate to={homeFor(user.role, user.mosqueId as string)} replace />
  }
  return children
}

/** مسجد بعينه: المدير يدخل أيّها شاء، والمشرف مسجده فقط، والموظف لا يدخلها */
function MosqueAccess({ children }: { children: JSX.Element }) {
  const { user } = useAuth()
  const { mid } = useParams()
  if (!user) return null
  if (user.role === 'director') return children
  if (user.role === 'supervisor' && user.mosqueId === mid) return children
  return <Navigate to={homeFor(user.role, user.mosqueId as string)} replace />
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
  if (user) {
    return <Navigate to={mustChangePassword ? '/change-password' : homeFor(user.role, user.mosqueId as string)} replace />
  }
  return <Login />
}

/** يوجّه الجذر حسب الصلاحية */
function RootRedirect() {
  const { user } = useAuth()
  if (!user) return null
  if (user.role === 'director') return <ComplexHome />
  return <Navigate to={homeFor(user.role, user.mosqueId as string)} replace />
}

function Shell() {
  return (
    <Routes>
      <Route path="/login" element={<LoginGate />} />
      <Route path="/change-password" element={<RequireSession><ChangePassword /></RequireSession>} />
      <Route path="/me" element={<Guard><MyPage /></Guard>} />

      {/* ===== واجهة المجمع — لمدير المجمع ===== */}
      <Route path="/" element={<Guard><ComplexLayout /></Guard>}>
        <Route index element={<RootRedirect />} />
        <Route path="complex/dashboard" element={<DirectorOnly><ComplexDashboard /></DirectorOnly>} />
        <Route path="complex/tasks" element={<DirectorOnly><Tasks scope="complex" /></DirectorOnly>} />
        <Route path="complex/attendance" element={<DirectorOnly><Attendance scope="complex" /></DirectorOnly>} />
        <Route path="complex/staff" element={<DirectorOnly><Staff scope="complex" /></DirectorOnly>} />
        <Route path="complex/meetings" element={<DirectorOnly><Meetings scope="complex" /></DirectorOnly>} />
        <Route path="complex/reports" element={<DirectorOnly><Reports scope="complex" /></DirectorOnly>} />
        <Route path="complex/announcements" element={<DirectorOnly><Announcements scope="complex" /></DirectorOnly>} />
        <Route path="complex/finance" element={<DirectorOnly><Finance scope="complex" /></DirectorOnly>} />
        <Route path="complex/settings" element={<DirectorOnly><ComplexSettings /></DirectorOnly>} />
      </Route>

      {/* ===== واجهة المسجد — للمدير ومشرف المسجد ===== */}
      <Route path="/m/:mid" element={<Guard><MosqueAccess><MosqueLayout /></MosqueAccess></Guard>}>
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

      {/* ===== مساحة الموظف وعضو اللجنة ===== */}
      <Route path="/my" element={<Guard><MemberLayout /></Guard>}>
        {/* أول شاشة لعضو اللجنة: لوحة تحكم لجنته */}
        <Route index element={<CommitteeDashboard />} />
        <Route path="tasks" element={<Tasks scope="mine" />} />
        <Route path="attendance" element={<Attendance scope="mine" />} />
        <Route path="committee" element={<Navigate to="/my" replace />} />
        <Route path="announcements" element={<Announcements scope="mine" />} />
        <Route path="report" element={<Reports scope="mine" />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

// HashRouter يعمل عند الرفع على أي استضافة ثابتة بدون إعدادات خادم
const Router = import.meta.env.DEV ? BrowserRouter : HashRouter

export default function App() {
  return (
    <ThemeProvider>
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
    </ThemeProvider>
  )
}
