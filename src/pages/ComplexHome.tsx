import { Link } from 'react-router-dom'
import { useDb } from '../store/db'
import { useAuth } from '../store/auth'
import { Card, Stat, Progress, Badge } from '../components/ui'
import { ActionInbox } from '../components/ActionInbox'
import { LogoMark } from '../components/Brand'
import { todayISO, shiftDays, fmtDate, fmtHijri, fmtDayName } from '../lib/date'
import { staffOf, taskCounts, tasksOf, attendanceStats, personName } from '../lib/selectors'

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
  const geofenced = db.mosques.filter((m) => m.geofence.lat !== 0 || m.geofence.lng !== 0)
  const setupDone = supervisors.length >= db.mosques.length && geofenced.length === db.mosques.length

  return (
    <div className="space-y-5">
      {/* ===== الترويسة ===== */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-bl from-navy-700 via-navy-800 to-navy-950 text-white p-5 sm:p-7 shadow-lift">
        <div className="absolute -top-24 -left-20 w-80 h-80 rounded-full bg-orange-500/15 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.05]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)', backgroundSize: '24px 24px' }} />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
          <LogoMark size={80} rounded="rounded-2xl" pad="p-0" />
          <div className="min-w-0 flex-1">
            <p className="text-white/55 text-[11.5px] font-bold">
              {fmtDayName(today)} · {fmtDate(today)} · {fmtHijri(today)}
            </p>
            <h1 className="text-[22px] sm:text-[28px] font-display font-black mt-1 leading-tight">
              حيّاك الله، {user?.name?.split(' ').slice(0, 2).join(' ')}
            </h1>
            <p className="text-white/60 mt-1.5 text-[12.5px] leading-6">{db.settings.complexSubtitle}</p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-2.5 shrink-0">
            {[
              ['المساجد', db.mosques.length],
              ['العاملون', allStaff.length],
              ['المعلمون', db.teachers.filter((t) => t.active).length],
            ].map(([l, v]) => (
              <div key={l as string} className="bg-white/10 rounded-2xl px-3 sm:px-4 py-2.5 text-center min-w-[74px] border border-white/10">
                <div className="text-[22px] font-display font-black tabular-nums leading-none">{v as number}</div>
                <div className="text-[10px] font-bold text-white/55 mt-1">{l as string}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== خطوات التهيئة ===== */}
      {isDirector && !setupDone && <SetupChecklist />}

      {/* ===== المساجد ===== */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="sect-title">مساجد المجمع</h2>
          <Link to="/complex/dashboard" className="text-[12.5px] font-bold text-navy-600 hover:text-orange-600 transition">
            لوحة المجمع المجمّعة ←
          </Link>
        </div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
          {db.mosques.map((m) => <MosqueCard key={m.id} id={m.id} />)}
        </div>
      </section>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2"><ActionInbox /></div>
        <div className="space-y-4">
          <Card title="نبض المجمع">
            <div className="space-y-4">
              <Meter label="متوسط الحضور (٣٠ يومًا)" value={rate} />
              <Meter label="نسبة إنجاز المهام" value={allTasks.total ? Math.round((allTasks.done / allTasks.total) * 100) : 0} />
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <Stat label="مهام متعثرة" value={allTasks.stuck} tone={allTasks.stuck ? 'rose' : 'slate'} />
                <Stat label="مهام متأخرة" value={allTasks.late} tone={allTasks.late ? 'gold' : 'slate'} />
              </div>
            </div>
          </Card>

          {isDirector && (
            <Card title="اختصارات سريعة">
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['👥', 'العاملون', '/complex/staff'],
                  ['📣', 'إعلان جديد', '/complex/announcements'],
                  ['📄', 'محضر اجتماع', '/complex/meetings'],
                  ['📊', 'التقارير', '/complex/reports'],
                  ['💼', 'المالية', '/complex/finance'],
                  ['⚙️', 'الإعدادات', '/complex/settings'],
                ].map(([i, t, to]) => (
                  <Link key={to as string} to={to as string}
                    className="rounded-2xl border border-line hover:border-navy-300 hover:bg-navy-50 px-3 py-3.5 text-center transition">
                    <div className="text-lg">{i}</div>
                    <div className="text-[11.5px] font-bold mt-1">{t}</div>
                  </Link>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-[12.5px] font-bold mb-1.5">
        <span>{label}</span><span className="tabular-nums">{value}%</span>
      </div>
      <Progress value={value} tone={value >= 85 ? 'brand' : value >= 60 ? 'olive' : 'gold'} />
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
      hint: 'بدونه لن يستطيع أحد تحضير نفسه.',
      to: `/m/${db.mosques[0]?.id}/settings`, cta: 'ضبط النطاق',
    },
    {
      done: db.teachers.length > 0 || db.people.filter((p) => p.role === 'member').length > 0,
      title: 'ثم يتولّى كل مشرف إضافة فريقه ومعلميه',
      hint: 'يسجّل المشرف بيانات فريق عمله ومعلمي مسجده من حسابه.',
      to: '/complex/staff', cta: 'عرض العاملين',
    },
  ]
  const doneCount = steps.filter((s) => s.done).length

  return (
    <Card
      title="خطوات تجهيز المنصة"
      subtitle={`${doneCount} من ${steps.length} خطوات مكتملة`}
      pad={false}
    >
      <div className="px-5 pb-1"><Progress value={(doneCount / steps.length) * 100} tone="gold" /></div>
      <ol className="divide-y divide-line mt-2">
        {steps.map((s, i) => (
          <li key={i} className="px-4 sm:px-5 py-3.5 flex flex-wrap items-center gap-3">
            <span className={`w-8 h-8 rounded-xl grid place-items-center text-[13px] font-black shrink-0
              ${s.done ? 'bg-navy-700 text-white' : 'bg-orange-100 text-orange-700'}`}>
              {s.done ? '✓' : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`font-bold text-[13.5px] ${s.done ? 'text-ink-400 line-through' : ''}`}>{s.title}</p>
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
  const todayAtt = db.attendance.filter((a) => a.mosqueId === id && a.date === today)
  const presentToday = todayAtt.filter((a) => a.status === 'present').length
  const rate = staff.length
    ? Math.round(staff.reduce((s, p) => s + attendanceStats(db, p.id, from, today).rate, 0) / staff.length)
    : 0
  const openCustody = db.custodies.filter((c) => c.mosqueId === id && (c.status === 'approved' || c.status === 'requested'))
  const noGeo = m.geofence.lat === 0 && m.geofence.lng === 0

  return (
    <Link to={`/m/${id}`} className="group card overflow-hidden transition hover:shadow-lift hover:border-navy-300">
      <div className="h-1.5 bg-gradient-to-l from-navy-600 to-navy-900" />
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display font-extrabold text-[16px] truncate">{m.name}</h3>
            <p className="text-[11.5px] text-ink-500 mt-1 truncate">
              {sup ? `المشرف: ${sup.name}` : 'لم يُعيَّن مشرف بعد'}
            </p>
          </div>
          <span className={`chip shrink-0 ${noGeo ? 'bg-orange-100 text-orange-700' : 'bg-navy-50 text-navy-700'}`}>
            {noGeo ? 'بلا نطاق' : `${m.geofence.radius} م`}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-1.5 sm:gap-2 mt-4 text-center">
          {[
            ['الفريق', staff.length],
            ['المعلمون', teachers.length],
            ['حضور اليوم', presentToday],
            ['مهام مفتوحة', tasks.total - tasks.done],
          ].map(([l, v]) => (
            <div key={l as string} className="rounded-xl bg-navy-50 py-2.5">
              <div className="text-[17px] font-display font-extrabold tabular-nums text-navy-800">{v as number}</div>
              <div className="text-[9.5px] font-bold text-ink-500 leading-tight mt-0.5">{l as string}</div>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <div className="flex justify-between text-[11.5px] font-bold text-ink-700 mb-1.5">
            <span>الحضور خلال ٣٠ يومًا</span>
            <span className="tabular-nums">{staff.length ? `${rate}%` : '—'}</span>
          </div>
          <Progress value={rate} tone={rate >= 85 ? 'brand' : rate >= 60 ? 'olive' : 'gold'} />
        </div>

        <div className="flex flex-wrap gap-1.5 mt-3.5 min-h-[26px]">
          {tasks.stuck > 0 && <Badge tone="bad" dot>{tasks.stuck} متعثرة</Badge>}
          {tasks.late > 0 && <Badge tone="warn" dot>{tasks.late} متأخرة</Badge>}
          {openCustody.length > 0 && <Badge tone="info" dot>{openCustody.length} عهدة</Badge>}
          {!sup && <Badge tone="warn" dot>بحاجة لمشرف</Badge>}
          {tasks.stuck === 0 && tasks.late === 0 && openCustody.length === 0 && sup && (
            <Badge tone="ok" dot>لا توجد ملاحظات</Badge>
          )}
        </div>

        <div className="mt-3.5 pt-3.5 border-t border-line flex items-center justify-between">
          <span className="text-[13px] font-black text-navy-700 group-hover:text-orange-600 transition">
            الدخول وإدارة المسجد
          </span>
          <span className="w-8 h-8 rounded-xl bg-navy-50 text-navy-700 grid place-items-center
            group-hover:bg-orange-500 group-hover:text-white transition">←</span>
        </div>
      </div>
    </Link>
  )
}
