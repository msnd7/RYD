import { Badge, Menu } from '../ui'
import { useDb } from '../../store/db'
import { fmtDate, dueLabel } from '../../lib/date'
import { personName, committeeName, mosqueName } from '../../lib/selectors'
import { waLink, taskReminder } from '../../lib/whatsapp'
import { QUADRANTS, QUADRANT_ORDER, KIND_LABEL, STATUS_LABEL, isPinnedOn } from '../../lib/tasks'
import type { Task, TaskPriority, TaskStatus } from '../../types'

/** كل ما يمكن فعله بالمهمة — يُمرَّر من الصفحة إلى القائمة والمصفوفة والتقويم */
export interface TaskActions {
  canEdit: (t: Task) => boolean
  canDelete: (t: Task) => boolean
  setStatus: (id: string, s: TaskStatus) => void
  setPriority: (id: string, p: TaskPriority | undefined) => void
  togglePin: (t: Task) => void
  edit: (t: Task) => void
  remove: (id: string) => void
}

export function useWaLink(t: Task) {
  const { db } = useDb()
  const assignee = db.people.find((p) => p.id === t.assigneeId)
  const late = t.status !== 'done' && dueLabel(t.dueDate).diff < 0
  return waLink(assignee?.phone, taskReminder({
    name: assignee?.name ?? '', title: t.title, kind: KIND_LABEL[t.kind],
    due: fmtDate(t.dueDate), complex: db.settings.complexName, late,
  }))
}

/** قائمة الإجراءات الموحدة لأي مهمة */
export function TaskMenu({ t, a }: { t: Task; a: TaskActions }) {
  const wa = useWaLink(t)
  if (!a.canEdit(t)) return null
  const pinned = !!(t.pinFrom && t.pinTo)
  return (
    <Menu items={[
      { label: 'تعديل المهمة', icon: '✎', onClick: () => a.edit(t) },
      { label: pinned ? 'إلغاء التثبيت' : 'تثبيت لفترة…', icon: '📌', onClick: () => a.togglePin(t) },
      'sep',
      ...QUADRANT_ORDER.filter((q) => q !== t.priority).map((q) => ({
        label: `نقل إلى: ${QUADRANTS[q].label}`, icon: '●', onClick: () => a.setPriority(t.id, q),
      })),
      ...(t.priority ? [{ label: 'إلغاء التصنيف', icon: '○', onClick: () => a.setPriority(t.id, undefined) }] : []),
      'sep',
      ...(Object.keys(STATUS_LABEL) as TaskStatus[]).filter((s) => s !== t.status).map((s) => ({
        label: `الحالة: ${STATUS_LABEL[s]}`, icon: '↻', onClick: () => a.setStatus(t.id, s),
      })),
      ...(wa ? ['sep' as const, { label: 'تذكير عبر واتساب', icon: '💬', onClick: () => window.open(wa, '_blank') }] : []),
      ...(a.canDelete(t) ? ['sep' as const, { label: 'حذف المهمة', icon: '🗑', danger: true, onClick: () => a.remove(t.id) }] : []),
    ]} />
  )
}

/** مربع الإنجاز — حدّه بلون مربع أيزنهاور كما في TickTick */
export function CheckBox({ t, a, size = 'md' }: { t: Task; a: TaskActions; size?: 'sm' | 'md' }) {
  const q = t.priority ? QUADRANTS[t.priority] : null
  const done = t.status === 'done'
  const dim = size === 'sm' ? 'w-[18px] h-[18px] rounded-md' : 'w-[22px] h-[22px] rounded-[7px]'
  return (
    <button
      onClick={(e) => { e.stopPropagation(); a.canEdit(t) && a.setStatus(t.id, done ? 'pending' : 'done') }}
      disabled={!a.canEdit(t)} title={done ? 'إرجاعها قيد التنفيذ' : 'تعليمها منجزة'}
      aria-label={done ? 'إرجاعها قيد التنفيذ' : 'تعليمها منجزة'}
      className={`tap shrink-0 border-2 grid place-items-center transition ${dim}
        ${done
          ? 'bg-ink-300 border-ink-300 text-white'
          : q
            ? `${q.soft} text-transparent hover:text-ink-400`
            : 'border-ink-300 text-transparent hover:border-navy-500 hover:text-ink-300'}`}
      style={!done && q ? { borderColor: `rgb(var(--${q.key}))` } : undefined}>
      <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12l6 6L20 6" />
      </svg>
    </button>
  )
}

export function PriorityTag({ p, compact }: { p?: TaskPriority; compact?: boolean }) {
  if (!p) return null
  const q = QUADRANTS[p]
  return (
    <span className={`chip ${q.soft} ${q.ink} !py-0.5`}>
      <i className={`w-1.5 h-1.5 rounded-full ${q.dot}`} />
      {compact ? q.short : q.label}
    </span>
  )
}

export const PinIcon = ({ className = 'w-3.5 h-3.5' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
    <path d="M15.6 2.6a1 1 0 0 1 1.4 0l4.4 4.4a1 1 0 0 1 0 1.4l-1.2 1.2a1 1 0 0 1-1.1.2l-3.3 3.3.3 3.6a1 1 0 0 1-.3.8l-1 1a1 1 0 0 1-1.4 0L9.6 14.7l-5.3 5.3a1 1 0 1 1-1.4-1.4l5.3-5.3-3.8-3.8a1 1 0 0 1 0-1.4l1-1a1 1 0 0 1 .8-.3l3.6.3 3.3-3.3a1 1 0 0 1 .2-1.1z" />
  </svg>
)

/** سطر مهمة في القائمة الذكية */
export function TaskRow({ t, a, showMosque, today }: {
  t: Task; a: TaskActions; showMosque?: boolean; today: string
}) {
  const { db } = useDb()
  const d = dueLabel(t.dueDate)
  const done = t.status === 'done'
  const late = !done && d.diff < 0
  const pinnedNow = isPinnedOn(t, today)
  const q = t.priority ? QUADRANTS[t.priority] : null

  return (
    <li className={`group relative transition hover:bg-navy-50/50 ${done ? 'opacity-70' : ''}`}>
      {q && !done && <span className={`absolute inset-y-2 right-0 w-[3px] rounded-l-full ${q.bar}`} />}
      <div className="flex items-start gap-3 pr-4 pl-2.5 sm:pr-5 sm:pl-3.5 py-3">
        <div className="pt-0.5"><CheckBox t={t} a={a} /></div>

        <button className="min-w-0 flex-1 text-right" onClick={() => a.canEdit(t) && a.edit(t)}>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h4 className={`font-sans font-bold text-[14.5px] leading-6 ${done ? 'line-through text-ink-400' : 'text-ink-900'}`}>
              {t.title}
            </h4>
            {pinnedNow && !done && (
              <span className="chip !py-0.5 bg-navy-700 text-white" title={`مثبّتة حتى ${fmtDate(t.pinTo)}`}>
                <PinIcon className="w-3 h-3" />حتى {fmtDate(t.pinTo).replace(/ \d{4}$/, '')}
              </span>
            )}
            {t.kind !== 'task' && (
              <span className={`chip !py-0.5 ${t.kind === 'decision' ? 'bg-navy-100 text-navy-800' : 'bg-orange-100 text-orange-700'}`}>
                {KIND_LABEL[t.kind]}
              </span>
            )}
            {t.status === 'stuck' && <Badge tone="bad">متعثرة</Badge>}
            {t.status === 'postponed' && <Badge tone="warn">مؤجلة</Badge>}
          </div>

          {t.details && !done && <p className="text-[12.5px] text-ink-500 mt-0.5 leading-6 line-clamp-2 whitespace-pre-wrap">{t.details}</p>}
          {t.note && !done && <p className="text-[12px] text-orange-800 bg-orange-50 rounded-lg px-2.5 py-1 mt-1.5 inline-block">{t.note}</p>}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11.5px] font-bold text-ink-500">
            <span className={`inline-flex items-center gap-1 ${late ? 'text-orange-700' : d.diff === 0 && !done ? 'text-navy-700' : ''}`}>
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
              {done ? `أُنجزت ${fmtDate(t.doneAt ?? t.dueDate)}` : `${fmtDate(t.dueDate)} · ${d.text}`}
            </span>
            {q && <PriorityTag p={t.priority} compact />}
            <span className="inline-flex items-center gap-1">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
              {personName(db, t.assigneeId)}
            </span>
            <span className="text-ink-400">{committeeName(db, t.committeeId)}</span>
            {showMosque && <span className="text-ink-400">{mosqueName(db, t.mosqueId)}</span>}
          </div>
        </button>

        <div className="shrink-0 no-print sm:opacity-60 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition">
          <TaskMenu t={t} a={a} />
        </div>
      </div>
    </li>
  )
}
