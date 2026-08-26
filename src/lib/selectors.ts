import type { DB, ID, Person, Task, Attendance, Teacher } from '../types'
import { todayISO, shiftDays, daysBetween, monthKey } from './date'

export const personName = (db: DB, id?: ID) =>
  db.people.find((p) => p.id === id)?.name ?? '—'

export const committeeName = (db: DB, id?: ID) =>
  db.committees.find((c) => c.id === id)?.name ?? '—'

export const mosqueName = (db: DB, id?: ID) =>
  id === 'complex' ? 'إدارة المجمع' : db.mosques.find((m) => m.id === id)?.name ?? '—'

export const staffOf = (db: DB, mosqueId: ID) =>
  db.people.filter((p) => p.mosqueId === mosqueId && p.active)

export const committeesOf = (db: DB, mosqueId: ID) =>
  db.committees.filter((c) => c.mosqueId === mosqueId)

export const membersOf = (db: DB, committeeId: ID) =>
  db.people.filter((p) => p.committeeIds.includes(committeeId) && p.active)

export const tasksOf = (db: DB, mosqueId: ID) =>
  db.tasks.filter((t) => t.mosqueId === mosqueId)

/** إحصاءات الحضور لشخص خلال فترة */
export function attendanceStats(db: DB, personId: ID, from: string, to: string) {
  const rows = db.attendance.filter(
    (a) => a.personId === personId && a.date >= from && a.date <= to,
  )
  const present = rows.filter((r) => r.status === 'present').length
  const absent = rows.filter((r) => r.status === 'absent').length
  const excused = rows.filter((r) => r.status === 'excused').length
  const total = rows.length
  return {
    rows, present, absent, excused, total,
    rate: total ? Math.round((present / total) * 100) : 0,
  }
}

/** خصم الراتب بناءً على الغياب والاستئذان */
export function payrollFor(db: DB, person: Person, monthIso: string) {
  const mk = monthKey(monthIso)
  const rows = db.attendance.filter((a) => a.personId === person.id && a.date.startsWith(mk))
  const absent = rows.filter((r) => r.status === 'absent').length
  const excused = rows.filter((r) => r.status === 'excused').length
  const dayValue = person.salary / (db.settings.workDaysPerMonth || 26)
  const deductionDays =
    absent * db.settings.absentDeductionDays + excused * db.settings.excusedDeductionDays
  const deduction = Math.round(dayValue * deductionDays)
  return {
    absent, excused, dayValue: Math.round(dayValue), deductionDays,
    deduction, net: Math.max(0, person.salary - deduction),
  }
}

export function taskCounts(tasks: Task[]) {
  const today = todayISO()
  return {
    total: tasks.length,
    done: tasks.filter((t) => t.status === 'done').length,
    stuck: tasks.filter((t) => t.status === 'stuck').length,
    postponed: tasks.filter((t) => t.status === 'postponed').length,
    pending: tasks.filter((t) => t.status === 'pending').length,
    late: tasks.filter((t) => t.status !== 'done' && t.dueDate < today).length,
  }
}

/** المهام التي اقترب موعدها أو تأخرت — لإشعار الدخول */
export function dueSoonTasks(db: DB, user: Person) {
  const today = todayISO()
  const scope = db.tasks.filter((t) => {
    if (t.status === 'done') return false
    if (user.role === 'director') return true
    if (user.role === 'supervisor') return t.mosqueId === user.mosqueId
    return t.assigneeId === user.id
  })
  return scope
    .filter((t) => {
      const d = daysBetween(today, t.dueDate)
      return d <= (t.remindBefore ?? 2)
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}

export function visibleAnnouncements(db: DB, user: Person) {
  return db.announcements
    .filter((a) => {
      if (a.target === 'all') return true
      if (a.target === 'mosque') return user.role === 'director' || a.targetId === user.mosqueId
      if (a.target === 'committee') return user.role === 'director' || user.committeeIds.includes(a.targetId!)
      return a.targetId === user.id || user.role === 'director'
    })
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.createdAt.localeCompare(a.createdAt))
}

export function custodyBalance(c: { amount: number; expenses: { amount: number }[]; returned?: number }) {
  const spent = c.expenses.reduce((s, e) => s + e.amount, 0)
  return { spent, remaining: c.amount - spent - (c.returned ?? 0) }
}

export const lastNDays = (n: number) =>
  Array.from({ length: n }, (_, i) => shiftDays(todayISO(), -(n - 1 - i)))

export function attendanceByDay(rows: Attendance[], days: string[]) {
  return days.map((d) => {
    const r = rows.filter((a) => a.date === d)
    return {
      date: d,
      present: r.filter((x) => x.status === 'present').length,
      absent: r.filter((x) => x.status === 'absent').length,
      excused: r.filter((x) => x.status === 'excused').length,
    }
  })
}


/* ================= المعلمون ================= */

export const teachersOf = (db: DB, mosqueId: ID) =>
  db.teachers.filter((t) => t.mosqueId === mosqueId && t.active)

export const teacherName = (db: DB, id?: ID) =>
  db.teachers.find((t) => t.id === id)?.name ?? '—'

export function teacherStats(db: DB, teacherId: ID, from: string, to: string) {
  const rows = db.teacherAttendance.filter(
    (t) => t.teacherId === teacherId && t.date >= from && t.date <= to,
  )
  const present = rows.filter((r) => r.status === 'present').length
  const absent = rows.filter((r) => r.status === 'absent').length
  const excused = rows.filter((r) => r.status === 'excused').length
  const late = rows.filter((r) => r.status === 'late').length
  return {
    rows, present, absent, excused, late, total: rows.length,
    rate: rows.length ? Math.round(((present + late) / rows.length) * 100) : 0,
  }
}

/** راتب المعلم بعد خصومات الغياب والاستئذان والتأخير */
export function teacherPayroll(db: DB, teacher: Teacher, monthIso: string) {
  const mk = monthKey(monthIso)
  const rows = db.teacherAttendance.filter((t) => t.teacherId === teacher.id && t.date.startsWith(mk))
  const absent = rows.filter((r) => r.status === 'absent').length
  const excused = rows.filter((r) => r.status === 'excused').length
  const late = rows.filter((r) => r.status === 'late').length
  const dayValue = (teacher.salary || 0) / (db.settings.workDaysPerMonth || 26)
  const deductionDays =
    absent * db.settings.absentDeductionDays +
    excused * db.settings.excusedDeductionDays +
    late * (db.settings.lateDeductionDays ?? 0)
  const deduction = Math.round(dayValue * deductionDays)
  return {
    absent, excused, late, deductionDays,
    dayValue: Math.round(dayValue), deduction,
    net: Math.max(0, (teacher.salary || 0) - deduction),
  }
}

/* ================= العهد ================= */

export const custodiesOfCommittee = (db: DB, committeeId: ID) =>
  db.custodies.filter((c) => c.committeeId === committeeId)
