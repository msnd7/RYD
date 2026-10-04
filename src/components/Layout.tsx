import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, Outlet, useNavigate, useParams, useLocation, matchPath } from 'react-router-dom'
import { useDb } from '../store/db'
import { useAuth } from '../store/auth'
import { LogoMark } from './Brand'
import { LoginNotice } from './LoginNotice'
import {
  IconGrid, IconCheck, IconPin, IconUsers, IconLayers, IconBook, IconDoc,
  IconChart, IconMega, IconWallet, IconGear, IconOut, IconHome, IconBack, IconBell,
} from './icons'
import { dueSoonTasks } from '../lib/selectors'
import { ThemeToggle } from '../store/theme'
import { InstallAppModal } from './InstallApp'

type Item = {
  to: string; label: string; short?: string; desc?: string
  Icon: (p: { className?: string }) => JSX.Element
  badge?: number; hide?: boolean
  /** يظهر في شريط التنقل العلوي والشريط السفلي */
  primary?: boolean
  /** المطابقة التامة للمسار (للصفحة الرئيسية) */
  end?: boolean
}
type Group = { title: string; items: Item[] }

const isActive = (it: Item, path: string) => !!matchPath({ path: it.to, end: !!it.end }, path)

/* =====================================================================
   القشرة العامة: شريط علوي بتنقل أفقي + لوحة «كل الأقسام» + شريط سفلي عائم للجوال
   — بلا قائمة جانبية —
   ===================================================================== */
function Shell({ groups, context }: { groups: Group[]; context: React.ReactNode }) {
  const [launcher, setLauncher] = useState(false)
  const loc = useLocation()

  useEffect(() => {
    setLauncher(false)
    // كل شاشة تبدأ من أعلاها
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [loc.pathname])

  // Ctrl/⌘ + K يفتح لوحة الأقسام من أي مكان
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setLauncher((o) => !o) }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const visible = groups
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.hide) }))
    .filter((g) => g.items.length > 0)
  const all = visible.flatMap((g) => g.items)
  const primary = all.filter((i) => i.primary)
  // القسم الحالي إن لم يكن من الأساسية يظهر مؤقتًا في الشريط، فلا يضيع المستخدم
  const current = all.find((i) => isActive(i, loc.pathname))
  const pills = current && !current.primary ? [...primary, current] : primary
  const dock = primary.slice(0, 4)
  const moreBadge = all.filter((i) => !dock.includes(i)).reduce((s, i) => s + (i.badge ?? 0), 0)

  return (
    <div className="min-h-[100dvh] relative">
      {/* هالة لونية هادئة أعلى الصفحة */}
      <div aria-hidden className="no-print pointer-events-none absolute inset-x-0 top-0 h-[340px] -z-0
        bg-[radial-gradient(60%_100%_at_85%_0%,rgb(var(--navy-100)/.75),transparent_70%),radial-gradient(40%_80%_at_10%_0%,rgb(var(--orange-100)/.55),transparent_70%)]" />

      <TopBar context={context} onLauncher={() => setLauncher((o) => !o)} launcherOpen={launcher}
        nav={
          <nav className="hidden lg:flex items-center gap-1 p-1 rounded-full bg-canvas/80 border border-line">
            {pills.map((it) => (
              <NavLink key={it.to} to={it.to} end={it.end}
                className={({ isActive: a }) => `nav-pill ${a ? 'nav-pill-on' : ''}`}>
                <it.Icon className="w-[16px] h-[16px]" />
                <span>{it.short ?? it.label}</span>
                {!!it.badge && <span className="nav-count">{it.badge > 99 ? '99+' : it.badge}</span>}
              </NavLink>
            ))}
            <button onClick={() => setLauncher((o) => !o)}
              className={`nav-pill ${launcher ? 'bg-navy-50 text-navy-800' : ''}`} aria-expanded={launcher}>
              <IconGrid className="w-[16px] h-[16px]" />
              <span>كل الأقسام</span>
            </button>
          </nav>
        }
      />
      <LoginNotice />

      <main className="relative">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 pt-5 lg:pt-8 pb-[calc(112px+var(--safe-b))] lg:pb-14 fade-in">
          <Outlet />
        </div>
      </main>

      {/* الشريط السفلي العائم — للجوال والتابلت */}
      <nav className="dock no-print lg:hidden">
        <ul className="grid grid-cols-5 px-1.5">
          {dock.map((it) => (
            <li key={it.to}>
              <NavLink to={it.to} end={it.end}
                className={({ isActive: a }) => `relative flex flex-col items-center justify-center gap-1 h-[62px] text-[10.5px] font-bold transition
                  ${a ? 'text-navy-700' : 'text-ink-400'}`}>
                {({ isActive: a }) => (
                  <>
                    <span className={`grid place-items-center w-11 h-7 rounded-full transition ${a ? 'bg-navy-700 text-white' : ''}`}>
                      <it.Icon className="w-[18px] h-[18px]" />
                    </span>
                    <span className="truncate max-w-[66px]">{it.short ?? it.label}</span>
                    {!!it.badge && (
                      <span className="absolute top-1.5 right-[calc(50%-22px)] w-4 h-4 text-[9px] font-black grid place-items-center rounded-full bg-orange-500 text-white">
                        {it.badge > 9 ? '9+' : it.badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            </li>
          ))}
          <li>
            <button onClick={() => setLauncher(true)}
              className={`relative w-full flex flex-col items-center justify-center gap-1 h-[62px] text-[10.5px] font-bold transition
                ${launcher || (current && !dock.includes(current)) ? 'text-navy-700' : 'text-ink-400'}`}>
              <span className={`grid place-items-center w-11 h-7 rounded-full transition
                ${current && !dock.includes(current) ? 'bg-navy-700 text-white' : ''}`}>
                <IconGrid className="w-[18px] h-[18px]" />
              </span>
              <span>الأقسام</span>
              {moreBadge > 0 && (
                <span className="absolute top-1.5 right-[calc(50%-22px)] w-4 h-4 text-[9px] font-black grid place-items-center rounded-full bg-orange-500 text-white">
                  {moreBadge > 9 ? '9+' : moreBadge}
                </span>
              )}
            </button>
          </li>
        </ul>
      </nav>

      <Launcher open={launcher} onClose={() => setLauncher(false)} groups={visible} />
    </div>
  )
}

/* ===================== لوحة «كل الأقسام» ===================== */
function Launcher({ open, onClose, groups }: { open: boolean; onClose: () => void; groups: Group[] }) {
  const [q, setQ] = useState('')
  const loc = useLocation()
  const nav = useNavigate()
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setQ('')
    const t = setTimeout(() => { if (window.matchMedia('(pointer: fine)').matches) input.current?.focus() }, 60)
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', h)
    return () => { clearTimeout(t); document.removeEventListener('keydown', h) }
  }, [open, onClose])

  const filtered = useMemo(() => {
    const s = q.trim()
    if (!s) return groups
    return groups
      .map((g) => ({ ...g, items: g.items.filter((i) => (i.label + (i.desc ?? '') + g.title).includes(s)) }))
      .filter((g) => g.items.length)
  }, [groups, q])

  if (!open) return null
  const firstHit = filtered[0]?.items[0]

  return createPortal(
    <div className="fixed inset-0 z-[90] no-print">
      <div className="absolute inset-0 bg-navy-950/35 backdrop-blur-[3px] fade-in" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 lg:bottom-auto lg:top-[calc(var(--hdr)+10px)] lg:inset-x-0 lg:mx-auto
        w-full lg:max-w-[880px] max-h-[86dvh] lg:max-h-[calc(100dvh-var(--hdr)-40px)] flex flex-col
        bg-surface rounded-t-[28px] lg:rounded-[28px] border border-line shadow-lift pop-in overflow-hidden">
        <div className="lg:hidden mx-auto mt-2.5 w-10 h-1.5 rounded-full bg-line" />
        <div className="px-4 sm:px-5 pt-3 lg:pt-4 pb-3 border-b border-line flex items-center gap-2">
          <div className="relative flex-1">
            <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
            </svg>
            <input ref={input} value={q} onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && firstHit) nav(firstHit.to) }}
              className="field !h-12 !rounded-2xl pr-11 !bg-canvas" placeholder="إلى أين تريد الذهاب؟" />
          </div>
          <button onClick={onClose} className="btn-icon" aria-label="إغلاق">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-5"
          style={{ paddingBottom: 'max(1.25rem, var(--safe-b))' }}>
          {filtered.length === 0 && <p className="text-center text-ink-400 font-bold py-10">لا يوجد قسم بهذا الاسم</p>}
          {filtered.map((g) => (
            <section key={g.title}>
              <p className="eyebrow mb-2.5">{g.title}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {g.items.map((it) => {
                  const on = isActive(it, loc.pathname)
                  return (
                    <NavLink key={it.to} to={it.to} end={it.end} className={`tile ${on ? 'tile-on' : ''}`}>
                      <span className={`tile-ico ${on ? '!bg-navy-700 !text-white' : ''}`}><it.Icon className="w-5 h-5" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="font-bold text-[13px] text-ink-900 truncate">{it.label}</span>
                          {!!it.badge && <span className="nav-count">{it.badge > 99 ? '99+' : it.badge}</span>}
                        </span>
                        {it.desc && <span className="block text-[11px] text-ink-400 leading-5 mt-0.5 line-clamp-2">{it.desc}</span>}
                      </span>
                    </NavLink>
                  )
                })}
              </div>
            </section>
          ))}
          <p className="hidden lg:block text-center text-[11px] text-ink-300 font-bold">
            اختصار سريع: <kbd className="px-1.5 py-0.5 rounded-md border border-line bg-canvas">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 rounded-md border border-line bg-canvas">K</kbd>
          </p>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/* ===================== الشريط العلوي ===================== */
export function TopBar({ context, nav: navEl, onLauncher, launcherOpen, title, subtitle, back }: {
  context?: React.ReactNode
  nav?: React.ReactNode
  onLauncher?: () => void
  launcherOpen?: boolean
  /** لصفحات مستقلة بلا تنقل (مثل صفحتي) */
  title?: string; subtitle?: string; back?: string
}) {
  const { user, logout } = useAuth()
  const { db, mode, sync, refresh } = useDb()
  const nav = useNavigate()
  const [menu, setMenu] = useState(false)
  const [install, setInstall] = useState(false)
  const alerts = user ? dueSoonTasks(db, user).length : 0

  return (
    <header className="no-print sticky top-0 z-40 bg-surface/80 backdrop-blur-xl border-b border-line/80"
      style={{ paddingTop: 'var(--safe-t)' }}>
      <div className="max-w-[1240px] mx-auto flex items-center gap-2 sm:gap-3 px-3 sm:px-6 lg:px-8 h-16">
        {back && (
          <button onClick={() => nav(back)} className="btn-icon" title="رجوع"><IconBack /></button>
        )}
        <div className="flex items-center gap-2.5 min-w-0 shrink-0 lg:max-w-[260px]">
          <LogoMark h={36} />
          {context ?? (title && (
            <span className="min-w-0 leading-tight">
              <span className="block font-display font-bold text-[14px] text-navy-900 truncate">{title}</span>
              {subtitle && <span className="block text-[10.5px] font-bold text-ink-400 truncate">{subtitle}</span>}
            </span>
          ))}
        </div>

        <div className="flex-1 min-w-0 flex justify-center">{navEl}</div>

        {onLauncher && (
          <button onClick={onLauncher} title="بحث وتنقل سريع (Ctrl+K)"
            className={`lg:hidden btn-icon ${launcherOpen ? 'bg-navy-50 text-navy-800' : ''}`} aria-label="كل الأقسام">
            <svg viewBox="0 0 24 24" className="w-[19px] h-[19px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
            </svg>
          </button>
        )}

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
            className="flex items-center gap-2 p-1 rounded-full hover:bg-navy-50 transition" aria-label="حسابي">
            <span className="w-9 h-9 rounded-full bg-gradient-to-br from-navy-600 to-navy-800 text-white grid place-items-center font-bold text-[13px] ring-2 ring-surface">
              {user?.name?.trim()[0] ?? '؟'}
            </span>
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
              <div className="menu left-0 w-60 z-20">
                <div className="px-2.5 py-2 border-b border-line mb-1">
                  <p className="text-[12.5px] font-bold truncate">{user?.name}</p>
                  <p className="text-[10.5px] text-ink-400 truncate">{user?.jobTitle}</p>
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
        className="hidden xl:inline-flex chip bg-orange-50 text-orange-700 border border-orange-200">
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
      className="hidden xl:inline-flex items-center gap-1.5 chip bg-navy-50 text-navy-700 hover:bg-navy-100 transition">
      <i className="w-1.5 h-1.5 rounded-full bg-current" /> محفوظ
    </button>
  )
}

/* ===================== مبدّل السياق (المجمع / المساجد) ===================== */
function ContextSwitch({ label, sub, current }: { label: string; sub: string; current?: string }) {
  const { db } = useDb()
  const { isDirector } = useAuth()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)

  const body = (
    <span className="min-w-0 leading-tight text-right">
      <span className="flex items-center gap-1 font-display font-bold text-[14px] text-navy-900">
        <span className="truncate">{label}</span>
        {isDirector && (
          <svg viewBox="0 0 24 24" className={`w-3.5 h-3.5 shrink-0 text-ink-400 transition ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
        )}
      </span>
      <span className="block text-[10.5px] font-bold text-ink-400 truncate">{sub}</span>
    </span>
  )

  if (!isDirector) return <div className="min-w-0 border-r border-line pr-2.5">{body}</div>

  return (
    <div className="relative min-w-0 border-r border-line pr-1.5">
      <button onClick={() => setOpen((o) => !o)} className="min-w-0 max-w-[190px] px-1.5 py-1 rounded-xl hover:bg-navy-50 transition">
        {body}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="menu right-0 w-64 z-20">
            <p className="eyebrow px-2.5 pt-1 pb-1.5">انتقل إلى</p>
            <button className={`menu-item ${!current ? '!bg-navy-50 !text-navy-800' : ''}`}
              onClick={() => { setOpen(false); nav('/') }}>
              <IconHome className="w-4 h-4" /> واجهة المجمع
            </button>
            <hr className="menu-sep" />
            {db.mosques.map((m) => (
              <button key={m.id} className={`menu-item ${current === m.id ? '!bg-navy-50 !text-navy-800' : ''}`}
                onClick={() => { setOpen(false); nav(`/m/${m.id}`) }}>
                <span className="w-4 text-center text-[13px]">🕌</span>
                <span className="flex-1 text-right truncate">{m.name}</span>
                {current === m.id && <span className="text-orange-500">●</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ===================== واجهة المسجد ===================== */
export function MosqueLayout() {
  const { mid = '' } = useParams()
  const { db } = useDb()
  const { user, isDirector, canFinance } = useAuth()
  const mosque = db.mosques.find((m) => m.id === mid)
  if (!mosque || !user) return null
  const base = `/m/${mid}`

  const myTasks = db.tasks.filter(
    (t) => t.mosqueId === mid && t.status !== 'done' &&
      (isDirector || user.role === 'supervisor' || t.assigneeId === user.id),
  ).length
  const pendingLeaves = db.leaves.filter((l) => l.mosqueId === mid && l.status === 'pending').length

  const groups: Group[] = [
    {
      title: 'المتابعة اليومية',
      items: [
        { to: base, end: true, label: 'لوحة المعلومات', short: 'الرئيسية', Icon: IconGrid, primary: true, desc: 'نظرة سريعة على يوم المسجد' },
        { to: `${base}/attendance`, label: 'التحضير', short: 'الحضور', Icon: IconPin, badge: pendingLeaves, primary: true, desc: 'حضور الفريق والاستئذانات' },
        { to: `${base}/tasks`, label: 'قائمة المهام', short: 'المهام', Icon: IconCheck, badge: myTasks, primary: true, desc: 'المهام والقرارات والتوصيات' },
      ],
    },
    {
      title: 'المسجد وفريقه',
      items: [
        { to: `${base}/staff`, label: 'الموظفون', Icon: IconUsers, primary: true, desc: 'فريق العمل وحساباتهم وعقودهم' },
        { to: `${base}/teachers`, label: 'المعلمون', Icon: IconBook, primary: true, desc: 'رصد حضور المعلمين وبياناتهم' },
        { to: `${base}/committees`, label: 'اللجان', Icon: IconLayers, desc: 'اللجان وأعضاؤها ومهامها وعهدها' },
      ],
    },
    {
      title: 'التوثيق والتواصل',
      items: [
        { to: `${base}/meetings`, label: 'محاضر الاجتماعات', Icon: IconDoc, desc: 'محاضر رسمية قابلة للطباعة' },
        { to: `${base}/reports`, label: 'التقارير', Icon: IconChart, desc: 'تقارير الأفراد واللجان والمسجد' },
        { to: `${base}/announcements`, label: 'الإعلانات', Icon: IconMega, desc: 'رسائل للفريق أو للجنة أو لشخص' },
      ],
    },
    {
      title: 'المالية والإعدادات',
      items: [
        { to: `${base}/finance`, label: 'الإدارة المالية', short: 'المالية', Icon: IconWallet, hide: !canFinance, desc: 'العهد ومسيّر الرواتب وعقود المعلمين' },
        { to: `${base}/settings`, label: 'إعدادات المسجد', Icon: IconGear, hide: !isDirector, desc: 'النطاق المكاني وبيانات المسجد' },
      ],
    },
  ]

  return <Shell groups={groups}
    context={<ContextSwitch label={mosque.shortName || mosque.name} sub={isDirector ? mosque.name : 'مسجدي'} current={mid} />} />
}

/* ===================== مساحة الموظف (عضو اللجنة) ===================== */
export function MemberLayout() {
  const { user, canFinance } = useAuth()
  const { db } = useDb()
  if (!user) return null

  const myOpen = db.tasks.filter(
    (t) => t.status !== 'done' && (t.assigneeId === user.id || user.committeeIds.includes(t.committeeId)),
  ).length
  const unread = db.teamNotes.filter((n) =>
    user.committeeIds.includes(n.committeeId) && n.createdBy !== user.id &&
    (n.targetIds.length === 0 || n.targetIds.includes(user.id)) &&
    !n.acks.some((a) => a.personId === user.id)).length
  const finance = canFinance && user.mosqueId !== 'complex'

  const groups: Group[] = [
    {
      title: 'عملي اليومي',
      items: [
        { to: '/my', end: true, label: 'لوحة لجنتي', short: 'لجنتي', Icon: IconLayers, badge: unread, primary: true, desc: 'مهام اللجنة وتوصياتها وحضورها' },
        { to: '/my/tasks', label: 'قائمة المهام', short: 'المهام', Icon: IconCheck, badge: myOpen, primary: true, desc: 'مهامك ومهام لجنتك' },
        { to: '/my/attendance', label: 'التحضير', short: 'التحضير', Icon: IconPin, primary: true, desc: 'سجّل حضورك داخل نطاق المسجد' },
      ],
    },
    {
      title: 'ما يخصّني',
      items: [
        { to: '/my/announcements', label: 'الإعلانات', Icon: IconMega, primary: true, desc: 'ما وُجّه إليك أو لفريقك' },
        { to: '/my/report', label: 'تقريري وملفي', short: 'تقريري', Icon: IconChart, primary: true, desc: 'حضورك ومهامك وأثرها المالي' },
        ...(finance ? [{
          to: '/my/finance', label: 'الإدارة المالية', short: 'المالية', Icon: IconWallet,
          desc: 'مفوَّض مالي: الرواتب وعقود المعلمين',
        }] : []),
      ],
    },
  ]

  return (
    <Shell groups={groups}
      context={<ContextSwitch label={user.name.split(' ').slice(0, 2).join(' ')}
        sub={`${user.jobTitle} · ${db.mosques.find((m) => m.id === user.mosqueId)?.shortName ?? ''}`} />} />
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
        { to: '/', end: true, label: 'المساجد', short: 'الرئيسية', Icon: IconHome, primary: true, desc: 'المساجد الثلاثة وما يحتاج قرارك' },
        { to: '/complex/dashboard', label: 'لوحة المجمع', short: 'اللوحة', Icon: IconGrid, primary: true, desc: 'مقارنة المساجد جنبًا إلى جنب' },
      ],
    },
    {
      title: 'المتابعة',
      items: [
        { to: '/complex/attendance', label: 'الحضور العام', short: 'الحضور', Icon: IconPin, badge: pendingAll, primary: true, desc: 'الحضور واعتماد الاستئذانات' },
        { to: '/complex/tasks', label: 'كل المهام', short: 'المهام', Icon: IconCheck, primary: true, desc: 'مهام المساجد واللجان' },
        { to: '/complex/staff', label: 'الموظفون', Icon: IconUsers, desc: 'المشرفون وفرق العمل' },
      ],
    },
    {
      title: 'التوثيق والتواصل',
      items: [
        { to: '/complex/meetings', label: 'محاضر المجمع', Icon: IconDoc, desc: 'محاضر اجتماعات الإدارة العامة' },
        { to: '/complex/reports', label: 'التقارير', Icon: IconChart, desc: 'تقارير شاملة قابلة للطباعة' },
        { to: '/complex/announcements', label: 'الإعلانات', Icon: IconMega, desc: 'إعلانات لكل المساجد' },
      ],
    },
    {
      title: 'المالية والإعدادات',
      items: [
        { to: '/complex/finance', label: 'الإدارة المالية', short: 'المالية', Icon: IconWallet, hide: !canFinance, primary: true, desc: 'العهد والرواتب الشهرية والعقود' },
        { to: '/complex/settings', label: 'الإعدادات', Icon: IconGear, hide: !isDirector, desc: 'الحسابات والخصومات والتطبيق' },
      ],
    },
  ]

  return <Shell groups={groups}
    context={<ContextSwitch label="رياض القرآن" sub="الإدارة العامة للمجمع" />} />
}
