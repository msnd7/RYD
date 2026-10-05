import { useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useDb, uid } from '../store/db'
import { useAuth } from '../store/auth'
import { Select, Empty, useToast } from '../components/ui'
import { PageHeader } from '../components/PageHeader'
import { todayISO, fmtDate, fmtDayName, fmtHijri, shiftDays, daysBetween } from '../lib/date'
import { committeesOf, staffOf, mosqueName } from '../lib/selectors'
import {
  QUADRANTS, QUADRANT_ORDER, STATUS_LABEL, GROUP_META, groupByTime, isPinnedOn, sortTasks, type GroupKey,
} from '../lib/tasks'
import type { Task, TaskPriority, TaskStatus } from '../types'
import { TaskRow, PinIcon, type TaskActions } from '../components/tasks/TaskRow'
import { MatrixView } from '../components/tasks/MatrixView'
import { CalendarView } from '../components/tasks/CalendarView'
import { TaskModal, type TaskDraft, type TaskScope } from '../components/tasks/TaskModal'

// تبقى متاحة لبقية الصفحات التي تستوردها من هنا
export { KIND_LABEL, KIND_TONE, STATUS_LABEL, STATUS_TONE } from '../lib/tasks'

type View = 'list' | 'matrix' | 'calendar'
type StatusFilter = 'all' | TaskStatus | 'late'

const VIEWS: { key: View; label: string; icon: JSX.Element }[] = [
  { key: 'list', label: 'القائمة', icon: <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1" /><circle cx="4.5" cy="12" r="1" /><circle cx="4.5" cy="18" r="1" /></svg> },
  { key: 'matrix', label: 'المصفوفة', icon: <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="8" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" /><rect x="13" y="13" width="8" height="8" rx="2" /></svg> },
  { key: 'calendar', label: 'التقويم', icon: <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg> },
]

const VIEW_KEY = 'ryd.tasks.view'
const readView = (): View => {
  try { const v = localStorage.getItem(VIEW_KEY); return v === 'matrix' || v === 'calendar' ? v : 'list' } catch { return 'list' }
}

export default function Tasks({ scope = 'mosque' }: { scope?: TaskScope }) {
  const { mid = '' } = useParams()
  const { db, set } = useDb()
  const { user, isDirector } = useAuth()
  const toast = useToast()
  const today = todayISO()

  // يصل المستخدم من بطاقات لوحة اللجنة برابط مثل /my/tasks?f=stuck
  const [params] = useSearchParams()
  const initial = params.get('f')
  const [status, setStatusFilter] = useState<StatusFilter>(
    (['pending', 'done', 'stuck', 'postponed', 'late'] as const).includes(initial as any) ? (initial as any) : 'all')
  const [view, setViewState] = useState<View>(() => {
    const v = params.get('v'); return v === 'matrix' || v === 'calendar' || v === 'list' ? v : readView()
  })
  const setView = (v: View) => { setViewState(v); try { localStorage.setItem(VIEW_KEY, v) } catch { /* تخزين غير متاح */ } }

  const [quad, setQuad] = useState<TaskPriority | 'none' | ''>('')
  const [fCommittee, setFCommittee] = useState('')
  const [fPerson, setFPerson] = useState('')
  const [fMosque, setFMosque] = useState('')
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Task | null>(null)
  const [draft, setDraft] = useState<TaskDraft | undefined>()
  const [open, setOpen] = useState(false)

  /** نطاق المهام المرئية لهذا المستخدم */
  const base = useMemo(() => {
    if (scope === 'mine') {
      return db.tasks.filter((t) => t.assigneeId === user!.id || user!.committeeIds.includes(t.committeeId))
    }
    if (scope === 'complex') return db.tasks
    return db.tasks.filter((t) => t.mosqueId === mid)
  }, [db.tasks, scope, mid, user])

  /** المرشّحات المشتركة بين العروض الثلاثة (عدا مرشّح المربع) */
  const scoped = useMemo(() => {
    let rows = base
    if (fMosque) rows = rows.filter((t) => t.mosqueId === fMosque)
    if (status === 'late') rows = rows.filter((t) => t.status !== 'done' && t.dueDate < today)
    else if (status !== 'all') rows = rows.filter((t) => t.status === status)
    if (fCommittee) rows = rows.filter((t) => t.committeeId === fCommittee)
    if (fPerson) rows = rows.filter((t) => t.assigneeId === fPerson)
    if (q.trim()) rows = rows.filter((t) => (t.title + t.details).includes(q.trim()))
    return rows
  }, [base, status, fCommittee, fPerson, fMosque, q, today])

  const list = useMemo(() => {
    if (!quad) return scoped
    return scoped.filter((t) => (quad === 'none' ? !t.priority : t.priority === quad))
  }, [scoped, quad])

  /* ---------- الإجراءات ---------- */
  const canEdit = (t: Task) =>
    isDirector || user?.role === 'supervisor' || t.assigneeId === user?.id || t.createdBy === user?.id

  const actions: TaskActions = {
    canEdit,
    canDelete: (t) => isDirector || t.createdBy === user?.id,
    setStatus: (id, s) => {
      set((d) => {
        const t = d.tasks.find((x) => x.id === id)
        if (t) { t.status = s; t.doneAt = s === 'done' ? todayISO() : undefined }
      })
      toast(s === 'done' ? 'أحسنت! أُنجزت المهمة ✓' : `الحالة الآن: ${STATUS_LABEL[s]}`)
    },
    setPriority: (id, p) => {
      set((d) => {
        const t = d.tasks.find((x) => x.id === id)
        if (!t) return
        if (p) t.priority = p; else delete t.priority
      })
      toast(p ? `صُنّفت: ${QUADRANTS[p].label}` : 'أُلغي التصنيف')
    },
    togglePin: (t) => {
      if (t.pinFrom && t.pinTo) {
        set((d) => { const x = d.tasks.find((y) => y.id === t.id); if (x) { delete x.pinFrom; delete x.pinTo } })
        toast('أُلغي التثبيت')
      } else openModal(t, { pin: true })
    },
    edit: (t) => openModal(t),
    remove: (id) => {
      if (!confirm('حذف هذه المهمة نهائيًا؟')) return
      set((d) => { d.tasks = d.tasks.filter((t) => t.id !== id) })
      toast('تم الحذف')
    },
  }

  function openModal(t: Task | null, d?: TaskDraft) { setEditing(t); setDraft(d); setOpen(true) }

  const defaultMosque = scope === 'mosque' ? mid : (user!.mosqueId === 'complex' ? db.mosques[0]?.id : user!.mosqueId as string)
  const canAssignOthers = isDirector || user?.role === 'supervisor'

  /** الإضافة السريعة: تُسند للمستخدم نفسه مباشرة، ومن يُسند لغيره يكمل في النموذج */
  const quickAdd = (title: string, priority: TaskPriority | undefined, dueDate: string) => {
    const mosqueId = defaultMosque
    const committeeId = user!.committeeIds[0] ?? committeesOf(db, mosqueId)[0]?.id
    if (canAssignOthers || !committeeId) { openModal(null, { title, priority, dueDate }); return }
    set((d) => {
      d.tasks.push({
        id: uid('t'), mosqueId, committeeId, assigneeId: user!.id,
        title, details: '', kind: 'task', status: 'pending', dueDate, remindBefore: 2,
        createdBy: user!.id, createdAt: todayISO(), ...(priority ? { priority } : {}),
      })
    })
    toast('أُضيفت المهمة')
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={scope === 'complex' ? 'الإدارة العامة' : scope === 'mine' ? 'مساحتي' : mosqueName(db, mid)}
        title="قائمة المهام"
        description="كل مهمة لها لون أولويتها من مصفوفة أيزنهاور: ابدأ بالأحمر، وخطّط للأخضر، وفوّض البنفسجي، وأجّل الرمادي."
        actions={<button className="btn-primary btn-sm" onClick={() => openModal(null)}>＋ مهمة جديدة</button>}
      />

      <FocusPanel tasks={base} a={actions} today={today} quad={quad} setQuad={setQuad} />

      {/* شريط الأدوات: العرض + البحث + المرشّحات */}
      <div className="flex flex-wrap items-center gap-2.5 no-print">
        <div className="seg" role="tablist" aria-label="طريقة العرض">
          {VIEWS.map((v) => (
            <button key={v.key} role="tab" aria-selected={view === v.key} onClick={() => setView(v.key)}
              className={`seg-btn inline-flex items-center gap-1.5 !h-9 !px-3.5 ${view === v.key ? 'seg-on' : ''}`}>
              {v.icon}{v.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[180px]">
          <svg viewBox="0 0 24 24" className="w-4 h-4 absolute top-1/2 -translate-y-1/2 right-3 text-ink-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input className="field !h-10 pr-9" placeholder="بحث في المهام…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select className="!h-10 !w-auto min-w-[130px]" value={status === 'all' ? '' : status} onChange={(v) => setStatusFilter((v || 'all') as StatusFilter)}
          placeholder="كل الحالات"
          options={[...Object.entries(STATUS_LABEL).map(([v, l]) => ({ value: v, label: l })), { value: 'late', label: 'متأخرة' }]} />
        {scope === 'complex' && (
          <Select className="!h-10 !w-auto min-w-[140px]" value={fMosque} onChange={setFMosque} placeholder="كل المساجد"
            options={db.mosques.map((m) => ({ value: m.id, label: m.name }))} />
        )}
        {scope !== 'mine' && (
          <>
            <Select className="!h-10 !w-auto min-w-[140px]" value={fCommittee} onChange={setFCommittee} placeholder="كل اللجان"
              options={(scope === 'complex' ? db.committees : committeesOf(db, mid)).map((c) => ({
                value: c.id, label: scope === 'complex' ? `${c.name} — ${mosqueName(db, c.mosqueId)}` : c.name,
              }))} />
            <Select className="!h-10 !w-auto min-w-[140px]" value={fPerson} onChange={setFPerson} placeholder="كل الموظفين"
              options={(scope === 'complex' ? db.people.filter((p) => p.active) : staffOf(db, mid))
                .map((p) => ({ value: p.id, label: p.name }))} />
          </>
        )}
      </div>

      {(quad || status !== 'all') && (
        <div className="flex flex-wrap items-center gap-2 text-[12px] font-bold text-ink-500 -mt-1">
          <span>تعرض الآن:</span>
          {quad && (
            <button onClick={() => setQuad('')} className={`chip ${quad === 'none' ? 'bg-navy-50 text-ink-700' : `${QUADRANTS[quad].soft} ${QUADRANTS[quad].ink}`}`}>
              {quad === 'none' ? 'غير مصنّفة' : QUADRANTS[quad].label} ✕
            </button>
          )}
          {status !== 'all' && (
            <button onClick={() => setStatusFilter('all')} className="chip bg-navy-50 text-navy-800">
              {status === 'late' ? 'متأخرة' : STATUS_LABEL[status]} ✕
            </button>
          )}
        </div>
      )}

      {view === 'list' && (
        <ListView tasks={list} total={base.length} a={actions} today={today} showMosque={scope === 'complex'}
          onQuickAdd={quickAdd} onAdd={() => openModal(null, quad && quad !== 'none' ? { priority: quad } : undefined)}
          emptyHint={scope === 'mine'
            ? 'أضف مهمة لنفسك من الحقل أعلاه، أو انتظر ما يُسند إليك من مدير المجمع أو مشرف مسجدك.'
            : 'أضف مهمة أو قرارًا أو توصية، وحدّد أولويتها والمسؤول والموعد.'} />
      )}
      {view === 'matrix' && (
        <MatrixView tasks={scoped} a={actions} today={today} onAdd={(p) => openModal(null, p ? { priority: p } : undefined)} />
      )}
      {view === 'calendar' && (
        <CalendarView tasks={list} a={actions} today={today}
          onAdd={(day) => openModal(null, { dueDate: day, ...(quad && quad !== 'none' ? { priority: quad } : {}) })} />
      )}

      <TaskModal
        open={open} onClose={() => { setOpen(false); setEditing(null); setDraft(undefined) }}
        task={editing} draft={draft} scope={scope}
        mosqueId={scope === 'mosque' ? mid : (editing?.mosqueId ?? defaultMosque)}
      />
    </div>
  )
}

/* ================= لوحة التركيز: ماذا عليّ الآن؟ ================= */
function FocusPanel({ tasks, a, today, quad, setQuad }: {
  tasks: Task[]; a: TaskActions; today: string
  quad: TaskPriority | 'none' | ''; setQuad: (q: TaskPriority | 'none' | '') => void
}) {
  const open = tasks.filter((t) => t.status !== 'done')
  const late = open.filter((t) => t.dueDate < today)
  const dueToday = tasks.filter((t) => t.dueDate === today)
  const doneToday = dueToday.filter((t) => t.status === 'done').length
  const q1 = open.filter((t) => t.priority === 'q1')
  const unsorted = open.filter((t) => !t.priority).length

  // أهم ما يجب فعله الآن: المثبّتة والمتأخرة ومستحقة اليوم، مرتبة بالأولوية
  const next = open
    .filter((t) => isPinnedOn(t, today) || t.dueDate <= today || t.priority === 'q1')
    .sort(sortTasks)
    .slice(0, 3)

  const headline = q1.length
    ? `ابدأ بـ ${q1.length} ${q1.length === 1 ? 'مهمة هامة وعاجلة' : 'مهام هامة وعاجلة'}`
    : late.length
      ? `لديك ${late.length} ${late.length === 1 ? 'مهمة متأخرة' : 'مهام متأخرة'} — أنهِها أولًا`
      : open.length
        ? 'لا شيء عاجل — وقت مثالي للمهام الهامة'
        : 'لا مهام مفتوحة — يومك صافٍ'

  const pct = dueToday.length ? Math.round((doneToday / dueToday.length) * 100) : 0
  const R = 26, C = 2 * Math.PI * R

  return (
    <section className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-3">
      <div className="hero p-5 sm:p-6">
        <div aria-hidden className="absolute -left-10 -top-16 w-56 h-56 rounded-full bg-orange-500/10 blur-2xl" />
        <div className="relative flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11.5px] font-bold text-white/60">{fmtDayName(today)} · {fmtDate(today)} · {fmtHijri(today)}</p>
            <h2 className="!text-[19px] sm:!text-[22px] text-white mt-1.5">{headline}</h2>
            <p className="text-[12.5px] text-white/65 mt-1">
              {open.length} مفتوحة · {late.length} متأخرة · {dueToday.length} مستحقة اليوم{unsorted ? ` · ${unsorted} بلا تصنيف` : ''}
            </p>
          </div>
          <div className="relative w-[68px] h-[68px] shrink-0" title="إنجاز مهام اليوم">
            <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
              <circle cx="32" cy="32" r={R} fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="6" />
              <circle cx="32" cy="32" r={R} fill="none" stroke="#F0820E" strokeWidth="6" strokeLinecap="round"
                strokeDasharray={C} strokeDashoffset={C - (C * pct) / 100} className="transition-all duration-700" />
            </svg>
            <div className="absolute inset-0 grid place-items-center text-center leading-none">
              <span className="num text-[15px] text-white">{doneToday}/{dueToday.length}</span>
              <span className="text-[9px] font-bold text-white/55 -mt-3">اليوم</span>
            </div>
          </div>
        </div>

        {next.length > 0 && (
          <ul className="relative mt-4 space-y-1.5">
            {next.map((t) => {
              const qd = t.priority ? QUADRANTS[t.priority] : null
              const diff = daysBetween(today, t.dueDate)
              return (
                <li key={t.id} className="flex items-center gap-2.5 rounded-xl bg-white/[.07] border border-white/10 px-3 py-2">
                  <i className={`w-2 h-2 rounded-full shrink-0 ${qd ? qd.dot : 'bg-white/40'}`} />
                  <button className="min-w-0 flex-1 text-right text-[13px] font-bold text-white truncate" onClick={() => a.canEdit(t) && a.edit(t)}>
                    {isPinnedOn(t, today) && <PinIcon className="inline w-3 h-3 ml-1 text-orange-300" />}{t.title}
                  </button>
                  <span className={`text-[11px] font-bold shrink-0 ${diff < 0 ? 'text-orange-300' : 'text-white/55'}`}>
                    {diff < 0 ? `متأخرة ${-diff} يوم` : diff === 0 ? 'اليوم' : fmtDate(t.dueDate).replace(/ \d{4}$/, '')}
                  </span>
                  {a.canEdit(t) && (
                    <button onClick={() => a.setStatus(t.id, 'done')} title="تعليمها منجزة" aria-label="تعليمها منجزة"
                      className="tap w-7 h-7 rounded-lg grid place-items-center bg-white/10 hover:bg-white/20 text-white shrink-0 transition">
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l6 6L20 6" /></svg>
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* المربعات الأربعة — تعمل مرشّحًا لكل العروض */}
      <div className="grid grid-cols-2 gap-2.5">
        {QUADRANT_ORDER.map((p) => {
          const qd = QUADRANTS[p]
          const n = open.filter((t) => t.priority === p).length
          const on = quad === p
          return (
            <button key={p} onClick={() => setQuad(on ? '' : p)} aria-pressed={on}
              className={`relative overflow-hidden text-right rounded-2xl border px-4 py-3.5 transition bg-surface shadow-soft
                ${on ? `ring-2 ${qd.ring} ${qd.soft}` : 'border-line/90 hover:-translate-y-px'}`}>
              <span className={`absolute inset-y-3 right-0 w-1 rounded-l-full ${qd.bar}`} />
              <div className="flex items-start justify-between gap-2">
                <span className={`text-[12px] font-black ${qd.ink}`}>{qd.label}</span>
                <span className={`w-2.5 h-2.5 rounded-full mt-1 ${qd.dot}`} />
              </div>
              <div className="num text-[26px] leading-none mt-2 text-ink-900">{n}</div>
              <div className="text-[11px] font-bold text-ink-400 mt-1.5 truncate">{qd.action}</div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

/* ================= القائمة الذكية ================= */
const ORDER: GroupKey[] = ['pinned', 'late', 'today', 'tomorrow', 'week', 'later', 'done']

function ListView({ tasks, total, a, today, showMosque, onQuickAdd, onAdd, emptyHint }: {
  tasks: Task[]; total: number; a: TaskActions; today: string; showMosque: boolean
  onQuickAdd: (title: string, p: TaskPriority | undefined, due: string) => void
  onAdd: () => void; emptyHint: string
}) {
  const groups = useMemo(() => groupByTime(tasks, today), [tasks, today])
  const [collapsed, setCollapsed] = useState<Partial<Record<GroupKey, boolean>>>({ done: true })

  return (
    <div className="space-y-3">
      <QuickAdd today={today} onAdd={onQuickAdd} />

      {tasks.length === 0 ? (
        <div className="card">
          <Empty icon="🗒️" title={total ? 'لا توجد مهام بهذا التصنيف' : 'لا توجد مهام بعد'} hint={emptyHint}
            action={<button className="btn-primary btn-sm" onClick={onAdd}>＋ مهمة جديدة</button>} />
        </div>
      ) : (
        ORDER.filter((k) => groups[k].length).map((k) => {
          const g = GROUP_META[k]
          const isClosed = !!collapsed[k]
          return (
            <section key={k} className="card overflow-hidden">
              <button onClick={() => setCollapsed((c) => ({ ...c, [k]: !c[k] }))} aria-expanded={!isClosed}
                className="w-full flex items-center gap-2.5 px-4 sm:px-5 py-3 text-right hover:bg-navy-50/40 transition">
                <svg viewBox="0 0 24 24" className={`w-4 h-4 text-ink-400 transition-transform ${isClosed ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
                {k === 'pinned' && <PinIcon className="w-4 h-4 text-navy-700" />}
                <h3 className={`sect-title ${g.tone}`}>{g.label}</h3>
                <span className="num text-[12px] text-ink-400 bg-navy-50 rounded-md px-1.5 py-0.5">{groups[k].length}</span>
                {g.hint && <span className="hidden sm:inline text-[11.5px] font-bold text-ink-400 truncate">— {g.hint}</span>}
                <span className="mr-auto flex items-center gap-1">
                  {QUADRANT_ORDER.map((p) => {
                    const n = groups[k].filter((t) => t.priority === p).length
                    return n ? (
                      <span key={p} className={`inline-flex items-center gap-1 text-[10.5px] font-black ${QUADRANTS[p].ink}`} title={QUADRANTS[p].label}>
                        <i className={`w-2 h-2 rounded-full ${QUADRANTS[p].dot}`} />{n}
                      </span>
                    ) : null
                  })}
                </span>
              </button>
              {!isClosed && (
                <ul className="divide-line border-t border-line/70">
                  {groups[k].map((t) => <TaskRow key={t.id} t={t} a={a} today={today} showMosque={showMosque} />)}
                </ul>
              )}
            </section>
          )
        })
      )}
    </div>
  )
}

/* ================= الإضافة السريعة على طريقة TickTick ================= */
function QuickAdd({ today, onAdd }: { today: string; onAdd: (title: string, p: TaskPriority | undefined, due: string) => void }) {
  const [title, setTitle] = useState('')
  const [p, setP] = useState<TaskPriority | undefined>()
  const [due, setDue] = useState(today)

  const submit = () => {
    if (!title.trim()) return
    onAdd(title.trim(), p, due)
    setTitle('')
  }
  const dayChips = [
    { l: 'اليوم', v: today }, { l: 'غدًا', v: shiftDays(today, 1) }, { l: 'بعد أسبوع', v: shiftDays(today, 7) },
  ]

  return (
    <div className="card p-2.5 sm:p-3 no-print">
      <div className="flex items-center gap-2">
        <span className="w-9 h-9 rounded-xl grid place-items-center shrink-0 bg-navy-50 text-navy-700 text-[18px] font-bold">＋</span>
        <input className="flex-1 min-w-0 h-10 bg-transparent outline-none text-[14.5px] font-bold text-ink-900 placeholder:text-ink-300 placeholder:font-normal"
          placeholder="أضف مهمة… ثم اضغط Enter" value={title}
          onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit() }} />
        <button className="btn-primary btn-sm shrink-0" onClick={submit} disabled={!title.trim()}>إضافة</button>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 pr-11">
        <div className="flex items-center gap-1.5" role="radiogroup" aria-label="الأولوية">
          <span className="text-[11px] font-bold text-ink-400 ml-0.5">الأولوية</span>
          {QUADRANT_ORDER.map((k) => {
            const qd = QUADRANTS[k]
            const on = p === k
            return (
              <button key={k} role="radio" aria-checked={on} title={qd.label} onClick={() => setP(on ? undefined : k)}
                className={`chip !px-2 !py-0.5 border transition ${on ? `${qd.soft} ${qd.ink}` : 'border-transparent text-ink-500 hover:bg-navy-50'}`}
                style={on ? { borderColor: `rgb(var(--${k}) / .5)` } : undefined}>
                <i className={`w-2 h-2 rounded-full ${qd.dot}`} />
                <span className={on ? '' : 'hidden xs:inline'}>{qd.short}</span>
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-ink-400 ml-0.5">الموعد</span>
          {dayChips.map((c) => (
            <button key={c.l} onClick={() => setDue(c.v)}
              className={`chip !py-0.5 border transition ${due === c.v ? 'bg-navy-700 text-white border-navy-700' : 'border-line text-ink-500 hover:bg-navy-50'}`}>
              {c.l}
            </button>
          ))}
          <input type="date" value={due} onChange={(e) => e.target.value && setDue(e.target.value)} aria-label="تاريخ آخر"
            className="h-7 rounded-full border border-line bg-surface px-2 text-[11px] font-bold text-ink-500 outline-none focus:border-orange-400" />
        </div>
      </div>
    </div>
  )
}

