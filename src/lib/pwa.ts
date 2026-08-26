/** تسجيل Service Worker وإدارة التثبيت والإشعارات */

let swReg: ServiceWorkerRegistration | null = null
let deferredPrompt: any = null
const listeners = new Set<() => void>()

const notify = () => listeners.forEach((f) => f())
export const onPwaChange = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f) } }

export function registerSW() {
  // نسخة الملف الواحد (المعاينة/المشاركة) لا تحتوي على sw.js
  if (import.meta.env.MODE === 'single') return
  if (!('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    const url = new URL('sw.js', document.baseURI).href
    navigator.serviceWorker.register(url, { scope: './' })
      .then((r) => { swReg = r; notify() })
      .catch(() => { /* يعمل الموقع بدون SW */ })
  })
  window.addEventListener('beforeinstallprompt', (e: any) => {
    e.preventDefault()
    deferredPrompt = e
    notify()
  })
  window.addEventListener('appinstalled', () => { deferredPrompt = null; notify() })
}

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (window.navigator as any).standalone === true

export const canInstall = () => !!deferredPrompt

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable'
  deferredPrompt.prompt()
  const { outcome } = await deferredPrompt.userChoice
  deferredPrompt = null
  notify()
  return outcome
}

/* ================= الإشعارات ================= */
export const notificationsSupported = () => 'Notification' in window
export const notificationPermission = () =>
  notificationsSupported() ? Notification.permission : 'unsupported'

export async function requestNotificationPermission() {
  if (!notificationsSupported()) return 'unsupported' as const
  const p = await Notification.requestPermission()
  notify()
  return p
}

export async function showNotification(title: string, body: string, opts: { tag?: string; url?: string } = {}) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return false
  const reg = swReg ?? (await navigator.serviceWorker?.ready.catch(() => null))
  if (reg) {
    await reg.showNotification(title, {
      body, icon: './icon-192.png', badge: './icon-192.png',
      dir: 'rtl', lang: 'ar', tag: opts.tag,
      data: { url: opts.url ?? './' },
    })
    return true
  }
  new Notification(title, { body, icon: './icon-192.png', dir: 'rtl', lang: 'ar', tag: opts.tag })
  return true
}
