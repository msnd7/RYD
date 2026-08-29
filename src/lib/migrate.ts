import type { DB } from '../types'

export const DB_VERSION = 3

const LISTS = [
  'mosques', 'people', 'committees', 'tasks', 'attendance', 'leaves',
  'meetings', 'reports', 'announcements', 'custodies', 'teachers', 'teacherAttendance',
] as const

/**
 * ترقية وثيقة قديمة إلى الصيغة الحالية دون فقد أي بيان.
 *
 * تملأ الحقول المستجدّة بقيم آمنة فقط، ولا تحذف ولا تستبدل أي بيانات موجودة.
 * آمنة للتكرار: تشغيلها مرارًا على وثيقة محدَّثة لا يغيّر شيئًا.
 *
 * ترجع true إذا غيّرت شيئًا (ليُحفظ)، وfalse إذا كانت الوثيقة محدَّثة أصلًا.
 */
export function migrate(doc: any): boolean {
  if (!doc || typeof doc !== 'object') return false
  let changed = false

  const fill = (obj: any, key: string, value: unknown) => {
    if (obj[key] === undefined || obj[key] === null) { obj[key] = value; changed = true }
  }

  // القوائم الأساسية موجودة دائمًا
  for (const k of LISTS) {
    if (!Array.isArray(doc[k])) { doc[k] = []; changed = true }
  }

  // الإعدادات
  if (!doc.settings || typeof doc.settings !== 'object') { doc.settings = {}; changed = true }
  fill(doc.settings, 'complexName', 'مجمع رياض القرآن')
  fill(doc.settings, 'complexSubtitle', 'حلقات تحفيظ القرآن الكريم — مدينة الملك سعود السكنية بديراب')
  fill(doc.settings, 'workDaysPerMonth', 26)
  fill(doc.settings, 'absentDeductionDays', 1)
  fill(doc.settings, 'excusedDeductionDays', 0.5)
  fill(doc.settings, 'reminderSeconds', 10)
  fill(doc.settings, 'defaultPassword', '1234')
  fill(doc.settings, 'pushEnabled', false)
  fill(doc.settings, 'lateDeductionDays', 0)

  // المساجد
  doc.mosques.forEach((m: any) => {
    fill(m, 'shortName', m.name ?? '')
    fill(m, 'address', '')
    fill(m, 'color', 'brand')
    if (!m.geofence || typeof m.geofence !== 'object') { m.geofence = { lat: 0, lng: 0, radius: 150 }; changed = true }
    fill(m.geofence, 'lat', 0); fill(m.geofence, 'lng', 0); fill(m.geofence, 'radius', 150)
  })

  // الحسابات
  doc.people.forEach((p: any) => {
    fill(p, 'email', '')
    fill(p, 'phone', '')
    fill(p, 'jobTitle', p.role === 'supervisor' ? 'مشرف المسجد' : 'موظف')
    fill(p, 'role', 'member')
    fill(p, 'committeeIds', [])
    fill(p, 'salary', 0)
    fill(p, 'financeAccess', false)
    fill(p, 'active', true)
    fill(p, 'mustChangePassword', false)
    fill(p, 'password', '')
    fill(p, 'hiredAt', new Date().toISOString().slice(0, 10))
  })

  // اللجان
  doc.committees.forEach((c: any) => fill(c, 'goal', ''))

  // البنود
  doc.tasks.forEach((t: any) => {
    fill(t, 'details', '')
    fill(t, 'kind', 'task')
    fill(t, 'status', 'pending')
    fill(t, 'remindBefore', 2)
    fill(t, 'createdAt', t.dueDate ?? new Date().toISOString().slice(0, 10))
  })

  // طلبات الاستئذان: صار لها نوع (موظف أو معلم)
  doc.leaves.forEach((l: any) => fill(l, 'personType', 'staff'))

  // المعلمون: أُضيف الراتب، والمستوى صار مرحلة دراسية (تبقى القيمة القديمة كما هي)
  doc.teachers.forEach((t: any) => {
    fill(t, 'salary', 0)
    fill(t, 'studentsCount', 0)
    fill(t, 'circle', '')
    fill(t, 'level', '')
    fill(t, 'notes', '')
    fill(t, 'active', true)
    fill(t, 'phone', '')
  })

  // العهد
  doc.custodies.forEach((c: any) => {
    if (!Array.isArray(c.expenses)) { c.expenses = []; changed = true }
    fill(c, 'status', 'requested')
  })

  // الاجتماعات والتقارير المرفوعة
  doc.meetings.forEach((m: any) => {
    fill(m, 'attendees', [])
    fill(m, 'agenda', ''); fill(m, 'minutes', ''); fill(m, 'decisions', '')
  })
  doc.reports.forEach((r: any) => { if (!Array.isArray(r.files)) { r.files = []; changed = true } })

  if (doc.version !== DB_VERSION) { doc.version = DB_VERSION; changed = true }
  return changed
}

/** ترقية نسخة وترجع الوثيقة الجاهزة */
export function migrated(doc: any): DB {
  migrate(doc)
  return doc as DB
}
