import { useEffect, useRef, useState } from 'react'
import type { LatLng } from '../lib/geo'

/**
 * خريطة لتحديد مركز نطاق المسجد داخل المنصة.
 *
 * تُحمَّل مكتبة الخريطة عند الحاجة فقط (import ديناميكي) حتى لا تثقل
 * حزمة الموقع الأساسية. الضغط على الخريطة — أو سحب الدبّوس — ينقل المركز،
 * وتُرسم دائرة النطاق بنصف القطر المحدَّد لتُرى المساحة المقبولة للتحضير.
 */
export function MapPicker({ value, radius, onChange, height = 320 }: {
  value: LatLng
  radius: number
  onChange: (p: LatLng) => void
  height?: number
}) {
  const boxRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const circleRef = useRef<any>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const [err, setErr] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  // إنشاء الخريطة مرة واحدة
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const L = (await import('leaflet')).default
        await import('leaflet/dist/leaflet.css')
        if (!alive || !boxRef.current || mapRef.current) return

        // إن لم يُحدَّد موقع بعد نبدأ من الرياض دون رسم دبّوس حتى يختار المستخدم
        const has = !!(value.lat && value.lng)
        const start: [number, number] = has ? [value.lat, value.lng] : [24.6408, 46.6215]
        const map = L.map(boxRef.current, { center: start, zoom: has ? 17 : 12, zoomControl: true })
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap',
        }).addTo(map)

        const pin = L.divIcon({
          className: '',
          html: '<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#F0820E;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>',
          iconSize: [22, 22],
          iconAnchor: [11, 22],
        })
        const marker = L.marker(start, { icon: pin, draggable: true })
        const circle = L.circle(start, {
          radius, color: '#1E3A5F', weight: 2, fillColor: '#1E3A5F', fillOpacity: 0.12,
        })
        if (has) { marker.addTo(map); circle.addTo(map) }

        const move = (lat: number, lng: number) => {
          const p = { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) }
          marker.setLatLng(p); circle.setLatLng(p)
          if (!map.hasLayer(marker)) { marker.addTo(map); circle.addTo(map) }
          onChangeRef.current(p)
        }
        map.on('click', (e: any) => move(e.latlng.lat, e.latlng.lng))
        marker.on('dragend', () => { const p = marker.getLatLng(); move(p.lat, p.lng) })

        mapRef.current = map; markerRef.current = marker; circleRef.current = circle
        setReady(true)
        // الخريطة تُنشأ أحيانًا قبل استقرار مقاس الحاوية
        setTimeout(() => map.invalidateSize(), 200)
      } catch {
        if (alive) setErr('تعذّر تحميل الخريطة. يمكنك لصق رابط قوقل ماب أو إدخال الإحداثيات يدويًا.')
      }
    })()
    return () => {
      alive = false
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // مزامنة الخريطة مع القيم القادمة من الحقول أو من «موقعي الحالي»
  useEffect(() => {
    if (!ready || !markerRef.current) return
    const cur = markerRef.current.getLatLng()
    if (Math.abs(cur.lat - value.lat) > 1e-6 || Math.abs(cur.lng - value.lng) > 1e-6) {
      markerRef.current.setLatLng(value)
      circleRef.current?.setLatLng(value)
      mapRef.current?.setView(value, Math.max(mapRef.current.getZoom(), 16))
    }
  }, [ready, value.lat, value.lng])

  useEffect(() => { if (ready) circleRef.current?.setRadius(radius) }, [ready, radius])

  if (err) {
    return (
      <div className="rounded-xl border border-line bg-navy-50/50 p-4 text-[12.5px] font-bold text-ink-600">{err}</div>
    )
  }

  return (
    <div className="relative rounded-xl overflow-hidden border border-line">
      <div ref={boxRef} style={{ height }} className="w-full bg-navy-50" />
      {!ready && (
        <div className="absolute inset-0 grid place-items-center bg-navy-50 text-[12px] font-bold text-ink-400">
          جارٍ تحميل الخريطة…
        </div>
      )}
      <p className="absolute z-[400] top-2 left-2 chip bg-surface/95 border border-line text-[10.5px] shadow-soft">
        اضغط على الخريطة أو اسحب الدبّوس لتحديد مركز المسجد
      </p>
    </div>
  )
}
