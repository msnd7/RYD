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
