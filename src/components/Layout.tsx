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
  IconSearch, IconMosque, IconTrophy, IconPulse, IconScreen,
} from './icons'
import { dueSoonTasks } from '../lib/selectors'
import { ThemeToggle, useTheme } from '../store/theme'
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
   القشرة العامة: ترويسة كحلية (Masthead) فيها شريط أوامر وشريط أقسام أفقي،
   ولوحة «كل الأقسام» بالبحث، وشريط سفلي عائم للجوال — بلا قائمة جانبية
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
  const current = all.find((i) => isActive(i, loc.pathname))
  const dock = all.filter((i) => i.primary).slice(0, 4)
  const moreBadge = all.filter((i) => !dock.includes(i)).reduce((s, i) => s + (i.badge ?? 0), 0)

  return (
    <div className="min-h-[100dvh] relative">
      <TopBar context={context} onLauncher={() => setLauncher((o) => !o)} launcherOpen={launcher}
        nav={<SectionRail groups={visible} />} />
      <LoginNotice />

      <main className="relative">
        {/* هالة هادئة تحت الترويسة تصل الكحلي بلون الصفحة */}
        <div aria-hidden className="no-print pointer-events-none absolute inset-x-0 top-0 h-[260px]
          bg-[radial-gradient(55%_100%_at_80%_0%,rgb(var(--navy-100)/.7),transparent_70%),radial-gradient(35%_80%_at_8%_0%,rgb(var(--orange-100)/.45),transparent_70%)]" />
        <div className="relative max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-10 pt-5 lg:pt-8 pb-[calc(116px+var(--safe-b))] lg:pb-16 fade-in">
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
                  ${a ? 'text-white' : 'text-white/55'}`}>
                {({ isActive: a }) => (
                  <>
                    <span className={`grid place-items-center w-11 h-7 rounded-full transition ${a ? 'bg-orange-500 text-white shadow-glow' : ''}`}>
                      <it.Icon className="w-[18px] h-[18px]" />
                    </span>
                    <span className="truncate max-w-[66px]">{it.short ?? it.label}</span>
                    {!!it.badge && (
                      <span className="absolute top-1.5 right-[calc(50%-22px)] w-4 h-4 text-[9px] font-black grid place-items-center rounded-full bg-orange-500 text-white ring-2 ring-[#0A2340]">
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
                ${launcher || (current && !dock.includes(current)) ? 'text-white' : 'text-white/55'}`}>
              <span className={`grid place-items-center w-11 h-7 rounded-full transition
                ${current && !dock.includes(current) ? 'bg-orange-500 text-white' : 'bg-white/10'}`}>
                <IconGrid className="w-[18px] h-[18px]" />
              </span>
              <span>الأقسام</span>
              {moreBadge > 0 && (
                <span className="absolute top-1.5 right-[calc(50%-22px)] w-4 h-4 text-[9px] font-black grid place-items-center rounded-full bg-orange-500 text-white ring-2 ring-[#0A2340]">
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

/* ===================== شريط الأقسام الأفقي (سطح المكتب) ===================== */
function SectionRail({ groups }: { groups: Group[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const loc = useLocation()
  // القسم الحالي يبقى ظاهرًا إن ضاق الشريط
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('.mast-tab-on')
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [loc.pathname])

  return (
    <div ref={ref} className="mast-tabs">
      {groups.map((g, gi) => (
        <div key={g.title} className="flex items-stretch shrink-0" title={g.title}>
          {gi > 0 && <span className="mast-sep" aria-hidden />}
          {g.items.map((it) => (
            <NavLink key={it.to} to={it.to} end={it.end}
              className={({ isActive: a }) => `mast-tab ${a ? 'mast-tab-on' : ''}`}>
              <it.Icon className="hidden 2xl:block w-[16px] h-[16px] opacity-90" />
              <span>{it.short ?? it.label}</span>
              {!!it.badge && <span className="nav-count">{it.badge > 99 ? '99+' : it.badge}</span>}
            </NavLink>
          ))}
        </div>
      ))}
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
      <div className="absolute inset-0 bg-navy-950/40 backdrop-blur-[3px] fade-in" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 lg:bottom-auto lg:top-[72px] lg:inset-x-0 lg:mx-auto
        w-full lg:max-w-[900px] max-h-[86dvh] lg:max-h-[calc(100dvh-110px)] flex flex-col
        bg-surface rounded-t-[28px] lg:rounded-[28px] border border-line shadow-lift pop-in overflow-hidden">
        <div className="lg:hidden mx-auto mt-2.5 w-10 h-1.5 rounded-full bg-line" />
        <div className="px-4 sm:px-5 pt-3 lg:pt-4 pb-3 border-b border-line flex items-center gap-2">
          <div className="relative flex-1">
            <IconSearch className="w-[18px] h-[18px] absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <input ref={input} value={q} onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && firstHit) nav(firstHit.to) }}
              className="field !h-12 !rounded-2xl pr-11 !bg-canvas" placeholder="ابحث عن قسم أو انتقل إليه…" />
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

/* ===================== الترويسة ===================== */
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
    <header className="masthead no-print" style={{ paddingTop: 'var(--safe-t)' }}>
      <div className="max-w-[1320px] mx-auto flex items-center gap-1.5 sm:gap-2.5 px-3 sm:px-6 lg:px-10 h-[60px]">
        {back && (
          <button onClick={() => nav(back)} className="mast-icon" title="رجوع"><IconBack /></button>
        )}
        <div className="flex items-center gap-2.5 min-w-0 shrink lg:shrink-0">
          <span className="w-10 h-10 rounded-xl bg-white grid place-items-center shrink-0 shadow-soft">
            <LogoMark h={30} />
          </span>
          {context ?? (title && (
            <span className="min-w-0 leading-tight">
              <span className="block font-display font-bold text-[14px] text-white truncate">{title}</span>
              {subtitle && <span className="block text-[10.5px] font-bold text-white/55 truncate">{subtitle}</span>}
            </span>
          ))}
        </div>

        <div className="flex-1 min-w-0 flex justify-center px-2">
          {onLauncher && (
            <button onClick={onLauncher} className={`mast-cmd hidden md:flex max-w-[420px] ${launcherOpen ? '!bg-white/15 !text-white' : ''}`}
              aria-expanded={launcherOpen} title="بحث وتنقل سريع (Ctrl+K)">
              <IconSearch className="w-[17px] h-[17px]" />
              <span className="flex-1 text-right truncate">ابحث أو انتقل إلى أي قسم…</span>
              <span className="mast-kbd" dir="ltr">Ctrl K</span>
            </button>
          )}
        </div>

        {onLauncher && (
          <button onClick={onLauncher} title="بحث وتنقل سريع"
            className={`md:hidden mast-icon ${launcherOpen ? '!bg-white/15 !text-white' : ''}`} aria-label="كل الأقسام">
            <IconSearch className="w-[19px] h-[19px]" />
          </button>
        )}

        <SyncBadge mode={mode} sync={sync} onRefresh={() => { void refresh() }} />
        <ThemeToggle className="mast-icon hidden xs:inline-grid" />

        <button onClick={() => nav('/me')} className="relative mast-icon" title="تنبيهاتي">
          <IconBell />
          {alerts > 0 && (
            <span className="absolute top-1 left-1 min-w-[15px] h-[15px] px-1 text-[9px] font-black grid place-items-center rounded-full bg-orange-500 text-white ring-2 ring-[#0D2B4A]">
              {alerts > 9 ? '9+' : alerts}
            </span>
          )}
        </button>

        <div className="relative">
          <button onClick={() => setMenu((m) => !m)}
            className="flex items-center gap-2 p-1 sm:pl-3 rounded-full hover:bg-white/10 transition" aria-label="حسابي">
            <span className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 text-white grid place-items-center font-bold text-[13px] ring-2 ring-white/15">
              {user?.name?.trim()[0] ?? '؟'}
            </span>
            <span className="hidden xl:block text-right leading-tight max-w-[130px]">
              <span className="block text-[12px] font-bold text-white truncate">{user?.name?.split(' ').slice(0, 2).join(' ')}</span>
              <span className="block text-[10px] font-bold text-white/50 truncate">{user?.jobTitle}</span>
            </span>
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
              <div className="menu left-0 w-60 z-20 text-ink-900">
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
                <ThemeMenuItem onDone={() => setMenu(false)} />
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

      {navEl && (
        <div className="hidden lg:block border-t border-white/[.07]">
          <div className="max-w-[1320px] mx-auto px-6 lg:px-10">{navEl}</div>
        </div>
      )}
      <InstallAppModal open={install} onClose={() => setInstall(false)} />
    </header>
  )
}

/** تبديل النظام من قائمة الحساب — للشاشات الضيقة التي يُخفى فيها الزر */
function ThemeMenuItem({ onDone }: { onDone: () => void }) {
  const { isDark, toggle } = useTheme()
  return (
    <button className="menu-item xs:hidden" onClick={() => { toggle(); onDone() }}>
      <span className="w-4 text-center">{isDark ? '☀' : '☾'}</span> {isDark ? 'النظام النهاري' : 'النظام الليلي'}
    </button>
  )
}

/** حالة حفظ البيانات: مشتركة على الخادم أم محلية على الجهاز */
function SyncBadge({ mode, sync, onRefresh }: { mode: string; sync: string; onRefresh: () => void }) {
  if (mode === 'loading') return null
  const base = 'chip border transition'

  if (mode === 'local') {
    return (
      <span title="لا يوجد خادم متصل — تُحفظ البيانات في هذا المتصفح فقط"
        className={`hidden xl:inline-flex ${base} bg-orange-500/15 text-orange-200 border-orange-400/30`}>
        حفظ محلي
      </span>
    )
  }
  if (sync === 'saving') {
    return <span className={`hidden sm:inline-flex ${base} bg-white/10 text-white/80 border-white/10`}>جارٍ الحفظ…</span>
  }
  if (sync === 'error') {
    return (
      <button onClick={onRefresh} title="تعذّر الحفظ على الخادم — اضغط لإعادة المحاولة"
        className={`inline-flex ${base} bg-orange-500 text-white border-orange-400`}>تعذّر الحفظ</button>
    )
  }
  return (
    <button onClick={onRefresh} title="البيانات محفوظة على الخادم — اضغط لتحديثها الآن"
      className={`hidden xl:inline-flex items-center gap-1.5 ${base} bg-white/[.06] text-white/70 border-white/10 hover:bg-white/10`}>
      <i className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> محفوظ
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
      <span className="flex items-center gap-1 font-display font-bold text-[14px] text-white">
        <span className="truncate">{label}</span>
        {isDirector && (
          <svg viewBox="0 0 24 24" className={`w-3.5 h-3.5 shrink-0 text-white/50 transition ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
        )}
      </span>
      <span className="block text-[10.5px] font-bold text-white/50 truncate">{sub}</span>
    </span>
  )

  if (!isDirector) return <div className="min-w-0 max-w-[200px]">{body}</div>

  return (
    <div className="relative min-w-0">
      <button onClick={() => setOpen((o) => !o)} className="min-w-0 max-w-[210px] px-2 py-1 rounded-xl hover:bg-white/10 transition">
        {body}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="menu right-0 w-64 z-20 text-ink-900">
            <p className="eyebrow px-2.5 pt-1 pb-1.5">انتقل إلى</p>
            <button className={`menu-item ${!current ? '!bg-navy-50 !text-navy-800' : ''}`}
              onClick={() => { setOpen(false); nav('/') }}>
              <IconHome className="w-4 h-4" /> واجهة المجمع
            </button>
            <hr className="menu-sep" />
            {db.mosques.map((m) => (
              <button key={m.id} className={`menu-item ${current === m.id ? '!bg-navy-50 !text-navy-800' : ''}`}
                onClick={() => { setOpen(false); nav(`/m/${m.id}`) }}>
                <IconMosque className="w-4 h-4" />
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
      title: 'التحفيز والأداء',
      items: [
        { to: `${base}/excellence`, label: 'لوحة الشرف', short: 'التميّز', Icon: IconTrophy, desc: 'فارس الأسبوع والشهر والأعلى حضورًا وإنجازًا' },
        { to: `${base}/insights`, label: 'لوحة البيانات', short: 'البيانات', Icon: IconPulse, desc: 'كل أرقام المسجد ومؤشراته في مكان واحد' },
        { to: `/show?m=${mid}`, label: 'شاشة العرض', short: 'العرض', Icon: IconScreen, desc: 'عرض تلقائي للمتميزين على شاشة المسجد' },
      ],
    },
    {
      title: 'التوثيق والتواصل',
      items: [
        { to: `${base}/meetings`, label: 'محاضر الاجتماعات', short: 'المحاضر', Icon: IconDoc, desc: 'محاضر رسمية قابلة للطباعة' },
        { to: `${base}/reports`, label: 'التقارير', Icon: IconChart, desc: 'تقارير الأفراد واللجان والمسجد' },
        { to: `${base}/announcements`, label: 'الإعلانات', Icon: IconMega, desc: 'رسائل للفريق أو للجنة أو لشخص' },
      ],
    },
    {
      title: 'المالية والإعدادات',
      items: [
        { to: `${base}/finance`, label: 'الإدارة المالية', short: 'المالية', Icon: IconWallet, hide: !canFinance, desc: 'العهد ومسيّر الرواتب وعقود المعلمين' },
        { to: `${base}/settings`, label: 'إعدادات المسجد', short: 'الإعدادات', Icon: IconGear, hide: !isDirector, desc: 'النطاق المكاني وبيانات المسجد' },
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
        { to: '/my/excellence', label: 'لوحة الشرف', short: 'التميّز', Icon: IconTrophy, desc: 'فرسان الأسبوع والشهر وترتيب اللجان' },
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
      title: 'التحفيز والأداء',
      items: [
        { to: '/complex/excellence', label: 'لوحة الشرف', short: 'التميّز', Icon: IconTrophy, desc: 'فرسان الأسبوع والشهر أفرادًا ولجانًا' },
        { to: '/complex/insights', label: 'لوحة البيانات', short: 'البيانات', Icon: IconPulse, desc: 'كل الأرقام والمؤشرات قابلة للتصفية والتصدير' },
        { to: '/show', label: 'شاشة العرض', short: 'العرض', Icon: IconScreen, desc: 'عرض تلقائي للمتميزين بملء الشاشة' },
      ],
    },
    {
      title: 'التوثيق والتواصل',
      items: [
        { to: '/complex/meetings', label: 'محاضر المجمع', short: 'المحاضر', Icon: IconDoc, desc: 'محاضر اجتماعات الإدارة العامة' },
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
