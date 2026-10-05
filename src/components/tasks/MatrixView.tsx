import { useState } from 'react'
import { useDb } from '../../store/db'
import { dueLabel } from '../../lib/date'
import { personName } from '../../lib/selectors'
import { QUADRANTS, QUADRANT_ORDER, sortTasks, isPinnedOn } from '../../lib/tasks'
import type { Task, TaskPriority } from '../../types'
import { CheckBox, TaskMenu, PinIcon, type TaskActions } from './TaskRow'

/**
 * مصفوفة أيزنهاور — أربعة مربعات بألوانها.
 * يُسحب السطر من مربع إلى آخر (أو من صندوق «غير المصنّفة») لتغيير تصنيفه،
 * وعلى الجوال تُصنَّف بالنقاط الملوّنة أو من قائمة الإجراءات.
 */
export function MatrixView({ tasks, a, onAdd, today }: {
  tasks: Task[]; a: TaskActions; onAdd: (p?: TaskPriority) => void; today: string
}) {
  const [showDone, setShowDone] = useState(false)
  const [over, setOver] = useState<TaskPriority | 'none' | null>(null)
  const rows = (showDone ? tasks : tasks.filter((t) => t.status !== 'done')).slice().sort(sortTasks)
  const by = (p?: TaskPriority) => rows.filter((t) => t.priority === p)
  const unsorted = by(undefined)

  const drop = (p: TaskPriority | undefined) => (e: React.DragEvent) => {
    e.preventDefault(); setOver(null)
    const id = e.dataTransfer.getData('text/task')
    if (id) a.setPriority(id, p)
  }
  const dragProps = (p: TaskPriority | 'none') => ({
    onDragOver: (e: React.DragEvent) => { if (e.dataTransfer.types.includes('text/task')) { e.preventDefault(); setOver(p) } },
    onDragLeave: (e: React.DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null) },
    onDrop: drop(p === 'none' ? undefined : p),
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="muted">اسحب المهمة بين المربعات لتغيير أولويتها، أو صنّفها من النقاط الملوّنة.</p>
        <label className="inline-flex items-center gap-2 text-[12.5px] font-bold text-ink-700 cursor-pointer select-none">
          <input type="checkbox" className="w-4 h-4 accent-navy-700" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
          إظهار المنجزة
        </label>
      </div>

      {/* المحور الأفقي: عاجل ← → غير عاجل */}
      <div className="hidden md:grid grid-cols-[28px_1fr_1fr] gap-3 -mb-1">
        <span />
        <AxisLabel text="عاجل" />
        <AxisLabel text="غير عاجل" />
      </div>

      <div className="grid md:grid-cols-[28px_1fr_1fr] gap-3">
        {/* المحور الرأسي: هام / غير هام */}
        <SideLabel text="هام" className="md:col-start-1 md:row-start-1" />
        <SideLabel text="غير هام" className="md:col-start-1 md:row-start-2" />

        {QUADRANT_ORDER.map((p, i) => {
          const q = QUADRANTS[p]
          const list = by(p)
          return (
            <section key={p} {...dragProps(p)}
              className={`card relative overflow-hidden flex flex-col min-h-[240px] md:max-h-[420px] transition
                ${POS[p]} ${over === p ? `ring-4 ${q.ring}` : ''}`}>
              <span className={`absolute inset-x-0 top-0 h-1 ${q.bar}`} />
              <header className={`flex items-center gap-3 px-4 pt-4 pb-3 ${q.soft}`}>
                <span className={`w-9 h-9 rounded-xl grid place-items-center text-white font-black text-[13px] ${q.dot}`}>
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className={`sect-title !text-[15px] ${q.ink}`}>{q.label}</h3>
                  <p className="text-[11.5px] font-bold text-ink-500 truncate">{q.action} · {q.hint}</p>
                </div>
                <span className={`num text-[22px] ${q.ink}`}>{list.length}</span>
              </header>

              <ul className="flex-1 overflow-y-auto overscroll-contain divide-line px-1.5 py-1">
                {list.length === 0 && (
                  <li className="text-center text-[12px] font-bold text-ink-400 py-8">
                    {over === p ? 'أفلت المهمة هنا' : 'لا مهام في هذا المربع'}
                  </li>
                )}
                {list.map((t) => <MatrixItem key={t.id} t={t} a={a} today={today} />)}
              </ul>

              <button onClick={() => onAdd(p)}
                className={`no-print m-2 mt-0 h-9 rounded-xl text-[12.5px] font-bold border border-dashed ${q.border} ${q.ink} ${q.hover} transition`}>
                ＋ إضافة إلى «{q.label}»
              </button>
            </section>
          )
        })}
      </div>

      {/* صندوق غير المصنّفة */}
      <section {...dragProps('none')}
        className={`card p-4 transition ${over === 'none' ? 'ring-4 ring-navy-200' : ''}`}>
        <div className="flex items-center justify-between gap-3 mb-2">
          <div>
            <h3 className="sect-title">غير مصنّفة <span className="num text-ink-400 text-[13px]">({unsorted.length})</span></h3>
            <p className="muted">صنّف كل مهمة لتعرف أين تضع وقتك — اضغط النقطة الملوّنة المناسبة.</p>
          </div>
          <Legend />
        </div>
        {unsorted.length === 0 ? (
          <p className="text-[12.5px] font-bold text-ink-400 py-3">كل المهام مصنّفة 👌</p>
        ) : (
          <ul className="divide-line">
            {unsorted.map((t) => (
              <MatrixItem key={t.id} t={t} a={a} today={today} classify />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

/** مكان كل مربع في الشبكة (العمود الأول للمحور الرأسي) */
const POS: Record<TaskPriority, string> = {
  q1: 'md:col-start-2 md:row-start-1', q2: 'md:col-start-3 md:row-start-1',
  q3: 'md:col-start-2 md:row-start-2', q4: 'md:col-start-3 md:row-start-2',
}

function MatrixItem({ t, a, today, classify }: { t: Task; a: TaskActions; today: string; classify?: boolean }) {
  const { db } = useDb()
  const d = dueLabel(t.dueDate)
  const done = t.status === 'done'
  const late = !done && d.diff < 0
  const editable = a.canEdit(t)
  return (
    <li draggable={editable}
      onDragStart={(e) => { e.dataTransfer.setData('text/task', t.id); e.dataTransfer.effectAllowed = 'move' }}
      className={`group flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-navy-50/70 transition
        ${editable ? 'cursor-grab active:cursor-grabbing' : ''}`}>
      <CheckBox t={t} a={a} size="sm" />
      <button className="min-w-0 flex-1 text-right" onClick={() => editable && a.edit(t)}>
        <div className={`text-[13.5px] font-bold leading-6 truncate ${done ? 'line-through text-ink-400' : 'text-ink-900'}`}>
          {isPinnedOn(t, today) && <PinIcon className="inline w-3 h-3 ml-1 text-navy-600" />}
          {t.title}
        </div>
        <div className="text-[11px] font-bold text-ink-400 truncate">
          <span className={late ? 'text-orange-700' : d.diff === 0 ? 'text-navy-700' : ''}>{done ? 'منجزة' : d.text}</span>
          {' · '}{personName(db, t.assigneeId)}
        </div>
      </button>
      {classify && editable && (
        <div className="flex items-center gap-1 shrink-0">
          {QUADRANT_ORDER.map((p) => (
            <button key={p} onClick={() => a.setPriority(t.id, p)} title={QUADRANTS[p].label}
              aria-label={`تصنيف: ${QUADRANTS[p].label}`}
              className={`tap w-5 h-5 rounded-full ${QUADRANTS[p].dot} opacity-70 hover:opacity-100 hover:scale-110 transition`} />
          ))}
        </div>
      )}
      <div className="shrink-0 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition">
        <TaskMenu t={t} a={a} />
      </div>
    </li>
  )
}

function AxisLabel({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 text-[11.5px] font-black text-ink-500">
      <span className="h-px flex-1 bg-line" />{text}<span className="h-px flex-1 bg-line" />
    </div>
  )
}

function SideLabel({ text, className = '' }: { text: string; className?: string }) {
  return (
    <div className={`hidden md:flex items-center justify-center ${className}`}>
      <span className="text-[11.5px] font-black text-ink-500 [writing-mode:vertical-rl]">{text}</span>
    </div>
  )
}

export function Legend({ withPin }: { withPin?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11.5px] font-bold text-ink-500">
      {QUADRANT_ORDER.map((p) => (
        <span key={p} className="inline-flex items-center gap-1.5">
          <i className={`w-2.5 h-2.5 rounded-full ${QUADRANTS[p].dot}`} />{QUADRANTS[p].label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full border-2 border-ink-300" />غير مصنّفة</span>
      {withPin && <span className="inline-flex items-center gap-1.5"><i className="w-4 h-2.5 rounded-sm bg-navy-700" />مثبّتة لفترة</span>}
    </div>
  )
}
