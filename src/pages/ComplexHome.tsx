import { Link } from 'react-router-dom'
import { useDb } from '../store/db'
import { useAuth } from '../store/auth'
import { Card, Stat, Progress, Badge } from '../components/ui'
import { ActionInbox } from '../components/ActionInbox'
import { Logo } from '../components/Logo'
import { todayISO, fmtDate, fmtHijri, fmtDayName } from '../lib/date'
import { staffOf, taskCounts, tasksOf, attendanceStats } from '../lib/selectors'
import { shiftDays } from '../lib/date'

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

  return (
    <div className="space-y-6">
      {/* ترويسة */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-bl from-brand-700 via-brand-800 to-brand-900 text-white p-6 sm:p-8 shadow-lift">
        <div className="absolute -top-20 -left-16 w-72 h-72 rounded-full bg-gold-400/20 blur-3xl" />
        <div className="absolute -bottom-24 right-10 w-72 h-56 rounded-full bg-olive-400/20 blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="bg-white rounded-3xl w-20 h-20 grid place-items-center shadow-lift shrink-0">
            <Logo size={62} />
          </div>
          <div className="min-w-0">
            <p className="text-white/70 text-[12px] font-bold">
              {fmtDayName(today)} · {fmtDate(today)} · {fmtHijri(today)}
            </p>
            <h1 className="text-2xl sm:text-3xl font-display font-black mt-1">
              حيّاك الله، {user?.name?.split(' ').slice(0, 2).join(' ')}
            </h1>
            <p className="text-white/75 mt-1.5 text-sm">{db.settings.complexSubtitle}</p>
          </div>
          <div className="sm:mr-auto grid grid-cols-3 gap-3 shrink-0">
            {[
              ['المساجد', db.mosques.length],
              ['العاملون', allStaff.length],
              ['المعلمون', db.teachers.filter((t) => t.active).length],
            ].map(([l, v]) => (
              <div key={l as string} className="bg-white/10 backdrop-blur rounded-2xl px-4 py-3 text-center min-w-[84px]">
                <div className="text-2xl font-display font-black tabular-nums">{v as number}</div>
                <div className="text-[10px] font-bold text-white/70">{l as string}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* المساجد */}
      <div>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="sect-title">مساجد المجمع</h2>
          <Link to="/complex/dashboard" className="text-[13px] font-bold text-brand-600 hover:underline">
            لوحة المجمع المجمّعة ←
          </Link>
        </div>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {db.mosques.map((m) => <MosqueCard key={m.id} id={m.id} />)}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2"><ActionInbox /></div>
        <div className="space-y-5">
          <Card title="نبض المجمع">
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-[13px] font-bold mb-1.5">
                  <span>متوسط الحضور (٣٠ يومًا)</span><span className="tabular-nums">{rate}%</span>
                </div>
                <Progress value={rate} tone={rate >= 85 ? 'olive' : rate >= 70 ? 'gold' : 'rose'} />
              </div>
              <div>
                <div className="flex justify-between text-[13px] font-bold mb-1.5">
                  <span>إنجاز المهام</span>
                  <span className="tabular-nums">{allTasks.total ? Math.round((allTasks.done / allTasks.total) * 100) : 0}%</span>
                </div>
                <Progress value={allTasks.total ? (allTasks.done / allTasks.total) * 100 : 0} tone="brand" />
              </div>
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
                  ['📣', 'إعلان جديد', '/complex/announcements'],
                  ['📄', 'محضر اجتماع', '/complex/meetings'],
                  ['📊', 'تقارير المجمع', '/complex/reports'],
                  ['💼', 'الإدارة المالية', '/complex/finance'],
                  ['👥', 'العاملون', '/complex/staff'],
                  ['⚙️', 'الإعدادات', '/complex/settings'],
                ].map(([i, t, to]) => (
                  <Link key={to} to={to as string}
                    className="rounded-2xl border border-slate-200 hover:border-brand-300 hover:bg-brand-50/50 px-3 py-3.5 text-center transition">
                    <div className="text-xl">{i}</div>
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

function MosqueCard({ id }: { id: string }) {
  const { db } = useDb()
  const today = todayISO()
  const from = shiftDays(today, -29)
  const m = db.mosques.find((x) => x.id === id)!
  const staff = staffOf(db, id)
  const sup = db.people.find((p) => p.id === m.supervisorId)
  const tasks = taskCounts(tasksOf(db, id))
  const teachers = db.teachers.filter((t) => t.mosqueId === id && t.active)
  const todayAtt = db.attendance.filter((a) => a.mosqueId === id && a.date === today)
  const presentToday = todayAtt.filter((a) => a.status === 'present').length
  const rate = staff.length
    ? Math.round(staff.reduce((s, p) => s + attendanceStats(db, p.id, from, today).rate, 0) / staff.length)
    : 0
  const openCustody = db.custodies.filter((c) => c.mosqueId === id && c.status !== 'closed' && c.status !== 'rejected')

  const theme = {
    brand: { bar: 'from-brand-500 to-brand-800', ring: 'group-hover:border-brand-300', text: 'text-brand-700' },
    olive: { bar: 'from-olive-400 to-olive-700', ring: 'group-hover:border-olive-300', text: 'text-olive-700' },
    gold: { bar: 'from-gold-300 to-gold-600', ring: 'group-hover:border-gold-300', text: 'text-gold-600' },
  }[m.color]

  return (
    <Link to={`/m/${id}`} className={`group card overflow-hidden transition hover:shadow-lift border-slate-200 ${theme.ring}`}>
      <div className={`h-1.5 bg-gradient-to-l ${theme.bar}`} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display font-extrabold text-[17px] truncate">{m.name}</h3>
            <p className="text-[11.5px] text-ink-500 mt-0.5 truncate">المشرف: {sup?.name ?? 'غير معيّن'}</p>
          </div>
          <span className={`chip bg-slate-100 ${theme.text} shrink-0`}>📍 {m.geofence.radius} م</span>
        </div>

        <div className="grid grid-cols-4 gap-2 mt-4 text-center">
          {[
            ['فريق العمل', staff.length],
            ['المعلمون', teachers.length],
            ['حضور اليوم', presentToday],
            ['مهام مفتوحة', tasks.total - tasks.done],
          ].map(([l, v]) => (
            <div key={l as string} className="rounded-xl bg-slate-50 py-2.5">
              <div className="text-lg font-display font-extrabold tabular-nums">{v as number}</div>
              <div className="text-[9.5px] font-bold text-ink-500 leading-tight">{l as string}</div>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <div className="flex justify-between text-[11.5px] font-bold text-ink-700 mb-1.5">
            <span>نسبة الحضور خلال ٣٠ يومًا</span><span className="tabular-nums">{rate}%</span>
          </div>
          <Progress value={rate} tone={rate >= 85 ? 'olive' : rate >= 70 ? 'gold' : 'rose'} />
        </div>

        <div className="flex flex-wrap gap-1.5 mt-4">
          {tasks.stuck > 0 && <Badge tone="bad" dot>{tasks.stuck} متعثرة</Badge>}
          {tasks.late > 0 && <Badge tone="warn" dot>{tasks.late} متأخرة</Badge>}
          {openCustody.length > 0 && <Badge tone="info" dot>{openCustody.length} عهدة مفتوحة</Badge>}
          {tasks.stuck === 0 && tasks.late === 0 && openCustody.length === 0 && <Badge tone="ok" dot>لا توجد ملاحظات</Badge>}
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[13px] font-black text-brand-700">الدخول وإدارة المسجد</span>
          <span className="w-8 h-8 rounded-xl bg-brand-50 text-brand-700 grid place-items-center group-hover:bg-brand-700 group-hover:text-white transition">←</span>
        </div>
      </div>
    </Link>
  )
}
