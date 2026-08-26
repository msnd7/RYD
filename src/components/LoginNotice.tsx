import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDb } from '../store/db'
import { useAuth } from '../store/auth'
import { dueSoonTasks } from '../lib/selectors'
import { dueLabel, fmtDate } from '../lib/date'

const SEEN = 'ryd.notice.seen'

/**
 * إشعار يظهر لكل مستخدم عند دخوله للمنصة لمدة عشر ثوانٍ ثم يختفي تلقائيًا،
 * ويعرض المهام والقرارات والتوصيات التي اقترب موعدها أو تأخرت.
 */
export function LoginNotice() {
  const { db } = useDb()
  const { user } = useAuth()
  const nav = useNavigate()
  const [show, setShow] = useState(false)
  const [left, setLeft] = useState(db.settings.reminderSeconds || 10)

  const items = user ? dueSoonTasks(db, user) : []

  useEffect(() => {
    if (!user || items.length === 0) return
    const key = `${SEEN}.${user.id}.${new Date().toISOString().slice(0, 10)}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
    setShow(true)
    const secs = db.settings.reminderSeconds || 10
    setLeft(secs)
    const iv = setInterval(() => setLeft((s) => s - 1), 1000)
    const to = setTimeout(() => setShow(false), secs * 1000)
    return () => { clearInterval(iv); clearTimeout(to) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  if (!show || !user) return null

  const late = items.filter((t) => dueLabel(t.dueDate).diff < 0).length

  return (
    <div className="fixed z-[70] top-4 left-4 right-4 sm:right-auto sm:left-4 sm:w-[400px] no-print pop-in">
      <div className="rounded-3xl bg-white shadow-lift border border-navy-100 overflow-hidden">
        <div className="bg-gradient-to-l from-navy-700 to-navy-900 text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🔔</span>
            <div>
              <div className="font-extrabold text-[15px]">تنبيه المواعيد القريبة</div>
              <div className="text-[11px] text-white/70">
                {late > 0 ? `${late} متأخرة · ` : ''}{items.length} بند يحتاج متابعتك
              </div>
            </div>
          </div>
          <button onClick={() => setShow(false)} className="w-8 h-8 grid place-items-center rounded-lg hover:bg-white/15" aria-label="إغلاق">✕</button>
        </div>

        <ul className="max-h-[46vh] overflow-y-auto divide-y divide-line">
          {items.slice(0, 6).map((t) => {
            const d = dueLabel(t.dueDate)
            return (
              <li key={t.id}>
                <button
                  onClick={() => { setShow(false); nav(`/m/${t.mosqueId}/tasks`) }}
                  className="w-full text-right px-5 py-3 hover:bg-navy-50/60 transition">
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-bold text-sm text-ink-900 leading-6">{t.title}</span>
                    <span className={`chip shrink-0 ${d.tone === 'bad' ? 'bg-orange-100 text-orange-700' : 'bg-orange-100 text-orange-700'}`}>
                      {d.text}
                    </span>
                  </div>
                  <div className="text-[11px] text-ink-500 mt-1">{fmtDate(t.dueDate)}</div>
                </button>
              </li>
            )
          })}
        </ul>

        <div className="h-1 bg-line">
          <div className="h-full bg-orange-500 transition-all duration-1000 ease-linear"
            style={{ width: `${(left / (db.settings.reminderSeconds || 10)) * 100}%` }} />
        </div>
        <div className="px-5 py-2 text-[11px] text-ink-500 text-center">
          يختفي هذا التنبيه تلقائيًا خلال {Math.max(0, left)} ثانية
        </div>
      </div>
    </div>
  )
}
