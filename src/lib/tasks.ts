import type { Task, TaskKind, TaskPriority, TaskStatus } from '../types'
import { todayISO, shiftDays, daysBetween } from './date'

export const KIND_LABEL: Record<TaskKind, string> = { task: 'مهمة', decision: 'قرار', recommendation: 'توصية' }
export const KIND_TONE: Record<TaskKind, string> = { task: 'info', decision: 'purple', recommendation: 'warn' }
export const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: 'قيد التنفيذ', done: 'منجزة', stuck: 'متعثرة', postponed: 'مؤجلة',
}
export const STATUS_TONE: Record<TaskStatus, string> = {
  pending: 'info', done: 'ok', stuck: 'bad', postponed: 'warn',
}

/**
 * مصفوفة أيزنهاور — كل مربع له اسم وفعل واضح ولون ثابت يتكرر
 * في القائمة والمصفوفة والتقويم، فيعرف المستخدم أولويته من اللون وحده.
 */
export const QUADRANTS: Record<TaskPriority, {
  key: TaskPriority
  label: string       // التصنيف
  short: string       // اسم مختصر للشارات
  action: string      // ماذا تفعل بها
  hint: string
  dot: string; bar: string; soft: string; ink: string; ring: string; border: string; hover: string
}> = {
  q1: {
    key: 'q1', label: 'هام وعاجل', short: 'هام وعاجل', action: 'نفّذها الآن',
    hint: 'أزمات ومواعيد قريبة لا تحتمل التأجيل',
    dot: 'bg-q1', bar: 'bg-q1', soft: 'bg-q1-soft', ink: 'text-q1-ink', ring: 'ring-q1/40', border: 'border-q1/30', hover: 'hover:bg-q1-soft',
  },
  q2: {
    key: 'q2', label: 'هام غير عاجل', short: 'هام', action: 'خطّط لها',
    hint: 'أهداف وتطوير وتخطيط — هنا يُصنع الأثر',
    dot: 'bg-q2', bar: 'bg-q2', soft: 'bg-q2-soft', ink: 'text-q2-ink', ring: 'ring-q2/40', border: 'border-q2/30', hover: 'hover:bg-q2-soft',
  },
  q3: {
    key: 'q3', label: 'عاجل غير هام', short: 'عاجل', action: 'فوّضها',
    hint: 'مقاطعات وطلبات يمكن أن يقوم بها غيرك',
    dot: 'bg-q3', bar: 'bg-q3', soft: 'bg-q3-soft', ink: 'text-q3-ink', ring: 'ring-q3/40', border: 'border-q3/30', hover: 'hover:bg-q3-soft',
  },
  q4: {
    key: 'q4', label: 'غير هام وغير عاجل', short: 'مؤجَّلة', action: 'أجّلها أو احذفها',
    hint: 'أمور ثانوية لا تستحق وقت الذروة',
    dot: 'bg-q4', bar: 'bg-q4', soft: 'bg-q4-soft', ink: 'text-q4-ink', ring: 'ring-q4/40', border: 'border-q4/30', hover: 'hover:bg-q4-soft',
  },
}

export const QUADRANT_ORDER: TaskPriority[] = ['q1', 'q2', 'q3', 'q4']

/** وزن الأولوية في الترتيب — غير المصنّفة بعد الهام وقبل الثانوي */
const RANK: Record<TaskPriority | 'none', number> = { q1: 0, q2: 1, q3: 2, none: 3, q4: 4 }
export const priorityRank = (t: Task) => RANK[t.priority ?? 'none']

/** هل المهمة مثبّتة في هذا اليوم؟ */
export function isPinnedOn(t: Task, day = todayISO()) {
  if (!t.pinFrom || !t.pinTo) return false
  return t.pinFrom <= day && day <= t.pinTo
}

/** الأيام التي تظهر فيها المهمة على التقويم: يوم الموعد، وكامل فترة التثبيت إن وُجدت */
export function taskOnDay(t: Task, day: string) {
  return t.dueDate === day || isPinnedOn(t, day)
}

export const sortTasks = (a: Task, b: Task) =>
  priorityRank(a) - priorityRank(b) || a.dueDate.localeCompare(b.dueDate) || a.title.localeCompare(b.title)

export type GroupKey = 'pinned' | 'late' | 'today' | 'tomorrow' | 'week' | 'later' | 'done'

export const GROUP_META: Record<GroupKey, { label: string; hint?: string; tone: string }> = {
  pinned:   { label: 'مثبّتة', hint: 'تبقى في الأعلى طوال الفترة التي حددتها', tone: 'text-navy-700' },
  late:     { label: 'متأخرة', hint: 'تجاوزت موعدها', tone: 'text-orange-700' },
  today:    { label: 'اليوم', tone: 'text-ink-900' },
  tomorrow: { label: 'غدًا', tone: 'text-ink-900' },
  week:     { label: 'خلال 7 أيام', tone: 'text-ink-700' },
  later:    { label: 'لاحقًا', tone: 'text-ink-500' },
  done:     { label: 'منجزة', tone: 'text-ink-400' },
}

/** تجميع المهام زمنيًا كما في تطبيقات المهام الحديثة — المثبّتة أولًا ثم حسب القرب */
export function groupByTime(tasks: Task[], today = todayISO()) {
  const g: Record<GroupKey, Task[]> = { pinned: [], late: [], today: [], tomorrow: [], week: [], later: [], done: [] }
  for (const t of tasks) {
    if (t.status === 'done') { g.done.push(t); continue }
    if (isPinnedOn(t, today)) { g.pinned.push(t); continue }
    const d = daysBetween(today, t.dueDate)
    if (d < 0) g.late.push(t)
    else if (d === 0) g.today.push(t)
    else if (d === 1) g.tomorrow.push(t)
    else if (d <= 7) g.week.push(t)
    else g.later.push(t)
  }
  ;(Object.keys(g) as GroupKey[]).forEach((k) => {
    if (k === 'done') g.done.sort((a, b) => (b.doneAt ?? b.dueDate).localeCompare(a.doneAt ?? a.dueDate))
    else g[k].sort(sortTasks)
  })
  return g
}

/** شبكة شهر كاملة تبدأ بالأحد — ٦ أسابيع ثابتة حتى لا يقفز ارتفاع التقويم */
export function monthGrid(year: number, month: number) {
  const first = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const lead = new Date(first + 'T12:00:00').getDay()
  const start = shiftDays(first, -lead)
  return Array.from({ length: 42 }, (_, i) => shiftDays(start, i))
}

/** رقم اليوم الهجري فقط لزاوية خانة التقويم */
const hijriFmt = (() => {
  try { return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', { day: 'numeric' }) }
  catch { return null }
})()
export const hijriDay = (iso: string) => {
  try { return hijriFmt?.format(new Date(iso + 'T12:00:00')) ?? '' } catch { return '' }
}
