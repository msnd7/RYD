import type { DB, ID, Person, Committee, Teacher, Task } from '../types'
import { todayISO, shiftDays, fmtDate } from './date'

/* =====================================================================
   محرّك التحفيز والتميّز
   يحتسب لكل فرد ولجنة: نسبة الحضور، ونسبة إنجاز المهام، والإنجاز في الموعد،
   ثم درجة مركّبة يُختار بها «فارس الأسبوع» و«فارس الشهر».
   ===================================================================== */

export type PeriodKey = 'week' | 'lastWeek' | 'month' | 'lastMonth' | 'q'

export interface Period {
  key: PeriodKey
  label: string
  from: string
  to: string
  /** وصف التاريخ للعرض */
  range: string
}

/** أوزان الدرجة المركّبة — مجموعها ١٠٠ */
export const WEIGHTS = { attendance: 50, tasks: 40, onTime: 10 }

const minISO = (a: string, b: string) => (a < b ? a : b)

/** أسبوع العمل يبدأ الأحد. offset = 0 للأسبوع الجاري، -1 للسابق */
export function weekPeriod(offset = 0, today = todayISO()): Period {
  const d = new Date(today + 'T12:00:00')
  const sunday = shiftDays(today, -d.getDay() + offset * 7)
  const saturday = shiftDays(sunday, 6)
  const to = minISO(saturday, today)
  return {
    key: offset === 0 ? 'week' : 'lastWeek',
    label: offset === 0 ? 'هذا الأسبوع' : 'الأسبوع الماضي',
    from: sunday, to,
    range: `${fmtDate(sunday)} — ${fmtDate(to)}`,
  }
}

/** الشهر الميلادي. offset = 0 للجاري، -1 للسابق */
export function monthPeriod(offset = 0, today = todayISO()): Period {
  const d = new Date(today + 'T12:00:00')
  const first = new Date(Date.UTC(d.getFullYear(), d.getMonth() + offset, 1, 12))
  const last = new Date(Date.UTC(d.getFullYear(), d.getMonth() + offset + 1, 0, 12))
  const from = first.toISOString().slice(0, 10)
  const to = minISO(last.toISOString().slice(0, 10), today)
  return {
    key: offset === 0 ? 'month' : 'lastMonth',
    label: offset === 0 ? 'هذا الشهر' : 'الشهر الماضي',
    from, to,
    range: `${fmtDate(from)} — ${fmtDate(to)}`,
  }
}

export function periodOf(key: PeriodKey, today = todayISO()): Period {
  if (key === 'week') return weekPeriod(0, today)
  if (key === 'lastWeek') return weekPeriod(-1, today)
  if (key === 'month') return monthPeriod(0, today)
  if (key === 'lastMonth') return monthPeriod(-1, today)
  const from = shiftDays(today, -89)
  return { key: 'q', label: 'آخر ٩٠ يومًا', from, to: today, range: `${fmtDate(from)} — ${fmtDate(today)}` }
}

export const PERIOD_OPTIONS: { value: PeriodKey; label: string }[] = [
  { value: 'week', label: 'هذا الأسبوع' },
  { value: 'lastWeek', label: 'الأسبوع الماضي' },
  { value: 'month', label: 'هذا الشهر' },
  { value: 'lastMonth', label: 'الشهر الماضي' },
  { value: 'q', label: 'آخر ٩٠ يومًا' },
]

/* ---------------- مقاييس أساسية ---------------- */

export interface AttMetrics { present: number; absent: number; excused: number; total: number; rate: number }
export interface TaskMetrics {
  total: number; done: number; onTime: number; open: number; late: number; stuck: number
  rate: number; onTimeRate: number
}

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)

/** المهام المحسوبة في الفترة: ما استحق فيها، أو أُنجز فيها */
export function tasksInPeriod(tasks: Task[], p: Period) {
  return tasks.filter((t) => {
    const done = t.status === 'done' ? (t.doneAt ?? t.dueDate).slice(0, 10) : ''
    return (t.dueDate >= p.from && t.dueDate <= p.to) || (done && done >= p.from && done <= p.to)
  })
}

export function taskMetrics(tasks: Task[], today = todayISO()): TaskMetrics {
  const done = tasks.filter((t) => t.status === 'done')
  const onTime = done.filter((t) => (t.doneAt ?? t.dueDate).slice(0, 10) <= t.dueDate).length
  return {
    total: tasks.length,
    done: done.length,
    onTime,
    open: tasks.length - done.length,
    late: tasks.filter((t) => t.status !== 'done' && t.dueDate < today).length,
    stuck: tasks.filter((t) => t.status === 'stuck').length,
    rate: pct(done.length, tasks.length),
    onTimeRate: pct(onTime, done.length),
  }
}

function attMetrics(db: DB, ids: Set<ID>, p: Period): AttMetrics {
  let present = 0, absent = 0, excused = 0
  for (const a of db.attendance) {
    if (!ids.has(a.personId) || a.date < p.from || a.date > p.to) continue
    if (a.status === 'present') present++
    else if (a.status === 'absent') absent++
    else excused++
  }
  const total = present + absent + excused
  return { present, absent, excused, total, rate: pct(present, total) }
}

/** الدرجة المركّبة: تُستبعد مكوّنات المهام إن لم توجد مهام، وتُعاد موازنة الأوزان */
export function compositeScore(att: AttMetrics, tasks: TaskMetrics) {
  let sum = 0, w = 0
  if (att.total) { sum += att.rate * WEIGHTS.attendance; w += WEIGHTS.attendance }
  if (tasks.total) { sum += tasks.rate * WEIGHTS.tasks; w += WEIGHTS.tasks }
  if (tasks.done) { sum += tasks.onTimeRate * WEIGHTS.onTime; w += WEIGHTS.onTime }
  return w ? Math.round((sum / w) * 10) / 10 : 0
}

/* ---------------- الأفراد ---------------- */

export interface PersonScore {
  id: ID
  person: Person
  mosqueId: ID
  committeeIds: ID[]
  att: AttMetrics
  tasks: TaskMetrics
  score: number
  /** مؤهّل للمنافسة على لقب الفارس */
  qualified: boolean
}

/** من يدخل المنافسة: الإداريون النشطون في المساجد */
export function competitors(db: DB, mosqueId: ID | 'all') {
  return db.people.filter((p) =>
    p.active && p.mosqueId !== 'complex' && p.role !== 'director' &&
    (mosqueId === 'all' || p.mosqueId === mosqueId))
}

const byScore = <T extends { score: number; qualified: boolean; tasks: TaskMetrics; att: AttMetrics }>(a: T, b: T) =>
  Number(b.qualified) - Number(a.qualified) ||
  b.score - a.score ||
  b.tasks.done - a.tasks.done ||
  b.att.present - a.att.present

export function scorePeople(db: DB, p: Period, mosqueId: ID | 'all'): PersonScore[] {
  const today = todayISO()
  const people = competitors(db, mosqueId)
  const rows = people.map((person) => {
    const att = attMetrics(db, new Set([person.id]), p)
    const tasks = taskMetrics(tasksInPeriod(db.tasks.filter((t) => t.assigneeId === person.id), p), today)
    return {
      id: person.id, person, mosqueId: person.mosqueId as ID, committeeIds: person.committeeIds,
      att, tasks, score: compositeScore(att, tasks), qualified: false,
    }
  })
  // التأهيل: سجلات حضور لا تقل عن نصف أعلى عدد سجلات في النطاق — فلا يتصدّر من حضر يومًا واحدًا
  const maxDays = Math.max(0, ...rows.map((r) => r.att.total))
  const need = Math.max(1, Math.ceil(maxDays / 2))
  rows.forEach((r) => { r.qualified = r.att.total >= need || (maxDays === 0 && r.tasks.total > 0) })
  return rows.sort(byScore)
}

/* ---------------- اللجان ---------------- */

export interface CommitteeScore {
  id: ID
  committee: Committee
  mosqueId: ID
  members: Person[]
  att: AttMetrics
  tasks: TaskMetrics
  score: number
  qualified: boolean
}

export function scoreCommittees(db: DB, p: Period, mosqueId: ID | 'all'): CommitteeScore[] {
  const today = todayISO()
  const list = db.committees.filter((c) => mosqueId === 'all' || c.mosqueId === mosqueId)
  return list.map((committee) => {
    const members = db.people.filter((x) => x.active && x.committeeIds.includes(committee.id))
    const att = attMetrics(db, new Set(members.map((m) => m.id)), p)
    const tasks = taskMetrics(tasksInPeriod(db.tasks.filter((t) => t.committeeId === committee.id), p), today)
    return {
      id: committee.id, committee, mosqueId: committee.mosqueId, members,
      att, tasks, score: compositeScore(att, tasks),
      qualified: members.length > 0 && (att.total > 0 || tasks.total > 0),
    }
  }).sort(byScore)
}

/* ---------------- المعلمون ---------------- */

export interface TeacherScore {
  id: ID; teacher: Teacher
  present: number; late: number; absent: number; excused: number; total: number; rate: number
  /** الانضباط: الحضور في الوقت دون تأخير */
  punctual: number
}

export function scoreTeachers(db: DB, p: Period, mosqueId: ID | 'all'): TeacherScore[] {
  return db.teachers
    .filter((t) => t.active && (mosqueId === 'all' || t.mosqueId === mosqueId))
    .map((teacher) => {
      const rows = db.teacherAttendance.filter((a) => a.teacherId === teacher.id && a.date >= p.from && a.date <= p.to)
      const present = rows.filter((r) => r.status === 'present').length
      const late = rows.filter((r) => r.status === 'late').length
      const absent = rows.filter((r) => r.status === 'absent').length
      const excused = rows.filter((r) => r.status === 'excused').length
      return {
        id: teacher.id, teacher, present, late, absent, excused, total: rows.length,
        rate: pct(present + late, rows.length), punctual: pct(present, rows.length),
      }
    })
    .sort((a, b) => b.punctual - a.punctual || b.rate - a.rate || b.present - a.present)
}

/* ---------------- الترتيب ---------------- */

/** الأعلى حضورًا: يُشترط وجود سجلات حضور */
export function topAttendance<T extends { att: AttMetrics; qualified: boolean }>(rows: T[], n = 5) {
  return rows
    .filter((r) => r.att.total > 0 && r.qualified)
    .sort((a, b) => b.att.rate - a.att.rate || b.att.present - a.att.present)
    .slice(0, n)
}

/** الأعلى إنجازًا: يُشترط وجود مهام في الفترة */
export function topTasks<T extends { tasks: TaskMetrics }>(rows: T[], n = 5) {
  return rows
    .filter((r) => r.tasks.total > 0)
    .sort((a, b) => b.tasks.rate - a.tasks.rate || b.tasks.done - a.tasks.done || b.tasks.onTimeRate - a.tasks.onTimeRate)
    .slice(0, n)
}

export function knightOf<T extends { qualified: boolean; score: number }>(rows: T[]): T | undefined {
  const r = rows[0]
  return r && r.qualified && r.score > 0 ? r : undefined
}

/* ---------------- اتجاه أسبوعي ---------------- */

export interface WeekPoint {
  label: string; from: string; to: string
  attRate: number; attTotal: number
  taskRate: number; taskTotal: number
}

/** نسب الحضور والإنجاز لآخر n أسابيع — للوحة البيانات */
export function weeklyTrend(db: DB, mosqueId: ID | 'all', n = 8): WeekPoint[] {
  const ids = new Set(competitors(db, mosqueId).map((p) => p.id))
  const tasks = db.tasks.filter((t) => mosqueId === 'all' || t.mosqueId === mosqueId)
  const today = todayISO()
  return Array.from({ length: n }, (_, i) => {
    const p = weekPeriod(-(n - 1 - i), today)
    const att = attMetrics(db, ids, p)
    const tm = taskMetrics(tasksInPeriod(tasks, p), today)
    const [, m, d] = p.from.split('-')
    return {
      label: `${Number(d)}/${Number(m)}`, from: p.from, to: p.to,
      attRate: att.rate, attTotal: att.total, taskRate: tm.rate, taskTotal: tm.total,
    }
  })
}

/* ---------------- تصدير ---------------- */

export function toCsv(head: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return '﻿' + [head, ...rows].map((r) => r.map(esc).join(',')).join('\n')
}

export function downloadText(name: string, text: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url; a.download = name
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const initials = (name: string) => {
  const parts = name.trim().split(/\s+/)
  return (parts[0]?.[0] ?? '؟') + (parts[1]?.[0] ?? '')
}

export const firstNames = (name: string, n = 2) => name.trim().split(/\s+/).slice(0, n).join(' ')
