import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDb } from '../store/db'
import { useAuth } from '../store/auth'
import { Card, Field, useToast, Empty, Badge, Modal, Tabs, Select, Menu } from '../components/ui'
import { PageHeader } from '../components/PageHeader'
import {
  canInstall, isStandalone, notificationPermission, notificationsSupported,
  onPwaChange, promptInstall, requestNotificationPermission, showNotification,
} from '../lib/pwa'
import { fmtDate } from '../lib/date'
import { mosqueName } from '../lib/selectors'
import type { Person } from '../types'

export default function ComplexSettings() {
  const { db, set, reset, exportJson, importJson } = useDb()
  const { isDirector } = useAuth()
  const [tab, setTab] = useState<'accounts' | 'policy' | 'app' | 'data'>('accounts')

  if (!isDirector) return <Card><Empty icon="🔒" title="الإعدادات مقصورة على مدير المجمع" /></Card>

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="الإدارة العامة"
        title="الإعدادات"
        description="حسابات الدخول وإعادة تعيين الرموز، وسياسة الحضور والخصومات، وتثبيت التطبيق والإشعارات، والنسخ الاحتياطي."
      />
      <Tabs value={tab} onChange={(v) => setTab(v as any)} items={[
        { value: 'accounts', label: 'الحسابات والدخول' },
        { value: 'policy', label: 'الهوية والسياسات' },
        { value: 'app', label: 'التطبيق والإشعارات' },
        { value: 'data', label: 'البيانات' },
      ]} />
      {tab === 'accounts' && <Accounts />}
      {tab === 'policy' && <Policy />}
      {tab === 'app' && <AppSettings />}
      {tab === 'data' && <DataSettings />}
    </div>
  )
}

/* ================= الحسابات ================= */
function Accounts() {
  const { db, set } = useDb()
  const { user } = useAuth()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [reveal, setReveal] = useState<Person | null>(null)

  const people = db.people
    .filter((p) => p.active)
    .filter((p) => !q.trim() || (p.name + p.email + p.jobTitle).includes(q.trim()))

  const resetOne = (p: Person) => {
    if (!confirm(`إعادة تعيين رمز ${p.name} إلى الرمز المبدئي (${db.settings.defaultPassword})؟\nسيُطلب منه تغييره عند أول دخول.`)) return
    set((d) => {
      const x = d.people.find((y) => y.id === p.id)!
      x.password = d.settings.defaultPassword
      x.mustChangePassword = true
    })
    setReveal({ ...p, password: db.settings.defaultPassword })
    toast('تمت إعادة تعيين الرمز')
  }

  return (
    <div className="space-y-5">
      <Card title="إدارة الدخول" subtitle="إعادة تعيين رمز أي حساب ليعود إلى الرمز المبدئي"
        action={<Link to="/complex/staff" className="btn-primary btn-sm">＋ إضافة حساب</Link>} pad={false}>
        <div className="px-4 sm:px-5 py-3">
          <input className="field" placeholder="بحث بالاسم أو البريد…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <ul className="divide-y divide-line">
          {people.map((p) => (
            <li key={p.id} className="px-4 sm:px-5 py-3.5 flex flex-wrap items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-navy-700 text-white grid place-items-center font-extrabold shrink-0">
                {p.name.trim()[0]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-[13.5px] truncate">
                  {p.name}
                  {p.id === user?.id && <span className="text-[11px] text-ink-400 font-normal"> (أنت)</span>}
                </p>
                <p className="text-[11.5px] text-ink-500 truncate" dir="ltr">{p.email}</p>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  <Badge tone={p.role === 'director' ? 'purple' : p.role === 'supervisor' ? 'info' : 'mute'}>
                    {p.role === 'director' ? 'مدير المجمع' : p.role === 'supervisor' ? 'مشرف' : 'عضو'}
                  </Badge>
                  {p.mosqueId !== 'complex' && <Badge tone="mute">{mosqueName(db, p.mosqueId)}</Badge>}
                  {p.mustChangePassword
                    ? <Badge tone="warn">رمز مبدئي — لم يُغيَّر</Badge>
                    : <Badge tone="ok">رمز خاص مفعّل</Badge>}
                  {p.lastLoginAt && <Badge tone="mute">آخر دخول {fmtDate(p.lastLoginAt.slice(0, 10))}</Badge>}
                </div>
              </div>
              <button className="btn-ghost btn-sm" onClick={() => resetOne(p)}>إعادة تعيين الرمز</button>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="الرمز المبدئي" subtitle="يُمنح للحسابات الجديدة وعند إعادة التعيين">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="الرمز المبدئي">
            <input className="field w-40 text-left tabular-nums" dir="ltr" value={db.settings.defaultPassword}
              onChange={(e) => set((d) => { d.settings.defaultPassword = e.target.value })} />
          </Field>
          <p className="muted flex-1 min-w-[220px]">
            يُطلب من كل حساب تغيير هذا الرمز فور أول دخول، ولا يُقبل الإبقاء عليه.
          </p>
        </div>
      </Card>

      {reveal && (
        <Modal open onClose={() => setReveal(null)} title="تم تعيين الرمز"
          footer={<button className="btn-primary" onClick={() => setReveal(null)}>تم</button>}>
          <div className="rounded-2xl bg-navy-50 border border-navy-100 p-4 space-y-3">
            {[['الاسم', reveal.name], ['البريد', reveal.email], ['الرمز المبدئي', reveal.password]].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <span className="text-[12px] font-bold text-ink-500">{k}</span>
                <b className="text-[14px]" dir={k === 'الاسم' ? 'rtl' : 'ltr'}>{v}</b>
              </div>
            ))}
          </div>
          <p className="muted mt-3">أبلغ صاحب الحساب بالرمز، وسيُطلب منه تغييره عند الدخول.</p>
        </Modal>
      )}
    </div>
  )
}

/* ================= الهوية والسياسات ================= */
function Policy() {
  const { db, set } = useDb()
  const toast = useToast()
  const [s, setS] = useState({ ...db.settings })
  const [aiEndpoint, setAiEndpoint] = useState(localStorage.getItem('ryd.ai.endpoint') ?? '')

  const save = () => {
    set((d) => {
      d.settings = {
        ...d.settings, ...s,
        workDaysPerMonth: Number(s.workDaysPerMonth) || 26,
        absentDeductionDays: Number(s.absentDeductionDays),
        excusedDeductionDays: Number(s.excusedDeductionDays),
        reminderSeconds: Number(s.reminderSeconds) || 10,
      }
    })
    toast('تم حفظ الإعدادات')
  }

  return (
    <div className="space-y-5">
      <Card title="هوية المجمع">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="اسم المجمع">
            <input className="field" value={s.complexName} onChange={(e) => setS({ ...s, complexName: e.target.value })} />
          </Field>
          <Field label="الوصف">
            <input className="field" value={s.complexSubtitle} onChange={(e) => setS({ ...s, complexSubtitle: e.target.value })} />
          </Field>
        </div>
      </Card>

      <Card title="سياسة الحضور والخصومات">
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="أيام العمل في الشهر" hint="أساس احتساب قيمة اليوم">
            <input type="number" className="field" value={s.workDaysPerMonth}
              onChange={(e) => setS({ ...s, workDaysPerMonth: e.target.value as any })} />
          </Field>
          <Field label="خصم يوم الغياب" hint="بالأيام — الافتراضي يوم كامل">
            <input type="number" step="0.5" className="field" value={s.absentDeductionDays}
              onChange={(e) => setS({ ...s, absentDeductionDays: e.target.value as any })} />
          </Field>
          <Field label="خصم الاستئذان" hint="بالأيام — الافتراضي نصف يوم">
            <input type="number" step="0.5" className="field" value={s.excusedDeductionDays}
              onChange={(e) => setS({ ...s, excusedDeductionDays: e.target.value as any })} />
          </Field>
        </div>
      </Card>

      <Card title="النطاق المكاني للمساجد" pad={false}>
        <ul className="divide-y divide-line">
          {db.mosques.map((m) => (
            <li key={m.id} className="px-4 sm:px-5 py-3.5 flex flex-wrap items-center gap-3">
              <span className="font-bold text-[13.5px] flex-1 min-w-[160px]">{m.name}</span>
              {m.geofence.lat === 0 && m.geofence.lng === 0
                ? <Badge tone="warn">لم يُحدَّد النطاق بعد</Badge>
                : <Badge tone="ok">نطاق {m.geofence.radius} م</Badge>}
              <Link to={`/m/${m.id}/settings`} className="btn-ghost btn-sm">ضبط النطاق</Link>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="مساعد التنسيق الذكي" subtitle="يعمل حاليًا داخل المتصفح بقواعد لغوية عربية بدون إنترنت">
        <Field label="ربط بخدمة ذكاء اصطناعي (اختياري)"
          hint="خدمة تستقبل { text, kind } وتعيد { text }. اتركه فارغًا لاستخدام التنسيق المحلي.">
          <div className="flex flex-wrap gap-2">
            <input className="field flex-1 min-w-[220px] text-left" dir="ltr" value={aiEndpoint}
              onChange={(e) => setAiEndpoint(e.target.value)} placeholder="https://example.com/api/polish" />
            <button className="btn-ghost btn-sm" onClick={() => {
              if (aiEndpoint.trim()) localStorage.setItem('ryd.ai.endpoint', aiEndpoint.trim())
              else localStorage.removeItem('ryd.ai.endpoint')
              toast('تم الحفظ')
            }}>حفظ</button>
          </div>
        </Field>
      </Card>

      <Card title="مدة إشعار الدخول">
        <Field label="بالثواني" hint="يظهر عند كل دخول ثم يختفي تلقائيًا">
          <input type="number" className="field max-w-[160px]" value={s.reminderSeconds}
            onChange={(e) => setS({ ...s, reminderSeconds: e.target.value as any })} />
        </Field>
      </Card>

      <button className="btn-primary" onClick={save}>حفظ الإعدادات</button>
    </div>
  )
}

/* ================= التطبيق والإشعارات ================= */
function AppSettings() {
  const { db, set } = useDb()
  const toast = useToast()
  const [, force] = useState(0)
  useEffect(() => onPwaChange(() => force((n) => n + 1)), [])

  const perm = notificationPermission()
  const installed = isStandalone()

  const enable = async () => {
    if (!notificationsSupported()) return toast('متصفحك لا يدعم الإشعارات.', 'bad')
    const p = await requestNotificationPermission()
    if (p !== 'granted') return toast('لم يُمنح إذن الإشعارات.', 'bad')
    set((d) => { d.settings.pushEnabled = true })
    await showNotification('تم تفعيل التذكيرات ✅', 'ستصلك تنبيهات باقتراب مواعيد المهام والقرارات.')
    toast('تم تفعيل الإشعارات')
  }

  return (
    <div className="space-y-5">
      <Card title="تثبيت التطبيق على الجهاز"
        subtitle="المنصة تعمل كتطبيق مستقل على الجوال والتابلت والحاسب">
        {installed ? (
          <div className="rounded-2xl bg-navy-50 border border-navy-100 p-4 text-[13px] font-bold text-navy-800">
            ✔ التطبيق مثبَّت ويعمل الآن في وضع التطبيق المستقل.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <button className="btn-accent" disabled={!canInstall()} onClick={async () => {
                const r = await promptInstall()
                if (r === 'accepted') toast('جارٍ تثبيت التطبيق…')
              }}>
                {canInstall() ? '⬇ تثبيت التطبيق الآن' : 'التثبيت غير متاح في هذا المتصفح'}
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 mt-4">
              <Guide title="آيفون / آيباد (Safari)" steps={[
                'افتح المنصة في متصفح Safari.',
                'اضغط زر المشاركة ⬆️ في الأسفل.',
                'اختر «إضافة إلى الشاشة الرئيسية».',
              ]} />
              <Guide title="أندرويد (Chrome)" steps={[
                'افتح المنصة في متصفح Chrome.',
                'اضغط قائمة ⋮ في الأعلى.',
                'اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».',
              ]} />
            </div>
          </>
        )}
      </Card>

      <Card title="إشعارات التذكير"
        subtitle="تنبيه باقتراب مواعيد المهام والقرارات والتوصيات">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={perm === 'granted' ? 'ok' : perm === 'denied' ? 'bad' : 'warn'}>
            {perm === 'granted' ? 'الإذن ممنوح' : perm === 'denied' ? 'الإذن مرفوض' : perm === 'unsupported' ? 'غير مدعوم' : 'لم يُطلب بعد'}
          </Badge>
          <Badge tone={db.settings.pushEnabled ? 'ok' : 'mute'}>
            {db.settings.pushEnabled ? 'التذكيرات مفعّلة' : 'التذكيرات متوقفة'}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          {!db.settings.pushEnabled || perm !== 'granted'
            ? <button className="btn-primary" onClick={enable}>تفعيل إشعارات التذكير</button>
            : <>
                <button className="btn-ghost" onClick={() => showNotification('تجربة إشعار 🔔', 'هكذا ستصلك تذكيرات المواعيد.')}>
                  إرسال إشعار تجريبي
                </button>
                <button className="btn-ghost" onClick={() => { set((d) => { d.settings.pushEnabled = false }); toast('تم إيقاف التذكيرات') }}>
                  إيقاف التذكيرات
                </button>
              </>}
        </div>

        {perm === 'denied' && (
          <p className="muted mt-3">
            الإذن مرفوض من إعدادات المتصفح. افتح إعدادات الموقع في متصفحك واسمح بالإشعارات ثم أعد المحاولة.
          </p>
        )}
        <p className="muted mt-3">
          تصل التذكيرات ما دام التطبيق مفتوحًا أو مثبّتًا على الجهاز. ولإرسالها والتطبيق مغلق تمامًا
          يلزم ربط خدمة إشعارات على خادم، والمنصة مهيّأة لذلك.
        </p>
      </Card>
    </div>
  )
}

function Guide({ title, steps }: { title: string; steps: string[] }) {
  return (
    <div className="rounded-2xl border border-line p-4">
      <h4 className="font-extrabold text-[13px] mb-2">{title}</h4>
      <ol className="space-y-1.5">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-2 text-[12.5px] text-ink-700 leading-6">
            <span className="w-5 h-5 rounded-md bg-navy-100 text-navy-700 text-[10px] font-black grid place-items-center shrink-0 mt-0.5">{i + 1}</span>
            {s}
          </li>
        ))}
      </ol>
    </div>
  )
}

/* ================= البيانات ================= */
function DataSettings() {
  const { db, reset, exportJson, importJson } = useDb()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)

  const counts = [
    ['المساجد', db.mosques.length], ['الحسابات', db.people.length],
    ['اللجان', db.committees.length], ['المهام', db.tasks.length],
    ['سجلات الحضور', db.attendance.length], ['المعلمون', db.teachers.length],
    ['المحاضر', db.meetings.length], ['العهد', db.custodies.length],
  ] as const

  return (
    <div className="space-y-5">
      <Card title="محتوى قاعدة البيانات">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {counts.map(([l, v]) => (
            <div key={l} className="rounded-xl bg-navy-50 border border-navy-100 px-3 py-2.5 text-center">
              <div className="text-xl font-display font-black tabular-nums text-navy-800">{v}</div>
              <div className="text-[10.5px] font-bold text-ink-500">{l}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="النسخ الاحتياطي" subtitle="تُحفظ البيانات في هذا الجهاز — احتفظ بنسخة دورية">
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary btn-sm" onClick={exportJson}>⬇ تصدير نسخة</button>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return
            try { await importJson(f); toast('تم استيراد النسخة') } catch { toast('ملف غير صالح', 'bad') }
            e.target.value = ''
          }} />
          <button className="btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>⬆ استيراد نسخة</button>
        </div>
      </Card>

      <Card title="منطقة الخطر">
        <p className="muted mb-3">
          إعادة التهيئة تحذف جميع الحسابات والسجلات وتعيد المنصة إلى حالتها الأولى
          (المساجد الثلاثة ولجانها وحساب المدير بالرمز المبدئي).
        </p>
        <button className="btn-danger btn-sm" onClick={() => {
          if (!confirm('سيتم حذف كل البيانات نهائيًا. متابعة؟')) return
          if (!confirm('تأكيد أخير: لا يمكن التراجع عن هذه الخطوة.')) return
          reset(); toast('تمت إعادة التهيئة')
        }}>إعادة تهيئة المنصة</button>
      </Card>
    </div>
  )
}
