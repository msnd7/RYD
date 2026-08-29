/** المسافة بين نقطتين بالأمتار (هافرساين) */
export function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const R = 6371000
  const toRad = (x: number) => (x * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(s)))
}

export function getPosition(): Promise<{ lat: number; lng: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('المتصفح لا يدعم تحديد الموقع'))
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) }),
      (e) => reject(new Error(
        e.code === 1 ? 'تم رفض إذن الموقع. فعّل الإذن من إعدادات المتصفح ثم أعد المحاولة.'
        : e.code === 2 ? 'تعذّر تحديد الموقع حاليًا.'
        : 'انتهت مهلة تحديد الموقع.',
      )),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    )
  })
}

/* ================= قراءة الإحداثيات من رابط خريطة ================= */

export type LatLng = { lat: number; lng: number }

const inRange = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) &&
  Math.abs(lat) <= 90 && Math.abs(lng) <= 180 &&
  !(lat === 0 && lng === 0)

/**
 * يستخرج الإحداثيات من رابط قوقل ماب (أو أي رابط خريطة شائع) أو من نص
 * إحداثيات مباشر. يرجع null إن لم يجد إحداثيات صالحة.
 *
 * يدعم:
 *   .../maps/place/الاسم/@24.71,46.67,17z/data=!3d24.7123!4d46.6753
 *   .../maps/@24.71,46.67,17z
 *   .../maps/search/?api=1&query=24.71,46.67
 *   ...?q=24.71,46.67   أو  ...&ll=24.71,46.67
 *   geo:24.71,46.67     أو  «24.71, 46.67»
 */
export function parseMapsUrl(input: string): LatLng | null {
  const s = (input ?? '').trim()
  if (!s) return null

  const take = (a: string, b: string): LatLng | null => {
    const lat = Number(a), lng = Number(b)
    return inRange(lat, lng) ? { lat, lng } : null
  }

  // 1) الأدقّ: إحداثيات الموقع الفعلي داخل data=…!3dLAT!4dLNG
  const d34 = s.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/)
  if (d34) { const r = take(d34[1], d34[2]); if (r) return r }

  // 2) معاملات صريحة: q= / query= / ll= / center= / daddr=
  const param = s.match(/[?&](?:q|query|ll|center|daddr|sll)=(-?\d+(?:\.\d+)?)\s*(?:,|%2C)\s*(-?\d+(?:\.\d+)?)/i)
  if (param) { const r = take(param[1], param[2]); if (r) return r }

  // 3) مركز الخريطة المعروض: @LAT,LNG
  const at = s.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
  if (at) { const r = take(at[1], at[2]); if (r) return r }

  // 4) صيغة geo:
  const geo = s.match(/^geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i)
  if (geo) { const r = take(geo[1], geo[2]); if (r) return r }

  // 5) نص إحداثيات مباشر «24.71, 46.67»
  const plain = s.match(/^\s*(-?\d+(?:\.\d+)?)\s*[,،]\s*(-?\d+(?:\.\d+)?)\s*$/)
  if (plain) { const r = take(plain[1], plain[2]); if (r) return r }

  return null
}

/** هل الرابط من روابط قوقل المختصرة التي لا يمكن فكّها داخل المتصفح؟ */
export const isShortMapsLink = (s: string) =>
  /(maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs)/i.test(s ?? '')

/** رابط فتح الموقع في قوقل ماب */
export const mapsLink = (p: LatLng) =>
  `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`
