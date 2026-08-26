import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useDb, uid } from '../store/db'
import { useAuth } from '../store/auth'
import { Card, Modal, Field, Select, Badge, Empty, Tabs, useToast, StatStrip, Menu } from '../components/ui'
import { PageHeader } from '../components/PageHeader'
import { AiTextArea } from '../components/AiTextArea'
import { todayISO, fmtDate, dueLabel, shiftDays } from '../lib/date'
import { committeesOf, staffOf, personName, committeeName, taskCounts, mosqueName } from '../lib/selectors'
import type { Task, TaskKind, TaskStatus } from '../types'

export const KIND_LABEL: Record<TaskKind, string> = { task: 'مهمة', decision: 'قرار', recommendation: 'توصية' }
export const KIND_TONE: Record<TaskKind, string> = { task: 'info', decision: 'purple', recommendation: 'warn' }
export const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: 'قيد التنفيذ', done: 'منجز', stuck: 'متعثر', postponed: 'مؤجل',
}
export const STATUS_TONE: Record<TaskStatus, string> = {
  pending: 'info', done: 'ok', stuck: 'bad', postponed: 'warn',
}

export default function Tasks({ scope }: { scope?: 'complex' }) {
  const { mid = '' } = useParams()
  const { db, set } = useDb()
  const { user, isDirector } = useAuth()
  const toast = useToast()
  const isComplex = scope === 'complex'

  const [tab, setTab] = useState<'all' | TaskStatus>('all')
  const [fCommittee, setFCommittee] = useState('')
  const [fPerson, setFPerson] = useState('')
  const [fKind, setFKind] = useState('')
  const [fMosque, setFMosque] = useState('')
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Task | null>(null)
  const [open, setOpen] = useState(false)

  const list = useMemo(() => {
    let rows = isComplex ? db.tasks : db.tasks.filter((t) => t.mosqueId === mid)
    if (!isDirector && user?.role === 'member') rows = rows.filter(
      (t) => t.assigneeId === user.id || user.committeeIds.includes(t.committeeId))
    if (fMosque) rows = rows.filter((t) => t.mosqueId === fMosque)
    if (tab !== 'all') rows = rows.filter((t) => t.status === tab)
    if (fCommittee) rows = rows.filter((t) => t.committeeId === fCommittee)
    if (fPerson) rows = rows.filter((t) => t.assigneeId === fPerson)
    if (fKind) rows = rows.filter((t) => t.kind === fKind)
    if (q.trim()) rows = rows.filter((t) => (t.title + t.details).includes(q.trim()))
    return rows.sort((a, b) => {
      const w = (t: Task) => (t.status === 'done' ? 1 : 0)
      return w(a) - w(b) || a.dueDate.localeCompare(b.dueDate)
    })
  }, [db.tasks, mid, tab, fCommittee, fPerson, fKind, fMosque, q, isComplex, isDirector, user])

  const base = isComplex ? db.tasks : db.tasks.filter((t) => t.mosqueId === mid)
  const tc = taskCounts(base)

  const setStatus = (id: string, status: TaskStatus) => {
    set((d) => {
      const t = d.tasks.find((x) => x.id === id)
      if (t) { t.status = status; t.doneAt = status === 'done' ? todayISO() : undefined }
    })
    toast(`تم تحديث الحالة إلى: ${STATUS_LABEL[status]}`)
  }

  const remove = (id: string) => {
    if (!confirm('حذف هذا البند نهائيًا؟')) return
    set((d) => { d.tasks = d.tasks.filter((t) => t.id !== id) })
    toast('تم الحذف', 'info')
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={isComplex ? 'الإدارة العامة' : mosqueName(db, mid)}
        title="المهام والقرارات والتوصيات"
        description="اختر المسؤول فتظهر لجنته تلقائيًا، وحدّد النوع والحالة والتاريخ ومدة التنبيه — وسيصلك تذكير قبل الموعد."
        actions={<button className="btn-primary btn-sm" onClick={() => { setEditing(null); setOpen(true) }}>＋ بند جديد</button>}
      />

      <StatStrip items={[
        { label: 'الإجمالي', value: tc.total },
        { label: 'منجز', value: tc.done },
        { label: 'قيد التنفيذ', value: tc.pending },
        { label: 'مؤجل', value: tc.postponed },
        { label: 'متعثر أو متأخر', value: tc.stuck + tc.late, hint: `${tc.stuck} متعثر · ${tc.late} متأخر`, accent: tc.stuck + tc.late > 0 },
      ]} />

      <Card pad={false}>
        <div className="px-5 py-4 space-y-3 no-print">
          <Tabs value={tab} onChange={(v) => setTab(v as any)} items={[
            { value: 'all', label: 'الكل', count: tc.total },
            { value: 'pending', label: 'قيد التنفيذ', count: tc.pending },
            { value: 'stuck', label: 'متعثر', count: tc.stuck },
            { value: 'postponed', label: 'مؤجل', count: tc.postponed },
            { value: 'done', label: 'منجز', count: tc.done },
          ]} />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            <input className="field" placeholder="🔍 بحث في العنوان أو التفاصيل…" value={q} onChange={(e) => setQ(e.target.value)} />
            {isComplex && (
              <Select value={fMosque} onChange={setFMosque} placeholder="كل المساجد"
                options={db.mosques.map((m) => ({ value: m.id, label: m.name }))} />
            )}
            <Select value={fCommittee} onChange={setFCommittee} placeholder="كل اللجان"
              options={(isComplex ? db.committees : committeesOf(db, mid)).map((c) => ({
                value: c.id, label: isComplex ? `${c.name} — ${mosqueName(db, c.mosqueId)}` : c.name,
              }))} />
            <Select value={fPerson} onChange={setFPerson} placeholder="كل المسؤولين"
              options={(isComplex ? db.people : staffOf(db, mid)).map((p) => ({ value: p.id, label: p.name }))} />
            <Select value={fKind} onChange={setFKind} placeholder="كل الأنواع"
              options={Object.entries(KIND_LABEL).map(([v, l]) => ({ value: v, label: l }))} />
          </div>
        </div>

        {list.length === 0 ? (
          <Empty icon="🗒️" title="لا توجد بنود مطابقة"
            hint="أضف مهمة أو قرارًا أو توصية، وحدّد اللجنة والمسؤول والتاريخ."
            action={<button className="btn-primary btn-sm" onClick={() => setOpen(true)}>＋ إضافة بند</button>} />
        ) : (
          <ul className="divide-y divide-line">
            {list.map((t) => {
              const d = dueLabel(t.dueDate)
              const canEdit = isDirector || user?.role === 'supervisor' || t.assigneeId === user?.id || t.createdBy === user?.id
              return (
                <li key={t.id} className="px-5 py-4 hover:bg-navy-50/30 transition">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={KIND_TONE[t.kind]}>{KIND_LABEL[t.kind]}</Badge>
                        <h4 className={`font-extrabold text-[14.5px] ${t.status === 'done' ? 'line-through text-ink-500' : ''}`}>{t.title}</h4>
                      </div>
                      {t.details && <p className="text-[12.5px] text-ink-500 mt-1.5 leading-6 whitespace-pre-wrap">{t.details}</p>}
                      {t.note && <p className="text-[12px] text-orange-700 bg-orange-50 rounded-lg px-2.5 py-1.5 mt-2">📌 {t.note}</p>}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2.5 text-[11.5px] text-ink-500 font-bold">
                        {isComplex && <span>🕌 {mosqueName(db, t.mosqueId)}</span>}
                        <span>🏷️ {committeeName(db, t.committeeId)}</span>
                        <span>👤 {personName(db, t.assigneeId)}</span>
                        <span>📅 {fmtDate(t.dueDate)}</span>
                        <span className={d.tone === 'bad' ? 'text-orange-600' : d.tone === 'warn' ? 'text-orange-600' : ''}>
                          ⏰ {t.status === 'done' ? 'أُنجزت' : d.text}
                        </span>
                        <span className="text-ink-300">🔔 تنبيه قبل {t.remindBefore} يوم</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 no-print">
                      <select value={t.status} onChange={(e) => setStatus(t.id, e.target.value as TaskStatus)}
                        disabled={!canEdit}
                        className={`rounded-xl px-3 py-2 text-[12px] font-black border-0 outline-none cursor-pointer
                          ${t.status === 'done' ? 'bg-navy-100 text-navy-800'
                            : t.status === 'stuck' ? 'bg-orange-100 text-orange-700'
                            : t.status === 'postponed' ? 'bg-orange-100 text-orange-700'
                            : 'bg-navy-100 text-navy-700'}`}>
                        {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                      {canEdit && (
                        <Menu items={[
                          { label: 'تعديل البند', icon: '✎', onClick: () => { setEditing(t); setOpen(true) } },
                          ...(isDirector || t.createdBy === user?.id
                            ? ['sep' as const, { label: 'حذف البند', icon: '🗑', danger: true, onClick: () => remove(t.id) }]
                            : []),
                        ]} />
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <TaskModal open={open} onClose={() => { setOpen(false); setEditing(null) }} task={editing}
        mosqueId={isComplex ? (editing?.mosqueId ?? db.mosques[0].id) : mid} allowMosquePick={isComplex} />
    </div>
  )
}

/* ================= نموذج البند ================= */
function TaskModal({ open, onClose, task, mosqueId, allowMosquePick }: {
  open: boolean; onClose: () => void; task: Task | null; mosqueId: string; allowMosquePick?: boolean
}) {
  const { db, set } = useDb()
  const { user } = useAuth()
  const toast = useToast()

  const [mos, setMos] = useState(task?.mosqueId ?? mosqueId)
  const [title, setTitle] = useState(task?.title ?? '')
  const [details, setDetails] = useState(task?.details ?? '')
  const [kind, setKind] = useState<TaskKind>(task?.kind ?? 'task')
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'pending')
  const [committeeId, setCommitteeId] = useState(task?.committeeId ?? '')
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId ?? '')
  const [dueDate, setDueDate] = useState(task?.dueDate ?? shiftDays(todayISO(), 3))
  const [remind, setRemind] = useState(task?.remindBefore ?? 2)
  const [note, setNote] = useState(task?.note ?? '')

  // إعادة الضبط عند فتح النموذج
  const [key, setKey] = useState('')
  const sig = `${open}-${task?.id ?? 'new'}`
  if (sig !== key) {
    setKey(sig)
    setMos(task?.mosqueId ?? mosqueId); setTitle(task?.title ?? ''); setDetails(task?.details ?? '')
    setKind(task?.kind ?? 'task'); setStatus(task?.status ?? 'pending')
    setCommitteeId(task?.committeeId ?? ''); setAssigneeId(task?.assigneeId ?? '')
    setDueDate(task?.dueDate ?? shiftDays(todayISO(), 3)); setRemind(task?.remindBefore ?? 2)
    setNote(task?.note ?? '')
  }

  const committees = committeesOf(db, mos)
  const people = staffOf(db, mos)
  const inCommittee = committeeId ? people.filter((p) => p.committeeIds.includes(committeeId)) : people
  // إن لم يكن للجنة أعضاء بعد، تُعرض قائمة فريق المسجد كاملة حتى لا يتعذّر الإسناد
  const peopleInCommittee = inCommittee.length ? inCommittee : people

  /** اختيار المسؤول يملأ لجنته تلقائيًا */
  const pickAssignee = (pid: string) => {
    setAssigneeId(pid)
    const p = db.people.find((x) => x.id === pid)
    if (p && !committeeId && p.committeeIds[0]) setCommitteeId(p.committeeIds[0])
  }
  /** اختيار اللجنة يقترح رئيسها كمسؤول */
  const pickCommittee = (cid: string) => {
    setCommitteeId(cid)
    const c = db.committees.find((x) => x.id === cid)
    const still = assigneeId && db.people.find((p) => p.id === assigneeId)?.committeeIds.includes(cid)
    if (!still) setAssigneeId(c?.leaderId ?? '')
  }

  const save = () => {
    if (!title.trim()) return toast('اكتب عنوان البند أولًا.', 'bad')
    if (!committeeId) return toast('اختر اللجنة الموكلة.', 'bad')
    if (!assigneeId) return toast('اختر الشخص المسؤول.', 'bad')
    set((d) => {
      if (task) {
        const t = d.tasks.find((x) => x.id === task.id)!
        Object.assign(t, { mosqueId: mos, title, details, kind, status, committeeId, assigneeId, dueDate, remindBefore: remind, note })
        if (status === 'done' && !t.doneAt) t.doneAt = todayISO()
      } else {
        d.tasks.push({
          id: uid('t'), mosqueId: mos, committeeId, assigneeId, title: title.trim(), details,
          kind, status, dueDate, remindBefore: remind, createdBy: user!.id,
          createdAt: todayISO(), note, doneAt: status === 'done' ? todayISO() : undefined,
        })
      }
    })
    toast(task ? 'تم حفظ التعديلات' : 'تمت إضافة البند')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={task ? 'تعديل البند' : 'بند جديد'} wide
      footer={<>
        <button className="btn-primary" onClick={save}>{task ? 'حفظ التعديلات' : 'إضافة البند'}</button>
        <button className="btn-ghost" onClick={onClose}>إلغاء</button>
      </>}>
      <div className="space-y-4">
        <Field label="العنوان" required>
          <input className="field" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="مثال: اعتماد خطة الحفظ للفصل الثاني" autoFocus />
        </Field>

        <div className="grid sm:grid-cols-2 gap-4">
          {allowMosquePick && (
            <Field label="المسجد" required>
              <Select value={mos} onChange={(v) => { setMos(v); setCommitteeId(''); setAssigneeId('') }}
                options={db.mosques.map((m) => ({ value: m.id, label: m.name }))} />
            </Field>
          )}
          <Field label="النوع" required>
            <Select value={kind} onChange={(v) => setKind(v as TaskKind)} placeholder=""
              options={Object.entries(KIND_LABEL).map(([v, l]) => ({ value: v, label: l }))} />
          </Field>
          <Field label="الحالة" required>
            <Select value={status} onChange={(v) => setStatus(v as TaskStatus)} placeholder=""
              options={Object.entries(STATUS_LABEL).map(([v, l]) => ({ value: v, label: l }))} />
          </Field>
          <Field label="اللجنة الموكلة" required hint="اختيار اللجنة يقترح رئيسها مسؤولًا">
            <Select value={committeeId} onChange={pickCommittee} placeholder="اختر اللجنة…"
              options={committees.map((c) => ({ value: c.id, label: c.name }))} />
          </Field>
          <Field label="الشخص المسؤول" required
            hint={committeeId && inCommittee.length === 0
              ? 'لا يوجد أعضاء مسكّنون في هذه اللجنة — تظهر قائمة فريق المسجد كاملة'
              : 'اختيار الشخص يملأ لجنته تلقائيًا'}>
            <Select value={assigneeId} onChange={pickAssignee} placeholder="اختر المسؤول…"
              options={peopleInCommittee.map((p) => ({ value: p.id, label: `${p.name} — ${p.jobTitle}` }))} />
          </Field>
          <Field label="التاريخ المحدد" required>
            <input type="date" className="field" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
          <Field label="التنبيه قبل الموعد">
            <Select value={String(remind)} onChange={(v) => setRemind(Number(v))} placeholder=""
              options={[1, 2, 3, 5, 7, 10].map((n) => ({ value: String(n), label: `${n} يوم` }))} />
          </Field>
        </div>

        <AiTextArea label="التفاصيل" value={details} onChange={setDetails} kind="task" rows={4}
          placeholder="اكتب تفاصيل المهمة أو نص القرار / التوصية…" />

        <Field label="ملاحظة متابعة" hint="تظهر بلون مميز أسفل البند (مثال: سبب التعثر أو التأجيل)">
          <input className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="اختياري" />
        </Field>
      </div>
    </Modal>
  )
}
