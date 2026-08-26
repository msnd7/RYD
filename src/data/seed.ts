import type { DB } from '../types'

/** اللجان الافتراضية التي تُنشأ لكل مسجد — قابلة للتعديل والحذف من صفحة اللجان */
export const COMMITTEE_TEMPLATES = [
  { key: 'edu', name: 'اللجنة التعليمية', goal: 'متابعة الحلقات والخطط التعليمية ومستوى الحفظ' },
  { key: 'act', name: 'لجنة الأنشطة', goal: 'إقامة المسابقات والبرامج والأنشطة المصاحبة' },
  { key: 'adm', name: 'اللجنة الإدارية', goal: 'الشؤون الإدارية والانضباط والتجهيزات' },
  { key: 'rel', name: 'لجنة العلاقات والإعلام', goal: 'التواصل مع أولياء الأمور والداعمين والتغطية الإعلامية' },
]

export const DIRECTOR_EMAIL = 'msnd5033@gmail.com'
export const DEFAULT_PASSWORD = '1234'

/**
 * قاعدة بيانات نظيفة تمامًا — بلا أي بيانات تجريبية.
 * تحتوي فقط على: المساجد الثلاثة، لجانها الافتراضية، وحساب مدير المجمع.
 */
export function buildSeed(): DB {
  const mosques: DB['mosques'] = [
    {
      id: 'm1', name: 'جامع عبدالله بن عمر', shortName: 'ابن عمر',
      address: 'مدينة الملك سعود السكنية — ديراب', color: 'brand',
      geofence: { lat: 0, lng: 0, radius: 150 },
    },
    {
      id: 'm2', name: 'جامع ماجد بن مترك', shortName: 'ابن مترك',
      address: 'مدينة الملك سعود السكنية — ديراب', color: 'olive',
      geofence: { lat: 0, lng: 0, radius: 150 },
    },
    {
      id: 'm3', name: 'جامع عبدالله الضحيان', shortName: 'الضحيان',
      address: 'مدينة الملك سعود السكنية — ديراب', color: 'gold',
      geofence: { lat: 0, lng: 0, radius: 150 },
    },
  ]

  const committees: DB['committees'] = mosques.flatMap((m) =>
    COMMITTEE_TEMPLATES.map((c) => ({
      id: `cm-${m.id}-${c.key}`, mosqueId: m.id, name: c.name, goal: c.goal,
    })),
  )

  const people: DB['people'] = [
    {
      id: 'p-director',
      mosqueId: 'complex',
      name: 'مدير المجمع',
      jobTitle: 'مدير مجمع رياض القرآن',
      phone: '',
      role: 'director',
      committeeIds: [],
      salary: 0,
      email: DIRECTOR_EMAIL,
      password: DEFAULT_PASSWORD,
      mustChangePassword: true,
      financeAccess: true,
      active: true,
      hiredAt: new Date().toISOString().slice(0, 10),
    },
  ]

  return {
    version: 3,
    settings: {
      complexName: 'مجمع رياض القرآن',
      complexSubtitle: 'حلقات تحفيظ القرآن الكريم — مدينة الملك سعود السكنية بديراب',
      workDaysPerMonth: 26,
      absentDeductionDays: 1,
      excusedDeductionDays: 0.5,
      reminderSeconds: 10,
      defaultPassword: DEFAULT_PASSWORD,
      pushEnabled: false,
      lateDeductionDays: 0,
    },
    mosques,
    committees,
    people,
    tasks: [],
    attendance: [],
    leaves: [],
    meetings: [],
    reports: [],
    announcements: [],
    custodies: [],
    teachers: [],
    teacherAttendance: [],
  }
}
