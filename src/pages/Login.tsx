import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { useDb } from '../store/db'
import { LogoMark } from '../components/Brand'

export default function Login() {
  const { login } = useAuth()
  const { db } = useDb()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    if (!email.trim()) return setErr('اكتب البريد الإلكتروني.')
    if (!pw) return setErr('اكتب رمز الدخول.')
    setBusy(true)
    const r = login(email, pw)
    setBusy(false)
    if (!r.ok) {
      return setErr(
        r.reason === 'notfound' ? 'لا يوجد حساب بهذا البريد الإلكتروني. راجع مدير المجمع أو مشرف مسجدك.'
        : r.reason === 'inactive' ? 'هذا الحساب موقوف حاليًا.'
        : 'رمز الدخول غير صحيح.',
      )
    }
    if (r.user.mustChangePassword) return nav('/change-password', { replace: true })
    nav(r.user.role === 'supervisor' ? `/m/${r.user.mosqueId}` : '/', { replace: true })
  }

  return (
    <div className="min-h-[100dvh] lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* ===== لوحة الهوية ===== */}
      <aside className="relative hidden lg:flex flex-col justify-between p-12 xl:p-16 overflow-hidden
        bg-gradient-to-bl from-navy-700 via-navy-800 to-navy-950 text-white">
        <div className="absolute -top-32 -left-24 w-[26rem] h-[26rem] rounded-full bg-orange-500/15 blur-3xl" />
        <div className="absolute bottom-[-8rem] right-[-4rem] w-[30rem] h-[22rem] rounded-full bg-navy-400/20 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)', backgroundSize: '26px 26px' }} />

        <div className="relative">
          <LogoMark size={116} rounded="rounded-[26px]" pad="p-0" />
          <h1 className="mt-9 font-display font-black text-[38px] xl:text-[44px] leading-[1.25]">
            منصة إدارة<br />مجمع رياض القرآن
          </h1>
          <p className="mt-5 text-white/70 leading-8 max-w-md text-[15px]">
            {db.settings.complexSubtitle}
          </p>
        </div>

        <ul className="relative grid gap-2.5 max-w-md">
          {[
            ['ثلاثة مساجد', 'كل مسجد بإدارة مستقلة ومتابعة موحّدة'],
            ['تحضير بالموقع', 'لا يُقبل التحضير إلا داخل نطاق المسجد'],
            ['مهام وقرارات', 'بمواعيد وتنبيهات ومسؤول لكل بند'],
            ['تقارير ومالية', 'عهد وفواتير ورواتب مربوطة بالحضور'],
          ].map(([t, d]) => (
            <li key={t} className="flex items-start gap-3 rounded-2xl bg-white/[.07] backdrop-blur-sm px-4 py-3 border border-white/10">
              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
              <span>
                <b className="block text-[13.5px] font-bold text-white">{t}</b>
                <span className="block text-[12px] text-white/60 mt-0.5">{d}</span>
              </span>
            </li>
          ))}
        </ul>

        <p className="relative text-[11px] text-white/40">مدينة الملك سعود السكنية — ديراب</p>
      </aside>

      {/* ===== نموذج الدخول ===== */}
      <main className="flex flex-col justify-center items-center px-6 py-10 sm:px-10 min-h-[100dvh] lg:min-h-0">
        <div className="w-full max-w-[380px]">
          <div className="lg:hidden flex flex-col items-center text-center mb-9">
            <LogoMark size={104} rounded="rounded-[24px]" pad="p-0" />
            <h1 className="mt-4 font-display font-black text-[24px] text-navy-800 leading-tight">
              منصة إدارة مجمع رياض القرآن
            </h1>
            <p className="text-[12px] text-ink-500 mt-1.5">لتحفيظ القرآن الكريم — ديراب</p>
          </div>

          <div className="hidden lg:block mb-8">
            <h2 className="font-display font-extrabold text-[26px]">تسجيل الدخول</h2>
            <p className="muted mt-1">أدخل بريدك الإلكتروني ورمز الدخول للمتابعة.</p>
          </div>

          <form onSubmit={submit} className="space-y-4" noValidate>
            <div>
              <label className="label" htmlFor="email">البريد الإلكتروني</label>
              <input
                id="email" type="email" inputMode="email" autoComplete="email" dir="ltr"
                className="field text-left" placeholder="name@example.com"
                value={email} onChange={(e) => { setEmail(e.target.value); setErr('') }}
              />
            </div>

            <div>
              <label className="label" htmlFor="pw">رمز الدخول</label>
              <div className="relative">
                <input
                  id="pw" type={show ? 'text' : 'password'} autoComplete="current-password" dir="ltr"
                  className="field text-left pl-11" placeholder="••••"
                  value={pw} onChange={(e) => { setPw(e.target.value); setErr('') }}
                />
                <button type="button" onClick={() => setShow((s) => !s)}
                  className="absolute inset-y-0 left-0 w-11 grid place-items-center text-ink-400 hover:text-navy-600"
                  aria-label={show ? 'إخفاء الرمز' : 'إظهار الرمز'}>
                  {show ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {err && (
              <p className="text-[13px] font-bold text-orange-700 bg-orange-50 border border-orange-200 rounded-xl px-3.5 py-2.5 leading-6">
                {err}
              </p>
            )}

            <button className="btn-primary btn-lg w-full" disabled={busy}>
              {busy ? 'جارٍ الدخول…' : 'دخول'}
            </button>
          </form>

          <div className="mt-8 rounded-2xl bg-navy-50 border border-navy-100 px-4 py-3.5">
            <p className="text-[12.5px] text-navy-800 leading-7">
              <b>نسيت رمز الدخول؟</b><br />
              يعيد <b>مدير المجمع</b> تعيين رمزك من الإعدادات ليعود إلى الرمز المبدئي،
              ثم يُطلب منك تغييره عند أول دخول.
            </p>
          </div>

          <p className="text-center text-[11px] text-ink-400 mt-8">
            مجمع رياض القرآن · جميع الحقوق محفوظة
          </p>
        </div>
      </main>
    </div>
  )
}
