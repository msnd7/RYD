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

type Item = {
  to: string; label: string; short?: string
  Icon: (p: { className?: string }) => JSX.Element
  badge?: number; hide?: boolean; primary?: boolean
}

/* ===================== قشرة عامة ===================== */
function Shell({ items, title, subtitle, back, brand }: {
  items: Item[]; title: string; subtitle?: string; back?: string; brand?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  useEffect(() => { setOpen(false) }, [loc.pathname])

  const visible = items.filter((i) => !i.hide)
  const bottom = visible.filter((i) => i.primary).slice(0, 5)

  return (
    <div className="min-h-[100dvh]">
      <TopBar onMenu={() => setOpen((o) => !o)} title={title} subtitle={subtitle} back={back} />
      <LoginNotice />

      <div className="flex">
        {/* شريط جانبي */}
        <aside
          className={`no-print fixed lg:sticky top-0 z-50 h-[100dvh] w-[268px] shrink-0 bg-white border-l border-line
            flex flex-col transition-transform duration-300 will-change-transform
            ${open ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}
        >
          <div className="p-4 border-b border-line">{brand}</div>
          <nav className="flex-1 overflow-y-auto p-3 space-y-1 pb-6">
            {visible.map((it) => (
              <NavLink
                key={it.to} to={it.to} end={it.to === '' || it.to === '/'}
                className={({ isActive }) => `group flex items-center gap-3 px-3.5 h-11 rounded-xl text-[13.5px] font-bold transition
                  ${isActive ? 'bg-navy-700 text-white shadow-soft' : 'text-ink-700 hover:bg-navy-50 hover:text-navy-800'}`}
              >
                <it.Icon />
                <span className="flex-1 truncate">{it.label}</span>
                {!!it.badge && (
                  <span className="text-[10px] font-black bg-orange-500 text-white rounded-full px-1.5 min-w-[20px] h-5 grid place-items-center">
                    {it.badge > 99 ? '99+' : it.badge}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </aside>

        {open && <div className="fixed inset-0 bg-navy-950/40 backdrop-blur-[2px] z-40 lg:hidden no-print" onClick={() => setOpen(false)} />}

        <main className="flex-1 min-w-0">
          <div className="max-w-[1200px] mx-auto p-4 sm:p-5 lg:p-7 pb-[calc(84px+var(--safe-b))] lg:pb-10 fade-in">
            <Outlet />
          </div>
        </main>
      </div>

      {/* شريط سفلي للجوال */}
      {bottom.length > 0 && (
        <nav className="no-print lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-lg border-t border-line"
          style={{ paddingBottom: 'var(--safe-b)' }}>
          <ul className="grid grid-cols-5">
            {bottom.map((it) => (
              <li key={it.to}>
                <NavLink to={it.to} end={it.to === '' || it.to === '/'}
                  className={({ isActive }) => `relative flex flex-col items-center justify-center gap-1 h-[62px] text-[10px] font-bold transition
                    ${isActive ? 'text-navy-700' : 'text-ink-400'}`}>
                  {({ isActive }) => (
                    <>
                      {isActive && <span className="absolute top-0 w-9 h-[3px] rounded-b-full bg-orange-500" />}
                      <it.Icon className="w-[21px] h-[21px]" />
                      <span className="truncate max-w-[68px]">{it.short ?? it.label}</span>
                      {!!it.badge && (
                        <span className="absolute top-2 left-1/2 mr-4 translate-x-1 w-4 h-4 text-[9px] font-black grid place-items-center rounded-full bg-orange-500 text-white">
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
  const { db } = useDb()
  const nav = useNavigate()
  const [menu, setMenu] = useState(false)
  const alerts = user ? dueSoonTasks(db, user).length : 0

  return (
    <header className="no-print sticky top-0 z-40 bg-white/85 backdrop-blur-xl border-b border-line"
      style={{ paddingTop: 'var(--safe-t)' }}>
      <div className="flex items-center gap-2 px-3 sm:px-5 h-[60px] max-w-[1600px] mx-auto">
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

        <div className="lg:hidden"><LogoMark size={36} rounded="rounded-lg" pad="p-0" shadow={false} /></div>

        <div className="min-w-0 flex-1 mr-1">
          <h1 className="font-display font-extrabold text-[15px] sm:text-[17px] truncate leading-tight">{title}</h1>
          {subtitle && <p className="text-[11px] text-ink-500 truncate">{subtitle}</p>}
        </div>

        <button onClick={() => nav('/me')} className="relative btn-icon" title="تنبيهاتي">
          <IconBell />
          {alerts > 0 && (
            <span className="absolute top-1 left-1 min-w-[16px] h-4 px-1 text-[9px] font-black grid place-items-center rounded-full bg-orange-500 text-white">
              {alerts > 9 ? '9+' : alerts}
            </span>
          )}
        </button>

        <div className="relative">
          <button onClick={() => setMenu((m) => !m)}
            className="flex items-center gap-2 pr-1.5 pl-1 h-10 rounded-xl hover:bg-navy-50 transition">
            <span className="w-8 h-8 rounded-lg bg-navy-700 text-white grid place-items-center font-extrabold text-[13px]">
              {user?.name?.trim()[0] ?? '؟'}
            </span>
            <span className="hidden md:block text-right leading-tight max-w-[150px]">
              <span className="block text-[12.5px] font-extrabold truncate">{user?.name}</span>
              <span className="block text-[10px] text-ink-500 truncate">{user?.jobTitle}</span>
            </span>
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
              <div className="absolute left-0 mt-2 w-60 card p-2 z-20 pop-in">
                <div className="px-3 py-2 border-b border-line mb-1">
                  <p className="text-[13px] font-extrabold truncate">{user?.name}</p>
                  <p className="text-[11px] text-ink-500 truncate" dir="ltr">{user?.email}</p>
                </div>
                {[
                  ['صفحتي وتقريري', '/me', <IconUsers key="a" />],
                  ['واجهة المجمع', '/', <IconHome key="b" />],
                  ['تغيير رمز الدخول', '/change-password', <IconGear key="c" />],
                ].map(([label, to, icon]) => (
                  <button key={to as string} onClick={() => { setMenu(false); nav(to as string) }}
                    className="w-full text-right px-3 h-10 rounded-xl hover:bg-navy-50 text-[13px] font-bold flex items-center gap-2.5">
                    {icon as any} {label as string}
                  </button>
                ))}
                <hr className="my-1.5 border-line" />
                <button onClick={() => { logout(); nav('/login') }}
                  className="w-full text-right px-3 h-10 rounded-xl hover:bg-orange-50 text-orange-700 text-[13px] font-bold flex items-center gap-2.5">
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

  const items: Item[] = [
    { to: '', label: 'لوحة المعلومات', short: 'اللوحة', Icon: IconGrid, primary: true },
    { to: 'tasks', label: 'المهام والقرارات', short: 'المهام', Icon: IconCheck, badge: myTasks, primary: true },
    { to: 'attendance', label: 'الحضور والتحضير', short: 'الحضور', Icon: IconPin, badge: pendingLeaves, primary: true },
    { to: 'teachers', label: 'المعلمون', short: 'المعلمون', Icon: IconBook, primary: true },
    { to: 'staff', label: 'فريق العمل', short: 'الفريق', Icon: IconUsers, primary: true },
    { to: 'committees', label: 'اللجان', Icon: IconLayers },
    { to: 'meetings', label: 'محاضر الاجتماعات', Icon: IconDoc },
    { to: 'reports', label: 'التقارير', Icon: IconChart },
    { to: 'announcements', label: 'الإعلانات', Icon: IconMega },
    { to: 'finance', label: 'الإدارة المالية', Icon: IconWallet, hide: !canFinance },
    { to: 'settings', label: 'إعدادات المسجد', Icon: IconGear, hide: !isDirector },
  ]

  const brand = (
    <div>
      <Link to="/" className="flex items-center gap-2.5 group">
        <LogoMark size={40} rounded="rounded-lg" pad="p-0" shadow={false} />
        <div className="min-w-0">
          <div className="font-display font-extrabold text-navy-800 text-[14.5px] leading-tight truncate">رياض القرآن</div>
          <div className="text-[10px] font-bold text-ink-500 group-hover:text-orange-600 transition">واجهة المجمع ←</div>
        </div>
      </Link>
      <select
        value={mid} onChange={(e) => nav(`/m/${e.target.value}`)}
        className="field !h-10 mt-3 text-[12.5px] font-bold !bg-navy-700 !text-white !border-navy-700"
        style={{ backgroundImage: "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")" }}
      >
        {db.mosques.map((m) => <option key={m.id} value={m.id} className="text-ink-900 bg-white">{m.name}</option>)}
      </select>
    </div>
  )

  return <Shell items={items} title={mosque.name} subtitle={mosque.address} back="/" brand={brand} />
}

/* ===================== واجهة المجمع ===================== */
export function ComplexLayout() {
  const { user, isDirector, canFinance } = useAuth()
  const { db } = useDb()
  if (!user) return null

  const pendingAll =
    db.leaves.filter((l) => l.status === 'pending').length +
    db.custodies.filter((c) => c.status === 'requested').length

  const items: Item[] = [
    { to: '/', label: 'المساجد', short: 'المساجد', Icon: IconHome, primary: true },
    { to: '/complex/dashboard', label: 'لوحة المجمع', short: 'اللوحة', Icon: IconGrid, primary: true },
    { to: '/complex/tasks', label: 'كل المهام', short: 'المهام', Icon: IconCheck, primary: true },
    { to: '/complex/attendance', label: 'الحضور العام', short: 'الحضور', Icon: IconPin, badge: pendingAll, primary: true },
    { to: '/complex/staff', label: 'العاملون', short: 'العاملون', Icon: IconUsers, primary: true },
    { to: '/complex/meetings', label: 'محاضر المجمع', Icon: IconDoc },
    { to: '/complex/reports', label: 'التقارير', Icon: IconChart },
    { to: '/complex/announcements', label: 'الإعلانات', Icon: IconMega },
    { to: '/complex/finance', label: 'الإدارة المالية', Icon: IconWallet, hide: !canFinance },
    { to: '/complex/settings', label: 'الإعدادات', Icon: IconGear, hide: !isDirector },
  ]

  return <Shell items={items} title={db.settings.complexName} subtitle="الإدارة العامة" brand={<Wordmark size="sm" />} />
}
