import { Link } from 'react-router-dom'
import { useDb } from '../store/db'
import { Card, Progress, Badge, StatStrip } from '../components/ui'
import { PageHeader } from '../components/PageHeader'
import { ActionInbox } from '../components/ActionInbox'
import { BarChart, SplitBar, Donut, C } from '../components/charts'
import { todayISO, shiftDays, fmtDate } from '../lib/date'
import {
  staffOf, taskCounts, attendanceStats, lastNDays, attendanceByDay,
  committeesOf, custodyBalance, personName,
} from '../lib/selectors'

export default function ComplexDashboard() {
  const { db } = useDb()
  const today = todayISO()
  const from = shiftDays(today, -29)
  const days = lastNDays(14)

  const rows = db.mosques.map((m) => {
    const staff = staffOf(db, m.id)
    const tasks = db.tasks.filter((t) => t.mosqueId === m.id)
    const tc = taskCounts(tasks)
    const rate = staff.length
      ? Math.round(staff.reduce((s, p) => s + attendanceStats(db, p.id, from, today).rate, 0) / staff.length) : 0
    const teachers = db.teachers.filter((t) => t.mosqueId === m.id && t.active)
    const tAtt = db.teacherAttendance.filter((t) => t.mosqueId === m.id && t.date >= from)
    const tRate = tAtt.length ? Math.round((tAtt.filter((x) => x.status === 'present').length / tAtt.length) * 100) : 0
    const custody = db.custodies.filter((c) => c.mosqueId === m.id)
    const spent = custody.reduce((s, c) => s + custodyBalance(c).spent, 0)
    return { m, staff, tc, rate, teachers, tRate, spent, open: custody.filter((c) => c.status === 'approved').length }
  })

  const allAtt = db.attendance.filter((a) => a.date >= days[0])
  const byDay = attendanceByDay(allAtt, days)
  const allTc = taskCounts(db.tasks)

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="الإدارة العامة"
        title="لوحة المجمع"
        description="مقارنة المساجد الثلاثة جنبًا إلى جنب في الحضور والإنجاز والمصروف، مع ما ينتظر قرارك."
      />

      <StatStrip items={[
        { label: 'الإداريون', value: rows.reduce((s, r) => s + r.staff.length, 0) },
        { label: 'المعلمون', value: rows.reduce((s, r) => s + r.teachers.length, 0) },
        { label: 'بنود مفتوحة', value: allTc.total - allTc.done },
        { label: 'متأخرة', value: allTc.late },
        { label: 'متعثرة', value: allTc.stuck, accent: allTc.stuck > 0 },
      ]} />

      <Card title="مقارنة المساجد" subtitle="نظرة واحدة تكشف الفروق بين المساجد الثلاثة" pad={false}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-navy-50"><tr>
              <th className="th">المسجد</th><th className="th">المشرف</th>
              <th className="th">الإداريون</th><th className="th">المعلمون</th>
              <th className="th">حضور الإداريين</th><th className="th">حضور المعلمين</th>
              <th className="th">إنجاز المهام</th><th className="th">المصروف</th><th className="th no-print"></th>
            </tr></thead>
            <tbody>
              {rows.map(({ m, staff, tc, rate, teachers, tRate, spent, open }) => {
                const done = tc.total ? Math.round((tc.done / tc.total) * 100) : 0
                return (
                  <tr key={m.id} className="row">
                    <td className="td font-bold">{m.name}</td>
                    <td className="td text-[12px] text-ink-500">{personName(db, m.supervisorId)}</td>
                    <td className="td tabular-nums">{staff.length}</td>
                    <td className="td tabular-nums">{teachers.length}</td>
                    <td className="td w-32">
                      <div className="flex items-center gap-2">
                        <span className="tabular-nums font-bold text-[12px] w-9">{rate}%</span>
                        <div className="flex-1"><Progress value={rate} tone={rate >= 85 ? 'olive' : rate >= 70 ? 'gold' : 'rose'} /></div>
                      </div>
                    </td>
                    <td className="td w-32">
                      <div className="flex items-center gap-2">
                        <span className="tabular-nums font-bold text-[12px] w-9">{tRate}%</span>
                        <div className="flex-1"><Progress value={tRate} tone={tRate >= 85 ? 'olive' : tRate >= 70 ? 'gold' : 'rose'} /></div>
                      </div>
                    </td>
                    <td className="td w-32">
                      <div className="flex items-center gap-2">
                        <span className="tabular-nums font-bold text-[12px] w-9">{done}%</span>
                        <div className="flex-1"><Progress value={done} tone="brand" /></div>
                      </div>
                    </td>
                    <td className="td tabular-nums text-[12px]">
                      {spent.toLocaleString('en-US')} ر.س
                      {open > 0 && <Badge tone="warn">{open} مفتوحة</Badge>}
                    </td>
                    <td className="td no-print"><Link to={`/m/${m.id}`} className="btn-ghost btn-sm">إدارة</Link></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid lg:grid-cols-3 gap-5">
        <Card title="حضور المجمع — آخر ١٤ يومًا" className="lg:col-span-2">
          <BarChart data={byDay.map((d) => ({
            label: d.date.slice(8),
            values: [
              { key: 'حاضر', value: d.present, color: C.present },
              { key: 'مستأذن', value: d.excused, color: C.excused },
              { key: 'غائب', value: d.absent, color: C.absent },
            ],
          }))} />
          <div className="mt-3">
            <SplitBar parts={[
              { label: 'حاضر', value: allAtt.filter((a) => a.status === 'present').length, color: C.present },
              { label: 'مستأذن', value: allAtt.filter((a) => a.status === 'excused').length, color: C.excused },
              { label: 'غائب', value: allAtt.filter((a) => a.status === 'absent').length, color: C.absent },
            ]} />
          </div>
        </Card>

        <Card title="حالة البنود في المجمع">
          <div className="flex flex-col items-center">
            <Donut value={allTc.total ? Math.round((allTc.done / allTc.total) * 100) : 0}
              tone={C.olive} sub={`${allTc.done} من ${allTc.total}`} />
            <div className="w-full mt-4">
              <SplitBar parts={[
                { label: 'منجز', value: allTc.done, color: C.done },
                { label: 'قيد التنفيذ', value: allTc.pending, color: C.pending },
                { label: 'متعثر', value: allTc.stuck, color: C.stuck },
                { label: 'مؤجل', value: allTc.postponed, color: C.postponed },
              ]} />
            </div>
          </div>
        </Card>
      </div>

      <ActionInbox />
    </div>
  )
}
