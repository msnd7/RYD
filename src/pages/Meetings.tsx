import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useDb, uid } from '../store/db'
import { useAuth } from '../store/auth'
import { Card, Modal, Field, Select, Badge, Empty, useToast, PrintBar } from '../components/ui'
import { AiTextArea } from '../components/AiTextArea'
import { ReportHeader, ReportFooter } from '../components/ReportShell'
import { todayISO, fmtDate, fmtDayName } from '../lib/date'
import { committeesOf, staffOf, personName, mosqueName, committeeName } from '../lib/selectors'
import type { Meeting, MeetingScope } from '../types'

const SCOPE_LABEL: Record<MeetingScope, string> = {
  complex: 'اجتماع على مستوى المجمع', mosque: 'اجتماع مسجد', committee: 'اجتماع لجنة',
}

export default function Meetings({ scope }: { scope?: 'complex' }) {
  const { mid = '' } = useParams()
  const { db, set } = useDb()
  const { user, isDirector } = useAuth()
  const toast = useToast()
  const isComplex = scope === 'complex'

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Meeting | null>(null)
  const [view, setView] = useState<Meeting | null>(null)

  const list = (isComplex ? db.meetings : db.meetings.filter((m) => m.mosqueId === mid))
    .sort((a, b) => b.date.localeCompare(a.date))

  const remove = (m: Meeting) => {
    if (!confirm('حذف المحضر؟')) return
    set((d) => { d.meetings = d.meetings.filter((x) => x.id !== m.id) })
    toast('تم الحذف', 'info')
  }

  return (
    <div className="space-y-5">
      <Card title="محاضر الاجتماعات"
        subtitle="يُحدَّد المكان والتاريخ والحاضرون حسب مكان انعقاد الاجتماع"
        action={<button className="btn-primary btn-sm" onClick={() => { setEditing(null); setOpen(true) }}>＋ محضر جديد</button>}
        pad={false}>
        {list.length === 0 ? (
          <Empty icon="📄" title="لا توجد محاضر" hint="سجّل مخرجات الاجتماع ليبقى موثّقًا ويسهل الرجوع إليه."
            action={<button className="btn-primary btn-sm" onClick={() => setOpen(true)}>＋ كتابة محضر</button>} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {list.map((m) => (
              <li key={m.id} className="px-5 py-4 hover:bg-brand-50/30 transition">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={m.scope === 'complex' ? 'purple' : m.scope === 'mosque' ? 'info' : 'ok'}>
                        {SCOPE_LABEL[m.scope]}
                      </Badge>
                      <h4 className="font-extrabold text-[14.5px]">{m.title}</h4>
                    </div>
                    <p className="text-[11.5px] text-ink-500 mt-1.5 font-bold">
                      📍 {m.place} · 📅 {fmtDayName(m.date)} {fmtDate(m.date)} · 🕐 {m.time} · 👥 {m.attendees.length} حاضرًا
                      {m.committeeId && ` · 🏷️ ${committeeName(db, m.committeeId)}`}
                      {isComplex && ` · 🕌 ${mosqueName(db, m.mosqueId)}`}
                    </p>
                    {m.decisions && <p className="text-[12.5px] text-ink-700 mt-2 leading-6 line-clamp-2 whitespace-pre-wrap">{m.decisions}</p>}
                  </div>
                  <div className="flex gap-1.5 no-print">
                    <button className="btn-ghost btn-sm" onClick={() => setView(m)}>عرض وطباعة</button>
                    {(isDirector || m.createdBy === user?.id) && <>
                      <button className="btn-ghost btn-sm" onClick={() => { setEditing(m); setOpen(true) }}>تعديل</button>
                      <button className="btn-sm px-2 rounded-lg text-rose-600 hover:bg-rose-50" onClick={() => remove(m)}>حذف</button>
                    </>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <MeetingModal open={open} onClose={() => { setOpen(false); setEditing(null) }}
        meeting={editing} mosqueId={isComplex ? 'complex' : mid} isComplex={isComplex} />
      {view && <MeetingView meeting={view} onClose={() => setView(null)} />}
    </div>
  )
}

function MeetingModal({ open, onClose, meeting, mosqueId, isComplex }: {
  open: boolean; onClose: () => void; meeting: Meeting | null; mosqueId: string; isComplex: boolean
}) {
  const { db, set } = useDb()
  const { user, isDirector } = useAuth()
  const toast = useToast()

  const [f, setF] = useState<any>({})
  const [key, setKey] = useState('')
  const sig = `${open}-${meeting?.id ?? 'new'}`
  if (sig !== key) {
    setKey(sig)
    setF(meeting ? { ...meeting } : {
      scope: isComplex ? 'complex' : 'mosque', mosqueId, committeeId: '',
      title: '', place: '', date: todayISO(), time: '19:30',
      attendees: [], agenda: '', minutes: '', decisions: '',
    })
  }

  /** الحاضرون المتاحون حسب مكان فتح الاجتماع */
  const pool = f.scope === 'complex'
    ? db.people.filter((p) => p.active)
    : f.scope === 'committee' && f.committeeId
      ? db.people.filter((p) => p.committeeIds.includes(f.committeeId) && p.active)
      : db.people.filter((p) => p.mosqueId === f.mosqueId && p.active)

  const mosqueForPlace = db.mosques.find((m) => m.id === f.mosqueId)
  const suggestPlace = () => setF((s: any) => ({
    ...s, place: s.scope === 'complex' ? 'مكتب إدارة المجمع' : mosqueForPlace?.name ?? '',
  }))

  const toggle = (pid: string) => setF((s: any) => ({
    ...s, attendees: s.attendees.includes(pid) ? s.attendees.filter((x: string) => x !== pid) : [...s.attendees, pid],
  }))

  const save = () => {
    if (!f.title?.trim()) return toast('اكتب عنوان الاجتماع.', 'bad')
    if (!f.place?.trim()) return toast('حدّد مكان الاجتماع.', 'bad')
    if (!f.attendees.length) return toast('حدّد الحاضرين.', 'bad')
    set((d) => {
      if (meeting) Object.assign(d.meetings.find((m) => m.id === meeting.id)!, f)
      else d.meetings.push({ ...f, id: uid('mt'), createdBy: user!.id, createdAt: todayISO() })
    })
    toast(meeting ? 'تم حفظ المحضر' : 'تم إنشاء المحضر')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={meeting ? 'تعديل محضر' : 'محضر اجتماع جديد'} wide
      footer={<><button className="btn-primary" onClick={save}>حفظ المحضر</button>
        <button className="btn-ghost" onClick={onClose}>إلغاء</button></>}>
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="نطاق الاجتماع" required hint="يحدّد قائمة الحاضرين المتاحة">
            <Select value={f.scope ?? ''} onChange={(v) => setF({ ...f, scope: v, attendees: [], committeeId: '' })} placeholder=""
              options={[
                ...(isDirector ? [{ value: 'complex', label: SCOPE_LABEL.complex }] : []),
                { value: 'mosque', label: SCOPE_LABEL.mosque },
                { value: 'committee', label: SCOPE_LABEL.committee },
              ]} />
          </Field>
          {f.scope !== 'complex' && (
            <Field label="المسجد" required>
              <Select value={f.mosqueId === 'complex' ? '' : f.mosqueId} onChange={(v) => setF({ ...f, mosqueId: v, attendees: [], committeeId: '' })}
                options={db.mosques.map((m) => ({ value: m.id, label: m.name }))} />
            </Field>
          )}
          {f.scope === 'committee' && (
            <Field label="اللجنة" required>
              <Select value={f.committeeId ?? ''} onChange={(v) => setF({ ...f, committeeId: v, attendees: [] })}
                options={committeesOf(db, f.mosqueId).map((c) => ({ value: c.id, label: c.name }))} />
            </Field>
          )}
          <Field label="عنوان الاجتماع" required>
            <input className="field" value={f.title ?? ''} onChange={(e) => setF({ ...f, title: e.target.value })}
              placeholder="مثال: اجتماع اللجنة التعليمية الدوري" />
          </Field>
          <Field label="المكان" required>
            <div className="flex gap-2">
              <input className="field" value={f.place ?? ''} onChange={(e) => setF({ ...f, place: e.target.value })} />
              <button type="button" className="btn-ghost btn-sm shrink-0" onClick={suggestPlace}>اقتراح</button>
            </div>
          </Field>
          <Field label="التاريخ" required>
            <input type="date" className="field" value={f.date ?? ''} onChange={(e) => setF({ ...f, date: e.target.value })} />
          </Field>
          <Field label="الوقت">
            <input type="time" className="field" value={f.time ?? ''} onChange={(e) => setF({ ...f, time: e.target.value })} />
          </Field>
        </div>

        <Field label={`الحاضرون (${f.attendees?.length ?? 0})`} required>
          <div className="flex flex-wrap gap-2 max-h-44 overflow-y-auto p-1">
            {pool.length === 0 && <span className="text-[12px] text-ink-300">حدّد النطاق أولًا لعرض الأسماء.</span>}
            {pool.map((p) => {
              const on = (f.attendees ?? []).includes(p.id)
              return (
                <button key={p.id} type="button" onClick={() => toggle(p.id)}
                  className={`chip transition ${on ? 'bg-brand-700 text-white' : 'bg-slate-100 text-ink-700 hover:bg-slate-200'}`}>
                  {on ? '✓ ' : '＋ '}{p.name}
                </button>
              )
            })}
          </div>
        </Field>

        <Field label="جدول الأعمال">
          <textarea className="field leading-7" rows={3} value={f.agenda ?? ''} onChange={(e) => setF({ ...f, agenda: e.target.value })} />
        </Field>

        <AiTextArea label="مُخرَج الاجتماع (نص المحضر)" value={f.minutes ?? ''}
          onChange={(v) => setF({ ...f, minutes: v })} kind="minutes" rows={6}
          placeholder="اكتب ما دار في الاجتماع…" />

        <AiTextArea label="القرارات والتوصيات" value={f.decisions ?? ''}
          onChange={(v) => setF({ ...f, decisions: v })} kind="minutes" rows={5}
          placeholder="اكتب كل قرار في سطر مستقل…" />
      </div>
    </Modal>
  )
}

function MeetingView({ meeting, onClose }: { meeting: Meeting; onClose: () => void }) {
  const { db } = useDb()
  return (
    <Modal open onClose={onClose} title="محضر الاجتماع" wide>
      <PrintBar title={meeting.title} />
      <div id="print-area" className="mt-4">
        <div className="border border-slate-200 rounded-2xl p-6">
          <ReportHeader title="محضر اجتماع" subtitle={SCOPE_LABEL[meeting.scope]} />

          <h2 className="font-display font-black text-xl mt-5 text-center">{meeting.title}</h2>

          <dl className="grid sm:grid-cols-3 gap-3 mt-5">
            {[
              ['المكان', meeting.place],
              ['التاريخ', `${fmtDayName(meeting.date)} ${fmtDate(meeting.date)}`],
              ['الوقت', meeting.time],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
                <dt className="text-[10.5px] font-bold text-ink-500">{k}</dt>
                <dd className="font-extrabold text-[13.5px] mt-0.5">{v}</dd>
              </div>
            ))}
          </dl>

          <section className="mt-5">
            <h4 className="font-extrabold text-[14px] mb-2">الحاضرون ({meeting.attendees.length})</h4>
            <div className="flex flex-wrap gap-1.5">
              {meeting.attendees.map((a) => (
                <span key={a} className="chip bg-brand-50 text-brand-700 border border-brand-100">{personName(db, a)}</span>
              ))}
            </div>
          </section>

          {meeting.agenda && (
            <section className="mt-5">
              <h4 className="font-extrabold text-[14px] mb-1.5">جدول الأعمال</h4>
              <p className="text-[13px] leading-8 whitespace-pre-wrap text-ink-700">{meeting.agenda}</p>
            </section>
          )}

          {meeting.minutes && (
            <section className="mt-5">
              <h4 className="font-extrabold text-[14px] mb-1.5">مُخرَج الاجتماع</h4>
              <p className="text-[13px] leading-8 whitespace-pre-wrap text-ink-700">{meeting.minutes}</p>
            </section>
          )}

          {meeting.decisions && (
            <section className="mt-5">
              <h4 className="font-extrabold text-[14px] mb-2">القرارات والتوصيات</h4>
              <div className="rounded-2xl bg-olive-50 border border-olive-200 p-4">
                <p className="text-[13px] leading-8 whitespace-pre-wrap text-olive-800 font-bold">{meeting.decisions}</p>
              </div>
            </section>
          )}

          <div className="grid sm:grid-cols-2 gap-8 mt-10">
            <div>
              <p className="text-[11.5px] font-bold text-ink-500">أمين الاجتماع</p>
              <div className="h-14 border-b border-slate-300 mt-1" />
              <p className="text-[11.5px] mt-1 font-bold">{personName(db, meeting.createdBy)}</p>
            </div>
            <div>
              <p className="text-[11.5px] font-bold text-ink-500">اعتماد المدير</p>
              <div className="h-14 border-b border-slate-300 mt-1" />
            </div>
          </div>

          <ReportFooter by={personName(db, meeting.createdBy)} />
        </div>
      </div>
    </Modal>
  )
}
