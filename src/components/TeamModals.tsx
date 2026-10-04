import { useState } from 'react'
import { useDb, uid } from '../store/db'
import { useAuth } from '../store/auth'
import { Modal, Field, Select, useToast, Badge } from './ui'
import { AiTextArea } from './AiTextArea'
import { membersOf, personName } from '../lib/selectors'
import { todayISO, shiftDays, fmtDate } from '../lib/date'
import type { Committee, TaskKind, TeamNote } from '../types'

const KIND: Record<TaskKind, string> = { task: 'مهمة', decision: 'قرار', recommendation: 'توصية' }

/** اختيار أعضاء الفريق: الكل أو أشخاص بعينهم */
function MemberPicker({ committee, value, onChange, allLabel = 'كل الفريق' }: {
  committee: Committee; value: string[]; onChange: (ids: string[]) => void; allLabel?: string
}) {
  const { db } = useDb()
  const members = membersOf(db, committee.id)
  const all = value.length === 0
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => onChange([])}
        className={`chip !py-2 !px-3 transition ${all ? 'bg-navy-700 text-white' : 'bg-navy-50 text-ink-700 hover:bg-navy-100'}`}>
        {all ? '✓ ' : ''}{allLabel} ({members.length})
      </button>
      {members.map((m) => {
        const on = value.includes(m.id)
        return (
          <button key={m.id} type="button" onClick={() => toggle(m.id)}
            className={`chip !py-2 !px-3 transition ${on ? 'bg-orange-500 text-white' : 'bg-surface border border-line text-ink-700 hover:border-navy-300'}`}>
            {on ? '✓ ' : ''}{m.name}{m.id === committee.leaderId ? ' ★' : ''}
          </button>
        )
      })}
      {members.length === 0 && <span className="text-[12px] text-ink-400">لا يوجد أعضاء مسكّنون في هذه اللجنة بعد.</span>}
    </div>
  )
}

/* =====================================================================
   مهمة من قائد اللجنة لفريقه — لعضو أو أكثر أو للفريق كله
   ===================================================================== */
export function LeaderTaskModal({ committees, initialCommitteeId, initialAssignee, onClose }: {
  committees: Committee[]; initialCommitteeId?: string; initialAssignee?: string; onClose: () => void
}) {
  const { db, set } = useDb()
  const { user } = useAuth()
  const toast = useToast()
  const [cid, setCid] = useState(initialCommitteeId ?? committees[0]?.id ?? '')
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')
  const [kind, setKind] = useState<TaskKind>('task')
  const [targets, setTargets] = useState<string[]>(initialAssignee ? [initialAssignee] : [])
  const [dueDate, setDueDate] = useState(shiftDays(todayISO(), 3))
  const [remind, setRemind] = useState(2)
  const committee = committees.find((c) => c.id === cid)
  if (!committee) return null

  const save = () => {
    if (!title.trim()) return toast('اكتب عنوان المهمة.', 'bad')
    const ids = targets.length ? targets : membersOf(db, committee.id).map((m) => m.id)
    if (!ids.length) return toast('لا يوجد أعضاء في اللجنة لإسناد المهمة إليهم.', 'bad')
    set((d) => {
      ids.forEach((aid) => d.tasks.push({
        id: uid('t'), mosqueId: committee.mosqueId, committeeId: committee.id, assigneeId: aid,
        title: title.trim(), details, kind, status: 'pending', dueDate,
        remindBefore: remind, createdBy: user!.id, createdAt: todayISO(),
      }))
    })
    toast(ids.length === 1 ? `أُسندت إلى ${personName(db, ids[0])}` : `أُسندت إلى ${ids.length} أعضاء`)
    onClose()
  }

  return (
    <Modal open onClose={onClose} title="إسناد مهمة للفريق" wide
      footer={<><button className="btn-primary" onClick={save}>إسناد المهمة</button>
        <button className="btn-ghost" onClick={onClose}>إلغاء</button></>}>
      <div className="space-y-4">
        {committees.length > 1 && (
          <Field label="اللجنة">
            <Select value={cid} onChange={(v) => { setCid(v); setTargets([]) }} placeholder=""
              options={committees.map((c) => ({ value: c.id, label: c.name }))} />
          </Field>
        )}
        <div className="grid sm:grid-cols-[1fr_160px] gap-4">
          <Field label="العنوان" required>
            <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus
              placeholder="مثال: تجهيز جوائز مسابقة الحفظ" />
          </Field>
          <Field label="النوع">
            <Select value={kind} onChange={(v) => setKind(v as TaskKind)} placeholder=""
              options={Object.entries(KIND).map(([v, l]) => ({ value: v, label: l }))} />
          </Field>
        </div>
        <Field label="المسند إليهم" hint="«كل الفريق» يُنشئ مهمة مستقلة لكل عضو ليتابع كلٌّ إنجازه">
          <MemberPicker committee={committee} value={targets} onChange={setTargets} />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="التاريخ المحدد">
            <input type="date" className="field" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
          <Field label="التنبيه قبل">
            <Select value={String(remind)} onChange={(v) => setRemind(Number(v))} placeholder=""
              options={[1, 2, 3, 5, 7].map((n) => ({ value: String(n), label: `${n} يوم` }))} />
          </Field>
        </div>
        <AiTextArea label="التفاصيل (اختياري)" value={details} onChange={setDetails} rows={3} kind="task" />
      </div>
    </Modal>
  )
}

/* =====================================================================
   توصية أو توجيه من قائد اللجنة لفريقه — مع متابعة من اطّلع
   ===================================================================== */
export function TeamNoteModal({ committees, initialCommitteeId, note, onClose }: {
  committees: Committee[]; initialCommitteeId?: string; note?: TeamNote | null; onClose: () => void
}) {
  const { set } = useDb()
  const { user } = useAuth()
  const toast = useToast()
  const [cid, setCid] = useState(note?.committeeId ?? initialCommitteeId ?? committees[0]?.id ?? '')
  const [kind, setKind] = useState<TeamNote['kind']>(note?.kind ?? 'recommendation')
  const [title, setTitle] = useState(note?.title ?? '')
  const [body, setBody] = useState(note?.body ?? '')
  const [priority, setPriority] = useState<TeamNote['priority']>(note?.priority ?? 'normal')
  const [targets, setTargets] = useState<string[]>(note?.targetIds ?? [])
  const committee = committees.find((c) => c.id === cid)
  if (!committee) return null

  const save = () => {
    if (!title.trim()) return toast('اكتب عنوان التوصية.', 'bad')
    set((d) => {
      if (note) {
        const n = d.teamNotes.find((x) => x.id === note.id)
        if (n) Object.assign(n, { kind, title: title.trim(), body, priority, targetIds: targets })
      } else {
        d.teamNotes.push({
          id: uid('tn'), mosqueId: committee.mosqueId, committeeId: committee.id, kind,
          title: title.trim(), body, priority, targetIds: targets,
          createdBy: user!.id, createdAt: new Date().toISOString(), acks: [],
        })
      }
    })
    toast(note ? 'حُفظت التعديلات' : 'نُشرت للفريق')
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={note ? 'تعديل التوصية' : 'توصية جديدة للفريق'} wide
      footer={<><button className="btn-primary" onClick={save}>{note ? 'حفظ' : 'نشر للفريق'}</button>
        <button className="btn-ghost" onClick={onClose}>إلغاء</button></>}>
      <div className="space-y-4">
        {committees.length > 1 && !note && (
          <Field label="اللجنة">
            <Select value={cid} onChange={(v) => { setCid(v); setTargets([]) }} placeholder=""
              options={committees.map((c) => ({ value: c.id, label: c.name }))} />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-2">
          {([['recommendation', 'توصية', 'اقتراح أو ممارسة يحسن العمل بها'], ['directive', 'توجيه', 'تعليمات يلتزم بها الفريق']] as const).map(([v, l, h]) => (
            <button key={v} type="button" onClick={() => setKind(v)}
              className={`rounded-2xl border p-3 text-right transition ${kind === v ? 'border-navy-700 bg-navy-50 ring-2 ring-navy-700/15' : 'border-line hover:border-navy-300'}`}>
              <span className="block font-bold text-[13.5px]">{l}</span>
              <span className="block text-[11px] text-ink-400 mt-0.5">{h}</span>
            </button>
          ))}
        </div>
        <Field label="العنوان" required>
          <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus
            placeholder={kind === 'directive' ? 'مثال: الحضور قبل الحلقة بعشر دقائق' : 'مثال: توثيق كل نشاط بصور'} />
        </Field>
        <AiTextArea label="التفاصيل" value={body} onChange={setBody} rows={4} kind="message" />
        <Field label="موجّهة إلى">
          <MemberPicker committee={committee} value={targets} onChange={setTargets} />
        </Field>
        <label className="flex items-center gap-3 rounded-xl bg-orange-50 border border-orange-200 px-4 py-3 cursor-pointer">
          <input type="checkbox" className="w-4 h-4 accent-orange-500" checked={priority === 'high'}
            onChange={(e) => setPriority(e.target.checked ? 'high' : 'normal')} />
          <span className="text-[13px] font-bold text-orange-800">مهمة وعاجلة — تظهر مميّزة في أعلى لوحة الفريق</span>
        </label>
      </div>
    </Modal>
  )
}

/* =====================================================================
   قائمة التوصيات — للأعضاء (زر «اطّلعت») وللقائد (من اطّلع ومن لم يطّلع)
   ===================================================================== */
export function TeamNotesList({ notes, canManage, onEdit }: {
  notes: TeamNote[]; canManage: (n: TeamNote) => boolean; onEdit: (n: TeamNote) => void
}) {
  const { db, set } = useDb()
  const { user } = useAuth()
  const toast = useToast()
  const [openId, setOpenId] = useState<string | null>(null)
  if (!user) return null

  const ack = (n: TeamNote) => {
    set((d) => {
      const x = d.teamNotes.find((y) => y.id === n.id)
      if (x && !x.acks.some((a) => a.personId === user.id)) x.acks.push({ personId: user.id, at: new Date().toISOString() })
    })
    toast('سُجّل اطّلاعك')
  }
  const remove = (n: TeamNote) => {
    if (!confirm('حذف هذه التوصية؟')) return
    set((d) => { d.teamNotes = d.teamNotes.filter((x) => x.id !== n.id) })
    toast('حُذفت')
  }

  return (
    <ul className="divide-y divide-line">
      {notes.map((n) => {
        const audience = n.targetIds.length ? n.targetIds : membersOf(db, n.committeeId).map((m) => m.id).filter((id) => id !== n.createdBy)
        const seen = n.acks.filter((a) => audience.includes(a.personId))
        const mine = n.acks.some((a) => a.personId === user.id)
        const forMe = audience.includes(user.id)
        const manage = canManage(n)
        const pending = audience.filter((id) => !n.acks.some((a) => a.personId === id))
        return (
          <li key={n.id} className={`px-4 sm:px-5 py-4 ${n.priority === 'high' ? 'bg-orange-50/60' : ''}`}>
            <div className="flex items-start gap-3">
              <span className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 text-[17px]
                ${n.kind === 'directive' ? 'bg-navy-700 text-white' : 'bg-orange-100 text-orange-700'}`}>
                {n.kind === 'directive' ? '📌' : '💡'}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-[14px] text-ink-900">{n.title}</p>
                  <Badge tone={n.kind === 'directive' ? 'purple' : 'warn'}>{n.kind === 'directive' ? 'توجيه' : 'توصية'}</Badge>
                  {n.priority === 'high' && <Badge tone="bad" dot>عاجلة</Badge>}
                </div>
                {n.body && <p className="text-[12.5px] text-ink-700 leading-7 mt-1 whitespace-pre-wrap">{n.body}</p>}
                <p className="text-[11px] text-ink-400 mt-1.5">
                  {personName(db, n.createdBy)} · {fmtDate(n.createdAt)}
                  {n.targetIds.length > 0 && ` · إلى: ${n.targetIds.map((id) => personName(db, id)).join('، ')}`}
                </p>

                {manage && audience.length > 0 && (
                  <div className="mt-2">
                    <button className="text-[11.5px] font-bold text-navy-600 hover:text-orange-600"
                      onClick={() => setOpenId(openId === n.id ? null : n.id)}>
                      اطّلع {seen.length} من {audience.length} {pending.length > 0 && '— عرض من لم يطّلع'}
                    </button>
                    <div className="h-1.5 rounded-full bg-line overflow-hidden mt-1.5 max-w-[220px]">
                      <div className="h-full bg-navy-600 rounded-full" style={{ width: `${(seen.length / audience.length) * 100}%` }} />
                    </div>
                    {openId === n.id && pending.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {pending.map((id) => <span key={id} className="chip bg-navy-50 text-ink-500">{personName(db, id)}</span>)}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                {forMe && !manage && (mine
                  ? <span className="chip bg-navy-100 text-navy-800">✓ اطّلعت</span>
                  : <button className="btn-primary btn-sm" onClick={() => ack(n)}>اطّلعت</button>)}
                {manage && (
                  <div className="flex gap-1">
                    <button className="btn-icon !w-8 !h-8" title="تعديل" onClick={() => onEdit(n)}>✎</button>
                    <button className="btn-icon !w-8 !h-8 hover:!text-orange-700" title="حذف" onClick={() => remove(n)}>🗑</button>
                  </div>
                )}
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
