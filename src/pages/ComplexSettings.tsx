import { useRef, useState } from 'react'
import { useDb } from '../store/db'
import { useAuth } from '../store/auth'
import { Card, Field, useToast, Empty, Badge } from '../components/ui'
import { Link } from 'react-router-dom'

export default function ComplexSettings() {
  const { db, set, reset, exportJson, importJson } = useDb()
  const { isDirector } = useAuth()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [s, setS] = useState({ ...db.settings })
  const [aiEndpoint, setAiEndpoint] = useState(localStorage.getItem('ryd.ai.endpoint') ?? '')

  if (!isDirector) return <Card><Empty icon="🔒" title="الإعدادات مقصورة على مدير المجمع" /></Card>

  const save = () => {
    set((d) => { d.settings = { ...s, workDaysPerMonth: Number(s.workDaysPerMonth) || 26,
      absentDeductionDays: Number(s.absentDeductionDays), excusedDeductionDays: Number(s.excusedDeductionDays),
      reminderSeconds: Number(s.reminderSeconds) || 10 } })
    toast('تم حفظ الإعدادات')
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <Card title="هوية المجمع">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="اسم المجمع">
            <input className="field" value={s.complexName} onChange={(e) => setS({ ...s, complexName: e.target.value })} />
          </Field>
          <Field label="الوصف">
            <input className="field" value={s.complexSubtitle} onChange={(e) => setS({ ...s, complexSubtitle: e.target.value })} />
          </Field>
        </div>
        <p className="muted mt-3">
          لتغيير الشعار: استبدل الملف <code className="bg-slate-100 px-1.5 py-0.5 rounded">public/logo.svg</code> بشعار المجمع.
        </p>
      </Card>

      <Card title="سياسة الحضور والخصومات">
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="أيام العمل في الشهر" hint="أساس احتساب قيمة اليوم">
            <input type="number" className="field" value={s.workDaysPerMonth}
              onChange={(e) => setS({ ...s, workDaysPerMonth: e.target.value as any })} />
          </Field>
          <Field label="خصم يوم الغياب" hint="بالأيام — الافتراضي يوم كامل">
            <input type="number" step="0.5" className="field" value={s.absentDeductionDays}
              onChange={(e) => setS({ ...s, absentDeductionDays: e.target.value as any })} />
          </Field>
          <Field label="خصم الاستئذان" hint="بالأيام — الافتراضي نصف يوم">
            <input type="number" step="0.5" className="field" value={s.excusedDeductionDays}
              onChange={(e) => setS({ ...s, excusedDeductionDays: e.target.value as any })} />
          </Field>
        </div>
      </Card>

      <Card title="التنبيهات">
        <Field label="مدة ظهور إشعار الدخول (بالثواني)" hint="يظهر عند كل دخول ثم يختفي تلقائيًا">
          <input type="number" className="field max-w-[180px]" value={s.reminderSeconds}
            onChange={(e) => setS({ ...s, reminderSeconds: e.target.value as any })} />
        </Field>
      </Card>

      <Card title="مساعد التنسيق الذكي"
        subtitle="يعمل حاليًا محليًا داخل المتصفح بقواعد لغوية عربية، بدون إنترنت">
        <Field label="ربط بخدمة ذكاء اصطناعي (اختياري)"
          hint="أدخل عنوان خدمة تستقبل { text, kind } وتعيد { text }. اتركه فارغًا لاستخدام التنسيق المحلي.">
          <div className="flex gap-2">
            <input className="field" dir="ltr" value={aiEndpoint} onChange={(e) => setAiEndpoint(e.target.value)}
              placeholder="https://example.com/api/polish" />
            <button className="btn-ghost btn-sm shrink-0" onClick={() => {
              if (aiEndpoint.trim()) localStorage.setItem('ryd.ai.endpoint', aiEndpoint.trim())
              else localStorage.removeItem('ryd.ai.endpoint')
              toast('تم الحفظ')
            }}>حفظ</button>
          </div>
        </Field>
      </Card>

      <Card title="المساجد">
        <ul className="divide-y divide-slate-100">
          {db.mosques.map((m) => (
            <li key={m.id} className="py-3 flex flex-wrap items-center gap-3">
              <span className="font-bold flex-1">{m.name}</span>
              <Badge tone="info">📍 {m.geofence.radius} م</Badge>
              <Link to={`/m/${m.id}/settings`} className="btn-ghost btn-sm">إعدادات النطاق</Link>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="النسخ الاحتياطي" subtitle="تُحفظ البيانات في متصفح هذا الجهاز — احتفظ بنسخة دورية">
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary btn-sm" onClick={exportJson}>⬇ تصدير نسخة احتياطية</button>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return
            try { await importJson(f); toast('تم استيراد النسخة') } catch { toast('ملف غير صالح', 'bad') }
            e.target.value = ''
          }} />
          <button className="btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>⬆ استيراد نسخة</button>
          <button className="btn-sm px-3 rounded-lg text-rose-600 hover:bg-rose-50 font-bold" onClick={() => {
            if (!confirm('سيتم حذف كل البيانات والعودة للبيانات التجريبية. متابعة؟')) return
            reset(); toast('تمت إعادة التهيئة', 'info')
          }}>إعادة تهيئة البيانات</button>
        </div>
      </Card>

      <button className="btn-primary" onClick={save}>حفظ الإعدادات</button>
    </div>
  )
}
