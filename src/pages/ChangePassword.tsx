import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { useDb } from '../store/db'
import { LogoMark } from '../components/Brand'
import { ThemeToggle } from '../store/theme'
import { useToast } from '../components/ui'

/** شاشة إجبارية تظهر عند أول دخول أو بعد إعادة تعيين الرمز من المدير */
export default function ChangePassword() {
  const { user, changePassword, logout, mustChangePassword } = useAuth()
  const { db } = useDb()
  const nav = useNavigate()
  const toast = useToast()

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [show, setShow] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  // ننتظر وصول البيانات المحدَّثة من الخادم قبل الانتقال
  useEffect(() => {
    if (done && !mustChangePassword && user) {
      nav(user.role === 'supervisor' ? `/m/${user.mosqueId}` : '/', { replace: true })
    }
  }, [done, mustChangePassword, user, nav])

  if (!user) return null

  const strength = (() => {
    let s = 0
    if (next.length >= 4) s++
    if (next.length >= 8) s++
    if (/[A-Za-z]/.test(next) && /\d/.test(next)) s++
    if (/[^A-Za-z0-9]/.test(next)) s++
    return s
  })()
  const strengthLabel = ['ضعيف جدًا', 'ضعيف', 'متوسط', 'جيد', 'قوي'][strength]

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    if (next !== again) return setErr('الرمز الجديد وتأكيده غير متطابقين.')
    if (next === db.settings.defaultPassword) return setErr('لا يمكن استخدام الرمز المبدئي. اختر رمزًا خاصًا بك.')
    setBusy(true)
    const r = await changePassword(current, next)
    setBusy(false)
    if (!r.ok) return setErr(r.error!)
    toast('تم تغيير رمز الدخول بنجاح')
    setDone(true)
  }

  return (
    <div className="min-h-[100dvh] grid place-items-center px-5 py-10
      bg-gradient-to-b from-surface via-navy-50 to-navy-100/60">
      <div className="absolute top-4 left-4"><ThemeToggle /></div>
      <div className="w-full max-w-[420px]">
        <div className="flex flex-col items-center text-center mb-7">
          <LogoMark h={96} />
          <h1 className="mt-5 font-display font-bold text-[21px] text-navy-900">
            {mustChangePassword ? 'تعيين رمز دخول خاص بك' : 'تغيير رمز الدخول'}
          </h1>
          <p className="text-[12.5px] text-ink-500 mt-2 leading-6 max-w-[330px]">
            {mustChangePassword
              ? 'لحماية حسابك، غيّر الرمز المبدئي إلى رمز تعرفه أنت وحدك قبل الدخول للمنصة.'
              : 'اختر رمزًا جديدًا لحسابك.'}
          </p>
        </div>

        <form onSubmit={submit} className="panel p-6 space-y-4">
          <div className="flex items-center gap-3 rounded-xl bg-navy-50 border border-navy-100 px-3.5 py-2.5">
            <span className="w-9 h-9 rounded-xl bg-navy-700 text-white grid place-items-center font-extrabold text-[13px] shrink-0">
              {user.name.trim()[0]}
            </span>
            <span className="min-w-0">
              <b className="block text-[13px] truncate">{user.name}</b>
              <span className="block text-[11px] text-ink-500 truncate" dir="ltr">{user.email}</span>
            </span>
          </div>

          <div>
            <label className="label">الرمز الحالي</label>
            <input type={show ? 'text' : 'password'} dir="ltr" className="field text-left"
              value={current} onChange={(e) => { setCurrent(e.target.value); setErr('') }}
              placeholder={mustChangePassword ? 'الرمز المبدئي' : '••••'} autoFocus />
          </div>

          <div>
            <label className="label">الرمز الجديد</label>
            <input type={show ? 'text' : 'password'} dir="ltr" className="field text-left"
              value={next} onChange={(e) => { setNext(e.target.value); setErr('') }} placeholder="٤ خانات فأكثر" />
            {next && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-line overflow-hidden flex gap-0.5">
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} className={`flex-1 rounded-full transition
                      ${i < strength ? (strength <= 1 ? 'bg-orange-500' : strength === 2 ? 'bg-orange-400' : 'bg-navy-600') : 'bg-line'}`} />
                  ))}
                </div>
                <span className="text-[11px] font-bold text-ink-500 w-16 text-left">{strengthLabel}</span>
              </div>
            )}
          </div>

          <div>
            <label className="label">تأكيد الرمز الجديد</label>
            <input type={show ? 'text' : 'password'} dir="ltr" className="field text-left"
              value={again} onChange={(e) => { setAgain(e.target.value); setErr('') }} placeholder="أعد كتابة الرمز" />
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input type="checkbox" className="w-4 h-4 accent-orange-500" checked={show} onChange={(e) => setShow(e.target.checked)} />
            <span className="text-[12.5px] font-bold text-ink-700">إظهار الرموز</span>
          </label>

          {err && (
            <p className="text-[13px] font-bold text-orange-700 bg-orange-50 border border-orange-200 rounded-xl px-3.5 py-2.5 leading-6">
              {err}
            </p>
          )}

          <button className="btn-primary btn-lg w-full" disabled={busy}>{busy ? 'جارٍ الحفظ…' : 'حفظ الرمز الجديد'}</button>

          <button type="button" className="btn-ghost btn-sm w-full"
            onClick={async () => { await logout(); nav('/login', { replace: true }) }}>
            تسجيل الخروج
          </button>
        </form>
      </div>
    </div>
  )
}
