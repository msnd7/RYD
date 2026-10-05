import { useMemo, useState } from 'react'
import { useDb } from '../../store/db'
import { fmtDate, fmtDayName, fmtHijri, shiftDays } from '../../lib/date'
import { personName } from '../../lib/selectors'
import { QUADRANTS, QUADRANT_ORDER, monthGrid, hijriDay, sortTasks, taskOnDay } from '../../lib/tasks'
import type { Task, TaskPriority } from '../../types'
import { CheckBox, PriorityTag, TaskMenu, PinIcon, type TaskActions } from './TaskRow'
import { Legend } from './MatrixView'

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
const WEEK = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
const MAX_LANES = 3
const MAX_CHIPS = 3

/** ألوان شريحة المهمة في التقويم حسب مربعها */
const chipCls = (p?: TaskPriority) => (p ? `${QUADRANTS[p].soft} ${QUADRANTS[p].ink}` : 'bg-navy-50 text-ink-700')
const dotCls = (p?: TaskPriority) => (p ? QUADRANTS[p].dot : 'bg-ink-300')

const hijriMonth = (iso: string) => {
  try {
    return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', { month: 'long', year: 'numeric' })
      .format(new Date(iso + 'T12:00:00'))
  } catch { return '' }
}

/** توزيع المهام المثبّتة على مسارات أفقية داخل الأسبوع حتى لا تتراكب الأشرطة */
function laneLayout(week: string[], pinned: Task[]) {
  const ws = week[0], we = week[6]
  const items = pinned
    .filter((t) => t.pinFrom! <= we && t.pinTo! >= ws)
    .sort((a, b) => a.pinFrom!.localeCompare(b.pinFrom!) || b.pinTo!.localeCompare(a.pinTo!))
  const lanes: string[] = [] // آخر يوم مشغول في كل مسار
  const bars: { t: Task; lane: number; start: number; span: number; capStart: boolean; capEnd: boolean }[] = []
  const hidden = new Map<string, number>() // يوم ← عدد الأشرطة التي لم تتسع
  for (const t of items) {
    const from = t.pinFrom! < ws ? ws : t.pinFrom!
    const to = t.pinTo! > we ? we : t.pinTo!
    const start = week.indexOf(from), end = week.indexOf(to)
    let lane = lanes.findIndex((last) => last < from)
    if (lane === -1) { lane = lanes.length; lanes.push(to) } else lanes[lane] = to
    if (lane >= MAX_LANES) {
      for (let i = start; i <= end; i++) hidden.set(week[i], (hidden.get(week[i]) ?? 0) + 1)
      continue
    }
    bars.push({ t, lane, start, span: end - start + 1, capStart: t.pinFrom! >= ws, capEnd: t.pinTo! <= we })
  }
  return { bars, lanes: Math.min(lanes.length, MAX_LANES), hidden }
}

export function CalendarView({ tasks, a, onAdd, today }: {
  tasks: Task[]; a: TaskActions; onAdd: (day: string) => void; today: string
}) {
  const { db } = useDb()
  const [cursor, setCursor] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 }))
  const [selected, setSelected] = useState(today)

  const days = useMemo(() => monthGrid(cursor.y, cursor.m), [cursor])
  const weeks = useMemo(() => Array.from({ length: 6 }, (_, i) => days.slice(i * 7, i * 7 + 7)), [days])
  const pinned = useMemo(() => tasks.filter((t) => t.pinFrom && t.pinTo && t.pinFrom <= t.pinTo), [tasks])
  const monthPrefix = `${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}`

  const move = (n: number) => setCursor((c) => {
    const d = new Date(c.y, c.m + n, 1)
    return { y: d.getFullYear(), m: d.getMonth() }
  })
  const goToday = () => {
    setCursor({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 })
    setSelected(today)
  }

  const dayList = tasks.filter((t) => taskOnDay(t, selected)).sort(sortTasks)
  const monthTasks = tasks.filter((t) => t.dueDate.startsWith(monthPrefix))
  const monthOpen = monthTasks.filter((t) => t.status !== 'done')
  const lastOfMonth = shiftDays(`${monthPrefix}-01`, new Date(cursor.y, cursor.m + 1, 0).getDate() - 1)
  const h1 = hijriMonth(`${monthPrefix}-01`), h2 = hijriMonth(lastOfMonth)

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_330px] gap-4 items-start">
      <section className="card overflow-hidden">
        {/* ترويسة الشهر */}
        <header className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-line/70">
          <div>
            <h2 className="text-navy-900">{MONTHS[cursor.m]} <span className="num">{cursor.y}</span></h2>
            <p className="text-[11.5px] font-bold text-ink-400 mt-0.5">{h1 === h2 ? h1 : `${h1.replace(/ \d+ هـ$/, '')} – ${h2}`}</p>
          </div>
          <div className="flex items-center gap-1.5 no-print">
            <button className="btn-ghost btn-sm" onClick={goToday}>اليوم</button>
            <button className="btn-icon !w-9 !h-9 border border-line" onClick={() => move(-1)} aria-label="الشهر السابق">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>
            </button>
            <button className="btn-icon !w-9 !h-9 border border-line" onClick={() => move(1)} aria-label="الشهر التالي">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M15 6l-6 6 6 6" /></svg>
            </button>
          </div>
        </header>

        {/* أيام الأسبوع */}
        <div className="grid grid-cols-7 border-b border-line/70 bg-navy-50/40">
          {WEEK.map((w, i) => (
            <div key={w} className={`py-2 text-center text-[11px] font-black ${i === 5 ? 'text-orange-700' : 'text-ink-500'}`}>
              <span className="hidden sm:inline">{w}</span><span className="sm:hidden">{w.replace('ال', '').slice(0, 2)}</span>
            </div>
          ))}
        </div>

        {/* الأسابيع — --lane ارتفاع شريط التثبيت (أنحف على الجوال) */}
        <div className="[--lane:6px] sm:[--lane:19px]">
          {weeks.map((week) => {
            const { bars, lanes, hidden } = laneLayout(week, pinned)
            return (
              <div key={week[0]} className="relative grid grid-cols-7 border-b border-line/60 last:border-b-0">
                {week.map((day) => {
                  const inMonth = day.startsWith(monthPrefix)
                  const isToday = day === today
                  const isSel = day === selected
                  // المثبّتة تظهر شريطًا، فلا تتكرر شريحةً في يوم يغطيه الشريط
                  const barIds = new Set(bars.filter((b) => week.indexOf(day) >= b.start && week.indexOf(day) < b.start + b.span).map((b) => b.t.id))
                  const chips = tasks.filter((t) => t.dueDate === day && !barIds.has(t.id)).sort(sortTasks)
                  const extra = Math.max(0, chips.length - MAX_CHIPS) + (hidden.get(day) ?? 0)
                  return (
                    <div key={day} role="button" tabIndex={0}
                      onClick={() => setSelected(day)}
                      onDoubleClick={() => onAdd(day)}
                      onKeyDown={(e) => { if (e.key === 'Enter') setSelected(day) }}
                      className={`relative min-h-[68px] sm:min-h-[118px] border-l border-line/60 [&:nth-child(7)]:border-l-0 p-1.5 text-right cursor-pointer transition outline-none
                        ${inMonth ? '' : 'bg-canvas/60'} ${isSel ? 'bg-navy-50/80' : 'hover:bg-navy-50/40'}`}>
                      {isSel && <span className="absolute inset-0 ring-2 ring-inset ring-navy-600/70 pointer-events-none" />}
                      <div className="flex items-center justify-between h-6">
                        <span className={`num text-[12.5px] w-6 h-6 grid place-items-center rounded-full
                          ${isToday ? 'bg-orange-500 text-white' : inMonth ? 'text-ink-900' : 'text-ink-300'}`}>
                          {Number(day.slice(8))}
                        </span>
                        <span className={`hidden sm:inline text-[10px] font-bold ${inMonth ? 'text-ink-400' : 'text-ink-300'}`}>{hijriDay(day)}</span>
                      </div>

                      {/* مساحة محجوزة لأشرطة التثبيت */}
                      <div style={{ height: `calc(${lanes} * (var(--lane) + 3px))` }} />

                      {/* شرائح سطح المكتب */}
                      <div className="hidden sm:block space-y-[3px] mt-[3px]">
                        {chips.slice(0, MAX_CHIPS).map((t) => (
                          <button key={t.id} onClick={(e) => { e.stopPropagation(); setSelected(day); a.canEdit(t) && a.edit(t) }}
                            title={t.title}
                            className={`w-full flex items-center gap-1 rounded-md px-1.5 h-[19px] text-[11px] font-bold truncate text-right
                              ${chipCls(t.priority)} ${t.status === 'done' ? 'opacity-55 line-through' : ''}`}>
                            <i className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotCls(t.priority)}`} />
                            <span className="truncate">{t.title}</span>
                          </button>
                        ))}
                        {extra > 0 && <div className="text-[10.5px] font-black text-ink-500 px-1">+{extra} أخرى</div>}
                      </div>

                      {/* نقاط الجوال */}
                      <div className="sm:hidden flex flex-wrap gap-[3px] mt-1 justify-center">
                        {chips.slice(0, 4).map((t) => (
                          <i key={t.id} className={`w-[6px] h-[6px] rounded-full ${dotCls(t.priority)} ${t.status === 'done' ? 'opacity-40' : ''}`} />
                        ))}
                        {chips.length > 4 && <i className="text-[9px] font-black text-ink-400 leading-[6px]">+</i>}
                      </div>
                    </div>
                  )
                })}

                {/* أشرطة المهام المثبّتة الممتدة على عدة أيام */}
                {bars.map((b) => {
                  const p = b.t.priority
                  return (
                    <button key={b.t.id}
                      onClick={(e) => { e.stopPropagation(); setSelected(week[b.start]); a.canEdit(b.t) && a.edit(b.t) }}
                      title={`📌 ${b.t.title} — من ${fmtDate(b.t.pinFrom)} إلى ${fmtDate(b.t.pinTo)}`}
                      className={`absolute z-[1] flex items-center gap-1 px-1.5 text-[11px] font-bold text-white dark:text-canvas overflow-hidden
                        ${p ? QUADRANTS[p].bar : 'bg-navy-700'} ${b.t.status === 'done' ? 'opacity-50' : ''}
                        ${b.capStart ? 'rounded-r-md' : ''} ${b.capEnd ? 'rounded-l-md' : ''}`}
                      style={{
                        top: `calc(31px + ${b.lane} * (var(--lane) + 3px))`,
                        height: 'var(--lane)',
                        insetInlineStart: `calc(${(b.start / 7) * 100}% + ${b.capStart ? 4 : 0}px)`,
                        width: `calc(${(b.span / 7) * 100}% - ${(b.capStart ? 4 : 0) + (b.capEnd ? 4 : 0)}px)`,
                      }}>
                      <span className="hidden sm:inline-flex items-center gap-1 truncate">
                        {b.capStart && <PinIcon className="w-3 h-3 shrink-0" />}
                        <span className="truncate">{b.t.title}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>

        <footer className="px-4 sm:px-5 py-3 border-t border-line/70 bg-navy-50/30">
          <Legend withPin />
        </footer>
      </section>

      {/* جدول اليوم المحدد */}
      <aside className="space-y-4 lg:sticky lg:top-[calc(var(--hdr)+16px)]">
        <section className="card overflow-hidden">
          <header className="px-4 pt-4 pb-3 border-b border-line/70 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="eyebrow">{selected === today ? 'اليوم' : fmtDayName(selected)}</p>
              <h3 className="sect-title mt-1">{fmtDate(selected)}</h3>
              <p className="text-[11.5px] font-bold text-ink-400 mt-0.5">{fmtHijri(selected)}</p>
            </div>
            <button className="btn-primary btn-sm no-print" onClick={() => onAdd(selected)}>＋ مهمة</button>
          </header>
          {dayList.length === 0 ? (
            <p className="text-center text-[12.5px] font-bold text-ink-400 py-10 px-4">
              لا مهام في هذا اليوم.<br /><span className="font-normal">اضغط مرتين على أي يوم لإضافة مهمة فيه.</span>
            </p>
          ) : (
            <ul className="divide-line">
              {dayList.map((t) => (
                <li key={t.id} className="group flex items-start gap-2.5 px-4 py-3">
                  <div className="pt-0.5"><CheckBox t={t} a={a} size="sm" /></div>
                  <button className="min-w-0 flex-1 text-right" onClick={() => a.canEdit(t) && a.edit(t)}>
                    <div className={`text-[13.5px] font-bold leading-6 ${t.status === 'done' ? 'line-through text-ink-400' : 'text-ink-900'}`}>{t.title}</div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <PriorityTag p={t.priority} compact />
                      {t.pinFrom && t.pinTo && t.dueDate !== selected && (
                        <span className="chip !py-0.5 bg-navy-700 text-white"><PinIcon className="w-3 h-3" />مثبّتة حتى {fmtDate(t.pinTo)}</span>
                      )}
                      <span className="text-[11px] font-bold text-ink-400">{personName(db, t.assigneeId)}</span>
                    </div>
                  </button>
                  <TaskMenu t={t} a={a} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ملخص الشهر حسب المصفوفة */}
        <section className="card p-4">
          <h3 className="sect-title">ملخص {MONTHS[cursor.m]}</h3>
          <p className="muted">{monthTasks.length} مهمة مستحقة هذا الشهر · {monthOpen.length} مفتوحة</p>
          <div className="mt-3 space-y-2">
            {QUADRANT_ORDER.map((p) => {
              const n = monthOpen.filter((t) => t.priority === p).length
              const pct = monthOpen.length ? Math.round((n / monthOpen.length) * 100) : 0
              return (
                <div key={p}>
                  <div className="flex items-center justify-between text-[12px] font-bold">
                    <span className={`inline-flex items-center gap-1.5 ${QUADRANTS[p].ink}`}><i className={`w-2 h-2 rounded-full ${QUADRANTS[p].dot}`} />{QUADRANTS[p].label}</span>
                    <span className="num text-ink-700">{n}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-line/80 mt-1 overflow-hidden">
                    <div className={`h-full rounded-full ${QUADRANTS[p].bar}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </aside>
    </div>
  )
}
