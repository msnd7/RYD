import { useEffect, useState } from 'react'
import { useDb } from '../store/db'
import { useAuth } from '../store/auth'
import { runReminderCheck } from '../lib/reminders'
import { canInstall, isStandalone, onPwaChange, promptInstall } from '../lib/pwa'
import { LogoMark } from './Brand'

const DISMISS = 'ryd.install.dismissed'

/** فحص دوري للتذكيرات + دعوة تثبيت التطبيق */
export function Runtime() {
  const { db } = useDb()
  const { user } = useAuth()
  const [showInstall, setShowInstall] = useState(false)

  // التذكيرات
  useEffect(() => {
    if (!user) return
    const tick = () => runReminderCheck(db, user)
    const t = setTimeout(tick, 4000)
    const iv = setInterval(tick, 30 * 60 * 1000)
    const onVis = () => document.visibilityState === 'visible' && tick()
    document.addEventListener('visibilitychange', onVis)
    return () => { clearTimeout(t); clearInterval(iv); document.removeEventListener('visibilitychange', onVis) }
  }, [db, user])

  // دعوة التثبيت
  useEffect(() => {
    const refresh = () => {
      setShowInstall(canInstall() && !isStandalone() && localStorage.getItem(DISMISS) !== '1')
    }
    refresh()
    return onPwaChange(refresh)
  }, [])

  if (!showInstall || !user) return null

  return (
    <div className="no-print fixed bottom-[calc(70px+var(--safe-b))] lg:bottom-5 inset-x-3 lg:inset-x-auto lg:left-5 lg:w-[360px] z-[55] pop-in">
      <div className="panel p-4 flex items-center gap-3 shadow-lift">
        <LogoMark size={48} rounded="rounded-lg" pad="p-0" shadow={false} />
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-extrabold">ثبّت التطبيق على جهازك</p>
          <p className="text-[11.5px] text-ink-500 leading-5">وصول أسرع وإشعارات بالمواعيد.</p>
        </div>
        <div className="flex flex-col gap-1.5 shrink-0">
          <button className="btn-accent btn-sm" onClick={async () => { await promptInstall(); setShowInstall(false) }}>تثبيت</button>
          <button className="text-[11px] font-bold text-ink-400 hover:text-ink-700"
            onClick={() => { localStorage.setItem(DISMISS, '1'); setShowInstall(false) }}>لاحقًا</button>
        </div>
      </div>
    </div>
  )
}
