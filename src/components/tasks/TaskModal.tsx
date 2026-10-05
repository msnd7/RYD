import { useState } from 'react'
import { useDb, uid } from '../../store/db'
import { useAuth } from '../../store/auth'
import { Modal, Field, Select, useToast } from '../ui'
import { AiTextArea } from '../AiTextArea'
import { todayISO, shiftDays, daysBetween } from '../../lib/date'
import { committeesOf, staffOf } from '../../lib/selectors'
import { QUADRANTS, QUADRANT_ORDER, KIND_LABEL, STATUS_LABEL } from '../../lib/tasks'
import type { Task, TaskPriority } from '../../types'
import { PinIcon } from './TaskRow'

export type TaskScope = 'complex' | 'mosque' | 'mine'

/** قيم أولية عند فتح النموذج من مربع في المصفوفة أو يوم في التقويم أو الإضافة السريعة */
export interface TaskDraft { title?: string; priority?: TaskPriority; dueDate?: string; pin?: boolean }

export function TaskModal({ open, onClose, task, draft, mosqueId, scope }: {
  open: boolean; onClose: () => void; task: Task | null; draft?: TaskDraft; mosqueId: string; scope: TaskScope
}) {
  const { db, set } = useDb()
  const { user, isDirector } = useAuth()
  const toast = useToast()

  const canAssignOthers = isDirector || user?.role === 'supervisor'
  const [f, setF] = useState<any>({})
  const [key, setKey] = useState('')
  const sig = `${open}-${task?.id ?? 'new'}-${JSON.stringify(draft ?? {})}`
  if (sig !== key) {
    setKey(sig)
    const due = draft?.dueDate ?? shiftDays(todayISO(), 3)
    setF(task ? { ...task, pinned: !!(task.pinFrom && task.pinTo) || !!draft?.pin,
      pinFrom: task.pinFrom ?? todayISO(), pinTo: task.pinTo ?? (task.dueDate >= todayISO() ? task.dueDate : shiftDays(todayISO(), 7)) } : {
      mosqueId,
      title: draft?.title ?? '', details: '', kind: 'task', status: 'pending',
      priority: draft?.priority,
      committeeId: canAssignOthers ? '' : (user!.committeeIds[0] ?? ''),
      assigneeId: canAssignOthers ? '' : user!.id,
      dueDate: due, remindBefore: 2, note: '',
      pinned: !!draft?.pin, pinFrom: todayISO() < due ? todayISO() : due, pinTo: due,
    })
  }

  const committees = committeesOf(db, f.mosqueId ?? mosqueId)
  const people = staffOf(db, f.mosqueId ?? mosqueId)
  const inCommittee = f.committeeId ? people.filter((p) => p.committeeIds.includes(f.committeeId)) : people
  const pool = inCommittee.length ? inCommittee : people

  const pickAssignee = (pid: string) => {
    const p = db.people.find((x) => x.id === pid)
    setF((s: any) => ({ ...s, assigneeId: pid, committeeId: s.committeeId || p?.committeeIds[0] || '' }))
  }
  const pickCommittee = (cid: string) => {
    const c = db.committees.find((x) => x.id === cid)
    setF((s: any) => {
      const still = s.assigneeId && db.people.find((p) => p.id === s.assigneeId)?.committeeIds.includes(cid)
      return { ...s, committeeId: cid, assigneeId: still ? s.assigneeId : (c?.leaderId ?? '') }
    })
  }

  const save = () => {
    if (!f.title?.trim()) return toast('اكتب عنوان المهمة.', 'bad')
    if (canAssignOthers && !f.assigneeId) return toast('اختر الموظف المسؤول عن المهمة.', 'bad')
    const committeeId = f.committeeId || user!.committeeIds[0] || committees[0]?.id
    const assigneeId = f.assigneeId || user!.id
    if (!committeeId) return toast('اختر اللجنة.', 'bad')
    if (!assigneeId) return toast('اختر المسؤول.', 'bad')
    if (f.pinned && (!f.pinFrom || !f.pinTo)) return toast('حدّد بداية التثبيت ونهايته.', 'bad')
    if (f.pinned && f.pinFrom > f.pinTo) return toast('تاريخ نهاية التثبيت قبل بدايته.', 'bad')

    const pin = f.pinned ? { pinFrom: f.pinFrom, pinTo: f.pinTo } : { pinFrom: undefined, pinTo: undefined }
    const { pinned: _p, ...fields } = f

    set((d) => {
      if (task) {
        const t = d.tasks.find((x) => x.id === task.id)!
        Object.assign(t, { ...fields, ...pin, committeeId, assigneeId })
        if (!f.priority) delete t.priority
        if (!f.pinned) { delete t.pinFrom; delete t.pinTo }
        if (f.status === 'done' && !t.doneAt) t.doneAt = todayISO()
        if (f.status !== 'done') t.doneAt = undefined
      } else {
        d.tasks.push({
          id: uid('t'), mosqueId: f.mosqueId, committeeId, assigneeId,
          title: f.title.trim(), details: f.details ?? '', kind: f.kind, status: f.status,
          dueDate: f.dueDate, remindBefore: Number(f.remindBefore) || 2,
          createdBy: user!.id, createdAt: todayISO(), note: f.note,
          doneAt: f.status === 'done' ? todayISO() : undefined,
          ...(f.priority ? { priority: f.priority } : {}),
          ...(f.pinned ? pin : {}),
        })
      }
    })
    toast(task ? 'تم حفظ التعديلات' : 'أُضيفت المهمة')
    onClose()
  }

  const pinDays = f.pinned && f.pinFrom && f.pinTo && f.pinFrom <= f.pinTo ? daysBetween(f.pinFrom, f.pinTo) + 1 : 0

  return (
    <Modal open={open} onClose={onClose} title={task ? 'تعديل مهمة' : 'مهمة جديدة'} wide
      footer={<>
        <button className="btn-primary" onClick={save}>{task ? 'حفظ' : 'إضافة'}</button>
        <button className="btn-ghost" onClick={onClose}>إلغاء</button>
      </>}>
      <div className="space-y-5">
        <Field label="ماذا يجب عمله؟" required>
          <input className="field !h-12 !text-[15px] font-bold" value={f.title ?? ''} onChange={(e) => setF({ ...f, title: e.target.value })}
            placeholder="مثال: تجهيز مسابقة الحفظ الشهرية" autoFocus />
        </Field>

        {/* مصفوفة أيزنهاور */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="label !mb-0">الأولوية — مصفوفة أيزنهاور</label>
            {f.priority && (
              <button className="text-[11.5px] font-bold text-ink-400 hover:text-navy-700" onClick={() => setF({ ...f, priority: undefined })}>
                إلغاء التصنيف
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="الأولوية">
            {QUADRANT_ORDER.map((p) => {
              const q = QUADRANTS[p]
              const on = f.priority === p
              return (
                <button key={p} type="button" role="radio" aria-checked={on}
                  onClick={() => setF({ ...f, priority: on ? undefined : p })}
                  className={`relative text-right rounded-2xl border-2 px-3.5 py-3 transition
                    ${on ? `${q.soft} shadow-soft` : 'border-line bg-surface hover:bg-navy-50/50'}`}
                  style={on ? { borderColor: `rgb(var(--${p}))` } : undefined}>
                  <div className="flex items-center gap-2">
                    <i className={`w-3 h-3 rounded-full shrink-0 ${q.dot}`} />
                    <span className={`font-bold text-[13.5px] ${on ? q.ink : 'text-ink-900'}`}>{q.label}</span>
                    {on && (
                      <svg viewBox="0 0 24 24" className={`w-4 h-4 mr-auto ${q.ink}`} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l6 6L20 6" /></svg>
                    )}
                  </div>
                  <p className="text-[11px] font-bold text-ink-500 mt-1 leading-5">{q.action} — {q.hint}</p>
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="الموعد" required>
            <input type="date" className="field" value={f.dueDate ?? ''} onChange={(e) => setF({ ...f, dueDate: e.target.value })} />
          </Field>
          <Field label="التنبيه قبل الموعد">
            <Select value={String(f.remindBefore ?? 2)} onChange={(v) => setF({ ...f, remindBefore: Number(v) })} placeholder=""
              options={[1, 2, 3, 5, 7, 10].map((n) => ({ value: String(n), label: `${n} يوم` }))} />
          </Field>
        </div>

        {/* التثبيت لفترة */}
        <div className={`rounded-2xl border transition ${f.pinned ? 'border-navy-300 bg-navy-50/60' : 'border-line'}`}>
          <label className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none">
            <span className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${f.pinned ? 'bg-navy-700 text-white' : 'bg-navy-50 text-navy-700'}`}>
              <PinIcon className="w-4 h-4" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-bold text-[13.5px] text-ink-900">تثبيت المهمة لفترة محددة</span>
              <span className="block text-[11.5px] text-ink-500">تبقى في أعلى القائمة وتمتد شريطًا على التقويم طوال الفترة</span>
            </span>
            <input type="checkbox" className="sr-only peer" checked={!!f.pinned} onChange={(e) => setF({ ...f, pinned: e.target.checked })} />
            <span className={`relative w-11 h-6 rounded-full transition shrink-0 ${f.pinned ? 'bg-navy-700' : 'bg-ink-300/60'}`}>
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${f.pinned ? 'left-0.5' : 'left-[22px]'}`} />
            </span>
          </label>
          {f.pinned && (
            <div className="px-4 pb-4 grid grid-cols-2 gap-3">
              <Field label="من تاريخ">
                <input type="date" className="field" value={f.pinFrom ?? ''} onChange={(e) => setF({ ...f, pinFrom: e.target.value })} />
              </Field>
              <Field label="إلى تاريخ">
                <input type="date" className="field" value={f.pinTo ?? ''} min={f.pinFrom} onChange={(e) => setF({ ...f, pinTo: e.target.value })} />
              </Field>
              <div className="col-span-2 flex flex-wrap items-center gap-1.5">
                {[{ l: 'أسبوع', n: 6 }, { l: 'أسبوعان', n: 13 }, { l: 'شهر', n: 29 }, { l: 'حتى الموعد', n: -1 }].map((o) => (
                  <button key={o.l} type="button" className="chip bg-surface border border-line text-ink-700 hover:border-navy-300"
                    onClick={() => {
                      const from = f.pinFrom || todayISO()
                      setF({ ...f, pinFrom: from, pinTo: o.n < 0 ? (f.dueDate >= from ? f.dueDate : from) : shiftDays(from, o.n) })
                    }}>{o.l}</button>
                ))}
                {pinDays > 0 && <span className="text-[11.5px] font-bold text-navy-700 mr-auto">مدة التثبيت: {pinDays} يوم</span>}
              </div>
            </div>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="النوع">
            <Select value={f.kind ?? 'task'} onChange={(v) => setF({ ...f, kind: v })} placeholder=""
              options={Object.entries(KIND_LABEL).map(([v, l]) => ({ value: v, label: l }))} />
          </Field>
          <Field label="الحالة">
            <Select value={f.status ?? 'pending'} onChange={(v) => setF({ ...f, status: v })} placeholder=""
              options={Object.entries(STATUS_LABEL).map(([v, l]) => ({ value: v, label: l }))} />
          </Field>

          {scope === 'complex' && (
            <Field label="المسجد" required>
              <Select value={f.mosqueId ?? ''} onChange={(v) => setF({ ...f, mosqueId: v, committeeId: '', assigneeId: '' })}
                options={db.mosques.map((m) => ({ value: m.id, label: m.name }))} />
            </Field>
          )}

          {canAssignOthers ? (
            <>
              <Field label="اللجنة" required hint="اختيار اللجنة يقترح رئيسها مسؤولًا">
                <Select value={f.committeeId ?? ''} onChange={pickCommittee} placeholder="اختر اللجنة…"
                  options={committees.map((c) => ({ value: c.id, label: c.name }))} />
              </Field>
              <Field label="الموظف المسؤول" required hint="اختيار الموظف يملأ لجنته تلقائيًا">
                <Select value={f.assigneeId ?? ''} onChange={pickAssignee} placeholder="اختر الموظف المسؤول…"
                  options={pool.map((p) => ({ value: p.id, label: `${p.name} — ${p.jobTitle}` }))} />
              </Field>
            </>
          ) : (
            <Field label="الموظف المسؤول" hint="المهام التي تضيفها تُسند إليك">
              <input className="field bg-navy-50" value={user!.name} disabled />
            </Field>
          )}
        </div>

        <AiTextArea label="تفاصيل (اختياري)" value={f.details ?? ''} onChange={(v) => setF({ ...f, details: v })}
          kind="task" rows={3} placeholder="أي تفاصيل تساعد على التنفيذ…" />

        <Field label="ملاحظة متابعة" hint="مثل سبب التعثر أو التأجيل — تظهر بلون مميز">
          <input className="field" value={f.note ?? ''} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="اختياري" />
        </Field>
      </div>
    </Modal>
  )
}
