import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { useDb } from '../store/db'
import { LogoMark } from '../components/Brand'

const FEATURES = [
  ['ثلاثة مساجد', 'كل مسجد بإدارة مستقلة، ومتابعة موحّدة للمجمع'],
  ['تحضير بالموقع', 'لا يُقبل التحضير إلا داخل نطاق المسجد المحدَّد'],
  ['مهام ومحاضر', 'مواعيد وتنبيهات ومسؤول واضح لكل بند'],
  ['عهد ورواتب', 'فواتير وإقفال عهد وخصومات مرتبطة بالحضور'],
]

export default function Login() {
  const { login } = useAuth()
  const { db } = useDb()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    if (!email.trim()) return setErr('اكتب البريد الإلكتروني.')
    if (!pw) return setErr('اكتب رمز الدخول.')
    setBusy(true)
    const r = await login(email, pw)
    setBusy(false)
    if (!r.ok) {
      return setErr(
        r.reason === 'notfound' ? 'لا يوجد حساب بهذا البريد. راجع مدير المجمع أو مشرف مسجدك.'
        : r.reason === 'inactive' ? 'هذا الحساب موقوف حاليًا.'
        : r.reason === 'network' ? 'تعذّر الاتصال بالخادم. تحقّق من الإنترنت وأعد المحاولة.'
        : 'رمز الدخول غير صحيح.',
      )
    }
    if (r.user.mustChangePassword) return nav('/change-password', { replace: true })
    nav(r.user.role === 'supervisor' ? `/m/${r.user.mosqueId}` : '/', { replace: true })
  }

  return (
    <div className="min-h-[100dvh] lg:grid lg:grid-cols-[1.1fr_1fr] bg-white">
      {/* ===== لوحة الهوية — خلفية فاتحة ليظهر الشعار على طبيعته ===== */}
      <aside className="relative hidden lg:flex flex-col justify-center gap-12 p-12 xl:p-16 overflow-hidden
        bg-gradient-to-b from-white via-navy-50 to-navy-100/70">
        <div className="absolute inset-0 opacity-[0.4]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #C7D6E6 1px, transparent 0)', backgroundSize: '22px 22px' }} />
        <div className="absolute top-0 right-0 w-1 h-full bg-gradient-to-b from-orange-400 via-orange-500 to-transparent" />

        <div className="relative">
          <LogoMark h={168} />
          <div className="mt-9 flex items-center gap-3">
            <span className="h-px w-10 bg-orange-500" />
            <p className="eyebrow !text-orange-700">منصة إدارة المجمع</p>
          </div>
          <h1 className="mt-3 font-display font-bold text-[30px] xl:text-[34px] leading-[1.4] text-navy-900">
            مجمع رياض القرآن
          </h1>
          <p className="mt-3 text-[14px] text-ink-500 leading-8 max-w-sm">
            {db.settings.complexSubtitle}
          </p>
        </div>

        <ul className="relative grid gap-3 max-w-sm">
          {FEATURES.map(([t, d]) => (
            <li key={t} className="flex items-start gap-3">
              <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />
              <span>
                <b className="block font-display text-[13.5px] font-bold text-navy-800">{t}</b>
                <span className="block text-[12px] text-ink-500 mt-0.5 leading-6">{d}</span>
              </span>
            </li>
          ))}
        </ul>

        <p className="absolute bottom-10 right-12 xl:right-16 text-[11px] text-ink-400">مدينة الملك سعود السكنية — ديراب</p>
      </aside>

      {/* ===== نموذج الدخول ===== */}
      <main className="flex flex-col justify-center items-center px-6 py-12 sm:px-10 min-h-[100dvh] lg:min-h-0">
        <div className="w-full max-w-[360px]">
          <div className="lg:hidden flex flex-col items-center text-center mb-10">
            <LogoMark h={112} />
            <h1 className="mt-6 font-display font-bold text-[21px] text-navy-900 leading-snug">
              مجمع رياض القرآن
            </h1>
            <p className="text-[11.5px] text-ink-400 mt-1.5">منصة إدارة المجمع — ديراب</p>
          </div>

          <div className="hidden lg:block mb-8">
            <h2 className="font-display font-bold text-[22px] text-navy-900">تسجيل الدخول</h2>
            <p className="muted mt-1.5">أدخل بريدك الإلكتروني ورمز الدخول للمتابعة.</p>
          </div>

          <form onSubmit={submit} className="space-y-4" noValidate>
            <div>
              <label className="label" htmlFor="email">البريد الإلكتروني</label>
              <input id="email" type="email" inputMode="email" autoComplete="email" dir="ltr"
                className="field text-left" placeholder="name@example.com"
                value={email} onChange={(e) => { setEmail(e.target.value); setErr('') }} />
            </div>

            <div>
              <label className="label" htmlFor="pw">رمز الدخول</label>
              <div className="relative">
                <input id="pw" type={show ? 'text' : 'password'} autoComplete="current-password" dir="ltr"
                  className="field text-left pl-11" placeholder="••••"
                  value={pw} onChange={(e) => { setPw(e.target.value); setErr('') }} />
                <button type="button" onClick={() => setShow((s) => !s)}
                  className="absolute inset-y-0 left-0 w-11 grid place-items-center text-ink-400 hover:text-navy-700 transition"
                  aria-label={show ? 'إخفاء الرمز' : 'إظهار الرمز'}>
                  <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    {show
                      ? <><path d="M3 3l18 18" /><path d="M10.6 10.7a2 2 0 002.8 2.8" /><path d="M9.4 5.3A9.5 9.5 0 0112 5c5 0 9 4.5 9 7a12 12 0 01-2.3 3.2M6.2 6.7C3.9 8.2 3 10.4 3 12c0 2.5 4 7 9 7 1.1 0 2.1-.2 3-.5" /></>
                      : <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.6" /></>}
                  </svg>
                </button>
              </div>
            </div>

            {err && (
              <p className="text-[12.5px] font-bold text-orange-800 bg-orange-50 border border-orange-200 rounded-xl px-3.5 py-2.5 leading-6">
                {err}
              </p>
            )}

            <button className="btn-primary btn-lg w-full" disabled={busy}>
              {busy ? 'جارٍ الدخول…' : 'دخول'}
            </button>
          </form>

          <div className="mt-8 rounded-xl border border-line px-4 py-3.5">
            <p className="text-[12px] text-ink-500 leading-7">
              <b className="text-ink-900">نسيت رمز الدخول؟</b><br />
              يعيد مدير المجمع تعيين رمزك من الإعدادات ليعود إلى الرمز المبدئي،
              ثم يُطلب منك تغييره عند أول دخول.
            </p>
          </div>

          <p className="text-center text-[10.5px] text-ink-300 mt-8">
            مجمع رياض القرآن · جميع الحقوق محفوظة
          </p>
        </div>
      </main>
    </div>
  )
}
