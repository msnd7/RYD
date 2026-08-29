import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useDb, uid } from '../store/db'
import { useAuth } from '../store/auth'
import { Card, Modal, Field, Select, Badge, Empty, useToast, Menu } from '../components/ui'
import { PageHeader } from '../components/PageHeader'
import { AiTextArea } from '../components/AiTextArea'
import { todayISO, fmtDate, dueLabel, shiftDays } from '../lib/date'
import { committeesOf, staffOf, personName, committeeName, taskCounts, mosqueName } from '../lib/selectors'
import { waLink, taskReminder, hasWhatsapp } from '../lib/whatsapp'
import type { Task, TaskKind, TaskStatus } from '../types'

export const KIND_LABEL: Record<TaskKind, string> = { task: 'مهمة', decision: 'قرار', recommendation: 'توصية' }
export const KIND_TONE: Record<TaskKind, string> = { task: 'info', decision: 'purple', recommendation: 'warn' }
export const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: 'قيد التنفيذ', done: 'منجزة', stuck: 'متعثرة', postponed: 'مؤجلة',
}
export const STATUS_TONE: Record<TaskStatus, string> = {
  pending: 'info', done: 'ok', stuck: 'bad', postponed: 'warn',
}

/** ألوان الحالة: شريط جانبي + خلفية هادئة + لون العنوان */
const STATUS_STYLE: Record<TaskStatus, { bar: string; tint: string; title: string; pill: string }> = {
  done:      { bar: 'bg-navy-600',   tint: 'bg-navy-50/60',   title: 'text-ink-400 line-through', pill: 'bg-navy-600 text-white' },
  pending:   { bar: 'bg-navy-300',   tint: '',                title: 'text-ink-900',              pill: 'bg-navy-50 text-navy-800' },
  postponed: { bar: 'bg-orange-300', tint: 'bg-orange-50/50', title: 'text-orange-800',           pill: 'bg-orange-100 text-orange-700' },
  stuck:     { bar: 'bg-orange-500', tint: 'bg-orange-50/70', title: 'text-orange-700',           pill: 'bg-orange-500 text-white' },
}

type Scope = 'complex' | 'mosque' | 'mine'

export default function Tasks({ scope = 'mosque' }: { scope?: Scope }) {
  const { mid = '' } = useParams()
  const { db, set } = useDb()
  const { user, isDirector } = useAuth()
  const toast = useToast()

  const [filter, setFilter] = useState<'all' | TaskStatus | 'late'>('all')
  const [fCommittee, setFCommittee] = useState('')
  const [fPerson, setFPerson] = useState('')
  const [fMosque, setFMosque] = useState('')
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Task | null>(null)
  const [open, setOpen] = useState(false)

  const today = todayISO()

  /** نطاق البنود المرئية لهذا المستخدم */
  const base = useMemo(() => {
    if (scope === 'mine') {
      return db.tasks.filter((t) => t.assigneeId === user!.id || user!.committeeIds.includes(t.committeeId))
    }
    if (scope === 'complex') return db.tasks
    return db.tasks.filter((t) => t.mosqueId === mid)
  }, [db.tasks, scope, mid, user])

  const tc = taskCounts(base)

  const list = useMemo(() => {
    let rows = base
    if (fMosque) rows = rows.filter((t) => t.mosqueId === fMosque)
    if (filter === 'late') rows = rows.filter((t) => t.status !== 'done' && t.dueDate < today)
    else if (filter !== 'all') rows = rows.filter((t) => t.status === filter)
    if (fCommittee) rows = rows.filter((t) => t.committeeId === fCommittee)
    if (fPerson) rows = rows.filter((t) => t.assigneeId === fPerson)
    if (q.trim()) rows = rows.filter((t) => (t.title + t.details).includes(q.trim()))
    return [...rows].sort((a, b) => {
      const w = (t: Task) => (t.status === 'done' ? 1 : 0)
      return w(a) - w(b) || a.dueDate.localeCompare(b.dueDate)
    })
  }, [base, filter, fCommittee, fPerson, fMosque, q, today])

  const setStatus = (id: string, status: TaskStatus) => {
    set((d) => {
      const t = d.tasks.find((x) => x.id === id)
      if (t) { t.status = status; t.doneAt = status === 'done' ? todayISO() : undefined }
    })
    toast(`الحالة الآن: ${STATUS_LABEL[status]}`)
  }

  const remove = (id: string) => {
    if (!confirm('حذف هذا البند نهائيًا؟')) return
    set((d) => { d.tasks = d.tasks.filter((t) => t.id !== id) })
    toast('تم الحذف')
  }

  const canEdit = (t: Task) =>
    isDirector || user?.role === 'supervisor' || t.assigneeId === user?.id || t.createdBy === user?.id

  const CARDS: { key: typeof filter; label: string; count: number; cls: string }[] = [
    { key: 'all', label: 'الكل', count: tc.total, cls: 'bg-surface border-line text-ink-900' },
    { key: 'pending', label: 'قيد التنفيذ', count: tc.pending, cls: 'bg-navy-50 border-navy-100 text-navy-800' },
    { key: 'done', label: 'منجزة', count: tc.done, cls: 'bg-navy-100 border-navy-200 text-navy-800' },
    { key: 'stuck', label: 'متعثرة', count: tc.stuck, cls: 'bg-orange-100 border-orange-200 text-orange-700' },
    { key: 'postponed', label: 'مؤجلة', count: tc.postponed, cls: 'bg-orange-50 border-orange-200 text-orange-800' },
    { key: 'late', label: 'متأخرة', count: tc.late, cls: 'bg-orange-50 border-orange-200 text-orange-800' },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={scope === 'complex' ? 'الإدارة العامة' : scope === 'mine' ? 'مساحتي' : mosqueName(db, mid)}
        title="قائمة المهام"
        description={scope === 'mine'
          ? 'مهامك وقرارات لجنتك. غيّر الحالة بضغطة، وأضف مهامك الخاصة، وذكّر زميلك عبر واتساب.'
          : 'أضف مهمة وحدّد المسؤول والموعد. تظهر حالة كل بند بلونه، ويمكن تذكير المسؤول عبر واتساب بضغطة.'}
        actions={<button className="btn-primary btn-sm" onClick={() => { setEditing(null); setOpen(true) }}>＋ مهمة جديدة</button>}
      />

      {/* لوحة المهام — بطاقات تعمل كمرشّحات */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {CARDS.map((c) => (
          <button key={c.key} onClick={() => setFilter(c.key)}
            className={`rounded-xl border px-3 py-3 text-right transition
              ${c.cls} ${filter === c.key ? 'ring-2 ring-orange-400 ring-offset-1 ring-offset-canvas' : 'hover:brightness-[.98]'}`}>
            <div className="num text-[22px] leading-none">{c.count}</div>
            <div className="text-[11px] font-bold mt-1.5 opacity-80 truncate">{c.label}</div>
          </button>
        ))}
      </div>

      <Card pad={false}>
        <div className="px-4 sm:px-5 py-3 grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5 no-print">
          <input className="field" placeholder="بحث في البنود…" value={q} onChange={(e) => setQ(e.target.value)} />
          {scope === 'complex' && (
            <Select value={fMosque} onChange={setFMosque} placeholder="كل المساجد"
              options={db.mosques.map((m) => ({ value: m.id, label: m.name }))} />
          )}
          {scope !== 'mine' && (
            <>
              <Select value={fCommittee} onChange={setFCommittee} placeholder="كل اللجان"
                options={(scope === 'complex' ? db.committees : committeesOf(db, mid)).map((c) => ({
                  value: c.id, label: scope === 'complex' ? `${c.name} — ${mosqueName(db, c.mosqueId)}` : c.name,
                }))} />
              <Select value={fPerson} onChange={setFPerson} placeholder="كل المسؤولين"
                options={(scope === 'complex' ? db.people.filter((p) => p.active) : staffOf(db, mid))
                  .map((p) => ({ value: p.id, label: p.name }))} />
            </>
          )}
        </div>

        {list.length === 0 ? (
          <Empty icon="🗒️"
            title={tc.total ? 'لا توجد بنود في هذا التصنيف' : 'لا توجد مهام بعد'}
            hint={scope === 'mine'
              ? 'أضف مهمة لنفسك، أو انتظر ما يُسند إليك من مدير المجمع أو مشرف مسجدك.'
              : 'أضف مهمة أو قرارًا أو توصية، وحدّد المسؤول والموعد.'}
            action={<button className="btn-primary btn-sm" onClick={() => { setEditing(null); setOpen(true) }}>＋ مهمة جديدة</button>} />
        ) : (
          <ul className="divide-y divide-line">
            {list.map((t) => {
              const d = dueLabel(t.dueDate)
              const late = t.status !== 'done' && d.diff < 0
              const st = STATUS_STYLE[t.status]
              const assignee = db.people.find((p) => p.id === t.assigneeId)
              const wa = waLink(assignee?.phone, taskReminder({
                name: assignee?.name ?? '', title: t.title, kind: KIND_LABEL[t.kind],
                due: fmtDate(t.dueDate), complex: db.settings.complexName, late,
              }))

              return (
                <li key={t.id} className={`relative ${st.tint}`}>
                  <span className={`absolute inset-y-0 right-0 w-1.5 ${late && t.status !== 'done' ? 'bg-orange-500' : st.bar}`} />
                  <div className="pr-4 pl-3 sm:pr-5 sm:pl-4 py-3.5">
                    <div className="flex items-start gap-3">
                      {/* علامة الإنجاز */}
                      <button
                        onClick={() => canEdit(t) && setStatus(t.id, t.status === 'done' ? 'pending' : 'done')}
                        disabled={!canEdit(t)} title={t.status === 'done' ? 'إرجاعها قيد التنفيذ' : 'تعليمها منجزة'}
                        className={`mt-0.5 w-6 h-6 shrink-0 rounded-lg border-2 grid place-items-center transition
                          ${t.status === 'done'
                            ? 'bg-navy-600 border-navy-600 text-white'
                            : 'border-ink-300 text-transparent hover:border-navy-500'}`}>
                        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 12l6 6L20 6" />
                        </svg>
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`chip ${t.kind === 'decision' ? 'bg-navy-700 text-white' : t.kind === 'recommendation' ? 'bg-orange-100 text-orange-700' : 'bg-navy-50 text-navy-800'}`}>
                            {KIND_LABEL[t.kind]}
                          </span>
                          <h4 className={`font-bold text-[14.5px] leading-6 ${st.title}`}>{t.title}</h4>
                          {late && <Badge tone="bad" dot>متأخرة {Math.abs(d.diff)} يوم</Badge>}
                        </div>

                        {t.details && <p className="text-[12.5px] text-ink-500 mt-1.5 leading-6 whitespace-pre-wrap">{t.details}</p>}
                        {t.note && <p className="text-[12px] text-orange-800 bg-orange-50 rounded-lg px-2.5 py-1.5 mt-2">{t.note}</p>}

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2.5 text-[11.5px] font-bold text-ink-500">
                          {scope === 'complex' && <span>{mosqueName(db, t.mosqueId)}</span>}
                          <span>{committeeName(db, t.committeeId)}</span>
                          <span className="inline-flex items-center gap-1.5">
                            {personName(db, t.assigneeId)}
                            {t.status !== 'done' && wa && (
                              <a href={wa} target="_blank" rel="noreferrer" title={`تذكير ${assignee?.name} عبر واتساب`}
                                className="inline-grid place-items-center w-6 h-6 rounded-md bg-navy-50 text-navy-800 hover:bg-navy-100 transition no-print">
                                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
                                  <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.1-.2 0-.4.1-.5l.4-.5c.1-.2.2-.3.3-.5v-.4l-.8-1.8c-.2-.4-.4-.4-.5-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.3.9 2.5 1.1 2.7a10 10 0 0 0 3.8 3.4c1.4.5 2 .6 2.6.5.5-.1 1.4-.6 1.6-1.2.2-.6.2-1 .1-1.2z" />
                                </svg>
                              </a>
                            )}
                            {t.status !== 'done' && !hasWhatsapp(assignee?.phone) && (
                              <span className="text-[10px] text-ink-300" title="لا يوجد رقم جوال مسجّل">—</span>
                            )}
                          </span>
                          <span className={late ? 'text-orange-700' : ''}>
                            {t.status === 'done' ? `أُنجزت ${fmtDate(t.doneAt ?? t.dueDate)}` : `${fmtDate(t.dueDate)} · ${d.text}`}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 no-print">
                        <select value={t.status} onChange={(e) => setStatus(t.id, e.target.value as TaskStatus)}
                          disabled={!canEdit(t)} aria-label="حالة البند"
                          className={`h-9 rounded-lg px-2.5 text-[12px] font-bold border-0 outline-none cursor-pointer ${st.pill}`}>
                          {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                        {canEdit(t) && (
                          <Menu items={[
                            { label: 'تعديل البند', icon: '✎', onClick: () => { setEditing(t); setOpen(true) } },
                            ...(wa ? [{ label: 'تذكير عبر واتساب', icon: '💬', onClick: () => window.open(wa, '_blank') }] : []),
                            ...(isDirector || t.createdBy === user?.id
                              ? ['sep' as const, { label: 'حذف البند', icon: '🗑', danger: true, onClick: () => remove(t.id) }]
                              : []),
                          ]} />
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <TaskModal
        open={open} onClose={() => { setOpen(false); setEditing(null) }} task={editing}
        scope={scope}
        mosqueId={scope === 'mosque' ? mid : (editing?.mosqueId ?? (user!.mosqueId === 'complex' ? db.mosques[0]?.id : user!.mosqueId as string))}
      />
    </div>
  )
}

/* ================= نموذج البند ================= */
function TaskModal({ open, onClose, task, mosqueId, scope }: {
  open: boolean; onClose: () => void; task: Task | null; mosqueId: string; scope: Scope
}) {
  const { db, set } = useDb()
  const { user, isDirector } = useAuth()
  const toast = useToast()

  const canAssignOthers = isDirector || user?.role === 'supervisor'
  const [f, setF] = useState<any>({})
  const [key, setKey] = useState('')
  const sig = `${open}-${task?.id ?? 'new'}`
  if (sig !== key) {
    setKey(sig)
    setF(task ? { ...task } : {
      mosqueId,
      title: '', details: '', kind: 'task', status: 'pending',
      committeeId: canAssignOthers ? '' : (user!.committeeIds[0] ?? ''),
      assigneeId: canAssignOthers ? '' : user!.id,
      dueDate: shiftDays(todayISO(), 3), remindBefore: 2, note: '',
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
    if (canAssignOthers && !f.assigneeId) return toast('اختر الشخص المسؤول عن المهمة.', 'bad')
    const committeeId = f.committeeId || user!.committeeIds[0] || committees[0]?.id
    const assigneeId = f.assigneeId || user!.id
    if (!committeeId) return toast('اختر اللجنة.', 'bad')
    if (!assigneeId) return toast('اختر المسؤول.', 'bad')

    set((d) => {
      if (task) {
        const t = d.tasks.find((x) => x.id === task.id)!
        Object.assign(t, { ...f, committeeId, assigneeId })
        if (f.status === 'done' && !t.doneAt) t.doneAt = todayISO()
        if (f.status !== 'done') t.doneAt = undefined
      } else {
        d.tasks.push({
          id: uid('t'), mosqueId: f.mosqueId, committeeId, assigneeId,
          title: f.title.trim(), details: f.details ?? '', kind: f.kind, status: f.status,
          dueDate: f.dueDate, remindBefore: Number(f.remindBefore) || 2,
          createdBy: user!.id, createdAt: todayISO(), note: f.note,
          doneAt: f.status === 'done' ? todayISO() : undefined,
        })
      }
    })
    toast(task ? 'تم حفظ التعديلات' : 'أُضيفت المهمة')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={task ? 'تعديل بند' : 'مهمة جديدة'} wide
      footer={<>
        <button className="btn-primary" onClick={save}>{task ? 'حفظ' : 'إضافة'}</button>
        <button className="btn-ghost" onClick={onClose}>إلغاء</button>
      </>}>
      <div className="space-y-4">
        <Field label="ماذا يجب عمله؟" required>
          <input className="field" value={f.title ?? ''} onChange={(e) => setF({ ...f, title: e.target.value })}
            placeholder="مثال: تجهيز مسابقة الحفظ الشهرية" autoFocus />
        </Field>

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
              <Field label="المسؤول" required hint="اختيار المسؤول يملأ لجنته تلقائيًا">
                <Select value={f.assigneeId ?? ''} onChange={pickAssignee} placeholder="اختر المسؤول…"
                  options={pool.map((p) => ({ value: p.id, label: `${p.name} — ${p.jobTitle}` }))} />
              </Field>
            </>
          ) : (
            <Field label="المسؤول" hint="المهام التي تضيفها تُسند إليك">
              <input className="field bg-navy-50" value={user!.name} disabled />
            </Field>
          )}

          <Field label="الموعد" required>
            <input type="date" className="field" value={f.dueDate ?? ''} onChange={(e) => setF({ ...f, dueDate: e.target.value })} />
          </Field>
          <Field label="التنبيه قبل الموعد">
            <Select value={String(f.remindBefore ?? 2)} onChange={(v) => setF({ ...f, remindBefore: Number(v) })} placeholder=""
              options={[1, 2, 3, 5, 7, 10].map((n) => ({ value: String(n), label: `${n} يوم` }))} />
          </Field>
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
