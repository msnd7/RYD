import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useDb } from '../store/db'
import { Card, Select } from '../components/ui'
import { PageHeader } from '../components/PageHeader'
import { TrendChart, HBars, SplitBar, C } from '../components/charts'
import { Seg, fmtScore } from '../components/honors'
import { IconDownload, IconTrophy } from '../components/icons'
import { custodyBalance } from '../lib/selectors'
import { money } from '../lib/format'
import { todayISO } from '../lib/date'
import {
  periodOf, PERIOD_OPTIONS, scorePeople, scoreCommittees, scoreTeachers, weeklyTrend,
  tasksInPeriod, taskMetrics, competitors, toCsv, downloadText, type PeriodKey,
} from '../lib/excellence'

type Tab = 'people' | 'committees' | 'teachers'
type SortDir = 1 | -1

/**
 * لوحة البيانات — كل الأرقام في مكان واحد:
 * مؤشرات الفريق والحضور والمهام والمعلمين والمالية للفترة المختارة،
 * واتجاه الأداء أسبوعيًا، ومقارنة المساجد، وجداول تفصيلية قابلة للترتيب والتصدير.
 */
export default function Insights({ scope = 'mosque' }: { scope?: 'complex' | 'mosque' }) {
  const { db } = useDb()
  const { mid = '' } = useParams()
  const [pk, setPk] = useState<PeriodKey>('month')
  const [pick, setPick] = useState('all')
  const [tab, setTab] = useState<Tab>('people')
  const [sort, setSort] = useState<{ key: string; dir: SortDir }>({ key: 'score', dir: -1 })

  const mosqueId = scope === 'complex' ? pick : mid
  const p = periodOf(pk)
  const inMosque = (id: string) => mosqueId === 'all' || id === mosqueId
  const mosque = db.mosques.find((m) => m.id === mosqueId)

  const d = useMemo(() => {
    const people = scorePeople(db, p, mosqueId)
    const committees = scoreCommittees(db, p, mosqueId)
    const teachers = scoreTeachers(db, p, mosqueId)
    const staff = competitors(db, mosqueId)
    const ids = new Set(staff.map((s) => s.id))

    const att = db.attendance.filter((a) => ids.has(a.personId) && a.date >= p.from && a.date <= p.to)
    const present = att.filter((a) => a.status === 'present').length
    const absent = att.filter((a) => a.status === 'absent').length
    const excused = att.filter((a) => a.status === 'excused').length

    const tasks = tasksInPeriod(db.tasks.filter((t) => inMosque(t.mosqueId)), p)
    const tm = taskMetrics(tasks)
    const allOpen = db.tasks.filter((t) => inMosque(t.mosqueId) && t.status !== 'done')

    const tAtt = db.teacherAttendance.filter((a) => inMosque(a.mosqueId) && a.date >= p.from && a.date <= p.to)
    const tPresent = tAtt.filter((a) => a.status === 'present').length
    const tLate = tAtt.filter((a) => a.status === 'late').length
    const tAbsent = tAtt.filter((a) => a.status === 'absent').length
    const tExcused = tAtt.filter((a) => a.status === 'excused').length
    const students = db.teachers.filter((t) => t.active && inMosque(t.mosqueId)).reduce((s, t) => s + (t.studentsCount || 0), 0)

    const leaves = db.leaves.filter((l) => inMosque(l.mosqueId) && l.date >= p.from && l.date <= p.to)
    const custodies = db.custodies.filter((c) => inMosque(c.mosqueId))
    const openCust = custodies.filter((c) => c.status === 'approved')
    const spentInPeriod = custodies.reduce((s, c) =>
      s + c.expenses.filter((e) => e.date >= p.from && e.date <= p.to).reduce((x, e) => x + e.amount, 0), 0)
    const meetings = db.meetings.filter((m) => m.mosqueId !== 'complex' && inMosque(m.mosqueId as string) && m.date >= p.from && m.date <= p.to)

    const rate = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)
    return {
      people, committees, teachers, staff,
      present, absent, excused, attTotal: att.length, attRate: rate(present, att.length),
      tm, allOpen: allOpen.length, allLate: allOpen.filter((t) => t.dueDate < todayISO()).length,
      byKind: {
        task: tasks.filter((t) => t.kind === 'task').length,
        decision: tasks.filter((t) => t.kind === 'decision').length,
        recommendation: tasks.filter((t) => t.kind === 'recommendation').length,
      },
      pending: tasks.filter((t) => t.status === 'pending').length,
      postponed: tasks.filter((t) => t.status === 'postponed').length,
      tPresent, tLate, tAbsent, tExcused, tTotal: tAtt.length, tRate: rate(tPresent + tLate, tAtt.length),
      students,
      leaves: leaves.length, leavesPending: leaves.filter((l) => l.status === 'pending').length,
      openCust: openCust.length,
      openCustBalance: openCust.reduce((s, c) => s + custodyBalance(c).remaining, 0),
      spentInPeriod, meetings: meetings.length,
      reports: db.reports.filter((r) => inMosque(r.mosqueId) && r.createdAt.slice(0, 10) >= p.from && r.createdAt.slice(0, 10) <= p.to).length,
      trend: weeklyTrend(db, mosqueId, 8),
    }
  }, [db, mosqueId, p.from, p.to])

  const byMosque = useMemo(() => {
    if (mosqueId !== 'all') return []
    return db.mosques.map((m) => {
      const ppl = scorePeople(db, p, m.id).filter((r) => r.att.total || r.tasks.total)
      const tasks = taskMetrics(tasksInPeriod(db.tasks.filter((t) => t.mosqueId === m.id), p))
      const att = ppl.reduce((s, r) => ({ pr: s.pr + r.att.present, t: s.t + r.att.total }), { pr: 0, t: 0 })
      const score = ppl.length ? Math.round(ppl.reduce((s, r) => s + r.score, 0) / ppl.length) : 0
      return { label: m.name, values: [att.t ? Math.round((att.pr / att.t) * 100) : 0, tasks.rate, score] }
    })
  }, [db, mosqueId, p.from, p.to])

  const mName = (id: string) => db.mosques.find((m) => m.id === id)?.shortName ?? ''
  const cName = (ids: string[]) => ids.map((id) => db.committees.find((c) => c.id === id)?.name).filter(Boolean).join('، ') || '—'

  /* ---------- الجداول ---------- */
  type Col = { key: string; label: string; get: (r: any) => string | number; fmt?: (r: any) => string; wide?: boolean }
  const cols: Col[] = tab === 'people' ? [
    { key: 'name', label: 'الاسم', get: (r) => r.person.name, wide: true },
    ...(mosqueId === 'all' ? [{ key: 'mosque', label: 'المسجد', get: (r: any) => mName(r.mosqueId) }] : []),
    { key: 'committee', label: 'اللجنة', get: (r) => cName(r.committeeIds) },
    { key: 'present', label: 'حضور', get: (r) => r.att.present },
    { key: 'absent', label: 'غياب', get: (r) => r.att.absent },
    { key: 'excused', label: 'استئذان', get: (r) => r.att.excused },
    { key: 'attRate', label: 'نسبة الحضور', get: (r) => r.att.rate, fmt: (r) => r.att.total ? `${r.att.rate}%` : '—' },
    { key: 'tasks', label: 'المهام', get: (r) => r.tasks.total },
    { key: 'done', label: 'منجزة', get: (r) => r.tasks.done },
    { key: 'late', label: 'متأخرة', get: (r) => r.tasks.late },
    { key: 'taskRate', label: 'الإنجاز', get: (r) => r.tasks.rate, fmt: (r) => r.tasks.total ? `${r.tasks.rate}%` : '—' },
    { key: 'onTime', label: 'بالموعد', get: (r) => r.tasks.onTimeRate, fmt: (r) => r.tasks.done ? `${r.tasks.onTimeRate}%` : '—' },
    { key: 'score', label: 'الدرجة', get: (r) => r.score, fmt: (r) => fmtScore(r.score) },
  ] : tab === 'committees' ? [
    { key: 'name', label: 'اللجنة', get: (r) => r.committee.name, wide: true },
    ...(mosqueId === 'all' ? [{ key: 'mosque', label: 'المسجد', get: (r: any) => mName(r.mosqueId) }] : []),
    { key: 'leader', label: 'القائد', get: (r) => db.people.find((x) => x.id === r.committee.leaderId)?.name ?? '—' },
    { key: 'members', label: 'الأعضاء', get: (r) => r.members.length },
    { key: 'present', label: 'حضور', get: (r) => r.att.present },
    { key: 'absent', label: 'غياب', get: (r) => r.att.absent },
    { key: 'attRate', label: 'نسبة الحضور', get: (r) => r.att.rate, fmt: (r) => r.att.total ? `${r.att.rate}%` : '—' },
    { key: 'tasks', label: 'المهام', get: (r) => r.tasks.total },
    { key: 'done', label: 'منجزة', get: (r) => r.tasks.done },
    { key: 'stuck', label: 'متعثرة', get: (r) => r.tasks.stuck },
    { key: 'late', label: 'متأخرة', get: (r) => r.tasks.late },
    { key: 'taskRate', label: 'الإنجاز', get: (r) => r.tasks.rate, fmt: (r) => r.tasks.total ? `${r.tasks.rate}%` : '—' },
    { key: 'score', label: 'الدرجة', get: (r) => r.score, fmt: (r) => fmtScore(r.score) },
  ] : [
    { key: 'name', label: 'المعلم', get: (r) => r.teacher.name, wide: true },
    ...(mosqueId === 'all' ? [{ key: 'mosque', label: 'المسجد', get: (r: any) => mName(r.teacher.mosqueId) }] : []),
    { key: 'circle', label: 'الحلقة', get: (r) => r.teacher.circle || '—' },
    { key: 'students', label: 'الطلاب', get: (r) => r.teacher.studentsCount || 0 },
    { key: 'present', label: 'حضور', get: (r) => r.present },
    { key: 'late', label: 'تأخير', get: (r) => r.late },
    { key: 'absent', label: 'غياب', get: (r) => r.absent },
    { key: 'excused', label: 'استئذان', get: (r) => r.excused },
    { key: 'rate', label: 'نسبة الحضور', get: (r) => r.rate, fmt: (r) => r.total ? `${r.rate}%` : '—' },
    { key: 'score', label: 'الانضباط', get: (r) => r.punctual, fmt: (r) => r.total ? `${r.punctual}%` : '—' },
  ]

  const rawRows: any[] = tab === 'people' ? d.people : tab === 'committees' ? d.committees : d.teachers
  const sortCol = cols.find((c) => c.key === sort.key) ?? cols[cols.length - 1]
  const rows = [...rawRows].sort((a, b) => {
    const x = sortCol.get(a), y = sortCol.get(b)
    return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'ar')) * sort.dir
  })

  const exportCsv = () => {
    const name = { people: 'الأفراد', committees: 'اللجان', teachers: 'المعلمون' }[tab]
    downloadText(`لوحة-البيانات-${name}-${p.from}_${p.to}.csv`,
      toCsv(cols.map((c) => c.label), rows.map((r) => cols.map((c) => (c.fmt ? c.fmt(r) : c.get(r))))))
  }

  const n = (v: number) => v.toLocaleString('en-US')

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={scope === 'complex' ? 'التحفيز والأداء · المجمع' : `التحفيز والأداء · ${mosque?.name ?? ''}`}
        title="لوحة البيانات"
        description="كل أرقام الفريق والحضور والمهام والمعلمين والمالية للفترة التي تختارها، مع جداول تفصيلية قابلة للترتيب والتصدير."
        actions={<>
          <Link to={scope === 'complex' ? '/complex/excellence' : `/m/${mid}/excellence`} className="btn-ghost btn-sm !h-10">
            <IconTrophy className="w-4 h-4" /> لوحة الشرف
          </Link>
          <button onClick={exportCsv} className="btn-primary btn-sm !h-10"><IconDownload className="w-4 h-4" /> تصدير Excel</button>
        </>}
      />

      {/* شريط التصفية */}
      <div className="card px-3 sm:px-4 py-3 flex flex-wrap items-center gap-2.5">
        <Seg value={pk} onChange={setPk} items={PERIOD_OPTIONS} className="max-w-full overflow-x-auto" />
        {scope === 'complex' && (
          <Select value={pick === 'all' ? '' : pick} onChange={(v) => setPick(v || 'all')} placeholder="كل المساجد"
            className="!h-10 !w-auto min-w-[170px] !text-[13px]"
            options={db.mosques.map((m) => ({ value: m.id, label: m.name }))} />
        )}
        <span className="text-[11.5px] font-bold text-ink-400 mr-auto">{p.range}</span>
      </div>

      {/* المؤشرات */}
      <KpiGroup title="الفريق والحضور" items={[
        { k: 'الإداريون النشطون', v: n(d.staff.length), h: `${d.committees.length} لجنة` },
        { k: 'متوسط الحضور', v: d.attTotal ? `${d.attRate}%` : '—', h: `${n(d.attTotal)} سجل حضور`, strong: true },
        { k: 'أيام الحضور', v: n(d.present) },
        { k: 'أيام الغياب', v: n(d.absent), alert: d.absent > 0 },
        { k: 'الاستئذانات', v: n(d.excused), h: `${d.leaves} طلب · ${d.leavesPending} معلّق` },
        { k: 'المؤهلون للمنافسة', v: n(d.people.filter((r) => r.qualified).length), h: 'على لقب الفارس' },
      ]} />

      <KpiGroup title="المهام والإنجاز" items={[
        { k: 'مهام الفترة', v: n(d.tm.total), h: `${d.byKind.task} مهمة · ${d.byKind.decision} قرار · ${d.byKind.recommendation} توصية` },
        { k: 'المنجزة', v: n(d.tm.done) },
        { k: 'نسبة الإنجاز', v: d.tm.total ? `${d.tm.rate}%` : '—', strong: true },
        { k: 'الإنجاز في الموعد', v: d.tm.done ? `${d.tm.onTimeRate}%` : '—', h: `${d.tm.onTime} من ${d.tm.done}` },
        { k: 'متعثرة', v: n(d.tm.stuck), alert: d.tm.stuck > 0 },
        { k: 'مفتوحة الآن', v: n(d.allOpen), h: `${d.allLate} تجاوزت موعدها` },
      ]} />

      <KpiGroup title="المعلمون والتوثيق والمالية" items={[
        { k: 'المعلمون', v: n(d.teachers.length), h: `${n(d.students)} طالبًا` },
        { k: 'حضور المعلمين', v: d.tTotal ? `${d.tRate}%` : '—', h: `${d.tLate} تأخير · ${d.tAbsent} غياب`, strong: true },
        { k: 'محاضر الاجتماعات', v: n(d.meetings) },
        { k: 'التقارير المرفوعة', v: n(d.reports) },
        { k: 'العهد المفتوحة', v: n(d.openCust), h: `رصيدها ${money(d.openCustBalance)}` },
        { k: 'المصروف في الفترة', v: money(d.spentInPeriod) },
      ]} />

      {/* الرسوم */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2" title="اتجاه الأداء — آخر ٨ أسابيع" subtitle="نسبة الحضور ونسبة إنجاز المهام لكل أسبوع (يبدأ الأحد)">
          <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2">
            {[['نسبة الحضور', C.navy], ['نسبة الإنجاز', C.orange]].map(([l, c]) => (
              <span key={l} className="inline-flex items-center gap-1.5 text-[11px] font-bold text-ink-700">
                <i className="w-2.5 h-2.5 rounded-sm" style={{ background: c }} />{l}
              </span>
            ))}
          </div>
          <TrendChart
            series={[{ name: 'الحضور', color: C.navy }, { name: 'الإنجاز', color: C.orange }]}
            points={d.trend.map((w) => ({
              label: w.label,
              hint: `أسبوع ${w.label} · ${w.attTotal} سجل · ${w.taskTotal} مهمة`,
              values: [w.attTotal ? w.attRate : null, w.taskTotal ? w.taskRate : null],
            }))} />
        </Card>

        <Card title="التوزيع في الفترة">
          <p className="text-[12px] font-bold text-ink-500 mb-2">سجلات حضور الفريق</p>
          <SplitBar parts={[
            { label: 'حاضر', value: d.present, color: C.present },
            { label: 'مستأذن', value: d.excused, color: C.excused },
            { label: 'غائب', value: d.absent, color: C.absent },
          ]} />
          <hr className="my-4 border-line/70" />
          <p className="text-[12px] font-bold text-ink-500 mb-2">حالة مهام الفترة</p>
          <SplitBar parts={[
            { label: 'منجز', value: d.tm.done, color: C.done },
            { label: 'قيد التنفيذ', value: d.pending, color: C.pending },
            { label: 'متعثر', value: d.tm.stuck, color: C.stuck },
            { label: 'مؤجل', value: d.postponed, color: C.postponed },
          ]} />
          <hr className="my-4 border-line/70" />
          <p className="text-[12px] font-bold text-ink-500 mb-2">حضور المعلمين</p>
          <SplitBar parts={[
            { label: 'حاضر', value: d.tPresent, color: C.present },
            { label: 'متأخر', value: d.tLate, color: C.navySoft },
            { label: 'مستأذن', value: d.tExcused, color: C.excused },
            { label: 'غائب', value: d.tAbsent, color: C.absent },
          ]} />
        </Card>
      </div>

      {byMosque.length > 0 && (
        <Card title="مقارنة المساجد" subtitle={`${p.label} · الحضور والإنجاز ومتوسط درجة التميّز`}>
          <div className="grid md:grid-cols-[1fr] gap-4">
            <HBars rows={byMosque} series={[
              { name: 'نسبة الحضور', color: C.navy },
              { name: 'نسبة الإنجاز', color: C.orange },
              { name: 'متوسط الدرجة', color: C.navySoft },
            ]} />
          </div>
        </Card>
      )}

      {/* الجداول التفصيلية */}
      <Card pad={false} title="البيانات التفصيلية" subtitle="اضغط عنوان أي عمود للترتيب حسبه"
        action={<>
          <Seg value={tab} onChange={(v) => { setTab(v); setSort({ key: 'score', dir: -1 }) }} items={[
            { value: 'people', label: `الأفراد (${d.people.length})` },
            { value: 'committees', label: `اللجان (${d.committees.length})` },
            { value: 'teachers', label: `المعلمون (${d.teachers.length})` },
          ]} />
          <button onClick={exportCsv} className="btn-ghost btn-sm"><IconDownload className="w-4 h-4" /> تصدير</button>
        </>}>
        {rows.length === 0 ? (
          <p className="text-center text-[12.5px] font-bold text-ink-400 py-12">لا توجد بيانات بعد.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-navy-50/70 sticky top-0">
                <tr>
                  <th className="th w-10">#</th>
                  {cols.map((c) => (
                    <th key={c.key} className="th">
                      <button className={`inline-flex items-center gap-1 hover:text-navy-800 transition ${sort.key === c.key ? 'text-navy-800' : ''}`}
                        onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? (s.dir === 1 ? -1 : 1) : c.wide ? 1 : -1 }))}>
                        {c.label}
                        <span className={`text-[9px] ${sort.key === c.key ? 'opacity-100' : 'opacity-0'}`}>{sort.dir === -1 ? '▼' : '▲'}</span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} className="row">
                    <td className="td text-ink-400 tabular-nums text-[12px]">{i + 1}</td>
                    {cols.map((c) => (
                      <td key={c.key} className={`td whitespace-nowrap ${c.wide ? 'font-bold' : 'tabular-nums text-[13px]'}
                        ${c.key === sort.key ? 'bg-navy-50/40' : ''}`}>
                        {c.fmt ? c.fmt(r) : c.get(r)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

function KpiGroup({ title, items }: {
  title: string
  items: { k: string; v: string; h?: string; alert?: boolean; strong?: boolean }[]
}) {
  return (
    <section>
      <p className="eyebrow mb-2">{title}</p>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5 sm:gap-3">
        {items.map((it) => (
          <div key={it.k} className={`kpi ${it.alert ? 'kpi-accent' : ''} ${it.strong ? '!bg-navy-700 !border-navy-700 before:!bg-orange-400' : ''}`}>
            <div className={`stat-k ${it.strong ? '!text-white/70' : ''}`}>{it.k}</div>
            <div className={`stat-v ${it.alert ? 'text-orange-700' : ''} ${it.strong ? '!text-white' : ''}
              ${it.v.length > 10 ? '!text-[17px]' : ''}`}>{it.v}</div>
            {it.h && <div className={`stat-h ${it.strong ? '!text-white/55' : ''}`}>{it.h}</div>}
          </div>
        ))}
      </div>
    </section>
  )
}
