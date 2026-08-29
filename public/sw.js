/* Service Worker — منصة رياض القرآن */
const CACHE = 'ryd-v3'
const CORE = ['./', './index.html', './manifest.webmanifest', './logo.png', './favicon.png']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()).catch(() => {}))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET' || !req.url.startsWith('http')) return

  // نداءات الخادم لا تُخزَّن أبدًا: البيانات يجب أن تصل حيّة
  const url = new URL(req.url)
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) return

  // التنقل: الشبكة أولًا ثم النسخة المخزّنة (للعمل بدون إنترنت)
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((r) => {
        const copy = r.clone()
        caches.open(CACHE).then((c) => c.put('./index.html', copy))
        return r
      }).catch(() => caches.match('./index.html').then((r) => r || caches.match('./'))),
    )
    return
  }

  // الأصول: المخزّن أولًا
  e.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((r) => {
      if (r.ok && (r.type === 'basic' || r.type === 'default')) {
        const copy = r.clone()
        caches.open(CACHE).then((c) => c.put(req, copy))
      }
      return r
    }).catch(() => cached)),
  )
})

// إشعارات التذكير
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = e.notification.data?.url || './'
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if ('focus' in c) { c.navigate(url); return c.focus() }
      return self.clients.openWindow(url)
    }),
  )
})

self.addEventListener('message', (e) => {
  const d = e.data || {}
  if (d.type === 'NOTIFY') {
    self.registration.showNotification(d.title, {
      body: d.body, icon: './icon-192.png', badge: './icon-192.png',
      dir: 'rtl', lang: 'ar', tag: d.tag, renotify: false,
      data: { url: d.url || './' },
    })
  }
  if (d.type === 'SKIP_WAITING') self.skipWaiting()
})

// دفع من الخادم (عند ربط خدمة Push مستقبلًا)
self.addEventListener('push', (e) => {
  let p = { title: 'رياض القرآن', body: 'لديك تذكير جديد.' }
  try { p = { ...p, ...(e.data ? e.data.json() : {}) } } catch { /* نص عادي */ }
  e.waitUntil(self.registration.showNotification(p.title, {
    body: p.body, icon: './icon-192.png', badge: './icon-192.png',
    dir: 'rtl', lang: 'ar', data: { url: p.url || './' },
  }))
})
