import type { DB, ID, PayrollLine, PayrollRun } from '../types'
import { todayISO, monthKey, monthLabel, daysBetween } from './date'
import { payrollFor, teacherPayroll, custodyBalance } from './selectors'

/**
 * دورة الرواتب الشهرية (ميلادية):
 * - يُحتسب كل شهر من أوله إلى آخره (الحضور والغياب والاستئذان داخله).
 * - تُصرف رواتبه يوم ١ من الشهر التالي، ومعه يبدأ احتساب شهر جديد.
 * - عند الاعتماد تُثبَّت أرقام الشهر، فتبقى تقارير الأشهر الماضية كما هي.
 */

export const currentMonth = () => monthKey(todayISO())

export function shiftMonth(month: string, n: number) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export const monthStart = (month: string) => `${month}-01`

export function monthEnd(month: string) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m, 0))
  return d.toISOString().slice(0, 10)
}

/** تاريخ صرف رواتب الشهر: يوم الصرف من الشهر الميلادي التالي */
export function payDateOf(db: DB, month: string) {
  const day = Math.min(28, Math.max(1, db.settings.payDay || 1))
  return `${shiftMonth(month, 1)}-${String(day).padStart(2, '0')}`
}

export type MonthStatus = 'open' | 'due' | 'approved' | 'paid'

export const MONTH_STATUS: Record<MonthStatus, { label: string; tone: string; hint: string }> = {
  open: { label: 'قيد الاحتساب', tone: 'info', hint: 'الشهر الجاري — تتغيّر أرقامه مع كل رصد حضور' },
  due: { label: 'مستحق — بانتظار الاعتماد', tone: 'warn', hint: 'انتهى الشهر وحان صرفه، اعتمد المسيّر لتثبيت أرقامه' },
  approved: { label: 'معتمد — بانتظار الصرف', tone: 'purple', hint: 'ثُبّتت الأرقام، أكّد الصرف بعد تحويل الرواتب' },
  paid: { label: 'مصروف', tone: 'ok', hint: 'صُرفت رواتب هذا الشهر وأُقفل' },
}

export const runOf = (db: DB, month: string): PayrollRun | undefined =>
  db.payrollRuns.find((r) => r.month === month)

export function monthStatus(db: DB, month: string): MonthStatus {
  const run = runOf(db, month)
  if (run?.paidAt) return 'paid'
  if (run) return 'approved'
  return month >= currentMonth() ? 'open' : 'due'
}

/** الأشهر المتاحة للعرض: من أقدم بيان مسجّل إلى الشهر الجاري — الأحدث أولًا */
export function availableMonths(db: DB, max = 36): string[] {
  const now = currentMonth()
  let oldest = now
  const consider = (iso?: string) => {
    if (!iso || iso.length < 7) return
    const k = iso.slice(0, 7)
    if (/^\d{4}-\d{2}$/.test(k) && k < oldest) oldest = k
  }
  db.attendance.forEach((a) => consider(a.date))
  db.teacherAttendance.forEach((a) => consider(a.date))
  db.payrollRuns.forEach((r) => consider(r.month))
  db.custodies.forEach((c) => consider(c.createdAt))

  const out: string[] = []
  for (let m = now; m >= oldest && out.length < max; m = shiftMonth(m, -1)) out.push(m)
  // شهر سابق واحد على الأقل، حتى لا تبقى القائمة يتيمة في أول استخدام
  if (out.length === 1) out.push(shiftMonth(now, -1))
  return out
}

/** يحسب سطور المسيّر لشهر من البيانات الحية */
export function computeLines(db: DB, month: string): PayrollLine[] {
  const end = monthEnd(month)
  const staff = db.people
    .filter((p) => p.mosqueId !== 'complex' && p.active && p.salary > 0 && (!p.hiredAt || p.hiredAt <= end))
    .map<PayrollLine>((p) => {
      const pay = payrollFor(db, p, month)
      return {
        kind: 'staff', personId: p.id, name: p.name, sub: p.jobTitle, mosqueId: p.mosqueId as ID,
        salary: p.salary, dayValue: pay.dayValue, absent: pay.absent, excused: pay.excused, late: 0,
        deductionDays: pay.deductionDays, deduction: pay.deduction, net: pay.net,
      }
    })
  const teachers = db.teachers
    .filter((t) => t.active && t.salary > 0 && (!t.hiredAt || t.hiredAt <= end))
    .map<PayrollLine>((t) => {
      const pay = teacherPayroll(db, t, month)
      return {
        kind: 'teacher', personId: t.id, name: t.name,
        sub: [t.circle, t.level].filter(Boolean).join(' · '), mosqueId: t.mosqueId,
        salary: t.salary, dayValue: pay.dayValue, absent: pay.absent, excused: pay.excused, late: pay.late,
        deductionDays: pay.deductionDays, deduction: pay.deduction, net: pay.net,
      }
    })
  return [...staff, ...teachers]
}

/** سطور الشهر: المثبّتة إن اعتُمد، وإلا المحسوبة من البيانات الحية */
export function linesFor(db: DB, month: string, mosqueId?: string) {
  const run = runOf(db, month)
  const all = run ? run.lines : computeLines(db, month)
  return mosqueId ? all.filter((l) => l.mosqueId === mosqueId) : all
}

export function totalsOf(lines: PayrollLine[]) {
  const gross = lines.reduce((s, l) => s + l.salary, 0)
  const deduction = lines.reduce((s, l) => s + l.deduction, 0)
  return {
    gross, deduction, net: gross - deduction, count: lines.length,
    staff: lines.filter((l) => l.kind === 'staff').length,
    teachers: lines.filter((l) => l.kind === 'teacher').length,
  }
}

/** ملخص مالي لشهر: الرواتب + العهد التي صُرفت ومصروفاتها خلاله */
export function monthSummary(db: DB, month: string, mosqueId?: string) {
  const lines = linesFor(db, month, mosqueId)
  const t = totalsOf(lines)
  const custodies = db.custodies.filter((c) =>
    (!mosqueId || c.mosqueId === mosqueId) && c.status !== 'rejected')
  const granted = custodies
    .filter((c) => (c.approvedAt ?? '').startsWith(month))
    .reduce((s, c) => s + c.amount, 0)
  const spent = custodies
    .flatMap((c) => c.expenses)
    .filter((e) => e.date.startsWith(month))
    .reduce((s, e) => s + e.amount, 0)
  const returned = custodies
    .filter((c) => (c.closedAt ?? '').startsWith(month))
    .reduce((s, c) => s + (c.returned ?? 0), 0)
  const openBalance = custodies
    .filter((c) => c.status === 'approved')
    .reduce((s, c) => s + custodyBalance(c).remaining, 0)
  return { ...t, lines, granted, spent, returned, openBalance, status: monthStatus(db, month) }
}

/** وصف الدورة الحالية: كم مضى من الشهر وكم بقي على الصرف */
export function cycleInfo(db: DB) {
  const month = currentMonth()
  const today = todayISO()
  const start = monthStart(month)
  const end = monthEnd(month)
  const total = daysBetween(start, end) + 1
  const elapsed = daysBetween(start, today) + 1
  const payDate = payDateOf(db, month)
  return {
    month, label: monthLabel(month), start, end, payDate,
    elapsed, total, pct: Math.round((elapsed / total) * 100),
    daysToPay: Math.max(0, daysBetween(today, payDate)),
    previous: shiftMonth(month, -1),
  }
}
