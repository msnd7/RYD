import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { useDb } from '../store/db'
import { Logo } from '../components/Logo'

export default function Login() {
  const { login } = useAuth()
  const { db } = useDb()
  const nav = useNavigate()
  const [u, setU] = useState('')
  const [p, setP] = useState('')
  const [err, setErr] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const user = login(u, p)
    if (!user) return setErr('اسم المستخدم أو كلمة المرور غير صحيحة.')
    nav(user.role === 'supervisor' ? `/m/${user.mosqueId}` : '/')
  }

  const quick = (username: string) => {
    setU(username); setP('1234')
    const user = login(username, '1234')
    if (user) nav(user.role === 'supervisor' ? `/m/${user.mosqueId}` : '/')
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* الجانب التعريفي */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 text-white overflow-hidden
        bg-gradient-to-bl from-brand-700 via-brand-800 to-brand-900">
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-gold-400/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[28rem] h-64 rounded-full bg-olive-400/20 blur-3xl" />
        <div className="relative">
          <div className="bg-white/95 rounded-3xl w-24 h-24 grid place-items-center shadow-lift">
            <Logo size={72} />
          </div>
          <h1 className="mt-8 text-4xl font-display font-black leading-snug">
            منصة إدارة<br />مجمع رياض القرآن
          </h1>
          <p className="mt-4 text-white/75 leading-8 max-w-md">
            {db.settings.complexSubtitle}
          </p>
        </div>
        <ul className="relative space-y-3 text-sm">
          {[
            ['🕌', 'ثلاثة مساجد بإدارة مستقلة ومتابعة موحّدة'],
            ['📍', 'تحضير ذاتي مربوط بالنطاق المكاني لكل مسجد'],
            ['✅', 'مهام وقرارات وتوصيات بمواعيد وتنبيهات'],
            ['💼', 'عهد ومصروفات وفواتير وربط بالرواتب'],
            ['📊', 'تقارير مصمّمة قابلة للطباعة والمشاركة'],
          ].map(([i, t]) => (
            <li key={t} className="flex items-center gap-3 bg-white/10 rounded-2xl px-4 py-3 backdrop-blur-sm">
              <span className="text-lg">{i}</span><span className="font-bold text-white/90">{t}</span>
            </li>
          ))}
        </ul>
        <p className="relative text-[11px] text-white/50">مدينة الملك سعود السكنية — ديراب</p>
      </div>

      {/* نموذج الدخول */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex flex-col items-center mb-8">
            <Logo size={78} />
            <h1 className="mt-3 text-2xl font-display font-black text-brand-800">رياض القرآن</h1>
            <p className="text-xs font-bold text-gold-600">منصة إدارة المجمع</p>
          </div>

          <h2 className="text-2xl font-display font-extrabold">أهلاً بك</h2>
          <p className="muted mt-1">سجّل دخولك لمتابعة أعمال المجمع.</p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <div>
              <label className="label">اسم المستخدم</label>
              <input className="field" value={u} onChange={(e) => { setU(e.target.value); setErr('') }}
                placeholder="admin" autoComplete="username" />
            </div>
            <div>
              <label className="label">كلمة المرور</label>
              <input className="field" type="password" value={p} onChange={(e) => { setP(e.target.value); setErr('') }}
                placeholder="••••" autoComplete="current-password" />
            </div>
            {err && <p className="text-sm font-bold text-rose-600 bg-rose-50 rounded-xl px-3 py-2.5">{err}</p>}
            <button className="btn-primary w-full py-3">دخول</button>
          </form>

          <div className="mt-8">
            <p className="text-[11px] font-bold text-ink-500 mb-2">دخول سريع للتجربة:</p>
            <div className="grid gap-2">
              <button onClick={() => quick('admin')} className="btn-ghost justify-between">
                <span>مدير المجمع</span><span className="text-[11px] text-ink-500">admin / 1234</span>
              </button>
              {db.mosques.map((m, i) => (
                <button key={m.id} onClick={() => quick(`sup${i + 1}`)} className="btn-ghost justify-between">
                  <span>مشرف {m.shortName}</span><span className="text-[11px] text-ink-500">sup{i + 1} / 1234</span>
                </button>
              ))}
              <button onClick={() => quick('m1u1')} className="btn-ghost justify-between">
                <span>عضو لجنة</span><span className="text-[11px] text-ink-500">m1u1 / 1234</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
