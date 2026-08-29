import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useDb, uid } from '../store/db'
import { useAuth } from '../store/auth'
import {
  Card, Modal, Field, Select, Badge, Empty, useToast, Tabs, PrintBar, Menu, StatStrip, Progress,
} from '../components/ui'
import { PageHeader } from '../components/PageHeader'
import { ReportHeader, ReportFooter } from '../components/ReportShell'
import { SplitBar, C } from '../components/charts'
import { todayISO, shiftDays, fmtDate, fmtDayName } from '../lib/date'
import { lastNDays, teachersOf, teacherStats, teacherPayroll } from '../lib/selectors'
import { money } from '../lib/format'
import type { Teacher, TeacherAttStatus } from '../types'

const TST: Record<TeacherAttStatus, { label: string; on: string }> = {
  present: { label: 'حاضر', on: 'bg-navy-700 text-white' },
  late: { label: 'متأخر', on: 'bg-orange-300 text-orange-900' },
  excused: { label: 'مستأذن', on: 'bg-orange-400 text-white' },
  absent: { label: 'غائب', on: 'bg-orange-600 text-white' },
}
const ORDER: TeacherAttStatus[] = ['present', 'late', 'excused', 'absent']

/** المراحل الدراسية لطلاب الحلقة */
export const STAGES: string[] = ['الابتدائية', 'المتوسطة', 'الثانوية', 'الجامعيون', 'الموظفون']

export default function Teachers() {
  const { mid = '' } = useParams()
  const { db, set } = useDb()
  const { user, isDirector } = useAuth()
  const toast = useToast()

  const [tab, setTab] = useState<'today' | 'list' | 'report'>('today')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Teacher | null>(null)
  const [evalFor, setEvalFor] = useState<Teacher | null>(null)
  const [leaveFor, setLeaveFor] = useState<Teacher | null>(null)
  const [date, setDate] = useState(todayISO())

  const mosque = db.mosques.find((m) => m.id === mid)
  const teachers = teachersOf(db, mid)
  const canManage = isDirector || (user?.role === 'supervisor' && user.mosqueId === mid)

  const rows = db.teacherAttendance.filter((t) => t.mosqueId === mid && t.date === date)
  const get = (tid: string) => rows.find((r) => r.teacherId === tid)

  const mark = (tid: string, status: TeacherAttStatus) => {
    set((d) => {
      const ex = d.teacherAttendance.find((r) => r.teacherId === tid && r.date === date)
      if (ex) { ex.status = status; if (status !== 'excused') ex.note = undefined }
      else d.teacherAttendance.push({ id: uid('ta'), mosqueId: mid, teacherId: tid, date, status })
    })
  }

  /** مسح رصد اليوم — لتصحيح غياب سُجّل بالخطأ */
  const clearMark = (tid: string) => {
    set((d) => {
      d.teacherAttendance = d.teacherAttendance.filter((r) => !(r.teacherId === tid && r.date === date))
    })
    toast('أُزيل الرصد — يمكن تسجيله من جديد')
  }

  const markAll = (status: TeacherAttStatus) => {
    set((d) => {
      teachers.forEach((t) => {
        const ex = d.teacherAttendance.find((r) => r.teacherId === t.id && r.date === date)
        if (ex) ex.status = status
        else d.teacherAttendance.push({ id: uid('ta'), mosqueId: mid, teacherId: t.id, date, status })
      })
    })
    toast(`تم تعليم الجميع: ${TST[status].label}`)
  }

  const marked = teachers.filter((t) => get(t.id)).length

  return (
    <div>
      <PageHeader
        eyebrow={mosque?.name}
        title="المعلمون"
        description="مشرف المسجد وحده يسجّل بيانات معلميه ورواتبهم، ويرصد حضورهم وغيابهم يوميًا، ويرفع لهم طلبات الاستئذان، ويصحّح أي رصد خاطئ. المعلم لا يحتاج حسابًا في المنصة."
        actions={canManage && (
          <button className="btn-primary btn-sm" onClick={() => { setEditing(null); setOpen(true) }}>
            ＋ إضافة معلم
          </button>
        )}
      />

      <StatStrip className="mb-5" items={[
        { label: 'عدد المعلمين', value: teachers.length },
        { label: 'الطلاب', value: teachers.reduce((s, t) => s + (t.studentsCount || 0), 0) },
        { label: 'حاضر اليوم', value: rows.filter((r) => r.status === 'present').length },
        {
          label: 'غائب اليوم', value: rows.filter((r) => r.status === 'absent').length,
          accent: rows.some((r) => r.status === 'absent'),
        },
        { label: 'لم يُرصدوا', value: teachers.length - marked, hint: `من ${teachers.length}` },
      ]} />

      <Tabs value={tab} onChange={(v) => setTab(v as any)} items={[
        { value: 'today', label: 'رصد الحضور' },
        { value: 'list', label: 'بيانات المعلمين', count: teachers.length },
        { value: 'report', label: 'التقرير والرواتب' },
      ]} />

      <div className="mt-4">
        {tab === 'today' && (
          <Card
            title="رصد حضور المعلمين"
            subtitle={`${fmtDayName(date)} · ${fmtDate(date)}`}
            action={
              <>
                <input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
                {canManage && teachers.length > 0 && (
                  <Menu align="start" items={[
                    { label: 'تعليم الجميع حاضرين', icon: '✓', onClick: () => markAll('present') },
                    { label: 'تعليم الجميع غائبين', icon: '✕', onClick: () => markAll('absent'), danger: true },
                  ]} />
                )}
              </>
            }
            pad={false}
          >
            {teachers.length === 0 ? (
              <Empty icon="📚" title="لم تُسجَّل بيانات المعلمين بعد"
                hint="سجّل معلمي المسجد أولًا ليظهروا في قائمة الرصد اليومي."
                action={canManage && <button className="btn-primary btn-sm" onClick={() => setOpen(true)}>＋ إضافة معلم</button>} />
            ) : (
              <ul className="divide-y divide-line">
                {teachers.map((t) => {
                  const r = get(t.id)
                  return (
                    <li key={t.id} className="px-4 sm:px-5 py-3.5">
                      <div className="flex items-start gap-3">
                        <span className="w-9 h-9 rounded-lg bg-navy-50 text-navy-700 grid place-items-center font-bold text-[13px] shrink-0">
                          {t.name.replace(/^(د\.|أ\.)\s*/, '')[0]}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-[13.5px] truncate">{t.name}</p>
                          <p className="text-[11px] text-ink-400 truncate">
                            {[t.circle, t.level, `${t.studentsCount} طالبًا`].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        {canManage && (
                          <Menu align="start" items={[
                            { label: 'طلب استئذان', icon: '📝', onClick: () => setLeaveFor(t) },
                            { label: 'تقييم المعلم', icon: '★', onClick: () => setEvalFor(t) },
                            { label: 'تعديل البيانات', icon: '✎', onClick: () => { setEditing(t); setOpen(true) } },
                            ...(r ? ['sep' as const, {
                              label: 'مسح رصد هذا اليوم', icon: '↩', danger: true,
                              onClick: () => clearMark(t.id),
                            }] : []),
                          ]} />
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-1.5 mt-3 no-print">
                        {ORDER.map((s) => (
                          <button key={s} disabled={!canManage} onClick={() => mark(t.id, s)}
                            className={`h-9 rounded-lg text-[12px] font-bold transition
                              ${r?.status === s ? TST[s].on : 'bg-navy-50 text-ink-500 hover:bg-navy-100 disabled:hover:bg-navy-50'}`}>
                            {TST[s].label}
                          </button>
                        ))}
                      </div>
                      {r && canManage && (
                        <button onClick={() => clearMark(t.id)}
                          className="mt-2 text-[11.5px] font-bold text-ink-400 hover:text-orange-700 transition no-print">
                          سُجّل بالخطأ؟ امسح رصد هذا اليوم
                        </button>
                      )}
                      {r?.note && <p className="text-[11.5px] text-orange-700 bg-orange-50 rounded-lg px-2.5 py-1.5 mt-2">📝 {r.note}</p>}
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        )}

        {tab === 'list' && (
          <Card title="بيانات معلمي المسجد" subtitle="الاسم والحلقة والراتب — الراتب أساس احتساب الخصومات"
            action={canManage && <button className="btn-primary btn-sm" onClick={() => { setEditing(null); setOpen(true) }}>＋ معلم جديد</button>}
            pad={false}>
            {teachers.length === 0 ? <Empty icon="📚" title="لا يوجد معلمون" /> : (
              <>
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-navy-50"><tr>
                      <th className="th">المعلم</th><th className="th">الحلقة</th><th className="th">المرحلة</th>
                      <th className="th">الطلاب</th><th className="th">الجوال</th>
                      <th className="th">الراتب / الصافي</th><th className="th">التقييم</th><th className="th no-print"></th>
                    </tr></thead>
                    <tbody>
                      {teachers.map((t) => {
                        const pay = teacherPayroll(db, t, todayISO())
                        return (
                          <tr key={t.id} className="row">
                            <td className="td font-bold">{t.name}</td>
                            <td className="td">{t.circle || '—'}</td>
                            <td className="td text-[12px]">{t.level}</td>
                            <td className="td num">{t.studentsCount}</td>
                            <td className="td text-[12px]" dir="ltr">{t.phone || '—'}</td>
                            <td className="td num">
                              {t.salary ? money(t.salary) : <span className="text-ink-300">لم يُسجَّل</span>}
                              {t.salary > 0 && <span className="block text-[11px] text-navy-700">صافي {money(pay.net)}</span>}
                            </td>
                            <td className="td">
                              {t.evaluation
                                ? <Badge tone={t.evaluation.score >= 4 ? 'ok' : t.evaluation.score >= 3 ? 'warn' : 'bad'}>{t.evaluation.score}/5</Badge>
                                : <span className="text-ink-300 text-[12px]">—</span>}
                            </td>
                            <td className="td no-print">
                              {canManage && (
                                <Menu items={[
                                  { label: 'تعديل البيانات', icon: '✎', onClick: () => { setEditing(t); setOpen(true) } },
                                  { label: 'تقييم المعلم', icon: '★', onClick: () => setEvalFor(t) },
                                  { label: 'طلب استئذان', icon: '📝', onClick: () => setLeaveFor(t) },
                                  'sep',
                                  {
                                    label: 'إيقاف المعلم', icon: '⏻', danger: true,
                                    onClick: () => {
                                      if (!confirm(`إيقاف ${t.name}؟`)) return
                                      set((d) => { const x = d.teachers.find((y) => y.id === t.id); if (x) x.active = false })
                                      toast('تم الإيقاف')
                                    },
                                  },
                                ]} />
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <ul className="lg:hidden divide-y divide-line">
                  {teachers.map((t) => {
                    const pay = teacherPayroll(db, t, todayISO())
                    return (
                      <li key={t.id} className="p-4 flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-[13.5px]">{t.name}</p>
                          <p className="text-[11.5px] text-ink-400 mt-0.5">
                            {[t.circle, t.level, `${t.studentsCount} طالبًا`].filter(Boolean).join(' · ')}
                          </p>
                          <p className="text-[11.5px] text-ink-500 mt-1.5">
                            {t.salary ? <>الراتب <b className="text-ink-900">{money(t.salary)}</b> · الصافي <b className="text-navy-700">{money(pay.net)}</b></> : 'لم يُسجَّل راتب'}
                          </p>
                        </div>
                        {canManage && (
                          <Menu items={[
                            { label: 'تعديل البيانات', icon: '✎', onClick: () => { setEditing(t); setOpen(true) } },
                            { label: 'تقييم المعلم', icon: '★', onClick: () => setEvalFor(t) },
                            { label: 'طلب استئذان', icon: '📝', onClick: () => setLeaveFor(t) },
                          ]} />
                        )}
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </Card>
        )}

        {tab === 'report' && <TeachersReport mid={mid} />}
      </div>

      <TeacherModal open={open} onClose={() => { setOpen(false); setEditing(null) }} teacher={editing} mosqueId={mid} />
      <EvalModal teacher={evalFor} onClose={() => setEvalFor(null)} />
      <TeacherLeaveModal teacher={leaveFor} onClose={() => setLeaveFor(null)} />
    </div>
  )
}

/* ================= التقرير والرواتب ================= */
function TeachersReport({ mid }: { mid: string }) {
  const { db } = useDb()
  const mosque = db.mosques.find((m) => m.id === mid)!
  const teachers = teachersOf(db, mid)
  const days = lastNDays(30)
  const from = days[0], to = todayISO()

  const totalGross = teachers.reduce((s, t) => s + (t.salary || 0), 0)
  const totalNet = teachers.reduce((s, t) => s + teacherPayroll(db, t, to).net, 0)

  return (
    <Card title="تقرير المعلمين ورواتبهم" subtitle="آخر ٣٠ يومًا — قابل للطباعة والمشاركة"
      action={<PrintBar title="تقرير المعلمين" />}>
      <div id="print-area">
        <ReportHeader title="تقرير حضور المعلمين ورواتبهم" subtitle={mosque.name}
          period={`${fmtDate(from)} — ${fmtDate(to)}`} />

        {teachers.length === 0 ? (
          <Empty icon="📚" title="لا يوجد معلمون بعد" />
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-line border border-line rounded-xl overflow-hidden mt-5">
              {[
                ['عدد المعلمين', String(teachers.length)],
                ['إجمالي الرواتب', money(totalGross)],
                ['إجمالي الخصومات', money(totalGross - totalNet)],
                ['الصافي المستحق', money(totalNet)],
              ].map(([k, v]) => (
                <div key={k} className="bg-surface px-4 py-3">
                  <p className="text-[11px] font-bold text-ink-500">{k}</p>
                  <p className="num text-[17px] mt-1">{v}</p>
                </div>
              ))}
            </div>

            <div className="space-y-3 mt-5">
              {teachers.map((t) => {
                const st = teacherStats(db, t.id, from, to)
                const pay = teacherPayroll(db, t, to)
                return (
                  <div key={t.id} className="rounded-xl border border-line p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="text-[14px] text-navy-900">{t.name}</h4>
                        <p className="text-[11.5px] text-ink-400 mt-0.5">
                          {[t.circle, t.level, `${t.studentsCount} طالبًا`].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <div className="text-left shrink-0">
                        <div className="num text-[20px] text-navy-800">{st.total ? `${st.rate}%` : '—'}</div>
                        <div className="text-[10px] font-bold text-ink-400">نسبة الحضور</div>
                      </div>
                    </div>

                    <div className="mt-3">
                      <SplitBar parts={[
                        { label: 'حاضر', value: st.present, color: C.present },
                        { label: 'متأخر', value: st.late, color: C.orangeSoft },
                        { label: 'مستأذن', value: st.excused, color: C.excused },
                        { label: 'غائب', value: st.absent, color: C.absent },
                      ]} />
                    </div>

                    {t.salary > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-line border border-line rounded-lg overflow-hidden mt-3">
                        {[
                          ['الراتب', money(t.salary)],
                          ['أيام الخصم', String(pay.deductionDays)],
                          ['الخصم', money(pay.deduction)],
                          ['الصافي', money(pay.net)],
                        ].map(([k, v]) => (
                          <div key={k} className="bg-surface px-3 py-2">
                            <p className="text-[10px] font-bold text-ink-400">{k}</p>
                            <p className="num text-[13px] mt-0.5">{v}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {t.evaluation && (
                      <div className="mt-3 rounded-lg bg-navy-50 border border-navy-100 px-3.5 py-2.5">
                        <p className="text-[12px] font-bold text-navy-800">
                          التقييم: {t.evaluation.score}/5 — {fmtDate(t.evaluation.at)}
                        </p>
                        {t.evaluation.note && <p className="text-[12px] text-ink-700 mt-1 leading-6">{t.evaluation.note}</p>}
                      </div>
                    )}
                    {t.notes && <p className="text-[11.5px] text-ink-500 mt-2">ملاحظات: {t.notes}</p>}
                  </div>
                )
              })}
            </div>
          </>
        )}
        <ReportFooter />
      </div>
    </Card>
  )
}

/* ================= نماذج ================= */
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
    setF(teacher ? { ...teacher } : {
      name: '', phone: '', circle: '', level: 'الابتدائية', studentsCount: 10,
      salary: 0, notes: '', hiredAt: todayISO(),
    })
  }

  const save = () => {
    if (!f.name?.trim()) return toast('اكتب اسم المعلم.', 'bad')
    const payload = {
      ...f,
      studentsCount: Number(f.studentsCount) || 0,
      salary: Number(f.salary) || 0,
    }
    set((d) => {
      if (teacher) Object.assign(d.teachers.find((t) => t.id === teacher.id)!, payload)
      else d.teachers.push({ ...payload, id: uid('tc'), mosqueId, active: true })
    })
    toast(teacher ? 'تم حفظ البيانات' : 'تمت إضافة المعلم')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={teacher ? 'تعديل بيانات معلم' : 'معلم جديد'} wide
      footer={<><button className="btn-primary" onClick={save}>حفظ</button>
        <button className="btn-ghost" onClick={onClose}>إلغاء</button></>}>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="اسم المعلم" required>
          <input className="field" value={f.name ?? ''} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus />
        </Field>
        <Field label="رقم الجوال">
          <input className="field text-left" dir="ltr" inputMode="tel" value={f.phone ?? ''}
            onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="05xxxxxxxx" />
        </Field>
        <Field label="الحلقة">
          <input className="field" value={f.circle ?? ''} onChange={(e) => setF({ ...f, circle: e.target.value })} placeholder="الحلقة الأولى" />
        </Field>
        <Field label="المرحلة" required>
          <Select value={f.level ?? ''} onChange={(v) => setF({ ...f, level: v })} placeholder="اختر المرحلة…"
            options={[
              ...STAGES.map((v) => ({ value: v, label: v })),
              // قيمة مسجّلة سابقًا خارج القائمة تبقى ظاهرة فلا تضيع
              ...(f.level && !STAGES.includes(f.level) ? [{ value: f.level, label: `${f.level} (مسجّلة سابقًا)` }] : []),
            ]} />
        </Field>
        <Field label="عدد الطلاب">
          <input type="number" inputMode="numeric" className="field" value={f.studentsCount ?? 0}
            onChange={(e) => setF({ ...f, studentsCount: e.target.value })} />
        </Field>
        <Field label="الراتب الشهري (ر.س)" hint="أساس احتساب خصم الغياب والاستئذان">
          <input type="number" inputMode="numeric" className="field" value={f.salary ?? 0}
            onChange={(e) => setF({ ...f, salary: e.target.value })} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="ملاحظات">
            <textarea className="field leading-7" rows={3} value={f.notes ?? ''} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          </Field>
        </div>
        <div className="sm:col-span-2 rounded-xl bg-navy-50 border border-navy-100 px-4 py-3 text-[12.5px] text-navy-900 leading-6">
          المعلم لا يملك حسابًا في المنصة. مشرف المسجد هو من يرصد حضوره وغيابه ويرفع له طلب الاستئذان،
          وتُحتسب الخصومات من راتبه المسجَّل هنا.
        </div>
      </div>
    </Modal>
  )
}

function TeacherLeaveModal({ teacher, onClose }: { teacher: Teacher | null; onClose: () => void }) {
  const { set } = useDb()
  const { user } = useAuth()
  const toast = useToast()
  const [date, setDate] = useState(todayISO())
  const [reason, setReason] = useState('')
  const [key, setKey] = useState('')
  if (teacher && key !== teacher.id) { setKey(teacher.id); setDate(todayISO()); setReason('') }
  if (!teacher) return null

  const save = () => {
    if (!reason.trim()) return toast('اكتب سبب الاستئذان.', 'bad')
    set((d) => d.leaves.push({
      id: uid('l'), mosqueId: teacher.mosqueId, personType: 'teacher', personId: teacher.id,
      date, reason: reason.trim(), status: 'pending', createdAt: todayISO(),
    }))
    toast('رُفع الطلب لمدير المجمع للاعتماد')
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={`طلب استئذان — ${teacher.name}`}
      footer={<><button className="btn-primary" onClick={save}>رفع الطلب</button>
        <button className="btn-ghost" onClick={onClose}>إلغاء</button></>}>
      <div className="space-y-4">
        <div className="rounded-xl bg-orange-50 border border-orange-200 px-4 py-3 text-[12.5px] text-orange-900 font-bold leading-6">
          عند اعتماد المدير يُحتسب «استئذان» ويُخصم نصف يوم من راتب المعلم، وبدون اعتماد يُحتسب غيابًا بيوم كامل.
        </div>
        <Field label="تاريخ الاستئذان" required>
          <input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="السبب" required>
          <textarea className="field leading-7" rows={4} value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="اذكر سبب الاستئذان بإيجاز…" />
        </Field>
      </div>
    </Modal>
  )
}

function EvalModal({ teacher, onClose }: { teacher: Teacher | null; onClose: () => void }) {
  const { set } = useDb()
  const toast = useToast()
  const [score, setScore] = useState(4)
  const [note, setNote] = useState('')
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
                className={`flex-1 h-12 rounded-xl font-black text-lg transition
                  ${score >= n ? 'bg-orange-500 text-white' : 'bg-navy-50 text-ink-300'}`}>★</button>
            ))}
          </div>
          <p className="text-center mt-2 text-[12.5px] font-bold text-ink-500">{score} من 5</p>
        </Field>
        <Field label="ملاحظات التقييم">
          <textarea className="field leading-7" rows={5} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="مستوى الانضباط، تفاعل الطلاب، جودة التحفيظ…" />
        </Field>
      </div>
    </Modal>
  )
}
