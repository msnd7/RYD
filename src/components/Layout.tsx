import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate, useParams, Link, useLocation } from 'react-router-dom'
import { useDb } from '../store/db'
import { useAuth } from '../store/auth'
import { LogoMark, Wordmark } from './Brand'
import { LoginNotice } from './LoginNotice'
import {
  IconGrid, IconCheck, IconPin, IconUsers, IconLayers, IconBook, IconDoc,
  IconChart, IconMega, IconWallet, IconGear, IconOut, IconHome, IconBack, IconBell,
} from './icons'
import { dueSoonTasks } from '../lib/selectors'
import { ThemeToggle } from '../store/theme'
import { InstallAppModal } from './InstallApp'

type Item = {
  to: string; label: string; short?: string
  Icon: (p: { className?: string }) => JSX.Element
  badge?: number; hide?: boolean; primary?: boolean
}
type Group = { title: string; items: Item[] }

/* ===================== قشرة عامة ===================== */
function Shell({ groups, title, subtitle, back, brand }: {
  groups: Group[]; title: string; subtitle?: string; back?: string; brand: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  useEffect(() => { setOpen(false) }, [loc.pathname])

  const visibleGroups = groups
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.hide) }))
    .filter((g) => g.items.length > 0)
  const bottom = visibleGroups.flatMap((g) => g.items).filter((i) => i.primary).slice(0, 5)

  return (
    <div className="min-h-[100dvh]">
      <TopBar onMenu={() => setOpen((o) => !o)} title={title} subtitle={subtitle} back={back} />
      <LoginNotice />

      <div className="flex">
        <aside
          className={`no-print fixed lg:sticky top-0 z-50 h-[100dvh] w-[262px] shrink-0 bg-surface border-l border-line
            flex flex-col transition-transform duration-300 will-change-transform
            ${open ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}
        >
          <div className="p-3.5 border-b border-line">{brand}</div>
          <nav className="flex-1 overflow-y-auto px-2.5 pb-6">
            {visibleGroups.map((g) => (
              <div key={g.title}>
                <p className="nav-group">{g.title}</p>
                <ul className="space-y-0.5">
                  {g.items.map((it) => (
                    <li key={it.to}>
                      <NavLink
                        to={it.to} end={it.to === '' || it.to === '/'}
                        className={({ isActive }) => `flex items-center gap-2.5 px-3 h-10 rounded-lg text-[13px] font-bold transition
                          ${isActive
                            ? 'bg-navy-700 text-white shadow-soft'
                            : 'text-ink-700 hover:bg-navy-50 hover:text-navy-800'}`}
                      >
                        <it.Icon className="w-[17px] h-[17px] shrink-0" />
                        <span className="flex-1 truncate">{it.label}</span>
                        {!!it.badge && (
                          <span className="text-[10px] font-black bg-orange-500 text-white rounded-full px-1.5 min-w-[19px] h-[19px] grid place-items-center">
                            {it.badge > 99 ? '99+' : it.badge}
                          </span>
                        )}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        {open && <div className="fixed inset-0 bg-navy-950/40 backdrop-blur-[2px] z-40 lg:hidden no-print" onClick={() => setOpen(false)} />}

        <main className="flex-1 min-w-0">
          <div className="max-w-[1180px] mx-auto px-4 sm:px-5 lg:px-7 py-5 lg:py-7 pb-[calc(84px+var(--safe-b))] lg:pb-10 fade-in">
            <Outlet />
          </div>
        </main>
      </div>

      {bottom.length > 0 && (
        <nav className="no-print lg:hidden fixed bottom-0 inset-x-0 z-40 bg-surface/95 backdrop-blur-lg border-t border-line"
          style={{ paddingBottom: 'var(--safe-b)' }}>
          <ul className="grid grid-cols-5">
            {bottom.map((it) => (
              <li key={it.to}>
                <NavLink to={it.to} end={it.to === '' || it.to === '/'}
                  className={({ isActive }) => `relative flex flex-col items-center justify-center gap-1 h-[60px] text-[10px] font-bold transition
                    ${isActive ? 'text-navy-700' : 'text-ink-400'}`}>
                  {({ isActive }) => (
                    <>
                      {isActive && <span className="absolute top-0 w-8 h-[3px] rounded-b-full bg-orange-500" />}
                      <it.Icon className="w-[20px] h-[20px]" />
                      <span className="truncate max-w-[66px]">{it.short ?? it.label}</span>
                      {!!it.badge && (
                        <span className="absolute top-2 right-[calc(50%-18px)] w-4 h-4 text-[9px] font-black grid place-items-center rounded-full bg-orange-500 text-white">
                          {it.badge > 9 ? '9+' : it.badge}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  )
}

/* ===================== شريط علوي ===================== */
export function TopBar({ onMenu, title, subtitle, back }: {
  onMenu?: () => void; title: string; subtitle?: string; back?: string
}) {
  const { user, logout } = useAuth()
  const { db, mode, sync, refresh } = useDb()
  const nav = useNavigate()
  const [menu, setMenu] = useState(false)
  const [install, setInstall] = useState(false)
  const alerts = user ? dueSoonTasks(db, user).length : 0

  return (
    <header className="no-print sticky top-0 z-40 bg-surface/90 backdrop-blur-xl border-b border-line"
      style={{ paddingTop: 'var(--safe-t)' }}>
      <div className="flex items-center gap-2 px-3 sm:px-5 h-14 sm:h-[58px]">
        {onMenu && (
          <button onClick={onMenu} className="lg:hidden btn-icon" aria-label="القائمة">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
        {back && (
          <button onClick={() => nav(back)} className="hidden lg:inline-grid btn-icon" title="رجوع"><IconBack /></button>
        )}
        <div className="lg:hidden"><LogoMark h={26} /></div>

        <div className="min-w-0 flex-1 mr-1">
          <p className="font-display font-bold text-[14px] sm:text-[15px] truncate leading-tight text-navy-900">{title}</p>
          {subtitle && <p className="text-[10.5px] text-ink-400 truncate">{subtitle}</p>}
        </div>

        <SyncBadge mode={mode} sync={sync} onRefresh={() => { void refresh() }} />

        <ThemeToggle />

        <button onClick={() => nav('/me')} className="relative btn-icon" title="تنبيهاتي">
          <IconBell />
          {alerts > 0 && (
            <span className="absolute top-1 left-1 min-w-[15px] h-[15px] px-1 text-[9px] font-black grid place-items-center rounded-full bg-orange-500 text-white">
              {alerts > 9 ? '9+' : alerts}
            </span>
          )}
        </button>

        <div className="relative">
          <button onClick={() => setMenu((m) => !m)}
            className="flex items-center gap-2 pr-1.5 pl-1 h-10 rounded-lg hover:bg-navy-50 transition">
            <span className="w-8 h-8 rounded-lg bg-navy-700 text-white grid place-items-center font-bold text-[13px]">
              {user?.name?.trim()[0] ?? '؟'}
            </span>
            <span className="hidden md:block text-right leading-tight max-w-[140px]">
              <span className="block text-[12px] font-bold truncate">{user?.name}</span>
              <span className="block text-[10px] text-ink-400 truncate">{user?.jobTitle}</span>
            </span>
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
              <div className="menu left-0 w-56 z-20">
                <div className="px-2.5 py-2 border-b border-line mb-1">
                  <p className="text-[12.5px] font-bold truncate">{user?.name}</p>
                  <p className="text-[10.5px] text-ink-400 truncate" dir="ltr">{user?.email}</p>
                </div>
                <button className="menu-item" onClick={() => { setMenu(false); nav('/me') }}>
                  <IconUsers className="w-4 h-4" /> صفحتي وتقريري
                </button>
                {user?.role === 'director' && (
                  <button className="menu-item" onClick={() => { setMenu(false); nav('/') }}>
                    <IconHome className="w-4 h-4" /> واجهة المجمع
                  </button>
                )}
                <button className="menu-item" onClick={() => { setMenu(false); setInstall(true) }}>
                  <span className="w-4 text-center">⬇</span> تثبيت التطبيق
                </button>
                <button className="menu-item" onClick={() => { setMenu(false); nav('/change-password') }}>
                  <IconGear className="w-4 h-4" /> تغيير رمز الدخول
                </button>
                <hr className="menu-sep" />
                <button className="menu-item-danger" onClick={async () => { await logout(); nav('/login') }}>
                  <IconOut className="w-4 h-4" /> تسجيل الخروج
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <InstallAppModal open={install} onClose={() => setInstall(false)} />
    </header>
  )
}

/** حالة حفظ البيانات: مشتركة على الخادم أم محلية على الجهاز */
function SyncBadge({ mode, sync, onRefresh }: { mode: string; sync: string; onRefresh: () => void }) {
  if (mode === 'loading') return null

  if (mode === 'local') {
    return (
      <span title="لا يوجد خادم متصل — تُحفظ البيانات في هذا المتصفح فقط"
        className="hidden sm:inline-flex chip bg-orange-50 text-orange-700 border border-orange-200">
        حفظ محلي
      </span>
    )
  }
  if (sync === 'saving') {
    return <span className="hidden sm:inline-flex chip bg-navy-50 text-navy-700">جارٍ الحفظ…</span>
  }
  if (sync === 'error') {
    return (
      <button onClick={onRefresh} title="تعذّر الحفظ على الخادم — اضغط لإعادة المحاولة"
        className="inline-flex chip bg-orange-500 text-white">تعذّر الحفظ</button>
    )
  }
  return (
    <button onClick={onRefresh} title="البيانات محفوظة على الخادم — اضغط لتحديثها الآن"
      className="hidden lg:inline-flex chip bg-navy-50 text-navy-700 hover:bg-navy-100 transition">محفوظ</button>
  )
}

/* ===================== واجهة المسجد ===================== */
export function MosqueLayout() {
  const { mid = '' } = useParams()
  const { db } = useDb()
  const { user, isDirector, canFinance } = useAuth()
  const nav = useNavigate()
  const mosque = db.mosques.find((m) => m.id === mid)
  if (!mosque || !user) return null

  const myTasks = db.tasks.filter(
    (t) => t.mosqueId === mid && t.status !== 'done' &&
      (isDirector || user.role === 'supervisor' || t.assigneeId === user.id),
  ).length
  const pendingLeaves = db.leaves.filter((l) => l.mosqueId === mid && l.status === 'pending').length

  const groups: Group[] = [
    {
      title: 'المتابعة اليومية',
      items: [
        { to: '', label: 'لوحة المعلومات', short: 'اللوحة', Icon: IconGrid, primary: true },
        { to: 'attendance', label: 'التحضير', short: 'الحضور', Icon: IconPin, badge: pendingLeaves, primary: true },
        { to: 'tasks', label: 'قائمة المهام', short: 'المهام', Icon: IconCheck, badge: myTasks, primary: true },
      ],
    },
    {
      title: 'المسجد وفريقه',
      items: [
        { to: 'staff', label: 'الموظفون', short: 'الموظفون', Icon: IconUsers, primary: true },
        { to: 'teachers', label: 'المعلمون', short: 'المعلمون', Icon: IconBook, primary: true },
        { to: 'committees', label: 'اللجان', Icon: IconLayers },
      ],
    },
    {
      title: 'التوثيق والتواصل',
      items: [
        { to: 'meetings', label: 'محاضر الاجتماعات', Icon: IconDoc },
        { to: 'reports', label: 'التقارير', Icon: IconChart },
        { to: 'announcements', label: 'الإعلانات', Icon: IconMega },
      ],
    },
    {
      title: 'المالية والإعدادات',
      items: [
        { to: 'finance', label: 'الإدارة المالية', Icon: IconWallet, hide: !canFinance },
        { to: 'settings', label: 'إعدادات المسجد', Icon: IconGear, hide: !isDirector },
      ],
    },
  ]

  const brand = (
    <div className="space-y-2.5">
      {isDirector && (
        <Link to="/" className="flex items-center gap-2 text-[11px] font-bold text-ink-400 hover:text-orange-600 transition">
          <IconBack className="w-3.5 h-3.5" /> كل المساجد
        </Link>
      )}
      <div className="flex items-center gap-2.5">
        <LogoMark h={34} />
        {isDirector ? (
          <select
            value={mid} onChange={(e) => nav(`/m/${e.target.value}`)}
            className="field !h-9 !px-2.5 !pl-7 text-[12.5px] font-bold !border-navy-200 !bg-navy-50 !text-navy-800"
            aria-label="اختيار المسجد"
          >
            {db.mosques.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        ) : (
          <span className="min-w-0 leading-tight border-r border-line pr-2.5">
            <span className="block font-display font-bold text-[13px] text-navy-800 truncate">{mosque.shortName}</span>
            <span className="block text-[10px] font-bold text-ink-400 truncate">مسجدي</span>
          </span>
        )}
      </div>
    </div>
  )

  return <Shell groups={groups} title={mosque.name} subtitle={mosque.address}
    back={isDirector ? '/' : undefined} brand={brand} />
}

/* ===================== مساحة الموظف (عضو اللجنة) ===================== */
export function MemberLayout() {
  const { user } = useAuth()
  const { db } = useDb()
  if (!user) return null

  const myOpen = db.tasks.filter(
    (t) => t.status !== 'done' && (t.assigneeId === user.id || user.committeeIds.includes(t.committeeId)),
  ).length
  const myCustodies = db.custodies.filter(
    (c) => c.committeeId && user.committeeIds.includes(c.committeeId) && c.status !== 'closed' && c.status !== 'rejected',
  ).length

  const groups: Group[] = [
    {
      title: 'عملي اليومي',
      items: [
        { to: '/my', label: 'قائمة المهام', short: 'المهام', Icon: IconCheck, badge: myOpen, primary: true },
        { to: '/my/attendance', label: 'التحضير', short: 'التحضير', Icon: IconPin, primary: true },
        { to: '/my/committee', label: 'لجنتي', short: 'لجنتي', Icon: IconLayers, badge: myCustodies, primary: true },
      ],
    },
    {
      title: 'ما يخصّني',
      items: [
        { to: '/my/announcements', label: 'الإعلانات', short: 'الإعلانات', Icon: IconMega, primary: true },
        { to: '/my/report', label: 'تقريري وملفي', short: 'تقريري', Icon: IconChart, primary: true },
      ],
    },
  ]

  const brand = (
    <div className="flex items-center gap-2.5">
      <LogoMark h={34} />
      <span className="min-w-0 leading-tight border-r border-line pr-2.5">
        <span className="block font-display font-bold text-[13.5px] text-navy-800 truncate">رياض القرآن</span>
        <span className="block text-[10px] font-bold text-ink-400 truncate">مساحتي</span>
      </span>
    </div>
  )

  return (
    <Shell
      groups={groups}
      title={user.name}
      subtitle={`${user.jobTitle} · ${db.mosques.find((m) => m.id === user.mosqueId)?.name ?? ''}`}
      brand={brand}
    />
  )
}

/* ===================== واجهة المجمع ===================== */
export function ComplexLayout() {
  const { user, isDirector, canFinance } = useAuth()
  const { db } = useDb()
  if (!user) return null

  const pendingAll =
    db.leaves.filter((l) => l.status === 'pending').length +
    db.custodies.filter((c) => c.status === 'requested').length

  const groups: Group[] = [
    {
      title: 'نظرة عامة',
      items: [
        { to: '/', label: 'المساجد', short: 'المساجد', Icon: IconHome, primary: true },
        { to: '/complex/dashboard', label: 'لوحة المجمع', short: 'اللوحة', Icon: IconGrid, primary: true },
      ],
    },
    {
      title: 'المتابعة',
      items: [
        { to: '/complex/attendance', label: 'الحضور العام', short: 'الحضور', Icon: IconPin, badge: pendingAll, primary: true },
        { to: '/complex/tasks', label: 'كل المهام', short: 'المهام', Icon: IconCheck, primary: true },
        { to: '/complex/staff', label: 'الموظفون', short: 'الموظفون', Icon: IconUsers, primary: true },
      ],
    },
    {
      title: 'التوثيق والتواصل',
      items: [
        { to: '/complex/meetings', label: 'محاضر المجمع', Icon: IconDoc },
        { to: '/complex/reports', label: 'التقارير', Icon: IconChart },
        { to: '/complex/announcements', label: 'الإعلانات', Icon: IconMega },
      ],
    },
    {
      title: 'المالية والإعدادات',
      items: [
        { to: '/complex/finance', label: 'الإدارة المالية', Icon: IconWallet, hide: !canFinance },
        { to: '/complex/settings', label: 'الإعدادات', Icon: IconGear, hide: !isDirector },
      ],
    },
  ]

  return <Shell groups={groups} title={db.settings.complexName} subtitle="الإدارة العامة" brand={<Wordmark h={38} />} />
}
