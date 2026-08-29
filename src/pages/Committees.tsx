import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useDb, uid } from '../store/db'
import { useAuth } from '../store/auth'
import { Card, Modal, Field, Select, Badge, Empty, useToast, Progress, Menu, StatStrip } from '../components/ui'
import { PageHeader } from '../components/PageHeader'
import { CustodyRequestModal } from '../components/CustodyRequestModal'
import { committeesOf, staffOf, taskCounts, personName, custodyBalance } from '../lib/selectors'
import { fmtDate, dueLabel, todayISO, shiftDays } from '../lib/date'
import { money } from '../lib/format'
import { KIND_LABEL, KIND_TONE } from './Tasks'
import type { Committee, TaskKind } from '../types'

const CST: Record<string, { label: string; tone: string }> = {
  requested: { label: 'بانتظار اعتماد المدير', tone: 'warn' },
  approved: { label: 'عهدة مفتوحة', tone: 'info' },
  closed: { label: 'مقفلة', tone: 'ok' },
  rejected: { label: 'مرفوضة', tone: 'bad' },
}

export default function Committees() {
  const { mid = '' } = useParams()
  const { db, set } = useDb()
  const { user, isDirector } = useAuth()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Committee | null>(null)
  const [taskFor, setTaskFor] = useState<Committee | null>(null)
  const [custodyFor, setCustodyFor] = useState<Committee | null>(null)

  const mosque = db.mosques.find((m) => m.id === mid)
  const list = committeesOf(db, mid)
  const canManage = isDirector || (user?.role === 'supervisor' && user.mosqueId === mid)

  const allCustodies = db.custodies.filter((c) => c.mosqueId === mid && c.committeeId)
  const openCustodies = allCustodies.filter((c) => c.status === 'approved')

  return (
    <div>
      <PageHeader
        eyebrow={mosque?.name}
        title="اللجان"
        description="كل لجنة تتابع مهامها، وتضيف بنودها وتفوّضها لأعضائها، وترفع طلب صرف عهدة يعتمده مدير المجمع."
        actions={canManage && (
          <button className="btn-primary btn-sm" onClick={() => { setEditing(null); setOpen(true) }}>＋ لجنة جديدة</button>
        )}
      />

      <StatStrip className="mb-5" items={[
        { label: 'عدد اللجان', value: list.length },
        { label: 'الأعضاء المسكَّنون', value: db.people.filter((p) => p.active && p.mosqueId === mid && p.committeeIds.length).length },
        { label: 'عهد مفتوحة', value: openCustodies.length, hint: openCustodies.length ? money(openCustodies.reduce((s, c) => s + custodyBalance(c).remaining, 0)) + ' متبقٍ' : undefined, accent: openCustodies.length > 0 },
        { label: 'بانتظار الاعتماد', value: allCustodies.filter((c) => c.status === 'requested').length },
      ]} />

      {list.length === 0 && <Card><Empty icon="🏷️" title="لا توجد لجان في هذا المسجد" /></Card>}

      <div className="grid lg:grid-cols-2 gap-4">
        {list.map((c) => {
          const members = db.people.filter((p) => p.committeeIds.includes(c.id) && p.active)
          const tasks = db.tasks.filter((t) => t.committeeId === c.id)
          const tc = taskCounts(tasks)
          const pct = tc.total ? Math.round((tc.done / tc.total) * 100) : 0
          const isMember = members.some((m) => m.id === user?.id)
          const canAct = canManage || isMember
          const custodies = db.custodies.filter((x) => x.committeeId === c.id)
          const live = custodies.filter((x) => x.status === 'requested' || x.status === 'approved')

          return (
            <Card key={c.id} pad={false}>
              <div className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-navy-900">{c.name}</h3>
                    <p className="text-[11.5px] text-ink-500 mt-1 leading-6">{c.goal}</p>
                  </div>
                  {(canManage || canAct) && (
                    <Menu items={[
                      ...(canAct ? [
                        { label: 'إضافة بند للجنة', icon: '＋', onClick: () => setTaskFor(c) },
                        { label: 'طلب صرف عهدة', icon: '💳', onClick: () => setCustodyFor(c) },
                      ] : []),
                      ...(canManage ? [
                        'sep' as const,
                        { label: 'تعديل اللجنة', icon: '✎', onClick: () => { setEditing(c); setOpen(true) } },
                      ] : []),
                      ...(isDirector ? [{
                        label: 'حذف اللجنة', icon: '🗑', danger: true,
                        onClick: () => {
                          if (!confirm(`حذف ${c.name}؟ ستبقى المهام المرتبطة بها.`)) return
                          set((d) => {
                            d.committees = d.committees.filter((x) => x.id !== c.id)
                            d.people.forEach((p) => { p.committeeIds = p.committeeIds.filter((x) => x !== c.id) })
                          })
                          toast('تم حذف اللجنة')
                        },
                      }] : []),
                    ]} />
                  )}
                </div>

                <div className="mt-4">
                  <div className="flex justify-between text-[11px] font-bold text-ink-500 mb-1.5">
                    <span>الإنجاز</span>
                    <span className="num text-ink-900">{tc.total ? `${pct}% · ${tc.done} من ${tc.total}` : 'لا توجد بنود'}</span>
                  </div>
                  <Progress value={pct} tone={pct >= 70 ? 'brand' : pct >= 40 ? 'olive' : 'gold'} />
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {tc.stuck > 0 && <Badge tone="bad">{tc.stuck} متعثر</Badge>}
                    {tc.postponed > 0 && <Badge tone="warn">{tc.postponed} مؤجل</Badge>}
                    {tc.pending > 0 && <Badge tone="info">{tc.pending} قيد التنفيذ</Badge>}
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-[11px] font-bold text-ink-400 mb-2">الأعضاء ({members.length})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {members.length === 0 && (
                      <span className="text-[11.5px] text-ink-300">لم يُسكَّن أحد بعد — من صفحة الموظفين</span>
                    )}
                    {members.map((m) => (
                      <span key={m.id} className={`chip ${m.id === c.leaderId ? 'bg-navy-700 text-white' : 'bg-navy-50 text-ink-700'}`}>
                        {m.id === c.leaderId && '★ '}{m.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* عهد اللجنة */}
              <div className="border-t border-line px-4 sm:px-5 py-3.5 bg-navy-50/40">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className="text-[11.5px] font-bold text-ink-700">عهد اللجنة</p>
                  {canAct && (
                    <button className="btn-soft btn-sm" onClick={() => setCustodyFor(c)}>طلب صرف عهدة</button>
                  )}
                </div>
                {live.length === 0 ? (
                  <p className="text-[11.5px] text-ink-400">لا توجد عهد مفتوحة لهذه اللجنة.</p>
                ) : (
                  <ul className="space-y-2">
                    {live.map((x) => {
                      const b = custodyBalance(x)
                      const overdue = x.status === 'approved' && x.closeDate < todayISO()
                      return (
                        <li key={x.id} className="rounded-lg bg-surface border border-line px-3 py-2.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-[12.5px] flex-1 min-w-0 truncate">{x.purpose}</span>
                            <Badge tone={CST[x.status].tone}>{CST[x.status].label}</Badge>
                            {overdue && <Badge tone="bad" dot>تجاوزت الإقفال</Badge>}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-500 mt-1.5">
                            <span>المبلغ <b className="text-ink-900 num">{money(x.amount)}</b></span>
                            {x.status === 'approved' && <>
                              <span>المنصرف <b className="text-ink-900 num">{money(b.spent)}</b></span>
                              <span>المتبقي <b className="text-orange-700 num">{money(b.remaining)}</b></span>
                              <span>الإقفال {fmtDate(x.closeDate)}</span>
                            </>}
                          </div>
                          {x.status === 'approved' && (
                            <div className="mt-2"><Progress value={x.amount ? (b.spent / x.amount) * 100 : 0} tone="gold" /></div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>

              {/* أقرب بنود اللجنة */}
              {tasks.filter((t) => t.status !== 'done').length > 0 && (
                <ul className="border-t border-line divide-y divide-line">
                  {tasks.filter((t) => t.status !== 'done').slice(0, 3).map((t) => {
                    const d = dueLabel(t.dueDate)
                    return (
                      <li key={t.id} className="px-4 sm:px-5 py-2.5 flex items-center gap-2">
                        <Badge tone={KIND_TONE[t.kind]}>{KIND_LABEL[t.kind]}</Badge>
                        <span className="flex-1 font-bold text-[12.5px] truncate">{t.title}</span>
                        <span className={`text-[11px] font-bold ${d.tone === 'bad' ? 'text-orange-700' : 'text-ink-400'}`}>{d.text}</span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Card>
          )
        })}
      </div>

      <CommitteeModal open={open} onClose={() => { setOpen(false); setEditing(null) }} committee={editing} mosqueId={mid} />
      <QuickTaskModal committee={taskFor} onClose={() => setTaskFor(null)} />
      <CustodyRequestModal
        open={!!custodyFor} onClose={() => setCustodyFor(null)}
        mosqueId={custodyFor?.mosqueId ?? mid} committeeId={custodyFor?.id}
        allowCommitteePick={false}
      />
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
        <Field label="رئيس اللجنة" hint="يُقترح تلقائيًا كمسؤول عند إضافة بند للجنة">
          <Select value={leaderId} onChange={setLeaderId} placeholder="بدون"
            options={staffOf(db, mosqueId).map((p) => ({ value: p.id, label: `${p.name} — ${p.jobTitle}` }))} />
        </Field>
      </div>
    </Modal>
  )
}

function QuickTaskModal({ committee, onClose }: { committee: Committee | null; onClose: () => void }) {
  const { db, set } = useDb()
  const { user } = useAuth()
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<TaskKind>('task')
  const [assigneeId, setAssigneeId] = useState('')
  const [dueDate, setDueDate] = useState(shiftDays(todayISO(), 3))
  const [remind, setRemind] = useState(2)
  const [key, setKey] = useState('')
  if (committee && key !== committee.id) {
    setKey(committee.id); setTitle(''); setAssigneeId(''); setDueDate(shiftDays(todayISO(), 3))
  }
  if (!committee) return null

  const members = db.people.filter((p) => p.committeeIds.includes(committee.id) && p.active)
  const pool = members.length ? members : staffOf(db, committee.mosqueId)

  const save = () => {
    if (!title.trim()) return toast('اكتب عنوان البند.', 'bad')
    const aid = assigneeId || committee.leaderId || pool[0]?.id
    if (!aid) return toast('لا يوجد أعضاء لتفويضهم. أضف موظفين للمسجد أولًا.', 'bad')
    set((d) => d.tasks.push({
      id: uid('t'), mosqueId: committee.mosqueId, committeeId: committee.id, assigneeId: aid,
      title: title.trim(), details: '', kind, status: 'pending', dueDate,
      remindBefore: remind, createdBy: user!.id, createdAt: todayISO(),
    }))
    toast(`أُضيف البند وفُوِّض إلى ${personName(db, aid)}`)
    onClose()
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
          <Field label="تفويض إلى" hint={members.length ? 'من أعضاء اللجنة' : 'لا يوجد أعضاء مسكّنون — تظهر قائمة فريق المسجد'}>
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
