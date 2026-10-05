export type ID = string

export type Role = 'director' | 'supervisor' | 'member'

export interface Geofence { lat: number; lng: number; radius: number } // radius بالأمتار

export interface Mosque {
  id: ID
  name: string
  shortName: string
  address: string
  color: 'brand' | 'gold' | 'olive'
  geofence: Geofence
  supervisorId?: ID
}

export interface Contract {
  title: string
  startDate: string
  salary: number
  terms: string
  signedAt?: string
  signature?: string   // dataURL للتوقيع بالرسم
  acknowledged?: boolean
}

export interface Person {
  id: ID
  mosqueId: ID | 'complex'
  name: string
  jobTitle: string
  phone: string
  role: Role
  committeeIds: ID[]
  salary: number
  email: string                // يُستخدم للدخول
  password: string
  mustChangePassword: boolean  // يُجبر على تغيير الرمز عند أول دخول أو بعد إعادة التعيين
  financeAccess: boolean       // تفويض مالي من المدير
  active: boolean
  hiredAt: string
  createdBy?: ID
  lastLoginAt?: string
  contract?: Contract
}

export interface Committee {
  id: ID
  mosqueId: ID
  name: string
  goal: string
  leaderId?: ID
}

export type TaskKind = 'task' | 'decision' | 'recommendation'
export type TaskStatus = 'pending' | 'done' | 'stuck' | 'postponed'
/** تصنيف مصفوفة أيزنهاور: q1 هام وعاجل · q2 هام غير عاجل · q3 عاجل غير هام · q4 غير هام وغير عاجل */
export type TaskPriority = 'q1' | 'q2' | 'q3' | 'q4'

export interface Task {
  id: ID
  mosqueId: ID
  committeeId: ID
  assigneeId: ID
  title: string
  details: string
  kind: TaskKind
  status: TaskStatus
  dueDate: string
  remindBefore: number   // بالأيام
  createdBy: ID
  createdAt: string
  doneAt?: string
  note?: string
  /** موقعها في مصفوفة أيزنهاور — غير المصنّفة تبقى بلا قيمة */
  priority?: TaskPriority
  /** تثبيت المهمة أعلى القائمة وعلى التقويم خلال فترة يحددها المستخدم */
  pinFrom?: string
  pinTo?: string
}

export type AttStatus = 'present' | 'absent' | 'excused'

export interface Attendance {
  id: ID
  mosqueId: ID
  personId: ID
  date: string          // YYYY-MM-DD
  status: AttStatus
  checkInAt?: string
  distance?: number     // متر من مركز النطاق
  source: 'geo' | 'manual' | 'system'
}

export type LeaveStatus = 'pending' | 'approved' | 'rejected'

export interface LeaveRequest {
  id: ID
  mosqueId: ID
  /** staff = إداري له حساب، teacher = معلم يرفع له المشرف الطلب */
  personType: 'staff' | 'teacher'
  personId: ID
  date: string
  reason: string
  status: LeaveStatus
  createdAt: string
  decidedBy?: ID
  decidedAt?: string
  decisionNote?: string
}

export type MeetingScope = 'complex' | 'mosque' | 'committee'

export interface Meeting {
  id: ID
  scope: MeetingScope
  mosqueId: ID | 'complex'
  committeeId?: ID
  title: string
  place: string
  date: string
  time: string
  attendees: ID[]
  agenda: string
  minutes: string
  decisions: string
  createdBy: ID
  createdAt: string
}

export interface UploadedFile {
  name: string
  type: string
  size: number
  /** رابط الملف على الخادم في الوضع المشترك */
  url?: string
  /** بيانات مضمّنة في الوضع المحلي (بلا خادم) */
  dataUrl?: string
}

export interface PeriodReport {
  id: ID
  mosqueId: ID
  committeeId?: ID
  period: 'weekly' | 'monthly'
  title: string
  summary: string
  files: UploadedFile[]
  createdBy: ID
  createdAt: string
}

export type AnnounceTarget = 'all' | 'mosque' | 'committee' | 'person'

export interface Announcement {
  id: ID
  target: AnnounceTarget
  targetId?: ID
  title: string
  body: string
  createdBy: ID
  createdAt: string
  pinned?: boolean
}

export type CustodyStatus = 'requested' | 'approved' | 'rejected' | 'closed'

export interface Expense {
  id: ID
  amount: number
  description: string
  date: string
  invoice?: UploadedFile
}

export interface Custody {
  id: ID
  mosqueId: ID
  requesterId: ID
  committeeId?: ID
  amount: number
  purpose: string
  closeDate: string
  status: CustodyStatus
  responsibleId?: ID      // المسؤول عن الاستلام والإقفال
  createdAt: string
  approvedAt?: string
  closedAt?: string
  returned?: number
  expenses: Expense[]
  note?: string
}

export interface Teacher {
  id: ID
  mosqueId: ID
  name: string
  phone: string
  circle: string        // الحلقة
  level: string         // المرحلة الدراسية
  studentsCount: number
  salary: number        // الراتب الشهري — أساس احتساب خصومات الغياب والاستئذان
  active: boolean
  notes: string
  hiredAt?: string
  evaluation?: { score: number; note: string; at: string }
}

export type TeacherAttStatus = 'present' | 'absent' | 'late' | 'excused'

export interface TeacherAttendance {
  id: ID
  mosqueId: ID
  teacherId: ID
  date: string
  status: TeacherAttStatus
  note?: string
}

/* ================= عقود المعلمين ================= */
export type TeacherContractStatus = 'draft' | 'awaiting' | 'signed' | 'cancelled'

/** عقد عمل للمعلم يُعدّه المفوض المالي، ويوقّعه المعلم على جهاز المفوض بعد قراءته */
export interface TeacherContract {
  id: ID
  mosqueId: ID
  teacherId: ID
  title: string
  startDate: string
  endDate: string
  salary: number
  workDays: string       // أيام الدوام
  workHours: string      // وقت الحلقة
  duties: string         // المهام والواجبات
  terms: string          // بنود إضافية
  status: TeacherContractStatus
  createdBy: ID
  createdAt: string
  /** توقيع الطرف الأول (المفوض المالي) */
  issuerSignature?: string
  issuerName?: string
  /** توقيع المعلم بعد القراءة والإقرار */
  teacherSignature?: string
  teacherSignedName?: string
  readAt?: string
  signedAt?: string      // ISO كامل بالوقت
  sentAt?: string
}

/* ================= دورات الرواتب ================= */
export interface PayrollLine {
  kind: 'staff' | 'teacher'
  personId: ID
  name: string
  sub: string
  mosqueId: ID
  salary: number
  dayValue: number
  absent: number
  excused: number
  late: number
  deductionDays: number
  deduction: number
  net: number
}

/**
 * مسيّر شهر ميلادي مُعتمد: تُثبَّت فيه الأرقام عند الاعتماد،
 * فلا تتغيّر تقارير الأشهر الماضية لو تغيّر راتب أحد لاحقًا.
 * الرواتب تُصرف يوم ١ من الشهر التالي، ومعه يبدأ احتساب شهر جديد.
 */
export interface PayrollRun {
  id: ID
  month: string          // YYYY-MM — شهر العمل المحتسب
  lines: PayrollLine[]
  approvedBy: ID
  approvedAt: string
  paidAt?: string        // تاريخ الصرف الفعلي
  paidBy?: ID
  note?: string
}

/* ================= توصيات قائد اللجنة لفريقه ================= */
export interface TeamNote {
  id: ID
  mosqueId: ID
  committeeId: ID
  kind: 'recommendation' | 'directive'   // توصية · توجيه
  title: string
  body: string
  priority: 'normal' | 'high'
  /** فارغ = لكل الفريق */
  targetIds: ID[]
  createdBy: ID
  createdAt: string
  acks: { personId: ID; at: string }[]
}

export interface Settings {
  complexName: string
  complexSubtitle: string
  workDaysPerMonth: number
  absentDeductionDays: number   // خصم الغياب (يوم كامل)
  excusedDeductionDays: number  // خصم الاستئذان (نصف يوم)
  reminderSeconds: number       // مدة ظهور إشعار الدخول
  defaultPassword: string       // الرمز المبدئي عند الإضافة أو إعادة التعيين
  pushEnabled: boolean          // تفعيل إشعارات التذكير على الجهاز
  lateDeductionDays: number     // خصم التأخير للمعلم (بالأيام)
  payDay: number                // يوم صرف الرواتب من الشهر الميلادي التالي (١)
}

export interface DB {
  version: number
  settings: Settings
  mosques: Mosque[]
  people: Person[]
  committees: Committee[]
  tasks: Task[]
  attendance: Attendance[]
  leaves: LeaveRequest[]
  meetings: Meeting[]
  reports: PeriodReport[]
  announcements: Announcement[]
  custodies: Custody[]
  teachers: Teacher[]
  teacherAttendance: TeacherAttendance[]
  teacherContracts: TeacherContract[]
  payrollRuns: PayrollRun[]
  teamNotes: TeamNote[]
}
