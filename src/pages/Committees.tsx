import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useDb, uid } from '../store/db'
import { useAuth } from '../store/auth'
import { Card, Modal, Field, Select, Badge, Empty, useToast, Progress } from '../components/ui'
import { Donut, C } from '../components/charts'
import { committeesOf, staffOf, taskCounts, personName } from '../lib/selectors'
import { fmtDate, dueLabel, todayISO, shiftDays } from '../lib/date'
import { KIND_LABEL, KIND_TONE, STATUS_LABEL, STATUS_TONE } from './Tasks'
import type { Committee, TaskKind, TaskStatus } from '../types'

export default function Committees() {
  const { mid = '' } = useParams()
  const { db, set } = useDb()
  const { user, isDirector } = useAuth()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Committee | null>(null)
  const [taskFor, setTaskFor] = useState<Committee | null>(null)

  const list = committeesOf(db, mid)
  const canManage = isDirector || (user?.role === 'supervisor' && user.mosqueId === mid)

  return (
    <div className="space-y-5">
      <Card title="لجان المسجد" subtitle="كل لجنة تتابع مهامها وتفوّض المسؤول عنها"
        action={canManage && <button className="btn-primary btn-sm" onClick={() => { setEditing(null); setOpen(true) }}>＋ لجنة جديدة</button>}>
        {list.length === 0 && <Empty icon="🏷️" title="لا توجد لجان" />}
        <div className="grid md:grid-cols-2 gap-4">
          {list.map((c) => {
            const members = db.people.filter((p) => p.committeeIds.includes(c.id) && p.active)
            const tasks = db.tasks.filter((t) => t.committeeId === c.id)
            const tc = taskCounts(tasks)
            const pct = tc.total ? Math.round((tc.done / tc.total) * 100) : 0
            const canAdd = canManage || members.some((m) => m.id === user?.id)

            return (
              <div key={c.id} className="rounded-2xl border border-line p-5 hover:shadow-soft transition">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-display font-extrabold text-[16px]">{c.name}</h3>
                    <p className="text-[12px] text-ink-500 mt-1 leading-6">{c.goal}</p>
                  </div>
                  <Donut value={pct} size={72} stroke={9}
                    tone={pct >= 80 ? C.olive : pct >= 50 ? C.gold : C.rose} sub="إنجاز" />
                </div>

                <div className="mt-4">
                  <p className="text-[11.5px] font-bold text-ink-500 mb-2">الأعضاء المسكّنون ({members.length})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {members.length === 0 && <span className="text-[12px] text-ink-300">لم يُسكَّن أحد بعد — من صفحة فريق العمل</span>}
                    {members.map((m) => (
                      <span key={m.id} className={`chip ${m.id === c.leaderId ? 'bg-navy-600 text-white' : 'bg-line text-ink-700'}`}>
                        {m.id === c.leaderId && '⭐ '}{m.name}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-4 gap-1.5 text-center">
                  {[
                    ['منجز', tc.done, 'text-navy-800'],
                    ['جارٍ', tc.pending, 'text-navy-700'],
                    ['متعثر', tc.stuck, 'text-orange-600'],
                    ['مؤجل', tc.postponed, 'text-orange-600'],
                  ].map(([l, v, cls]) => (
                    <div key={l as string} className="rounded-xl bg-navy-50 py-2">
                      <div className={`text-base font-display font-black tabular-nums ${cls}`}>{v as number}</div>
                      <div className="text-[10px] font-bold text-ink-500">{l as string}</div>
                    </div>
                  ))}
                </div>

                {tasks.filter((t) => t.status !== 'done').length > 0 && (
                  <ul className="mt-4 space-y-2">
                    {tasks.filter((t) => t.status !== 'done').slice(0, 3).map((t) => {
                      const d = dueLabel(t.dueDate)
                      return (
                        <li key={t.id} className="flex items-center gap-2 text-[12px] bg-navy-50 rounded-xl px-3 py-2">
                          <Badge tone={KIND_TONE[t.kind]}>{KIND_LABEL[t.kind]}</Badge>
                          <span className="flex-1 font-bold truncate">{t.title}</span>
                          <span className={`text-[11px] font-bold ${d.tone === 'bad' ? 'text-orange-600' : 'text-ink-500'}`}>{d.text}</span>
                        </li>
                      )
                    })}
                  </ul>
                )}

                <div className="flex gap-2 mt-4 no-print">
                  {canAdd && <button className="btn-primary btn-sm" onClick={() => setTaskFor(c)}>＋ مهمة للجنة</button>}
                  {canManage && <button className="btn-ghost btn-sm" onClick={() => { setEditing(c); setOpen(true) }}>تعديل</button>}
                  {isDirector && (
                    <button className="btn-sm px-2 rounded-lg text-orange-600 hover:bg-orange-50" onClick={() => {
                      if (!confirm(`حذف ${c.name}؟ ستبقى المهام المرتبطة بها.`)) return
                      set((d) => {
                        d.committees = d.committees.filter((x) => x.id !== c.id)
                        d.people.forEach((p) => { p.committeeIds = p.committeeIds.filter((x) => x !== c.id) })
                      })
                      toast('تم حذف اللجنة', 'info')
                    }}>حذف</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <CommitteeModal open={open} onClose={() => { setOpen(false); setEditing(null) }} committee={editing} mosqueId={mid} />
      <QuickTaskModal committee={taskFor} onClose={() => setTaskFor(null)} />
    </div>
  )
}

function CommitteeModal({ open, onClose, committee, mosqueId }: {
  open: boolean; onClose: () => void; committee: Committee | null; mosqueId: string
}) {
  const { db, set } = useDb()
  const toast = useToast()
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('')
  const [leaderId, setLeaderId] = useState('')
  const [key, setKey] = useState('')
  const sig = `${open}-${committee?.id ?? 'new'}`
  if (sig !== key) {
    setKey(sig); setName(committee?.name ?? ''); setGoal(committee?.goal ?? ''); setLeaderId(committee?.leaderId ?? '')
  }

  const save = () => {
    if (!name.trim()) return toast('اكتب اسم اللجنة.', 'bad')
    set((d) => {
      if (committee) Object.assign(d.committees.find((c) => c.id === committee.id)!, { name, goal, leaderId })
      else d.committees.push({ id: uid('cm'), mosqueId, name: name.trim(), goal, leaderId })
    })
    toast(committee ? 'تم الحفظ' : 'تمت إضافة اللجنة')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={committee ? 'تعديل لجنة' : 'لجنة جديدة'}
      footer={<><button className="btn-primary" onClick={save}>حفظ</button>
        <button className="btn-ghost" onClick={onClose}>إلغاء</button></>}>
      <div className="space-y-4">
        <Field label="اسم اللجنة" required>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: اللجنة التعليمية" autoFocus />
        </Field>
        <Field label="هدف اللجنة">
          <textarea className="field leading-7" rows={3} value={goal} onChange={(e) => setGoal(e.target.value)} />
        </Field>
        <Field label="رئيس اللجنة" hint="يُقترح تلقائيًا كمسؤول عند إضافة مهمة للجنة">
          <Select value={leaderId} onChange={setLeaderId} placeholder="بدون"
            options={staffOf(db, mosqueId).map((p) => ({ value: p.id, label: `${p.name} — ${p.jobTitle}` }))} />
        </Field>
      </div>
    </Modal>
  )
}

/* إضافة مهمة خاصة باللجنة وتفويضها لمسؤول */
function QuickTaskModal({ committee, onClose }: { committee: Committee | null; onClose: () => void }) {
  const { db, set } = useDb()
  const { user } = useAuth()
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<TaskKind>('task')
  const [assigneeId, setAssigneeId] = useState('')
  const [dueDate, setDueDate] = useState(shiftDays(todayISO(), 3))
  const [remind, setRemind] = useState(2)

  if (!committee) return null
  const members = db.people.filter((p) => p.committeeIds.includes(committee.id) && p.active)
  const pool = members.length ? members : staffOf(db, committee.mosqueId)

  const save = () => {
    if (!title.trim()) return toast('اكتب عنوان المهمة.', 'bad')
    const aid = assigneeId || committee.leaderId || pool[0]?.id
    if (!aid) return toast('لا يوجد أعضاء لتفويضهم.', 'bad')
    set((d) => d.tasks.push({
      id: uid('t'), mosqueId: committee.mosqueId, committeeId: committee.id, assigneeId: aid,
      title: title.trim(), details: '', kind, status: 'pending', dueDate,
      remindBefore: remind, createdBy: user!.id, createdAt: todayISO(),
    }))
    toast(`تمت إضافة البند وتفويضه إلى ${personName(db, aid)}`)
    setTitle(''); setAssigneeId(''); onClose()
  }

  return (
    <Modal open onClose={onClose} title={`بند جديد — ${committee.name}`}
      footer={<><button className="btn-primary" onClick={save}>إضافة وتفويض</button>
        <button className="btn-ghost" onClick={onClose}>إلغاء</button></>}>
      <div className="space-y-4">
        <Field label="العنوان" required>
          <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="النوع">
            <Select value={kind} onChange={(v) => setKind(v as TaskKind)} placeholder=""
              options={Object.entries(KIND_LABEL).map(([v, l]) => ({ value: v, label: l }))} />
          </Field>
          <Field label="تفويض إلى" hint="من أعضاء اللجنة">
            <Select value={assigneeId} onChange={setAssigneeId}
              placeholder={committee.leaderId ? `${personName(db, committee.leaderId)} (رئيس اللجنة)` : 'اختر…'}
              options={pool.map((p) => ({ value: p.id, label: `${p.name} — ${p.jobTitle}` }))} />
          </Field>
          <Field label="التاريخ المحدد">
            <input type="date" className="field" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
          <Field label="التنبيه قبل">
            <Select value={String(remind)} onChange={(v) => setRemind(Number(v))} placeholder=""
              options={[1, 2, 3, 5, 7].map((n) => ({ value: String(n), label: `${n} يوم` }))} />
          </Field>
        </div>
      </div>
    </Modal>
  )
}
