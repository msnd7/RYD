import { useState } from 'react'
import { NavLink, Outlet, useNavigate, useParams, Link } from 'react-router-dom'
import { useDb } from '../store/db'
import { useAuth } from '../store/auth'
import { Logo, Wordmark } from './Logo'
import { LoginNotice } from './LoginNotice'
import {
  IconGrid, IconCheck, IconPin, IconUsers, IconLayers, IconBook, IconDoc,
  IconChart, IconMega, IconWallet, IconGear, IconOut, IconHome, IconBack,
} from './icons'
import { dueSoonTasks } from '../lib/selectors'

type NavItem = { to: string; label: string; Icon: (p: { className?: string }) => JSX.Element; badge?: number; hide?: boolean }

export function MosqueLayout() {
  const { mid = '' } = useParams()
  const { db } = useDb()
  const { user, isDirector, canFinance } = useAuth()
  const mosque = db.mosques.find((m) => m.id === mid)
  const [open, setOpen] = useState(false)

  if (!mosque || !user) return null

  const myTasks = db.tasks.filter(
    (t) => t.mosqueId === mid && t.status !== 'done' &&
      (isDirector || user.role === 'supervisor' || t.assigneeId === user.id),
  ).length

  const pendingLeaves = db.leaves.filter((l) => l.mosqueId === mid && l.status === 'pending').length

  const items: NavItem[] = [
    { to: '', label: 'لوحة المعلومات', Icon: IconGrid },
    { to: 'tasks', label: 'المهام والقرارات', Icon: IconCheck, badge: myTasks },
    { to: 'attendance', label: 'الحضور والتحضير', Icon: IconPin, badge: pendingLeaves },
    { to: 'staff', label: 'فريق العمل', Icon: IconUsers },
    { to: 'committees', label: 'اللجان', Icon: IconLayers },
    { to: 'teachers', label: 'المعلمون', Icon: IconBook },
    { to: 'meetings', label: 'محاضر الاجتماعات', Icon: IconDoc },
    { to: 'reports', label: 'التقارير', Icon: IconChart },
    { to: 'announcements', label: 'الإعلانات', Icon: IconMega },
    { to: 'finance', label: 'الإدارة المالية', Icon: IconWallet, hide: !canFinance },
    { to: 'settings', label: 'إعدادات المسجد', Icon: IconGear, hide: !isDirector },
  ]

  const accent = { brand: 'bg-brand-700', olive: 'bg-olive-600', gold: 'bg-gold-500' }[mosque.color]

  return (
    <div className="min-h-screen">
      <TopBar onMenu={() => setOpen((o) => !o)} title={mosque.name} subtitle={mosque.address} back="/" />
      <LoginNotice />

      <div className="flex">
        {/* Sidebar */}
        <aside className={`no-print fixed lg:sticky top-0 z-40 h-screen w-[264px] shrink-0 bg-white border-l border-slate-200
          transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}>
          <div className="h-full flex flex-col">
            <div className="p-4 border-b border-slate-100">
              <Link to="/" className="flex items-center gap-2.5 group">
                <Logo size={36} />
                <div>
                  <div className="font-display font-extrabold text-brand-800 text-[15px] leading-tight">رياض القرآن</div>
                  <div className="text-[10px] font-bold text-ink-500 group-hover:text-brand-600">الرجوع لواجهة المجمع ←</div>
                </div>
              </Link>
              <div className={`mt-3 rounded-2xl ${accent} text-white px-3.5 py-2.5`}>
                <div className="text-[10px] font-bold text-white/70">المسجد الحالي</div>
                <div className="font-extrabold text-sm">{mosque.name}</div>
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {items.filter((i) => !i.hide).map((it) => (
                <NavLink key={it.to} to={it.to} end={it.to === ''} onClick={() => setOpen(false)}
                  className={({ isActive }) => `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13.5px] font-bold transition
                    ${isActive ? 'bg-brand-700 text-white shadow-soft' : 'text-ink-700 hover:bg-slate-100'}`}>
                  <it.Icon />
                  <span className="flex-1">{it.label}</span>
                  {!!it.badge && (
                    <span className="text-[10px] font-black bg-gold-500 text-white rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                      {it.badge}
                    </span>
                  )}
                </NavLink>
              ))}
            </nav>

            <div className="p-3 border-t border-slate-100">
              <MosqueSwitcher current={mid} />
            </div>
          </div>
        </aside>

        {open && <div className="fixed inset-0 bg-ink-900/30 z-30 lg:hidden no-print" onClick={() => setOpen(false)} />}

        <main className="flex-1 min-w-0 p-4 sm:p-6 pb-24 lg:pb-8">
          <div className="max-w-[1180px] mx-auto fade-in"><Outlet /></div>
        </main>
      </div>
    </div>
  )
}

function MosqueSwitcher({ current }: { current: string }) {
  const { db } = useDb()
  const nav = useNavigate()
  return (
    <select value={current} onChange={(e) => nav(`/m/${e.target.value}`)}
      className="field text-[13px] font-bold">
      {db.mosques.map((m) => <option key={m.id} value={m.id}>الانتقال إلى: {m.name}</option>)}
    </select>
  )
}

/* ================= Top bar ================= */
export function TopBar({ onMenu, title, subtitle, back }: {
  onMenu?: () => void; title: string; subtitle?: string; back?: string
}) {
  const { user, logout } = useAuth()
  const { db } = useDb()
  const nav = useNavigate()
  const [menu, setMenu] = useState(false)
  const alerts = user ? dueSoonTasks(db, user).length : 0

  return (
    <header className="no-print sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-slate-200">
      <div className="flex items-center gap-3 px-4 sm:px-6 h-16">
        {onMenu && (
          <button onClick={onMenu} className="lg:hidden w-10 h-10 grid place-items-center rounded-xl hover:bg-slate-100" aria-label="القائمة">
            <span className="text-xl">☰</span>
          </button>
        )}
        {back && (
          <button onClick={() => nav(back)} className="hidden lg:grid w-10 h-10 place-items-center rounded-xl hover:bg-slate-100 text-ink-500" title="رجوع">
            <IconBack />
          </button>
        )}

        <div className="min-w-0 flex-1">
          <h1 className="font-display font-extrabold text-[16px] sm:text-lg truncate">{title}</h1>
          {subtitle && <p className="text-[11px] text-ink-500 truncate">{subtitle}</p>}
        </div>

        <button onClick={() => nav('/me')} className="relative w-10 h-10 grid place-items-center rounded-xl hover:bg-slate-100 text-ink-700" title="تنبيهاتي">
          <span className="text-lg">🔔</span>
          {alerts > 0 && <span className="absolute top-1.5 left-1.5 w-4 h-4 text-[9px] font-black grid place-items-center rounded-full bg-rose-500 text-white">{alerts}</span>}
        </button>

        <div className="relative">
          <button onClick={() => setMenu((m) => !m)} className="flex items-center gap-2 pr-2 pl-1 py-1.5 rounded-xl hover:bg-slate-100">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-bl from-brand-500 to-brand-800 text-white grid place-items-center font-extrabold text-sm">
              {user?.name?.[0] ?? '؟'}
            </span>
            <span className="hidden sm:block text-right leading-tight">
              <span className="block text-[13px] font-extrabold">{user?.name}</span>
              <span className="block text-[10px] text-ink-500">{user?.jobTitle}</span>
            </span>
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
              <div className="absolute left-0 mt-2 w-56 card p-2 z-20 pop-in">
                <button onClick={() => { setMenu(false); nav('/me') }} className="w-full text-right px-3 py-2.5 rounded-xl hover:bg-slate-100 text-sm font-bold flex items-center gap-2">
                  <IconUsers /> صفحتي وتقريري
                </button>
                <button onClick={() => { setMenu(false); nav('/') }} className="w-full text-right px-3 py-2.5 rounded-xl hover:bg-slate-100 text-sm font-bold flex items-center gap-2">
                  <IconHome /> واجهة المجمع
                </button>
                <hr className="my-1.5 border-slate-100" />
                <button onClick={() => { logout(); nav('/login') }} className="w-full text-right px-3 py-2.5 rounded-xl hover:bg-rose-50 text-rose-600 text-sm font-bold flex items-center gap-2">
                  <IconOut /> تسجيل الخروج
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

/* ================= Complex (المجمع) layout ================= */
export function ComplexLayout() {
  const { user, isDirector, canFinance } = useAuth()
  const [open, setOpen] = useState(false)
  if (!user) return null

  const items: NavItem[] = [
    { to: '/', label: 'المساجد', Icon: IconHome },
    { to: '/complex/dashboard', label: 'لوحة المجمع', Icon: IconGrid },
    { to: '/complex/tasks', label: 'كل المهام', Icon: IconCheck },
    { to: '/complex/attendance', label: 'الحضور العام', Icon: IconPin },
    { to: '/complex/staff', label: 'العاملون', Icon: IconUsers },
    { to: '/complex/meetings', label: 'محاضر المجمع', Icon: IconDoc },
    { to: '/complex/reports', label: 'التقارير', Icon: IconChart },
    { to: '/complex/announcements', label: 'الإعلانات', Icon: IconMega },
    { to: '/complex/finance', label: 'الإدارة المالية', Icon: IconWallet, hide: !canFinance },
    { to: '/complex/settings', label: 'الإعدادات', Icon: IconGear, hide: !isDirector },
  ]

  return (
    <div className="min-h-screen">
      <TopBar onMenu={() => setOpen((o) => !o)} title="مجمع رياض القرآن" subtitle="الإدارة العامة" />
      <LoginNotice />
      <div className="flex">
        <aside className={`no-print fixed lg:sticky top-0 z-40 h-screen w-[252px] shrink-0 bg-white border-l border-slate-200
          transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}>
          <div className="p-4 border-b border-slate-100"><Wordmark compact /></div>
          <nav className="p-3 space-y-1 overflow-y-auto">
            {items.filter((i) => !i.hide).map((it) => (
              <NavLink key={it.to} to={it.to} end={it.to === '/'} onClick={() => setOpen(false)}
                className={({ isActive }) => `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13.5px] font-bold transition
                  ${isActive ? 'bg-brand-700 text-white shadow-soft' : 'text-ink-700 hover:bg-slate-100'}`}>
                <it.Icon /> {it.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        {open && <div className="fixed inset-0 bg-ink-900/30 z-30 lg:hidden no-print" onClick={() => setOpen(false)} />}
        <main className="flex-1 min-w-0 p-4 sm:p-6 pb-24 lg:pb-8">
          <div className="max-w-[1180px] mx-auto fade-in"><Outlet /></div>
        </main>
      </div>
    </div>
  )
}
