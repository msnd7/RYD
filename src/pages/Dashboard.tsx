import { Link, useParams } from 'react-router-dom'
import { useDb } from '../store/db'
import { useAuth } from '../store/auth'
import { Card, Stat, Progress, Badge, Empty } from '../components/ui'
import { ActionInbox } from '../components/ActionInbox'
import { BarChart, Donut, SplitBar, C } from '../components/charts'
import { todayISO, shiftDays, fmtDate, dueLabel } from '../lib/date'
import {
  staffOf, committeesOf, tasksOf, taskCounts, attendanceStats,
  personName, committeeName, lastNDays, attendanceByDay, visibleAnnouncements,
} from '../lib/selectors'

export default function Dashboard() {
  const { mid = '' } = useParams()
  const { db } = useDb()
  const { user, isDirector } = useAuth()
  const today = todayISO()
  const from = shiftDays(today, -29)

  const mosque = db.mosques.find((m) => m.id === mid)!
  const staff = staffOf(db, mid)
  const tasks = tasksOf(db, mid)
  const tc = taskCounts(tasks)
  const teachers = db.teachers.filter((t) => t.mosqueId === mid && t.active)

  const days = lastNDays(14)
  const attRows = db.attendance.filter((a) => a.mosqueId === mid && a.date >= days[0])
  const byDay = attendanceByDay(attRows, days)

  const rate = staff.length
    ? Math.round(staff.reduce((s, p) => s + attendanceStats(db, p.id, from, today).rate, 0) / staff.length)
    : 0

  const todayAtt = db.attendance.filter((a) => a.mosqueId === mid && a.date === today)
  const presentToday = todayAtt.filter((a) => a.status === 'present').length
  const notCheckedIn = staff.filter((p) => !todayAtt.some((a) => a.personId === p.id))

  const upcoming = tasks
    .filter((t) => t.status !== 'done')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 6)

  const anns = user ? visibleAnnouncements(db, user).filter(
    (a) => a.target === 'all' || (a.target === 'mosque' && a.targetId === mid)).slice(0, 3) : []

  const teacherToday = db.teacherAttendance.filter((t) => t.mosqueId === mid && t.date === today)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat tone="brand" label="حضور اليوم" value={`${presentToday}/${staff.length}`}
          hint={notCheckedIn.length ? `${notCheckedIn.length} لم يحضّروا بعد` : 'اكتمل الحضور'} />
        <Stat tone="olive" label="نسبة الحضور (٣٠ يومًا)" value={staff.length ? `${rate}%` : '—'} hint="لفريق العمل" />
        <Stat tone={tc.total - tc.done > 0 ? 'gold' : 'slate'} label="مهام مفتوحة"
          value={tc.total - tc.done} hint={tc.late ? `${tc.late} متأخرة` : 'لا توجد متأخرات'} />
        <Stat tone={tc.stuck ? 'rose' : 'slate'} label="مهام متعثرة" value={tc.stuck} hint="تحتاج تدخّلًا" />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <Card title="حركة الحضور — آخر ١٤ يومًا" className="lg:col-span-2"
          action={<Link to={`../attendance`} className="btn-ghost btn-sm">فتح التحضير</Link>}>
          {attRows.length === 0 ? (
            <Empty icon="📍" title="لا توجد سجلات حضور بعد"
              hint="يبدأ الرسم البياني بالظهور فور تسجيل أول حضور في المسجد." />
          ) : (<>
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
              { label: 'حاضر', value: attRows.filter((a) => a.status === 'present').length, color: C.present },
              { label: 'مستأذن', value: attRows.filter((a) => a.status === 'excused').length, color: C.excused },
              { label: 'غائب', value: attRows.filter((a) => a.status === 'absent').length, color: C.absent },
            ]} />
          </div></>)}
        </Card>

        <Card title="حالة المهام">
          <div className="flex flex-col items-center">
            <Donut value={tc.total ? Math.round((tc.done / tc.total) * 100) : 0}
              tone={C.olive} sub={`${tc.done} من ${tc.total}`} />
            <div className="w-full mt-4 space-y-2">
              {[
                ['منجزة', tc.done, C.done],
                ['قيد التنفيذ', tc.pending, C.pending],
                ['متعثرة', tc.stuck, C.stuck],
                ['مؤجلة', tc.postponed, C.postponed],
              ].map(([l, v, c]) => (
                <div key={l as string} className="flex items-center gap-2.5">
                  <i className="w-2.5 h-2.5 rounded-sm" style={{ background: c as string }} />
                  <span className="text-[13px] font-bold flex-1">{l as string}</span>
                  <span className="text-[13px] font-black tabular-nums">{v as number}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <Card title="أقرب المواعيد" subtitle="مهام وقرارات وتوصيات" pad={false}
          action={<Link to="../tasks" className="btn-ghost btn-sm">الكل</Link>}>
          {upcoming.length === 0 ? <Empty icon="✅" title="لا توجد بنود مفتوحة" /> : (
            <ul className="divide-y divide-line">
              {upcoming.map((t) => {
                const d = dueLabel(t.dueDate)
                return (
                  <li key={t.id} className="px-5 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-bold text-[13.5px] leading-6">{t.title}</span>
                      <Badge tone={d.tone === 'bad' ? 'bad' : d.tone === 'warn' ? 'warn' : 'mute'}>{d.text}</Badge>
                    </div>
                    <p className="text-[11px] text-ink-500 mt-1">
                      {committeeName(db, t.committeeId)} · {personName(db, t.assigneeId)} · {fmtDate(t.dueDate)}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <Card title="اللجان" pad={false} action={<Link to="../committees" className="btn-ghost btn-sm">إدارة</Link>}>
          <ul className="divide-y divide-line">
            {committeesOf(db, mid).map((c) => {
              const ct = taskCounts(tasks.filter((t) => t.committeeId === c.id))
              const members = db.people.filter((p) => p.committeeIds.includes(c.id) && p.active).length
              return (
                <li key={c.id} className="px-5 py-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-[13.5px]">{c.name}</span>
                    <span className="text-[11px] font-bold text-ink-500">{members} أعضاء</span>
                  </div>
                  <div className="mt-2"><Progress value={ct.total ? (ct.done / ct.total) * 100 : 0} tone="olive" /></div>
                  <div className="flex gap-1.5 mt-2">
                    <Badge tone="ok">{ct.done} منجز</Badge>
                    {ct.stuck > 0 && <Badge tone="bad">{ct.stuck} متعثر</Badge>}
                    {ct.postponed > 0 && <Badge tone="warn">{ct.postponed} مؤجل</Badge>}
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>

        <div className="space-y-5">
          <Card title="المعلمون اليوم" action={<Link to="../teachers" className="btn-ghost btn-sm">التحضير</Link>}>
            {teacherToday.length === 0 ? (
              <Empty icon="📚" title="لم يُسجّل حضور المعلمين اليوم"
                hint={`${teachers.length} معلمًا بانتظار التحضير`} />
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                <Stat label="حاضر" value={teacherToday.filter((t) => t.status === 'present').length} tone="olive" />
                <Stat label="غائب" value={teacherToday.filter((t) => t.status === 'absent').length} tone={teacherToday.some((t) => t.status === 'absent') ? 'rose' : 'slate'} />
                <Stat label="متأخر" value={teacherToday.filter((t) => t.status === 'late').length} />
                <Stat label="مستأذن" value={teacherToday.filter((t) => t.status === 'excused').length} />
              </div>
            )}
          </Card>

          <Card title="آخر الإعلانات" pad={false} action={<Link to="../announcements" className="btn-ghost btn-sm">الكل</Link>}>
            {anns.length === 0 ? <Empty icon="📣" title="لا توجد إعلانات" /> : (
              <ul className="divide-y divide-line">
                {anns.map((a) => (
                  <li key={a.id} className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      {a.pinned && <span className="text-orange-500">📌</span>}
                      <span className="font-bold text-[13.5px]">{a.title}</span>
                    </div>
                    <p className="text-[12px] text-ink-500 mt-1 line-clamp-2 leading-6">{a.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <ActionInbox mosqueId={mid} />
    </div>
  )
}
