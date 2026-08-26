import type { DB } from '../types'
import { todayISO, shiftDays } from '../lib/date'

const T = todayISO()

export const COMMITTEE_TEMPLATES = [
  { key: 'edu', name: 'اللجنة التعليمية', goal: 'متابعة الحلقات والخطط التعليمية ومستوى الحفظ' },
  { key: 'act', name: 'لجنة الأنشطة', goal: 'إقامة المسابقات والبرامج والأنشطة المصاحبة' },
  { key: 'adm', name: 'اللجنة الإدارية', goal: 'الشؤون الإدارية والحضور والانضباط والتجهيزات' },
  { key: 'rel', name: 'لجنة العلاقات والإعلام', goal: 'التواصل مع أولياء الأمور والداعمين والتغطية الإعلامية' },
]

function committeesFor(mosqueId: string): DB['committees'] {
  return COMMITTEE_TEMPLATES.map((c) => ({
    id: `cm-${mosqueId}-${c.key}`,
    mosqueId,
    name: c.name,
    goal: c.goal,
  }))
}

export function buildSeed(): DB {
  const mosques: DB['mosques'] = [
    {
      id: 'm1', name: 'جامع عبدالله بن عمر', shortName: 'ابن عمر',
      address: 'مدينة الملك سعود السكنية — ديراب', color: 'brand',
      geofence: { lat: 24.5471, lng: 46.5423, radius: 150 }, supervisorId: 'p-m1-sup',
    },
    {
      id: 'm2', name: 'جامع ماجد بن مترك', shortName: 'ابن مترك',
      address: 'مدينة الملك سعود السكنية — ديراب', color: 'olive',
      geofence: { lat: 24.5518, lng: 46.5361, radius: 150 }, supervisorId: 'p-m2-sup',
    },
    {
      id: 'm3', name: 'جامع عبدالله الضحيان', shortName: 'الضحيان',
      address: 'مدينة الملك سعود السكنية — ديراب', color: 'gold',
      geofence: { lat: 24.5405, lng: 46.5487, radius: 150 }, supervisorId: 'p-m3-sup',
    },
  ]

  const committees = mosques.flatMap((m) => committeesFor(m.id))

  const people: DB['people'] = [
    {
      id: 'p-dir', mosqueId: 'complex', name: 'مدير المجمع', jobTitle: 'مدير مجمع رياض القرآن',
      phone: '0500000000', role: 'director', committeeIds: [], salary: 0,
      username: 'admin', password: '1234', financeAccess: true, active: true, hiredAt: '2023-01-01',
      contract: { title: 'عقد إدارة المجمع', startDate: '2023-01-01', salary: 0, terms: 'إدارة عامة للمجمع.' },
    },
  ]

  const names: Record<string, { sup: string; members: [string, string][] }> = {
    m1: {
      sup: 'خالد بن سعد العتيبي',
      members: [
        ['عبدالرحمن بن ناصر الحربي', 'edu'],
        ['ماجد بن فهد القحطاني', 'act'],
        ['سلطان بن عبدالله الدوسري', 'adm'],
        ['يوسف بن إبراهيم الشمري', 'rel'],
      ],
    },
    m2: {
      sup: 'فيصل بن محمد الزهراني',
      members: [
        ['أحمد بن علي الغامدي', 'edu'],
        ['نايف بن سلطان المطيري', 'act'],
        ['بندر بن عمر السبيعي', 'adm'],
      ],
    },
    m3: {
      sup: 'تركي بن عبدالعزيز الشثري',
      members: [
        ['مشعل بن حمد العنزي', 'edu'],
        ['عبدالإله بن صالح الخالدي', 'act'],
        ['رائد بن مساعد الرشيدي', 'adm'],
      ],
    },
  }

  mosques.forEach((m, mi) => {
    const cfg = names[m.id]
    people.push({
      id: `p-${m.id}-sup`, mosqueId: m.id, name: cfg.sup, jobTitle: 'مشرف المسجد',
      phone: `05500000${mi + 1}0`, role: 'supervisor', committeeIds: [`cm-${m.id}-adm`],
      salary: 4500, username: `sup${mi + 1}`, password: '1234',
      financeAccess: false, active: true, hiredAt: '2023-02-15',
      contract: {
        title: 'عقد إشراف على مسجد', startDate: '2023-02-15', salary: 4500,
        terms: 'الإشراف على سير الحلقات، ومتابعة حضور المعلمين وفريق العمل، وتنفيذ خطة المجمع، والالتزام بالدوام داخل النطاق المكاني للمسجد.',
      },
    })
    cfg.members.forEach(([nm, ck], i) => {
      people.push({
        id: `p-${m.id}-${i + 1}`, mosqueId: m.id, name: nm,
        jobTitle: i === 0 ? 'مساعد إداري' : 'عضو فريق العمل',
        phone: `05512300${mi}${i}`, role: 'member', committeeIds: [`cm-${m.id}-${ck}`],
        salary: 3000, username: `${m.id}u${i + 1}`, password: '1234',
        financeAccess: false, active: true, hiredAt: '2023-03-01',
        contract: {
          title: 'عقد عمل — فريق العمل', startDate: '2023-03-01', salary: 3000,
          terms: 'العمل ضمن لجنة المسجد وتنفيذ المهام الموكلة، والالتزام بالحضور اليومي، ويُخصم يوم كامل عن الغياب ونصف يوم عن الاستئذان المعتمد.',
        },
      })
    })
    // رئاسة اللجان
    committees.filter((c) => c.mosqueId === m.id).forEach((c) => {
      const lead = people.find((p) => p.mosqueId === m.id && p.committeeIds.includes(c.id) && p.role !== 'supervisor')
      if (lead) c.leaderId = lead.id
    })
  })

  const tasks: DB['tasks'] = [
    {
      id: 't1', mosqueId: 'm1', committeeId: 'cm-m1-edu', assigneeId: 'p-m1-1',
      title: 'اعتماد خطة الحفظ للفصل الثاني', details: 'مراجعة مقررات الحلقات وتوزيعها على المستويات.',
      kind: 'task', status: 'pending', dueDate: shiftDays(T, 2), remindBefore: 2,
      createdBy: 'p-dir', createdAt: shiftDays(T, -6),
    },
    {
      id: 't2', mosqueId: 'm1', committeeId: 'cm-m1-act', assigneeId: 'p-m1-2',
      title: 'تجهيز مسابقة الحفظ الشهرية', details: 'الجوائز، التحكيم، جدول التصفيات.',
      kind: 'decision', status: 'stuck', dueDate: shiftDays(T, -3), remindBefore: 3,
      createdBy: 'p-m1-sup', createdAt: shiftDays(T, -12), note: 'بانتظار اعتماد الميزانية.',
    },
    {
      id: 't3', mosqueId: 'm1', committeeId: 'cm-m1-adm', assigneeId: 'p-m1-3',
      title: 'جرد أجهزة التكييف وصيانتها', details: '', kind: 'task', status: 'done',
      dueDate: shiftDays(T, -8), remindBefore: 1, createdBy: 'p-m1-sup',
      createdAt: shiftDays(T, -20), doneAt: shiftDays(T, -9),
    },
    {
      id: 't4', mosqueId: 'm2', committeeId: 'cm-m2-edu', assigneeId: 'p-m2-1',
      title: 'رفع تقرير مستوى الطلاب', details: 'تقرير أسبوعي عن نسب الإتقان.',
      kind: 'recommendation', status: 'pending', dueDate: shiftDays(T, 1), remindBefore: 2,
      createdBy: 'p-dir', createdAt: shiftDays(T, -4),
    },
    {
      id: 't5', mosqueId: 'm2', committeeId: 'cm-m2-act', assigneeId: 'p-m2-2',
      title: 'رحلة ترفيهية للمتفوقين', details: '', kind: 'task', status: 'postponed',
      dueDate: shiftDays(T, 9), remindBefore: 5, createdBy: 'p-m2-sup', createdAt: shiftDays(T, -15),
      note: 'أُجلت لما بعد الاختبارات.',
    },
    {
      id: 't6', mosqueId: 'm3', committeeId: 'cm-m3-adm', assigneeId: 'p-m3-3',
      title: 'حصر احتياج المسجد من المصاحف', details: '', kind: 'task', status: 'pending',
      dueDate: shiftDays(T, 0), remindBefore: 1, createdBy: 'p-m3-sup', createdAt: shiftDays(T, -3),
    },
    {
      id: 't7', mosqueId: 'm3', committeeId: 'cm-m3-edu', assigneeId: 'p-m3-1',
      title: 'متابعة غياب الطلاب المتكرر', details: 'التواصل مع أولياء الأمور.',
      kind: 'recommendation', status: 'done', dueDate: shiftDays(T, -2), remindBefore: 2,
      createdBy: 'p-dir', createdAt: shiftDays(T, -10), doneAt: shiftDays(T, -2),
    },
  ]

  // حضور تجريبي لآخر 14 يوم
  const attendance: DB['attendance'] = []
  const staff = people.filter((p) => p.mosqueId !== 'complex')
  for (let d = 13; d >= 1; d--) {
    const date = shiftDays(T, -d)
    const dow = new Date(date).getDay()
    if (dow === 5) continue // الجمعة
    staff.forEach((p, idx) => {
      const r = (d * 7 + idx * 13) % 11
      const status = r === 0 ? 'absent' : r === 1 ? 'excused' : 'present'
      attendance.push({
        id: `a-${p.id}-${date}`, mosqueId: p.mosqueId as string, personId: p.id, date,
        status: status as any, checkInAt: status === 'present' ? `${date}T16:${(idx * 7) % 60 || 5}:00` : undefined,
        distance: status === 'present' ? 30 + ((idx * 17) % 90) : undefined,
        source: status === 'present' ? 'geo' : 'system',
      })
    })
  }

  const leaves: DB['leaves'] = [
    {
      id: 'l1', mosqueId: 'm1', personId: 'p-m1-2', date: shiftDays(T, 1),
      reason: 'مراجعة طبية بعد صلاة العصر.', status: 'pending', createdAt: shiftDays(T, 0),
    },
    {
      id: 'l2', mosqueId: 'm2', personId: 'p-m2-1', date: shiftDays(T, -3),
      reason: 'ظرف عائلي طارئ.', status: 'approved', createdAt: shiftDays(T, -4),
      decidedBy: 'p-dir', decidedAt: shiftDays(T, -3),
    },
  ]

  const meetings: DB['meetings'] = [
    {
      id: 'mt1', scope: 'complex', mosqueId: 'complex', title: 'اجتماع مشرفي المساجد الدوري',
      place: 'مكتب إدارة المجمع', date: shiftDays(T, -5), time: '19:30',
      attendees: ['p-dir', 'p-m1-sup', 'p-m2-sup', 'p-m3-sup'],
      agenda: 'مراجعة نسب الحضور، خطة الفصل، الاحتياجات المالية.',
      minutes: 'استعرض المدير نسب الحضور لكل مسجد، ونوقشت معوقات تنفيذ خطة الحفظ.',
      decisions: '١) اعتماد خطة الحفظ الجديدة.\n٢) رفع تقرير أسبوعي لكل مسجد يوم الأحد.\n٣) صرف عهدة تشغيلية لكل مسجد.',
      createdBy: 'p-dir', createdAt: shiftDays(T, -5),
    },
    {
      id: 'mt2', scope: 'committee', mosqueId: 'm1', committeeId: 'cm-m1-edu',
      title: 'اجتماع اللجنة التعليمية', place: 'مصلى النساء — جامع عبدالله بن عمر',
      date: shiftDays(T, -2), time: '20:00', attendees: ['p-m1-sup', 'p-m1-1'],
      agenda: 'توزيع المقررات على الحلقات.',
      minutes: 'تمت مراجعة مستويات الطلاب وتوزيعهم على ثلاث حلقات.',
      decisions: 'اعتماد التوزيع الجديد بدءًا من الأسبوع القادم.',
      createdBy: 'p-m1-sup', createdAt: shiftDays(T, -2),
    },
  ]

  const announcements: DB['announcements'] = [
    {
      id: 'an1', target: 'all', title: 'انطلاق الفصل الدراسي الثاني',
      body: 'يبدأ الدوام في جميع مساجد المجمع بعد صلاة العصر من يوم الأحد القادم بإذن الله، ونسأل الله التوفيق للجميع.',
      createdBy: 'p-dir', createdAt: shiftDays(T, -1), pinned: true,
    },
    {
      id: 'an2', target: 'mosque', targetId: 'm2', title: 'صيانة مكيفات المسجد',
      body: 'سيتم تنفيذ أعمال الصيانة يوم الخميس، يُرجى من فريق العمل تهيئة الحلقات في القاعة الجانبية.',
      createdBy: 'p-dir', createdAt: shiftDays(T, -3),
    },
  ]

  const custodies: DB['custodies'] = [
    {
      id: 'c1', mosqueId: 'm1', requesterId: 'p-m1-sup', committeeId: 'cm-m1-act',
      amount: 3000, purpose: 'جوائز مسابقة الحفظ الشهرية', closeDate: shiftDays(T, 12),
      status: 'approved', responsibleId: 'p-m1-2', createdAt: shiftDays(T, -6),
      approvedAt: shiftDays(T, -5),
      expenses: [{ id: 'e1', amount: 1200, description: 'شراء جوائز', date: shiftDays(T, -2) }],
    },
    {
      id: 'c2', mosqueId: 'm2', requesterId: 'p-m2-sup', amount: 1500,
      purpose: 'مستلزمات تشغيلية للمسجد', closeDate: shiftDays(T, 5), status: 'requested',
      createdAt: shiftDays(T, -1), expenses: [],
    },
    {
      id: 'c3', mosqueId: 'm3', requesterId: 'p-m3-sup', amount: 2000,
      purpose: 'طباعة مصاحف وكتيبات', closeDate: shiftDays(T, -10), status: 'closed',
      responsibleId: 'p-m3-3', createdAt: shiftDays(T, -25), approvedAt: shiftDays(T, -24),
      closedAt: shiftDays(T, -9), returned: 250,
      expenses: [
        { id: 'e2', amount: 1250, description: 'طباعة ٥٠٠ كتيب', date: shiftDays(T, -18) },
        { id: 'e3', amount: 500, description: 'مصاحف', date: shiftDays(T, -14) },
      ],
    },
  ]

  const teachers: DB['teachers'] = []
  const teacherNames: Record<string, string[]> = {
    m1: ['د. عبدالعزيز الشريف', 'أ. محمد الصالح', 'أ. سعود البقمي', 'أ. عمر الجهني'],
    m2: ['أ. إبراهيم العمري', 'أ. طلال الحارثي', 'أ. زياد النفيعي'],
    m3: ['أ. حسن الأسمري', 'أ. فهد البلوي', 'أ. وليد الثقفي'],
  }
  Object.entries(teacherNames).forEach(([mid, arr]) => {
    arr.forEach((nm, i) => {
      teachers.push({
        id: `tc-${mid}-${i + 1}`, mosqueId: mid, name: nm, phone: `0533${mid.slice(1)}00${i}`,
        circle: `الحلقة ${['الأولى', 'الثانية', 'الثالثة', 'الرابعة'][i] ?? i + 1}`,
        level: i % 2 === 0 ? 'حفظ' : 'تلاوة وتجويد',
        studentsCount: 12 + ((i * 5) % 9), active: true, notes: '',
      })
    })
  })

  const teacherAttendance: DB['teacherAttendance'] = []
  for (let d = 7; d >= 1; d--) {
    const date = shiftDays(T, -d)
    if (new Date(date).getDay() === 5) continue
    teachers.forEach((t, i) => {
      const r = (d * 5 + i * 3) % 9
      teacherAttendance.push({
        id: `ta-${t.id}-${date}`, mosqueId: t.mosqueId, teacherId: t.id, date,
        status: r === 0 ? 'absent' : r === 1 ? 'late' : r === 2 ? 'excused' : 'present',
      })
    })
  }

  return {
    version: 1,
    settings: {
      complexName: 'مجمع رياض القرآن',
      complexSubtitle: 'حلقات تحفيظ القرآن الكريم — مدينة الملك سعود السكنية بديراب',
      workDaysPerMonth: 26,
      absentDeductionDays: 1,
      excusedDeductionDays: 0.5,
      reminderSeconds: 10,
    },
    mosques, people, committees, tasks, attendance, leaves, meetings,
    reports: [], announcements, custodies, teachers, teacherAttendance,
  }
}
