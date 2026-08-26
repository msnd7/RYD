import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useDb } from '../store/db'
import { useAuth } from '../store/auth'
import { Card, Field, Select, useToast, Empty, Badge } from '../components/ui'
import { PageHeader } from '../components/PageHeader'
import { getPosition, distanceMeters } from '../lib/geo'
import { staffOf } from '../lib/selectors'

export default function MosqueSettings() {
  const { mid = '' } = useParams()
  const { db, set } = useDb()
  const { isDirector } = useAuth()
  const toast = useToast()
  const m = db.mosques.find((x) => x.id === mid)!
  const [f, setF] = useState({ ...m, ...m.geofence })
  const [busy, setBusy] = useState(false)
  const [test, setTest] = useState<string | null>(null)

  if (!isDirector) return <Card><Empty icon="🔒" title="إعدادات المسجد مقصورة على مدير المجمع" /></Card>

  const useMyLocation = async () => {
    setBusy(true)
    try {
      const p = await getPosition()
      setF((s) => ({ ...s, lat: Number(p.lat.toFixed(6)), lng: Number(p.lng.toFixed(6)) }))
      toast(`تم أخذ موقعك الحالي (دقة ${p.accuracy} م)`)
    } catch (e: any) { toast(e.message, 'bad') } finally { setBusy(false) }
  }

  const testDistance = async () => {
    setBusy(true); setTest(null)
    try {
      const p = await getPosition()
      const d = distanceMeters(p, { lat: Number(f.lat), lng: Number(f.lng) })
      setTest(d <= Number(f.radius)
        ? `✔ أنت داخل النطاق — المسافة ${d} متر من مركز المسجد.`
        : `⚠ أنت خارج النطاق — المسافة ${d} متر، والنطاق ${f.radius} متر.`)
    } catch (e: any) { setTest(e.message) } finally { setBusy(false) }
  }

  const save = () => {
    set((d) => {
      const x = d.mosques.find((y) => y.id === mid)!
      x.name = f.name; x.shortName = f.shortName; x.address = f.address
      x.color = f.color; x.supervisorId = f.supervisorId
      x.geofence = { lat: Number(f.lat), lng: Number(f.lng), radius: Number(f.radius) }
      const sup = d.people.find((p) => p.id === f.supervisorId)
      if (sup) { sup.role = 'supervisor'; sup.mosqueId = mid }
    })
    toast('تم حفظ إعدادات المسجد')
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <PageHeader
        eyebrow={m.name}
        title="إعدادات المسجد"
        description="بيانات المسجد ومشرفه، والنطاق المكاني الذي لا يُقبل التحضير خارجه."
      />
      <Card title="بيانات المسجد">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="اسم المسجد" required>
            <input className="field" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <Field label="الاسم المختصر">
            <input className="field" value={f.shortName} onChange={(e) => setF({ ...f, shortName: e.target.value })} />
          </Field>
          <Field label="العنوان">
            <input className="field" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
          </Field>
          <Field label="مشرف المسجد">
            <Select value={f.supervisorId ?? ''} onChange={(v) => setF({ ...f, supervisorId: v })} placeholder="بدون"
              options={staffOf(db, mid).map((p) => ({ value: p.id, label: p.name }))} />
          </Field>
          <Field label="لون المسجد في الواجهة">
            <Select value={f.color} onChange={(v) => setF({ ...f, color: v as any })} placeholder=""
              options={[
                { value: 'brand', label: 'أزرق غامق' },
                { value: 'olive', label: 'أزرق متوسط' },
                { value: 'gold', label: 'برتقالي' },
              ]} />
          </Field>
        </div>
      </Card>

      <Card title="النطاق المكاني للتحضير"
        subtitle="لا يستطيع المشرف تحضير نفسه إلا إذا كان داخل هذا النطاق">
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="خط العرض (Latitude)" required>
            <input className="field" dir="ltr" value={f.lat} onChange={(e) => setF({ ...f, lat: e.target.value as any })} />
          </Field>
          <Field label="خط الطول (Longitude)" required>
            <input className="field" dir="ltr" value={f.lng} onChange={(e) => setF({ ...f, lng: e.target.value as any })} />
          </Field>
          <Field label="نصف قطر النطاق (متر)" required hint="يُنصح بـ ١٠٠–٢٠٠ متر">
            <input type="number" className="field" value={f.radius} onChange={(e) => setF({ ...f, radius: e.target.value as any })} />
          </Field>
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          <button className="btn-primary btn-sm" onClick={useMyLocation} disabled={busy}>
            📍 استخدام موقعي الحالي كمركز
          </button>
          <button className="btn-ghost btn-sm" onClick={testDistance} disabled={busy}>
            🎯 اختبار: هل أنا داخل النطاق؟
          </button>
          <a className="btn-ghost btn-sm" target="_blank" rel="noreferrer"
            href={`https://www.google.com/maps/search/?api=1&query=${f.lat},${f.lng}`}>
            🗺️ عرض على الخريطة
          </a>
        </div>
        {test && <p className="mt-3 text-[13px] font-bold rounded-xl px-4 py-3 bg-navy-50 border border-line">{test}</p>}

        <div className="mt-5 rounded-2xl bg-navy-50/60 border border-navy-100 p-4 text-[12.5px] leading-7 text-navy-800">
          <b>كيف يعمل النطاق؟</b> عند ضغط المشرف على «تحضير نفسي» يقرأ الموقع من جهازه ويحسب المسافة
          بينه وبين مركز المسجد. إن كانت المسافة أقل من نصف القطر يُسجَّل الحضور تلقائيًا مع حفظ المسافة،
          وإلا تظهر له رسالة برفض التحضير.
        </div>
      </Card>

      <div className="flex gap-2">
        <button className="btn-primary" onClick={save}>حفظ الإعدادات</button>
      </div>
    </div>
  )
}
