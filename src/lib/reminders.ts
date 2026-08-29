import type { DB, Person } from '../types'
import { dueSoonTasks } from './selectors'
import { daysBetween, todayISO, fmtDate } from './date'
import { showNotification } from './pwa'

const SENT = 'ryd.reminders.sent'

const sent = (): Record<string, string> => {
  try { return JSON.parse(localStorage.getItem(SENT) || '{}') } catch { return {} }
}
const markSent = (key: string) => {
  const s = sent(); s[key] = todayISO()
  localStorage.setItem(SENT, JSON.stringify(s))
}

/**
 * يفحص قائمة المهام القريبة أو المتأخرة ويرسل إشعارًا واحدًا
 * لكل مهمة في اليوم. يعمل ما دام التطبيق مفتوحًا أو مثبّتًا في الخلفية.
 */
export async function runReminderCheck(db: DB, user: Person | null) {
  if (!user || !db.settings.pushEnabled) return
  const items = dueSoonTasks(db, user)
  if (!items.length) return

  const store = sent()
  const today = todayISO()
  const fresh = items.filter((t) => store[`t:${t.id}`] !== today)
  if (!fresh.length) return

  if (fresh.length === 1) {
    const t = fresh[0]
    const d = daysBetween(today, t.dueDate)
    await showNotification(
      d < 0 ? '⚠️ مهمة تجاوزت موعدها' : d === 0 ? '⏰ مهمة مستحقة اليوم' : '🔔 موعد يقترب',
      `${t.title} — ${fmtDate(t.dueDate)}`,
      { tag: `t-${t.id}`, url: `./#/m/${t.mosqueId}/tasks` },
    )
  } else {
    const late = fresh.filter((t) => daysBetween(today, t.dueDate) < 0).length
    await showNotification(
      '🔔 لديك مواعيد تحتاج متابعتك',
      `${fresh.length} مهمة${late ? ` منها ${late} متأخرة` : ''} — افتح المنصة للاطلاع.`,
      { tag: 'due-digest', url: './#/me' },
    )
  }
  fresh.forEach((t) => markSent(`t:${t.id}`))
}
