import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useDb, uid } from '../store/db'
import { useAuth } from '../store/auth'
import {
  Card, Modal, Field, Select, Badge, Empty, useToast, Stat, Tabs,
  FileDrop, FileChips, Progress, PrintBar, Menu,
} from '../components/ui'
import { AiTextArea } from '../components/AiTextArea'
import { PageHeader } from '../components/PageHeader'
import { ReportHeader, ReportFooter } from '../components/ReportShell'
import { Donut, SplitBar, BarChart, C } from '../components/charts'
import { todayISO, shiftDays, fmtDate, dueLabel } from '../lib/date'
import {
  staffOf, committeesOf, attendanceStats, taskCounts, personName,
  committeeName, mosqueName, payrollFor, lastNDays, attendanceByDay,
} from '../lib/selectors'
import { KIND_LABEL, STATUS_LABEL } from './Tasks'
import type { PeriodReport, UploadedFile } from '../types'

export default function Reports({ scope }: { scope?: 'complex' }) {
  const { mid = '' } = useParams()
  const { user, isDirector } = useAuth()
  const isComplex = scope === 'complex'
  const [tab, setTab] = useState<'person' | 'committee' | 'mosque' | 'uploads'>('person')

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={isComplex ? 'الإدارة العامة' : undefined}
        title="التقارير"
        description="تقارير جاهزة للطباعة أو الحفظ PDF — للشخص واللجنة والمسجد، إضافة إلى رفع التقارير الأسبوعية والشهرية بشواهدها."
      />
      <Tabs value={tab} onChange={(v) => setTab(v as any)} items={[
        { value: 'person', label: 'تقرير شخص' },
        { value: 'committee', label: 'تقرير لجنة' },
        { value: 'mosque', label: isComplex ? 'تقرير المجمع' : 'تقرير المسجد' },
        { value: 'uploads', label: 'التقارير الدورية المرفوعة' },
      ]} />
      {tab === 'person' && <PersonReport mid={isComplex ? '' : mid} />}
      {tab === 'committee' && <CommitteeReport mid={isComplex ? '' : mid} />}
      {tab === 'mosque' && <MosqueReport mid={isComplex ? '' : mid} isComplex={isComplex} />}
      {tab === 'uploads' && <Uploads mid={isComplex ? '' : mid} isComplex={isComplex} />}
    </div>
  )
}

const RANGES = [
  { value: '7', label: 'آخر ٧ أيام' },
  { value: '30', label: 'آخر ٣٠ يومًا' },
  { value: '90', label: 'آخر ٩٠ يومًا' },
]

/* ================= تقرير شخص ================= */
function PersonReport({ mid }: { mid: string }) {
  const { db } = useDb()
  const { user, isDirector } = useAuth()
  const [range, setRange] = useState('30')

  const pool = mid ? staffOf(db, mid) : db.people.filter((p) => p.active)
  const canPickOthers = isDirector || user?.role === 'supervisor'
  const [pid, setPid] = useState(canPickOthers ? (pool[0]?.id ?? user!.id) : user!.id)
  const person = db.people.find((p) => p.id === pid) ?? user!

  const to = todayISO()
  const from = shiftDays(to, -(Number(range) - 1))
  const st = attendanceStats(db, person.id, from, to)
  const tasks = db.tasks.filter((t) => t.assigneeId === person.id)
  const tc = taskCounts(tasks)
  const pay = payrollFor(db, person, to)
  const days = lastNDays(Math.min(Number(range), 21))
  const byDay = attendanceByDay(db.attendance.filter((a) => a.personId === person.id), days)

  return (
    <Card title="التقرير الشخصي" subtitle="حضورك ومهامك خلال الفترة"
      action={<div className="flex flex-wrap gap-2 items-center">
        {canPickOthers && (
          <Select value={pid} onChange={setPid} placeholder=""
            options={pool.map((p) => ({ value: p.id, label: p.name }))} />
        )}
        <Select value={range} onChange={setRange} placeholder="" options={RANGES} />
        <PrintBar title={`تقرير ${person.name}`} />
      </div>}>
      <div id="print-area">
        <ReportHeader title="التقرير الشخصي" subtitle={person.name}
          period={`${fmtDate(from)} — ${fmtDate(to)}`} />

        <div className="mt-5 grid sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-line p-5 flex flex-col items-center justify-center">
            <Donut value={st.rate} tone={st.rate >= 85 ? C.olive : st.rate >= 70 ? C.gold : C.rose} sub="نسبة الحضور" />
            <p className="text-[12px] font-bold text-ink-500 mt-3">
              حضر {st.present} من {st.total} يوم عمل
            </p>
          </div>
          <div className="sm:col-span-2 grid grid-cols-2 gap-3">
            <Stat label="أيام الحضور" value={st.present} tone="olive" />
            <Stat label="أيام الغياب" value={st.absent} tone={st.absent ? 'rose' : 'slate'} />
            <Stat label="أيام الاستئذان" value={st.excused} tone="gold" />
            <Stat label="بنود موكلة إليه" value={tc.total} tone="brand" />
            <Stat label="منجزة" value={tc.done} />
            <Stat label="متعثرة / متأخرة" value={`${tc.stuck} / ${tc.late}`} tone={tc.stuck || tc.late ? 'rose' : 'slate'} />
          </div>
        </div>

        <section className="mt-6">
          <h4 className="font-extrabold text-[14px] mb-2">حركة الحضور</h4>
          <BarChart data={byDay.map((d) => ({
            label: d.date.slice(8),
            values: [
              { key: 'حاضر', value: d.present, color: C.present },
              { key: 'مستأذن', value: d.excused, color: C.excused },
              { key: 'غائب', value: d.absent, color: C.absent },
            ],
          }))} height={100} />
        </section>

        {person.salary > 0 && (
          <section className="mt-6">
            <h4 className="font-extrabold text-[14px] mb-2">الأثر المالي (الشهر الحالي)</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="الراتب" value={person.salary.toLocaleString('en-US')} />
              <Stat label="أيام الخصم" value={pay.deductionDays} />
              <Stat label="إجمالي الخصم" value={pay.deduction.toLocaleString('en-US')} tone={pay.deduction ? 'rose' : 'slate'} />
              <Stat label="الصافي" value={pay.net.toLocaleString('en-US')} tone="olive" />
            </div>
          </section>
        )}

        <section className="mt-6">
          <h4 className="font-extrabold text-[14px] mb-2">البنود الموكلة</h4>
          {tasks.length === 0 ? <p className="muted">لا توجد بنود.</p> : (
            <div className="overflow-x-auto -mx-1 px-1"><table className="w-full min-w-[520px] border border-line rounded-xl overflow-hidden">
              <thead className="bg-navy-50"><tr>
                <th className="th">البند</th><th className="th">النوع</th><th className="th">اللجنة</th>
                <th className="th">الموعد</th><th className="th">الحالة</th>
              </tr></thead>
              <tbody>
                {tasks.map((t) => {
                  const d = dueLabel(t.dueDate)
                  return (
                    <tr key={t.id} className="row">
                      <td className="td font-bold text-[12.5px]">{t.title}</td>
                      <td className="td text-[12px]">{KIND_LABEL[t.kind]}</td>
                      <td className="td text-[12px]">{committeeName(db, t.committeeId)}</td>
                      <td className="td text-[12px]">
                        {fmtDate(t.dueDate)}
                        {t.status !== 'done' && d.diff < 0 && <span className="text-orange-600 font-bold"> · متأخرة</span>}
                      </td>
                      <td className="td"><Badge tone={
                        t.status === 'done' ? 'ok' : t.status === 'stuck' ? 'bad' : t.status === 'postponed' ? 'warn' : 'info'
                      }>{STATUS_LABEL[t.status]}</Badge></td>
                    </tr>
                  )
                })}
              </tbody>
            </table></div>
          )}
        </section>

        <ReportFooter by={user?.name} />
      </div>
    </Card>
  )
}

/* ================= تقرير لجنة ================= */
function CommitteeReport({ mid }: { mid: string }) {
  const { db } = useDb()
  const { user } = useAuth()
  const [range, setRange] = useState('30')
  const committees = mid ? committeesOf(db, mid) : db.committees
  const [cid, setCid] = useState(committees[0]?.id ?? '')
  const c = db.committees.find((x) => x.id === cid)

  if (!c) return <Card><Empty icon="🏷️" title="لا توجد لجان" /></Card>

  const to = todayISO()
  const from = shiftDays(to, -(Number(range) - 1))
  const tasks = db.tasks.filter((t) => t.committeeId === c.id)
  const inRange = tasks.filter((t) => t.createdAt >= from || t.dueDate >= from)
  const tc = taskCounts(tasks)
  const members = db.people.filter((p) => p.committeeIds.includes(c.id) && p.active)
  const pct = tc.total ? Math.round((tc.done / tc.total) * 100) : 0

  const grade = pct >= 85 ? { t: 'ممتاز', tone: 'ok' } : pct >= 70 ? { t: 'جيد جدًا', tone: 'ok' }
    : pct >= 55 ? { t: 'جيد', tone: 'warn' } : pct >= 40 ? { t: 'يحتاج تحسينًا', tone: 'warn' }
    : { t: 'ضعيف', tone: 'bad' }

  return (
    <Card title="تقرير اللجنة" subtitle="الإنجاز والتعثر وتقييم الأداء"
      action={<div className="flex flex-wrap gap-2 items-center">
        <Select value={cid} onChange={setCid} placeholder=""
          options={committees.map((x) => ({ value: x.id, label: mid ? x.name : `${x.name} — ${mosqueName(db, x.mosqueId)}` }))} />
        <Select value={range} onChange={setRange} placeholder="" options={RANGES} />
        <PrintBar title={`تقرير ${c.name}`} />
      </div>}>
      <div id="print-area">
        <ReportHeader title="تقرير أداء لجنة" subtitle={`${c.name} — ${mosqueName(db, c.mosqueId)}`}
          period={`${fmtDate(from)} — ${fmtDate(to)}`} />

        <div className="mt-5 grid sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-line p-5 flex flex-col items-center">
            <Donut value={pct} tone={pct >= 70 ? C.olive : pct >= 50 ? C.gold : C.rose} sub="نسبة الإنجاز" />
            <span className={`chip mt-3 ${grade.tone === 'ok' ? 'bg-navy-100 text-navy-800' : grade.tone === 'warn' ? 'bg-orange-100 text-orange-700' : 'bg-orange-100 text-orange-700'}`}>
              تقييم الأداء: {grade.t}
            </span>
          </div>
          <div className="sm:col-span-2">
            <p className="text-[13px] text-ink-700 leading-7">{c.goal}</p>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <Stat label="إجمالي البنود" value={tc.total} tone="brand" />
              <Stat label="منجزة" value={tc.done} tone="olive" />
              <Stat label="متعثرة" value={tc.stuck} tone={tc.stuck ? 'rose' : 'slate'} />
              <Stat label="مؤجلة" value={tc.postponed} tone="gold" />
            </div>
            <div className="mt-4">
              <SplitBar parts={[
                { label: 'منجز', value: tc.done, color: C.done },
                { label: 'قيد التنفيذ', value: tc.pending, color: C.pending },
                { label: 'متعثر', value: tc.stuck, color: C.stuck },
                { label: 'مؤجل', value: tc.postponed, color: C.postponed },
              ]} />
            </div>
          </div>
        </div>

        <section className="mt-6">
          <h4 className="font-extrabold text-[14px] mb-2">أعضاء اللجنة ({members.length})</h4>
          <div className="grid sm:grid-cols-2 gap-3">
            {members.map((m) => {
              const mt = taskCounts(tasks.filter((t) => t.assigneeId === m.id))
              const s = attendanceStats(db, m.id, from, to)
              return (
                <div key={m.id} className="rounded-xl border border-line px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[13px]">{m.id === c.leaderId ? '⭐ ' : ''}{m.name}</span>
                    <span className="text-[11.5px] font-bold text-ink-500">حضور {s.rate}%</span>
                  </div>
                  <div className="mt-2"><Progress value={mt.total ? (mt.done / mt.total) * 100 : 0} tone="olive" /></div>
                  <p className="text-[11px] text-ink-500 mt-1.5">
                    {mt.done} منجزة من {mt.total}{mt.stuck ? ` · ${mt.stuck} متعثرة` : ''}{mt.late ? ` · ${mt.late} متأخرة` : ''}
                  </p>
                </div>
              )
            })}
          </div>
        </section>

        <section className="mt-6">
          <h4 className="font-extrabold text-[14px] mb-2">بنود اللجنة</h4>
          {tasks.length === 0 ? <p className="muted">لا توجد بنود.</p> : (
            <div className="overflow-x-auto -mx-1 px-1"><table className="w-full min-w-[520px] border border-line rounded-xl overflow-hidden">
              <thead className="bg-navy-50"><tr>
                <th className="th">البند</th><th className="th">النوع</th><th className="th">المسؤول</th>
                <th className="th">الموعد</th><th className="th">الحالة</th>
              </tr></thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.id} className="row">
                    <td className="td font-bold text-[12.5px]">{t.title}</td>
                    <td className="td text-[12px]">{KIND_LABEL[t.kind]}</td>
                    <td className="td text-[12px]">{personName(db, t.assigneeId)}</td>
                    <td className="td text-[12px]">{fmtDate(t.dueDate)}</td>
                    <td className="td"><Badge tone={
                      t.status === 'done' ? 'ok' : t.status === 'stuck' ? 'bad' : t.status === 'postponed' ? 'warn' : 'info'
                    }>{STATUS_LABEL[t.status]}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </section>

        <ReportFooter by={user?.name} />
      </div>
    </Card>
  )
}

/* ================= تقرير المسجد / المجمع ================= */
function MosqueReport({ mid, isComplex }: { mid: string; isComplex: boolean }) {
  const { db } = useDb()
  const { user } = useAuth()
  const [range, setRange] = useState('30')
  const to = todayISO()
  const from = shiftDays(to, -(Number(range) - 1))

  const mosques = mid ? db.mosques.filter((m) => m.id === mid) : db.mosques

  return (
    <Card title={isComplex ? 'تقرير المجمع' : 'تقرير المسجد'}
      action={<div className="flex gap-2 items-center">
        <Select value={range} onChange={setRange} placeholder="" options={RANGES} />
        <PrintBar title="تقرير المسجد" />
      </div>}>
      <div id="print-area">
        <ReportHeader title={isComplex ? 'التقرير العام للمجمع' : 'تقرير المسجد'}
          subtitle={mid ? mosqueName(db, mid) : 'ثلاثة مساجد'} period={`${fmtDate(from)} — ${fmtDate(to)}`} />

        <div className="space-y-6 mt-5">
          {mosques.map((m) => {
            const staff = staffOf(db, m.id)
            const tasks = db.tasks.filter((t) => t.mosqueId === m.id)
            const tc = taskCounts(tasks)
            const teachers = db.teachers.filter((t) => t.mosqueId === m.id && t.active)
            const tAtt = db.teacherAttendance.filter((t) => t.mosqueId === m.id && t.date >= from)
            const rate = staff.length
              ? Math.round(staff.reduce((s, p) => s + attendanceStats(db, p.id, from, to).rate, 0) / staff.length) : 0
            const tRate = tAtt.length
              ? Math.round((tAtt.filter((t) => t.status === 'present').length / tAtt.length) * 100) : 0

            return (
              <div key={m.id} className="rounded-2xl border border-line p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
                  <h3 className="font-display font-extrabold text-[17px]">{m.name}</h3>
                  <span className="text-[12px] text-ink-500 font-bold">
                    المشرف: {personName(db, m.supervisorId)}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
                  <Stat label="فريق العمل" value={staff.length} />
                  <Stat label="المعلمون" value={teachers.length} />
                  <Stat label="حضور الفريق" value={`${rate}%`} tone={rate >= 85 ? 'olive' : rate >= 70 ? 'gold' : 'rose'} />
                  <Stat label="حضور المعلمين" value={`${tRate}%`} tone={tRate >= 85 ? 'olive' : tRate >= 70 ? 'gold' : 'rose'} />
                  <Stat label="إنجاز المهام" value={`${tc.total ? Math.round((tc.done / tc.total) * 100) : 0}%`} tone="brand" />
                </div>

                <div className="grid sm:grid-cols-2 gap-5 mt-5">
                  <div>
                    <h5 className="font-bold text-[12.5px] mb-2">حالة البنود</h5>
                    <SplitBar parts={[
                      { label: 'منجز', value: tc.done, color: C.done },
                      { label: 'قيد التنفيذ', value: tc.pending, color: C.pending },
                      { label: 'متعثر', value: tc.stuck, color: C.stuck },
                      { label: 'مؤجل', value: tc.postponed, color: C.postponed },
                    ]} />
                  </div>
                  <div>
                    <h5 className="font-bold text-[12.5px] mb-2">أداء اللجان</h5>
                    <div className="space-y-2">
                      {committeesOf(db, m.id).map((c) => {
                        const ct = taskCounts(tasks.filter((t) => t.committeeId === c.id))
                        const p = ct.total ? (ct.done / ct.total) * 100 : 0
                        return (
                          <div key={c.id}>
                            <div className="flex justify-between text-[11.5px] font-bold">
                              <span>{c.name}</span><span className="tabular-nums">{Math.round(p)}%</span>
                            </div>
                            <Progress value={p} tone={p >= 70 ? 'olive' : p >= 50 ? 'gold' : 'rose'} />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <ReportFooter by={user?.name} />
      </div>
    </Card>
  )
}

/* ================= التقارير الدورية المرفوعة ================= */
function Uploads({ mid, isComplex }: { mid: string; isComplex: boolean }) {
  const { db, set } = useDb()
  const { user, isDirector } = useAuth()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<PeriodReport | null>(null)

  const list = (mid ? db.reports.filter((r) => r.mosqueId === mid) : db.reports)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return (
    <div className="space-y-5">
      <Card title="التقارير الأسبوعية والشهرية"
        subtitle="ترفع كل لجنة أو مسجد تقريرها مدعومًا بالشواهد والملفات"
        action={<button className="btn-primary btn-sm" onClick={() => setOpen(true)}>＋ رفع تقرير</button>}
        pad={false}>
        {list.length === 0 ? (
          <Empty icon="📤" title="لا توجد تقارير مرفوعة"
            hint="ارفع تقريرك الأسبوعي أو الشهري مع صور أو ملفات الشواهد."
            action={<button className="btn-primary btn-sm" onClick={() => setOpen(true)}>＋ رفع تقرير</button>} />
        ) : (
          <ul className="divide-y divide-line">
            {list.map((r) => (
              <li key={r.id} className="px-5 py-4 flex flex-wrap items-start gap-3">
                <span className="w-11 h-11 shrink-0 rounded-2xl bg-navy-100 text-navy-700 grid place-items-center text-lg">📄</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-extrabold text-[14.5px]">{r.title}</h4>
                    <Badge tone={r.period === 'weekly' ? 'info' : 'purple'}>
                      {r.period === 'weekly' ? 'أسبوعي' : 'شهري'}
                    </Badge>
                    {r.committeeId && <Badge tone="ok">{committeeName(db, r.committeeId)}</Badge>}
                    {!mid && <Badge tone="mute">{mosqueName(db, r.mosqueId)}</Badge>}
                  </div>
                  <p className="text-[12.5px] text-ink-700 mt-1.5 leading-7 line-clamp-2 whitespace-pre-wrap">{r.summary}</p>
                  <p className="text-[11px] text-ink-500 mt-1.5">{personName(db, r.createdBy)} · {fmtDate(r.createdAt)}</p>
                  <FileChips files={r.files} />
                </div>
                <div className="flex gap-1.5 no-print">
                  <button className="btn-ghost btn-sm" onClick={() => setView(r)}>عرض وطباعة</button>
                  {(isDirector || r.createdBy === user?.id) && (
                    <Menu items={[{
                      label: 'حذف التقرير', icon: '🗑', danger: true,
                      onClick: () => {
                        if (!confirm('حذف التقرير؟')) return
                        set((d) => { d.reports = d.reports.filter((x) => x.id !== r.id) })
                        toast('تم الحذف', 'info')
                      },
                    }]} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <UploadModal open={open} onClose={() => setOpen(false)}
        mosqueId={mid || (user!.mosqueId === 'complex' ? db.mosques[0].id : user!.mosqueId as string)}
        allowMosquePick={!mid} />
      {view && <ViewUpload report={view} onClose={() => setView(null)} />}
    </div>
  )
}

function UploadModal({ open, onClose, mosqueId, allowMosquePick }: {
  open: boolean; onClose: () => void; mosqueId: string; allowMosquePick?: boolean
}) {
  const { db, set } = useDb()
  const { user } = useAuth()
  const toast = useToast()
  const [f, setF] = useState<any>({})
  const [key, setKey] = useState('')
  if (key !== String(open)) {
    setKey(String(open))
    setF({ mosqueId, committeeId: '', period: 'weekly', title: '', summary: '', files: [] as UploadedFile[] })
  }

  const save = () => {
    if (!f.title?.trim()) return toast('اكتب عنوان التقرير.', 'bad')
    set((d) => d.reports.push({
      id: uid('r'), mosqueId: f.mosqueId, committeeId: f.committeeId || undefined,
      period: f.period, title: f.title.trim(), summary: f.summary,
      files: f.files, createdBy: user!.id, createdAt: todayISO(),
    }))
    toast('تم رفع التقرير')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="رفع تقرير دوري" wide
      footer={<><button className="btn-primary" onClick={save}>رفع التقرير</button>
        <button className="btn-ghost" onClick={onClose}>إلغاء</button></>}>
      <div className="space-y-4">
        <div className="grid sm:grid-cols-3 gap-4">
          {allowMosquePick && (
            <Field label="المسجد" required>
              <Select value={f.mosqueId ?? ''} onChange={(v) => setF({ ...f, mosqueId: v, committeeId: '' })}
                options={db.mosques.map((m) => ({ value: m.id, label: m.name }))} />
            </Field>
          )}
          <Field label="اللجنة (اختياري)">
            <Select value={f.committeeId ?? ''} onChange={(v) => setF({ ...f, committeeId: v })} placeholder="تقرير المسجد"
              options={committeesOf(db, f.mosqueId).map((c) => ({ value: c.id, label: c.name }))} />
          </Field>
          <Field label="الدورية" required>
            <Select value={f.period ?? 'weekly'} onChange={(v) => setF({ ...f, period: v })} placeholder=""
              options={[{ value: 'weekly', label: 'أسبوعي' }, { value: 'monthly', label: 'شهري' }]} />
          </Field>
        </div>
        <Field label="عنوان التقرير" required>
          <input className="field" value={f.title ?? ''} onChange={(e) => setF({ ...f, title: e.target.value })}
            placeholder="مثال: التقرير الأسبوعي للجنة التعليمية" autoFocus />
        </Field>
        <AiTextArea label="ملخص التقرير" value={f.summary ?? ''} onChange={(v) => setF({ ...f, summary: v })}
          kind="report" rows={6} placeholder="أبرز ما تم إنجازه، المعوقات، المقترحات…" />
        <Field label="الشواهد والملفات" hint="صور أو ملفات PDF / Word / Excel">
          <FileDrop onFiles={(fs) => setF({ ...f, files: [...(f.files ?? []), ...fs] })} />
          <FileChips files={f.files ?? []} onRemove={(i) => setF({ ...f, files: f.files.filter((_: any, x: number) => x !== i) })} />
        </Field>
      </div>
    </Modal>
  )
}

function ViewUpload({ report, onClose }: { report: PeriodReport; onClose: () => void }) {
  const { db } = useDb()
  return (
    <Modal open onClose={onClose} title="التقرير الدوري" wide>
      <PrintBar title={report.title} />
      <div id="print-area" className="mt-4">
        <div className="border border-line rounded-2xl p-6">
          <ReportHeader title={report.period === 'weekly' ? 'تقرير أسبوعي' : 'تقرير شهري'}
            subtitle={report.committeeId ? committeeName(db, report.committeeId) : mosqueName(db, report.mosqueId)} />
          <h2 className="font-display font-black text-xl mt-5">{report.title}</h2>
          <p className="text-[11.5px] text-ink-500 mt-1">
            {mosqueName(db, report.mosqueId)}
            {report.committeeId && ` · ${committeeName(db, report.committeeId)}`}
            {' · '}{personName(db, report.createdBy)} · {fmtDate(report.createdAt)}
          </p>
          <p className="text-[13px] leading-8 whitespace-pre-wrap text-ink-700 mt-4">{report.summary}</p>

          {report.files.length > 0 && (
            <section className="mt-6">
              <h4 className="font-extrabold text-[14px] mb-3">الشواهد المرفقة ({report.files.length})</h4>
              <div className="grid sm:grid-cols-3 gap-3">
                {report.files.map((f, i) => (
                  <div key={i} className="rounded-xl border border-line overflow-hidden">
                    {f.type.startsWith('image/')
                      ? <img src={f.dataUrl} alt={f.name} className="w-full h-36 object-cover" />
                      : <div className="h-36 grid place-items-center bg-navy-50 text-3xl">📄</div>}
                    <p className="text-[11px] font-bold p-2 truncate">{f.name}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
          <ReportFooter by={personName(db, report.createdBy)} />
        </div>
      </div>
    </Modal>
  )
}
