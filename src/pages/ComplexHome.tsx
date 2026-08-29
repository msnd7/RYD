import { Link } from 'react-router-dom'
import { useDb } from '../store/db'
import { useAuth } from '../store/auth'
import { Card, Progress, Badge, StatStrip } from '../components/ui'
import { PageHeader } from '../components/PageHeader'
import { ActionInbox } from '../components/ActionInbox'
import { LogoMark } from '../components/Brand'
import { todayISO, shiftDays, fmtDate, fmtHijri, fmtDayName } from '../lib/date'
import { staffOf, taskCounts, tasksOf, attendanceStats } from '../lib/selectors'

export default function ComplexHome() {
  const { db } = useDb()
  const { user, isDirector } = useAuth()
  const today = todayISO()
  const from = shiftDays(today, -29)

  const allStaff = db.people.filter((p) => p.mosqueId !== 'complex' && p.active)
  const allTasks = taskCounts(db.tasks)
  const rate = allStaff.length
    ? Math.round(allStaff.reduce((s, p) => s + attendanceStats(db, p.id, from, today).rate, 0) / allStaff.length)
    : 0

  const supervisors = db.people.filter((p) => p.role === 'supervisor' && p.active)
  const setupDone =
    supervisors.length >= db.mosques.length &&
    db.mosques.every((m) => m.geofence.lat !== 0 || m.geofence.lng !== 0)

  return (
    <div className="space-y-5">
      {/* ترويسة هادئة يظهر فيها الشعار على طبيعته */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-4 pb-5 border-b border-line">
        <LogoMark h={64} />
        <div className="min-w-0 flex-1">
          <p className="eyebrow">{fmtDayName(today)} · {fmtDate(today)} · {fmtHijri(today)}</p>
          <h1 className="text-navy-900 mt-1">حيّاك الله، {user?.name?.split(' ').slice(0, 2).join(' ')}</h1>
          <p className="muted mt-1">{db.settings.complexSubtitle}</p>
        </div>
      </div>

      <StatStrip items={[
        { label: 'المساجد', value: db.mosques.length },
        { label: 'الموظفون', value: allStaff.length },
        { label: 'المعلمون', value: db.teachers.filter((t) => t.active).length },
        { label: 'متوسط الحضور', value: allStaff.length ? `${rate}%` : '—', hint: 'آخر ٣٠ يومًا' },
        {
          label: 'بنود تحتاج متابعة', value: allTasks.stuck + allTasks.late,
          hint: `${allTasks.stuck} متعثرة · ${allTasks.late} متأخرة`,
          accent: allTasks.stuck + allTasks.late > 0,
        },
      ]} />

      {isDirector && !setupDone && <SetupChecklist />}

      <section>
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <h2 className="sect-title">مساجد المجمع</h2>
          <Link to="/complex/dashboard" className="text-[12px] font-bold text-navy-600 hover:text-orange-600 transition">
            لوحة المجمع المجمّعة ←
          </Link>
        </div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
          {db.mosques.map((m) => <MosqueCard key={m.id} id={m.id} />)}
        </div>
      </section>

      <div className="grid lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2"><ActionInbox /></div>
        {isDirector && (
          <Card title="اختصارات">
            <div className="grid grid-cols-2 gap-2">
              {[
                ['الموظفون', '/complex/staff'],
                ['إعلان جديد', '/complex/announcements'],
                ['محضر اجتماع', '/complex/meetings'],
                ['التقارير', '/complex/reports'],
                ['الإدارة المالية', '/complex/finance'],
                ['الإعدادات', '/complex/settings'],
              ].map(([t, to]) => (
                <Link key={to} to={to}
                  className="rounded-xl border border-line hover:border-navy-300 hover:bg-navy-50 px-3 h-[52px]
                    grid place-items-center text-center text-[12px] font-bold text-ink-700 hover:text-navy-800 transition">
                  {t}
                </Link>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

/* ===== خطوات تهيئة المنصة ===== */
function SetupChecklist() {
  const { db } = useDb()
  const supervisors = db.people.filter((p) => p.role === 'supervisor' && p.active)
  const director = db.people.find((p) => p.role === 'director')

  const steps = [
    {
      done: !director?.mustChangePassword,
      title: 'غيّر رمز دخولك',
      hint: 'استبدل الرمز المبدئي برمز خاص بك.',
      to: '/change-password', cta: 'تغيير الرمز',
    },
    {
      done: supervisors.length >= db.mosques.length,
      title: 'أضف مشرفًا لكل مسجد',
      hint: `${supervisors.length} من ${db.mosques.length} مساجد لها مشرف. يُضاف المشرف ببريده ورمز مبدئي.`,
      to: '/complex/staff', cta: 'إضافة مشرف',
    },
    {
      done: db.mosques.every((m) => m.geofence.lat !== 0 || m.geofence.lng !== 0),
      title: 'حدّد النطاق المكاني لكل مسجد',
      hint: 'بدونه لا يستطيع أحد تحضير نفسه.',
      to: `/m/${db.mosques[0]?.id}/settings`, cta: 'ضبط النطاق',
    },
    {
      done: db.teachers.length > 0,
      title: 'ثم يضيف كل مشرف موظفي مسجده ومعلميه',
      hint: 'الموظف يدخل بحسابه ويحضّر نفسه، والمعلم يحضّره المشرف.',
      to: '/complex/staff', cta: 'عرض الموظفين',
    },
  ]
  const doneCount = steps.filter((s) => s.done).length

  return (
    <Card title="خطوات تجهيز المنصة" subtitle={`${doneCount} من ${steps.length} خطوات مكتملة`} pad={false}>
      <div className="px-4 sm:px-5"><Progress value={(doneCount / steps.length) * 100} tone="gold" /></div>
      <ol className="divide-y divide-line mt-2">
        {steps.map((s, i) => (
          <li key={i} className="px-4 sm:px-5 py-3 flex flex-wrap items-center gap-3">
            <span className={`w-7 h-7 rounded-lg grid place-items-center text-[12px] font-black shrink-0
              ${s.done ? 'bg-navy-100 text-navy-700' : 'bg-orange-500 text-white'}`}>
              {s.done ? '✓' : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`font-bold text-[13px] ${s.done ? 'text-ink-400 line-through' : 'text-ink-900'}`}>{s.title}</p>
              <p className="text-[11.5px] text-ink-500 leading-5 mt-0.5">{s.hint}</p>
            </div>
            {!s.done && <Link to={s.to} className="btn-accent btn-sm">{s.cta}</Link>}
          </li>
        ))}
      </ol>
    </Card>
  )
}

/* ===== بطاقة مسجد ===== */
function MosqueCard({ id }: { id: string }) {
  const { db } = useDb()
  const today = todayISO()
  const from = shiftDays(today, -29)
  const m = db.mosques.find((x) => x.id === id)!
  const staff = staffOf(db, id)
  const sup = db.people.find((p) => p.id === m.supervisorId && p.active)
  const tasks = taskCounts(tasksOf(db, id))
  const teachers = db.teachers.filter((t) => t.mosqueId === id && t.active)
  const presentToday = db.attendance.filter((a) => a.mosqueId === id && a.date === today && a.status === 'present').length
  const rate = staff.length
    ? Math.round(staff.reduce((s, p) => s + attendanceStats(db, p.id, from, today).rate, 0) / staff.length)
    : 0
  const openCustody = db.custodies.filter((c) => c.mosqueId === id && (c.status === 'approved' || c.status === 'requested'))
  const noGeo = m.geofence.lat === 0 && m.geofence.lng === 0

  return (
    <Link to={`/m/${id}`} className="group card p-4 sm:p-5 transition hover:shadow-lift hover:border-navy-300">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-navy-900 truncate">{m.name}</h3>
          <p className="text-[11.5px] text-ink-400 mt-1 truncate">
            {sup ? `المشرف: ${sup.name}` : 'لم يُعيَّن مشرف بعد'}
          </p>
        </div>
        <span className="w-8 h-8 rounded-lg bg-navy-50 text-navy-700 grid place-items-center shrink-0
          group-hover:bg-orange-500 group-hover:text-white transition text-[15px]">←</span>
      </div>

      <dl className="grid grid-cols-4 gap-px bg-line rounded-xl overflow-hidden mt-4 border border-line">
        {[
          ['إداريون', staff.length],
          ['معلمون', teachers.length],
          ['حضور اليوم', presentToday],
          ['مهام مفتوحة', tasks.total - tasks.done],
        ].map(([l, v]) => (
          <div key={l as string} className="bg-surface py-2.5 text-center">
            <dd className="num text-[16px] text-navy-800">{v as number}</dd>
            <dt className="text-[9.5px] font-bold text-ink-400 mt-0.5">{l as string}</dt>
          </div>
        ))}
      </dl>

      <div className="mt-3.5">
        <div className="flex justify-between text-[11px] font-bold text-ink-500 mb-1.5">
          <span>الحضور خلال ٣٠ يومًا</span>
          <span className="num text-ink-900">{staff.length ? `${rate}%` : '—'}</span>
        </div>
        <Progress value={rate} tone={rate >= 85 ? 'brand' : rate >= 60 ? 'olive' : 'gold'} />
      </div>

      <div className="flex flex-wrap gap-1.5 mt-3">
        {!sup && <Badge tone="bad" dot>بحاجة لمشرف</Badge>}
        {noGeo && <Badge tone="warn" dot>بلا نطاق مكاني</Badge>}
        {tasks.stuck > 0 && <Badge tone="bad" dot>{tasks.stuck} متعثرة</Badge>}
        {tasks.late > 0 && <Badge tone="warn" dot>{tasks.late} متأخرة</Badge>}
        {openCustody.length > 0 && <Badge tone="info" dot>{openCustody.length} عهدة</Badge>}
        {sup && !noGeo && !tasks.stuck && !tasks.late && !openCustody.length && (
          <Badge tone="ok" dot>لا توجد ملاحظات</Badge>
        )}
      </div>
    </Link>
  )
}
