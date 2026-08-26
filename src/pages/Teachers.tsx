import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useDb, uid } from '../store/db'
import { useAuth } from '../store/auth'
import { Card, Modal, Field, Select, Badge, Empty, useToast, Stat, Tabs, PrintBar } from '../components/ui'
import { BarChart, SplitBar, C } from '../components/charts'
import { todayISO, fmtDate, fmtDayName } from '../lib/date'
import { lastNDays } from '../lib/selectors'
import { ReportHeader, ReportFooter } from '../components/ReportShell'
import type { Teacher, TeacherAttendance } from '../types'

const TST = {
  present: { label: 'حاضر', tone: 'ok', color: C.present },
  late: { label: 'متأخر', tone: 'warn', color: '#f59e0b' },
  excused: { label: 'مستأذن', tone: 'info', color: C.excused },
  absent: { label: 'غائب', tone: 'bad', color: C.absent },
} as const

export default function Teachers() {
  const { mid = '' } = useParams()
  const { db, set } = useDb()
  const { user, isDirector } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState<'today' | 'list' | 'report'>('today')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Teacher | null>(null)
  const [evalFor, setEvalFor] = useState<Teacher | null>(null)
  const [date, setDate] = useState(todayISO())

  const mosque = db.mosques.find((m) => m.id === mid)
  const teachers = db.teachers.filter((t) => t.mosqueId === mid && t.active)
  const canManage = isDirector || (user?.role === 'supervisor' && user.mosqueId === mid)

  const rows = db.teacherAttendance.filter((t) => t.mosqueId === mid && t.date === date)
  const get = (tid: string) => rows.find((r) => r.teacherId === tid)

  const mark = (tid: string, status: TeacherAttendance['status']) => {
    set((d) => {
      const ex = d.teacherAttendance.find((r) => r.teacherId === tid && r.date === date)
      if (ex) ex.status = status
      else d.teacherAttendance.push({ id: uid('ta'), mosqueId: mid, teacherId: tid, date, status })
    })
  }

  const markAll = (status: TeacherAttendance['status']) => {
    set((d) => {
      teachers.forEach((t) => {
        const ex = d.teacherAttendance.find((r) => r.teacherId === t.id && r.date === date)
        if (ex) ex.status = status
        else d.teacherAttendance.push({ id: uid('ta'), mosqueId: mid, teacherId: t.id, date, status })
      })
    })
    toast(`تم تعليم الجميع: ${TST[status].label}`)
  }

  const removeTeacher = (t: Teacher) => {
    if (!confirm(`إيقاف المعلم ${t.name}؟`)) return
    set((d) => { const x = d.teachers.find((y) => y.id === t.id); if (x) x.active = false })
    toast('تم الإيقاف', 'info')
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="عدد المعلمين" value={teachers.length} tone="brand" />
        <Stat label="الطلاب" value={teachers.reduce((s, t) => s + (t.studentsCount || 0), 0)} tone="olive" />
        <Stat label="حاضر اليوم" value={rows.filter((r) => r.status === 'present').length} tone="gold" />
        <Stat label="غائب اليوم" value={rows.filter((r) => r.status === 'absent').length}
          tone={rows.some((r) => r.status === 'absent') ? 'rose' : 'slate'} />
      </div>

      <Tabs value={tab} onChange={(v) => setTab(v as any)} items={[
        { value: 'today', label: 'تحضير المعلمين' },
        { value: 'list', label: 'بيانات المعلمين', count: teachers.length },
        { value: 'report', label: 'تقرير المعلمين' },
      ]} />

      {tab === 'today' && (
        <Card title="رصد حضور المعلمين" subtitle={`${fmtDayName(date)} · ${fmtDate(date)} · ${mosque?.name}`}
          action={<div className="flex flex-wrap gap-2 items-center">
            <input type="date" className="field !py-2 !text-[13px] w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
            {canManage && <>
              <button className="btn-olive btn-sm" onClick={() => markAll('present')}>الكل حاضر</button>
              <button className="btn-ghost btn-sm" onClick={() => markAll('absent')}>الكل غائب</button>
            </>}
          </div>} pad={false}>
          {teachers.length === 0 ? (
            <Empty icon="📚" title="لم تُسجَّل بيانات المعلمين بعد"
              hint="سجّل بيانات معلمي المسجد أولًا ليظهروا في قائمة التحضير."
              action={canManage && <button className="btn-primary btn-sm" onClick={() => { setEditing(null); setOpen(true) }}>＋ إضافة معلم</button>} />
          ) : (
            <ul className="divide-y divide-line">
              {teachers.map((t) => {
                const r = get(t.id)
                return (
                  <li key={t.id} className="px-5 py-3.5 flex flex-wrap items-center gap-3">
                    <span className="w-10 h-10 rounded-xl bg-gradient-to-bl from-navy-500 to-navy-800 text-white grid place-items-center font-extrabold">
                      {t.name.replace(/^(د\.|أ\.)\s*/, '')[0]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-[14px]">{t.name}</div>
                      <div className="text-[11.5px] text-ink-500">{t.circle} · {t.level} · {t.studentsCount} طالبًا</div>
                    </div>
                    <div className="flex gap-1.5 no-print">
                      {(Object.keys(TST) as (keyof typeof TST)[]).map((s) => (
                        <button key={s} disabled={!canManage} onClick={() => mark(t.id, s)}
                          className={`px-3 py-1.5 rounded-lg text-[11.5px] font-black transition
                            ${r?.status === s
                              ? s === 'present' ? 'bg-navy-700 text-white'
                                : s === 'absent' ? 'bg-orange-600 text-white'
                                : s === 'late' ? 'bg-orange-400 text-white' : 'bg-orange-500 text-white'
                              : 'bg-line text-ink-500 hover:bg-line'}`}>
                          {TST[s].label}
                        </button>
                      ))}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      )}

      {tab === 'list' && (
        <Card title="بيانات معلمي المسجد" subtitle="مشرف المسجد مسؤول عن تسجيلها"
          action={canManage && <button className="btn-primary btn-sm" onClick={() => { setEditing(null); setOpen(true) }}>＋ معلم جديد</button>} pad={false}>
          {teachers.length === 0 ? <Empty icon="📚" title="لا يوجد معلمون" /> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-navy-50"><tr>
                  <th className="th">المعلم</th><th className="th">الحلقة</th><th className="th">المستوى</th>
                  <th className="th">الطلاب</th><th className="th">الجوال</th><th className="th">التقييم</th>
                  <th className="th no-print"></th>
                </tr></thead>
                <tbody>
                  {teachers.map((t) => (
                    <tr key={t.id} className="row">
                      <td className="td font-bold">{t.name}</td>
                      <td className="td">{t.circle}</td>
                      <td className="td text-[12px]">{t.level}</td>
                      <td className="td tabular-nums">{t.studentsCount}</td>
                      <td className="td text-[12px]" dir="ltr">{t.phone}</td>
                      <td className="td">
                        {t.evaluation
                          ? <Badge tone={t.evaluation.score >= 4 ? 'ok' : t.evaluation.score >= 3 ? 'warn' : 'bad'}>
                              {t.evaluation.score} / 5
                            </Badge>
                          : <span className="text-ink-300 text-[12px]">—</span>}
                      </td>
                      <td className="td no-print">
                        <div className="flex gap-1.5">
                          {canManage && <>
                            <button className="btn-ghost btn-sm" onClick={() => setEvalFor(t)}>تقييم</button>
                            <button className="btn-ghost btn-sm" onClick={() => { setEditing(t); setOpen(true) }}>تعديل</button>
                            <button className="btn-sm px-2 rounded-lg text-orange-600 hover:bg-orange-50" onClick={() => removeTeacher(t)}>إيقاف</button>
                          </>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === 'report' && <TeachersReport mid={mid} />}

      <TeacherModal open={open} onClose={() => { setOpen(false); setEditing(null) }} teacher={editing} mosqueId={mid} />
      <EvalModal teacher={evalFor} onClose={() => setEvalFor(null)} />
    </div>
  )
}

function TeachersReport({ mid }: { mid: string }) {
  const { db } = useDb()
  const mosque = db.mosques.find((m) => m.id === mid)!
  const teachers = db.teachers.filter((t) => t.mosqueId === mid && t.active)
  const days = lastNDays(30)
  const rows = db.teacherAttendance.filter((t) => t.mosqueId === mid && t.date >= days[0])

  return (
    <Card title="تقرير حضور المعلمين" subtitle="آخر ٣٠ يومًا — قابل للطباعة والمشاركة"
      action={<PrintBar title="تقرير المعلمين" />}>
      <div id="print-area">
        <ReportHeader title="تقرير حضور وأداء المعلمين" subtitle={mosque.name} />
        <div className="mt-5 space-y-4">
          {teachers.map((t) => {
            const r = rows.filter((x) => x.teacherId === t.id)
            const present = r.filter((x) => x.status === 'present').length
            const rate = r.length ? Math.round((present / r.length) * 100) : 0
            return (
              <div key={t.id} className="rounded-2xl border border-line p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="font-extrabold text-[14.5px]">{t.name}</h4>
                    <p className="text-[11.5px] text-ink-500">{t.circle} · {t.level} · {t.studentsCount} طالبًا</p>
                  </div>
                  <div className="text-left">
                    <div className={`text-2xl font-display font-black tabular-nums ${rate >= 85 ? 'text-navy-800' : rate >= 70 ? 'text-orange-600' : 'text-orange-600'}`}>{rate}%</div>
                    <div className="text-[10px] font-bold text-ink-500">نسبة الحضور</div>
                  </div>
                </div>
                <div className="mt-3">
                  <SplitBar parts={[
                    { label: 'حاضر', value: present, color: C.present },
                    { label: 'متأخر', value: r.filter((x) => x.status === 'late').length, color: '#f59e0b' },
                    { label: 'مستأذن', value: r.filter((x) => x.status === 'excused').length, color: C.excused },
                    { label: 'غائب', value: r.filter((x) => x.status === 'absent').length, color: C.absent },
                  ]} />
                </div>
                {t.evaluation && (
                  <div className="mt-3 rounded-xl bg-navy-50 border border-navy-100 px-3.5 py-2.5">
                    <p className="text-[12px] font-bold text-navy-800">
                      التقييم: {t.evaluation.score}/5 — {fmtDate(t.evaluation.at)}
                    </p>
                    {t.evaluation.note && <p className="text-[12px] text-ink-700 mt-1 leading-6">{t.evaluation.note}</p>}
                  </div>
                )}
                {t.notes && <p className="text-[12px] text-ink-500 mt-2">ملاحظات: {t.notes}</p>}
              </div>
            )
          })}
        </div>
        <ReportFooter />
      </div>
    </Card>
  )
}

function TeacherModal({ open, onClose, teacher, mosqueId }: {
  open: boolean; onClose: () => void; teacher: Teacher | null; mosqueId: string
}) {
  const { set } = useDb()
  const toast = useToast()
  const [f, setF] = useState<any>({})
  const [key, setKey] = useState('')
  const sig = `${open}-${teacher?.id ?? 'new'}`
  if (sig !== key) {
    setKey(sig)
    setF(teacher ? { ...teacher } : { name: '', phone: '', circle: '', level: 'حفظ', studentsCount: 10, notes: '' })
  }

  const save = () => {
    if (!f.name?.trim()) return toast('اكتب اسم المعلم.', 'bad')
    set((d) => {
      if (teacher) Object.assign(d.teachers.find((t) => t.id === teacher.id)!, { ...f, studentsCount: Number(f.studentsCount) || 0 })
      else d.teachers.push({ ...f, id: uid('tc'), mosqueId, active: true, studentsCount: Number(f.studentsCount) || 0 })
    })
    toast(teacher ? 'تم الحفظ' : 'تمت إضافة المعلم')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={teacher ? 'تعديل بيانات معلم' : 'معلم جديد'}
      footer={<><button className="btn-primary" onClick={save}>حفظ</button>
        <button className="btn-ghost" onClick={onClose}>إلغاء</button></>}>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="اسم المعلم" required>
          <input className="field" value={f.name ?? ''} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus />
        </Field>
        <Field label="رقم الجوال">
          <input className="field" value={f.phone ?? ''} onChange={(e) => setF({ ...f, phone: e.target.value })} dir="ltr" />
        </Field>
        <Field label="الحلقة">
          <input className="field" value={f.circle ?? ''} onChange={(e) => setF({ ...f, circle: e.target.value })} placeholder="الحلقة الأولى" />
        </Field>
        <Field label="المستوى">
          <Select value={f.level ?? ''} onChange={(v) => setF({ ...f, level: v })} placeholder="اختر…"
            options={['حفظ', 'تلاوة وتجويد', 'مراجعة', 'تأسيس'].map((v) => ({ value: v, label: v }))} />
        </Field>
        <Field label="عدد الطلاب">
          <input type="number" className="field" value={f.studentsCount ?? 0} onChange={(e) => setF({ ...f, studentsCount: e.target.value })} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="ملاحظات">
            <textarea className="field leading-7" rows={3} value={f.notes ?? ''} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          </Field>
        </div>
      </div>
    </Modal>
  )
}

function EvalModal({ teacher, onClose }: { teacher: Teacher | null; onClose: () => void }) {
  const { set } = useDb()
  const toast = useToast()
  const [score, setScore] = useState(teacher?.evaluation?.score ?? 4)
  const [note, setNote] = useState(teacher?.evaluation?.note ?? '')
  const [key, setKey] = useState('')
  if (teacher && key !== teacher.id) {
    setKey(teacher.id); setScore(teacher.evaluation?.score ?? 4); setNote(teacher.evaluation?.note ?? '')
  }
  if (!teacher) return null

  const save = () => {
    set((d) => {
      const t = d.teachers.find((x) => x.id === teacher.id)!
      t.evaluation = { score, note, at: todayISO() }
    })
    toast('تم حفظ التقييم')
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={`تقييم — ${teacher.name}`}
      footer={<><button className="btn-primary" onClick={save}>حفظ التقييم</button>
        <button className="btn-ghost" onClick={onClose}>إلغاء</button></>}>
      <div className="space-y-4">
        <Field label="الدرجة">
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setScore(n)}
                className={`flex-1 py-3 rounded-xl font-black text-lg transition
                  ${score >= n ? 'bg-orange-400 text-white' : 'bg-line text-ink-300'}`}>★</button>
            ))}
          </div>
          <p className="text-center mt-2 text-[13px] font-bold text-ink-500">{score} من 5</p>
        </Field>
        <Field label="ملاحظات التقييم">
          <textarea className="field leading-7" rows={5} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="مستوى الانضباط، تفاعل الطلاب، جودة التحفيظ…" />
        </Field>
      </div>
    </Modal>
  )
}
