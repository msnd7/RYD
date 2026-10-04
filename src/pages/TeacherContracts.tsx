import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDb, uid } from '../store/db'
import { useAuth } from '../store/auth'
import { Card, Modal, Field, Select, Badge, Empty, useToast, Menu, StatStrip } from '../components/ui'
import { SignaturePad } from '../components/SignaturePad'
import { DocActions } from '../components/DocActions'
import { LogoMark } from '../components/Brand'
import logoSrc from '../assets/logo.png'
import { fmtDate, fmtHijri, fmtTime, todayISO, shiftDays } from '../lib/date'
import { money } from '../lib/format'
import { mosqueName, personName, teachersOf } from '../lib/selectors'
import { waLink, hasWhatsapp } from '../lib/whatsapp'
import type { Teacher, TeacherContract, TeacherContractStatus } from '../types'

export const TC_STATUS: Record<TeacherContractStatus, { label: string; tone: string }> = {
  draft: { label: 'مسودة — بانتظار توقيعك', tone: 'mute' },
  awaiting: { label: 'بانتظار توقيع المعلم', tone: 'warn' },
  signed: { label: 'موقّع', tone: 'ok' },
  cancelled: { label: 'ملغى', tone: 'bad' },
}

const DEFAULT_DUTIES = [
  'تحفيظ الطلاب ومراجعة محفوظهم وفق خطة الحلقة المعتمدة.',
  'الحضور قبل بدء الحلقة والالتزام بوقتها كاملًا.',
  'متابعة حضور الطلاب وتسجيل مستوياتهم ورفعها لمشرف المسجد.',
  'التواصل مع أولياء الأمور فيما يخص مستوى أبنائهم بالتنسيق مع المشرف.',
  'حسن التعامل مع الطلاب والقدوة الحسنة في السلوك والمظهر.',
].map((x, i) => `${i + 1}. ${x}`).join('\n')

function defaultTerms(lateDays: number) {
  return [
    `يرتبط الراتب بسجل الحضور في المنصة: يُخصم يوم كامل عن كل غياب، ونصف يوم عن كل استئذان معتمد${lateDays ? `، و${lateDays} يوم عن كل تأخير` : ''}.`,
    'تُصرف الرواتب يوم ١ من كل شهر ميلادي عن الشهر السابق، ويبدأ بعده احتساب شهر جديد.',
    'يحق لأي من الطرفين إنهاء العقد بإشعار كتابي قبل خمسة عشر يومًا.',
    'يلتزم المعلم بأنظمة المجمع وتعليمات مشرف المسجد.',
    'يُجدَّد العقد باتفاق الطرفين عند انتهاء مدته.',
  ].map((x, i) => `${i + 1}. ${x}`).join('\n')
}

/* =====================================================================
   عقود المعلمين — يُعدّها المفوض المالي ويوقّعها المعلم على جهازه
   ===================================================================== */
export function TeacherContracts({ mosqueId, isComplex, mosqueFilter }: {
  mosqueId: string; isComplex: boolean; mosqueFilter?: React.ReactNode
}) {
  const { db, set } = useDb()
  const { isDirector } = useAuth()
  const toast = useToast()
  const [editing, setEditing] = useState<TeacherContract | null>(null)
  const [creating, setCreating] = useState<{ teacherId?: string } | null>(null)
  const [viewId, setViewId] = useState<string | null>(null)
  const [fStatus, setFStatus] = useState<'' | TeacherContractStatus>('')

  const scoped = db.teacherContracts.filter((c) => !mosqueId || c.mosqueId === mosqueId)
  const list = scoped
    .filter((c) => !fStatus || c.status === fStatus)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const teachers = mosqueId ? teachersOf(db, mosqueId) : db.teachers.filter((t) => t.active)
  const withoutContract = teachers.filter((t) =>
    !db.teacherContracts.some((c) => c.teacherId === t.id && c.status !== 'cancelled'))
  const view = db.teacherContracts.find((c) => c.id === viewId) ?? null

  return (
    <div className="space-y-4">
      <StatStrip items={[
        { label: 'العقود', value: scoped.filter((c) => c.status !== 'cancelled').length },
        { label: 'موقّعة', value: scoped.filter((c) => c.status === 'signed').length },
        { label: 'بانتظار توقيع المعلم', value: scoped.filter((c) => c.status === 'awaiting').length,
          accent: scoped.some((c) => c.status === 'awaiting') },
        { label: 'معلمون بلا عقد', value: withoutContract.length, hint: `من ${teachers.length} معلمًا` },
      ]} />

      <Card title="عقود المعلمين"
        subtitle="أنشئ العقد ووقّعه، ثم سلّم جهازك للمعلم ليقرأه ويوقّعه، وأرسله له PDF"
        action={<>
          {mosqueFilter}
          <Select value={fStatus} onChange={(v) => setFStatus(v as any)} placeholder="كل الحالات"
            options={Object.entries(TC_STATUS).map(([v, s]) => ({ value: v, label: s.label.split(' — ')[0] }))} />
          <button className="btn-primary btn-sm" onClick={() => setCreating({})}>＋ عقد جديد</button>
        </>}
        pad={false}>
        {list.length === 0 ? (
          <Empty icon="📜" title={scoped.length ? 'لا توجد عقود بهذه الحالة' : 'لا توجد عقود للمعلمين بعد'}
            hint="اختر المعلم وحدّد راتبه ومدة العقد، فتُملأ البنود تلقائيًا ويمكنك تعديلها."
            action={teachers.length > 0 && <button className="btn-primary btn-sm" onClick={() => setCreating({})}>＋ إنشاء أول عقد</button>} />
        ) : (
          <ul className="divide-y divide-line">
            {list.map((c) => {
              const t = db.teachers.find((x) => x.id === c.teacherId)
              return (
                <li key={c.id} className="px-4 sm:px-5 py-3.5 flex items-center gap-3 hover:bg-navy-50/40 transition cursor-pointer"
                  onClick={() => setViewId(c.id)}>
                  <span className={`w-11 h-11 rounded-2xl grid place-items-center shrink-0 text-[18px]
                    ${c.status === 'signed' ? 'bg-navy-700 text-white' : c.status === 'awaiting' ? 'bg-orange-100 text-orange-700' : 'bg-navy-50 text-ink-500'}`}>
                    {c.status === 'signed' ? '✓' : '📜'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-[13.5px] truncate">{t?.name ?? 'معلم محذوف'}</p>
                      <Badge tone={TC_STATUS[c.status].tone}>{TC_STATUS[c.status].label.split(' — ')[0]}</Badge>
                      {c.sentAt && <Badge tone="info">أُرسل PDF</Badge>}
                    </div>
                    <p className="text-[11.5px] text-ink-400 mt-0.5 truncate">
                      {c.title} · {money(c.salary)} شهريًا · {fmtDate(c.startDate)} — {fmtDate(c.endDate)}
                      {isComplex && ` · ${mosqueName(db, c.mosqueId)}`}
                    </p>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <Menu items={[
                      { label: 'فتح العقد', icon: '📄', onClick: () => setViewId(c.id) },
                      ...(c.status === 'draft' || c.status === 'awaiting'
                        ? [{ label: 'تعديل البنود', icon: '✎', onClick: () => setEditing(c) }] : []),
                      ...(c.status !== 'signed' && c.status !== 'cancelled' ? [{
                        label: 'حذف المسودة', icon: '🗑', danger: true,
                        onClick: () => {
                          if (!confirm('حذف هذا العقد نهائيًا؟')) return
                          set((d) => { d.teacherContracts = d.teacherContracts.filter((x) => x.id !== c.id) })
                          toast('حُذف العقد')
                        },
                      }] : []),
                      ...(c.status === 'signed' && isDirector ? ['sep' as const, {
                        label: 'إلغاء العقد', icon: '⏻', danger: true,
                        onClick: () => {
                          if (!confirm('إلغاء هذا العقد الموقّع؟ يبقى في السجل بحالة «ملغى».')) return
                          set((d) => { const x = d.teacherContracts.find((y) => y.id === c.id); if (x) x.status = 'cancelled' })
                          toast('أُلغي العقد', 'info')
                        },
                      }] : []),
                    ]} />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      {withoutContract.length > 0 && (
        <Card title="معلمون بلا عقد" subtitle="ابدأ عقد أي معلم بضغطة" pad={false}>
          <div className="p-4 sm:p-5 flex flex-wrap gap-2">
            {withoutContract.map((t) => (
              <button key={t.id} onClick={() => setCreating({ teacherId: t.id })}
                className="chip !py-2 !px-3 bg-navy-50 text-navy-800 hover:bg-navy-100 transition">
                ＋ {t.name}{isComplex && <span className="text-ink-400 font-normal">· {mosqueName(db, t.mosqueId).replace('جامع ', '')}</span>}
              </button>
            ))}
          </div>
        </Card>
      )}

      <ContractEditor open={!!creating || !!editing} contract={editing}
        presetTeacherId={creating?.teacherId} mosqueId={mosqueId}
        onClose={() => { setCreating(null); setEditing(null) }}
        onSaved={(id) => { setCreating(null); setEditing(null); setViewId(id) }} />
      {view && <ContractViewer contract={view} onClose={() => setViewId(null)} onEdit={() => { setEditing(view); setViewId(null) }} />}
    </div>
  )
}

/* ================= إنشاء وتعديل ================= */
function ContractEditor({ open, contract, presetTeacherId, mosqueId, onClose, onSaved }: {
  open: boolean; contract: TeacherContract | null; presetTeacherId?: string; mosqueId: string
  onClose: () => void; onSaved: (id: string) => void
}) {
  const { db, set } = useDb()
  const { user } = useAuth()
  const toast = useToast()
  const [f, setF] = useState<any>({})
  const [key, setKey] = useState('')
  const sig = `${open}-${contract?.id ?? 'new'}-${presetTeacherId ?? ''}`
  if (sig !== key) {
    setKey(sig)
    const t = db.teachers.find((x) => x.id === presetTeacherId)
    const start = todayISO()
    setF(contract ? { ...contract } : {
      teacherId: t?.id ?? '', mosqueId: t?.mosqueId ?? mosqueId,
      title: 'عقد عمل معلم حلقة تحفيظ', startDate: start, endDate: shiftDays(start, 364),
      salary: t?.salary ?? 0, workDays: 'من الأحد إلى الخميس', workHours: 'بعد صلاة العصر حتى صلاة المغرب',
      duties: DEFAULT_DUTIES, terms: defaultTerms(db.settings.lateDeductionDays ?? 0),
    })
  }
  if (!open) return null

  const pool = (f.mosqueId ? teachersOf(db, f.mosqueId) : db.teachers.filter((t) => t.active))
  const pickTeacher = (id: string) => {
    const t = db.teachers.find((x) => x.id === id)
    setF((s: any) => ({ ...s, teacherId: id, mosqueId: t?.mosqueId ?? s.mosqueId, salary: s.salary || t?.salary || 0 }))
  }

  const save = () => {
    if (!f.teacherId) return toast('اختر المعلم.', 'bad')
    if (!Number(f.salary)) return toast('حدّد الراتب الشهري.', 'bad')
    if (!f.startDate || !f.endDate || f.endDate < f.startDate) return toast('تحقّق من تاريخي بداية العقد ونهايته.', 'bad')
    const payload = { ...f, salary: Number(f.salary) || 0 }
    let id = contract?.id ?? uid('tcn')
    set((d) => {
      if (contract) {
        const x = d.teacherContracts.find((y) => y.id === contract.id)!
        Object.assign(x, payload)
        // أي تعديل على البنود يُسقط توقيع الطرف الأول فيُعاد اعتماده
        x.issuerSignature = undefined; x.issuerName = undefined; x.status = 'draft'
      } else {
        d.teacherContracts.push({ ...payload, id, status: 'draft', createdBy: user!.id, createdAt: new Date().toISOString() })
      }
    })
    toast(contract ? 'حُفظت البنود — أعد توقيعك لاعتمادها' : 'أُنشئ العقد — وقّعه ثم سلّمه للمعلم')
    onSaved(id)
  }

  return (
    <Modal open onClose={onClose} title={contract ? 'تعديل عقد معلم' : 'عقد معلم جديد'} wide
      footer={<><button className="btn-primary" onClick={save}>{contract ? 'حفظ التعديلات' : 'إنشاء العقد'}</button>
        <button className="btn-ghost" onClick={onClose}>إلغاء</button></>}>
      <div className="space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          {!mosqueId && (
            <Field label="المسجد" required>
              <Select value={f.mosqueId ?? ''} onChange={(v) => setF({ ...f, mosqueId: v, teacherId: '' })}
                options={db.mosques.map((m) => ({ value: m.id, label: m.name }))} />
            </Field>
          )}
          <Field label="المعلم" required hint={pool.length ? undefined : 'لا يوجد معلمون — أضفهم من صفحة المعلمين أولًا'}>
            <Select value={f.teacherId ?? ''} onChange={pickTeacher} placeholder="اختر المعلم…"
              options={pool.map((t) => ({ value: t.id, label: `${t.name}${t.circle ? ` — ${t.circle}` : ''}` }))} />
          </Field>
          <Field label="عنوان العقد">
            <input className="field" value={f.title ?? ''} onChange={(e) => setF({ ...f, title: e.target.value })} />
          </Field>
          <Field label="الراتب الشهري (ر.س)" required hint="يُحدَّث راتب المعلم في المسيّر عند توقيعه">
            <input type="number" inputMode="numeric" className="field" value={f.salary ?? 0}
              onChange={(e) => setF({ ...f, salary: e.target.value })} />
          </Field>
          <Field label="بداية العقد" required>
            <input type="date" className="field" value={f.startDate ?? ''} onChange={(e) => setF({ ...f, startDate: e.target.value })} />
          </Field>
          <Field label="نهاية العقد" required>
            <div className="flex gap-2">
              <input type="date" className="field" value={f.endDate ?? ''} onChange={(e) => setF({ ...f, endDate: e.target.value })} />
              <Select className="!w-28 shrink-0" value="" placeholder="مدة…" onChange={(v) => v && setF({ ...f, endDate: shiftDays(f.startDate || todayISO(), Number(v)) })}
                options={[{ value: '89', label: '٣ أشهر' }, { value: '181', label: '٦ أشهر' }, { value: '364', label: 'سنة' }]} />
            </div>
          </Field>
          <Field label="أيام الدوام">
            <input className="field" value={f.workDays ?? ''} onChange={(e) => setF({ ...f, workDays: e.target.value })} />
          </Field>
          <Field label="وقت الحلقة">
            <input className="field" value={f.workHours ?? ''} onChange={(e) => setF({ ...f, workHours: e.target.value })} />
          </Field>
        </div>
        <Field label="مهام المعلم وواجباته">
          <textarea className="field leading-7" rows={6} value={f.duties ?? ''} onChange={(e) => setF({ ...f, duties: e.target.value })} />
        </Field>
        <Field label="بنود العقد">
          <textarea className="field leading-7" rows={6} value={f.terms ?? ''} onChange={(e) => setF({ ...f, terms: e.target.value })} />
        </Field>
      </div>
    </Modal>
  )
}

/* ================= وثيقة العقد ================= */
export function ContractDoc({ c, teacher }: { c: TeacherContract; teacher?: Teacher }) {
  const { db } = useDb()
  const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean)
  return (
    <div className="bg-surface text-ink-900">
      <header className="text-center border-b-2 border-navy-700 pb-4">
        <img src={logoSrc} alt="" style={{ height: 60 }} className="w-auto object-contain mx-auto" />
        <h2 className="font-display font-black text-[19px] text-navy-800 mt-2">{db.settings.complexName}</h2>
        <p className="text-[11px] text-ink-500 mt-0.5">{db.settings.complexSubtitle}</p>
        <h3 className="mt-3 font-extrabold text-[17px] text-navy-900">{c.title}</h3>
        <p className="text-[10.5px] text-ink-400 mt-1">رقم العقد: {c.id.slice(-8).toUpperCase()} · حُرّر في {fmtDate(c.createdAt)} — {fmtHijri(c.createdAt)}</p>
      </header>

      <p className="text-[13px] leading-8 mt-5 pdf-keep">
        إنه في يوم {fmtDate(c.createdAt)} تم الاتفاق بين كلٍّ من:
        <br /><b>الطرف الأول:</b> {db.settings.complexName} — {mosqueName(db, c.mosqueId)}، ويمثّله المفوض المالي{c.issuerName ? ` / ${c.issuerName}` : ''}.
        <br /><b>الطرف الثاني:</b> المعلم / {teacher?.name ?? '—'}{teacher?.phone ? `، جوال ${teacher.phone}` : ''}.
        <br />على أن يعمل الطرف الثاني معلمًا لحلقات تحفيظ القرآن الكريم وفق البنود الآتية:
      </p>

      <dl className="grid grid-cols-2 gap-x-8 gap-y-2.5 mt-4 text-[13px]">
        {[
          ['المسجد', mosqueName(db, c.mosqueId)],
          ['الحلقة', teacher?.circle || '—'],
          ['المرحلة', teacher?.level || '—'],
          ['الراتب الشهري', money(c.salary)],
          ['بداية العقد', fmtDate(c.startDate)],
          ['نهاية العقد', fmtDate(c.endDate)],
          ['أيام الدوام', c.workDays || '—'],
          ['وقت الحلقة', c.workHours || '—'],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 border-b border-dashed border-line pb-1.5">
            <dt className="doc-k shrink-0">{k}</dt>
            <dd className="doc-v text-left">{v}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-5">
        <h4 className="font-extrabold text-[14px] text-navy-900 mb-1.5">أولًا: مهام المعلم وواجباته</h4>
        {lines(c.duties).map((l, i) => <p key={i} className="text-[13px] leading-8 text-ink-800">{l}</p>)}
      </section>
      <section className="mt-4">
        <h4 className="font-extrabold text-[14px] text-navy-900 mb-1.5">ثانيًا: بنود العقد</h4>
        {lines(c.terms).map((l, i) => <p key={i} className="text-[13px] leading-8 text-ink-800">{l}</p>)}
      </section>

      <div className="grid grid-cols-2 gap-8 mt-8 pdf-keep">
        <div>
          <p className="doc-k mb-1.5">الطرف الأول — المفوض المالي</p>
          <div className="h-20 border-b-2 border-line grid place-items-center">
            {c.issuerSignature
              ? <img src={c.issuerSignature} alt="توقيع الطرف الأول" className="max-h-[74px]" />
              : <span className="text-ink-300 text-[12px] font-bold">لم يُوقَّع بعد</span>}
          </div>
          <p className="text-[11.5px] font-bold mt-1.5">{c.issuerName || ' '}</p>
        </div>
        <div>
          <p className="doc-k mb-1.5">الطرف الثاني — المعلم</p>
          <div className="h-20 border-b-2 border-line grid place-items-center">
            {c.teacherSignature
              ? <img src={c.teacherSignature} alt="توقيع المعلم" className="max-h-[74px]" />
              : <span className="text-ink-300 text-[12px] font-bold">لم يُوقَّع بعد</span>}
          </div>
          <p className="text-[11.5px] font-bold mt-1.5">{c.teacherSignedName || teacher?.name}</p>
          {c.signedAt && (
            <p className="text-[10.5px] text-navy-700 font-bold mt-0.5">
              ✔ قرأ العقد ووقّعه في {fmtDate(c.signedAt)} الساعة {fmtTime(c.signedAt)}
            </p>
          )}
        </div>
      </div>

      <footer className="mt-7 pt-2.5 border-t border-line flex justify-between gap-2 text-[9.5px] text-ink-500">
        <span>وُقّع إلكترونيًا عبر منصة إدارة مجمع رياض القرآن</span>
        <span>{fmtDate(todayISO())}</span>
      </footer>
    </div>
  )
}

/* ================= عرض العقد والتوقيع والإرسال ================= */
function ContractViewer({ contract: c, onClose, onEdit }: { contract: TeacherContract; onClose: () => void; onEdit: () => void }) {
  const { db, set } = useDb()
  const { user } = useAuth()
  const toast = useToast()
  const [signing, setSigning] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const teacher = db.teachers.find((t) => t.id === c.teacherId)
  // توقيع المفوض السابق — لتوفير إعادة الرسم في كل عقد
  const saved = db.teacherContracts
    .filter((x) => x.createdBy === user?.id && x.issuerSignature && x.id !== c.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.issuerSignature

  const issuerSign = (sig: string) => {
    set((d) => {
      const x = d.teacherContracts.find((y) => y.id === c.id)!
      x.issuerSignature = sig; x.issuerName = user?.name; x.status = 'awaiting'
    })
    toast('اعتُمد العقد بتوقيعك — سلّم الجهاز للمعلم')
  }

  const markSent = () => set((d) => {
    const x = d.teacherContracts.find((y) => y.id === c.id)
    if (x) x.sentAt = new Date().toISOString()
  })

  const wa = waLink(teacher?.phone, [
    `السلام عليكم ورحمة الله، الأستاذ ${teacher?.name ?? ''}`,
    '',
    `مرفق لكم نسخة عقد العمل الموقّع مع ${db.settings.complexName} — ${mosqueName(db, c.mosqueId)}.`,
    `• مدة العقد: ${fmtDate(c.startDate)} — ${fmtDate(c.endDate)}`,
    `• الراتب الشهري: ${money(c.salary)}`,
    '',
    'بارك الله فيكم ونفع بكم.',
  ].join('\n'))

  return (
    <>
      <Modal open={!signing} onClose={onClose} title={`عقد ${teacher?.name ?? ''}`} wide>
        <div className="space-y-4">
          {/* شريط الحالة والخطوات */}
          <ol className="grid grid-cols-3 gap-2">
            {[
              ['إعداد العقد', true],
              ['توقيع المفوض', !!c.issuerSignature],
              ['توقيع المعلم', !!c.teacherSignature],
            ].map(([l, done], i) => (
              <li key={l as string} className={`rounded-xl border px-3 py-2 text-[11.5px] font-bold flex items-center gap-2
                ${done ? 'bg-navy-700 border-navy-700 text-white' : 'bg-surface border-line text-ink-400'}`}>
                <span className={`w-5 h-5 rounded-full grid place-items-center text-[10px] ${done ? 'bg-white/20' : 'bg-navy-50'}`}>{done ? '✓' : i + 1}</span>
                {l as string}
              </li>
            ))}
          </ol>

          {c.status === 'signed' && (
            <div className="rounded-2xl bg-navy-50 border border-navy-100 p-4 space-y-3">
              <div>
                <p className="font-bold text-[13.5px] text-navy-900">✔ العقد موقّع من الطرفين</p>
                <p className="text-[12px] text-ink-500 mt-0.5">
                  أرسله للمعلم ملف PDF: على الجوال تفتح قائمة المشاركة (واتساب وغيره) مباشرة، وعلى الحاسب يُنزَّل الملف لإرفاقه.
                  {c.sentAt && <> · أُرسل في {fmtDate(c.sentAt)}</>}
                </p>
              </div>
              <DocActions target={() => ref.current} filename={`عقد ${teacher?.name ?? 'معلم'}`}
                shareText={`عقد العمل — ${teacher?.name ?? ''}`} onShared={markSent} />
              {wa && (
                <a href={wa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[12px] font-bold text-navy-700 hover:text-orange-600">
                  💬 فتح محادثة المعلم في واتساب ({teacher?.phone})
                </a>
              )}
              {!hasWhatsapp(teacher?.phone) && (
                <p className="text-[11.5px] text-ink-400">لا يوجد رقم جوال صالح للمعلم — أضفه من صفحة المعلمين لفتح محادثته مباشرة.</p>
              )}
            </div>
          )}

          {c.status === 'awaiting' && (
            <div className="rounded-2xl bg-orange-50 border border-orange-200 p-4 flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-bold text-[13.5px] text-orange-800">الخطوة التالية: توقيع المعلم</p>
                <p className="text-[12px] text-orange-800/80 mt-0.5">سلّم جهازك للمعلم؛ سيقرأ العقد كاملًا ثم يقرّ ويوقّع عليه بإصبعه.</p>
              </div>
              <button className="btn-accent" onClick={() => setSigning(true)}>✍️ تسليم الجهاز للمعلم</button>
            </div>
          )}

          {c.status === 'draft' && (
            <div className="rounded-2xl bg-surface border border-line p-4">
              <p className="font-bold text-[13.5px]">اعتمد العقد بتوقيعك أولًا</p>
              <p className="text-[12px] text-ink-500 mt-0.5 mb-3">بصفتك المفوض المالي (الطرف الأول). بعدها يُسلَّم للمعلم ليوقّع.</p>
              {saved && (
                <button className="btn-soft btn-sm mb-3" onClick={() => issuerSign(saved)}>استخدام توقيعي المحفوظ</button>
              )}
              <SignaturePad onSave={issuerSign} />
              <button className="btn-ghost btn-sm mt-3" onClick={onEdit}>✎ تعديل البنود قبل التوقيع</button>
            </div>
          )}

          <div className="rounded-2xl bg-canvas border border-line p-2 sm:p-3 overflow-x-auto">
            <div ref={ref} className="paper p-5 sm:p-8 min-w-[600px]">
              <ContractDoc c={c} teacher={teacher} />
            </div>
          </div>

          {c.status !== 'signed' && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11.5px] text-ink-400 font-bold">نسخة للمراجعة قبل التوقيع:</span>
              <DocActions compact target={() => ref.current} filename={`مسودة عقد ${teacher?.name ?? 'معلم'}`} />
            </div>
          )}
          <p className="text-[11px] text-ink-400">أعدّه {personName(db, c.createdBy)} في {fmtDate(c.createdAt)}</p>
        </div>
      </Modal>
      {signing && <SigningMode contract={c} teacher={teacher} onClose={() => setSigning(false)} />}
    </>
  )
}

/* =====================================================================
   وضع توقيع المعلم — شاشة كاملة على جهاز المفوض:
   قراءة العقد حتى نهايته ← إقرار ← توقيع ← شكر وإعادة الجهاز
   ===================================================================== */
function SigningMode({ contract: c, teacher, onClose }: { contract: TeacherContract; teacher?: Teacher; onClose: () => void }) {
  const { set } = useDb()
  const toast = useToast()
  const [step, setStep] = useState<'read' | 'sign' | 'done'>('read')
  const [progress, setProgress] = useState(0)
  const [readAt, setReadAt] = useState<string | null>(null)
  const [agree, setAgree] = useState(false)
  const [name, setName] = useState(teacher?.name ?? '')
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const onScroll = () => {
    const el = scroller.current
    if (!el) return
    const max = el.scrollHeight - el.clientHeight
    const p = max <= 0 ? 100 : Math.min(100, Math.round((el.scrollTop / max) * 100))
    setProgress((x) => Math.max(x, p))
    if (p >= 97 && !readAt) setReadAt(new Date().toISOString())
  }
  // عقد قصير لا يحتاج تمريرًا
  useEffect(() => { const t = setTimeout(onScroll, 300); return () => clearTimeout(t) })

  const sign = (sig: string) => {
    if (!agree) return toast('ضع علامة الإقرار أولًا.', 'bad')
    if (name.trim().length < 3) return toast('اكتب اسمك الكامل.', 'bad')
    const now = new Date().toISOString()
    set((d) => {
      const x = d.teacherContracts.find((y) => y.id === c.id)!
      x.teacherSignature = sig; x.teacherSignedName = name.trim()
      x.readAt = readAt ?? now; x.signedAt = now; x.status = 'signed'
      // العقد الموقّع يحدّد راتب المعلم في المسيّر
      const t = d.teachers.find((y) => y.id === c.teacherId)
      if (t) { t.salary = c.salary; if (!t.hiredAt) t.hiredAt = c.startDate }
    })
    setStep('done')
  }

  const exit = () => {
    if (step !== 'done' && !confirm('الخروج من وضع التوقيع؟ لن يُحفظ توقيع المعلم.')) return
    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 z-[160] bg-canvas flex flex-col" style={{ paddingTop: 'var(--safe-t)' }}>
      <header className="shrink-0 bg-surface border-b border-line">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center gap-3">
          <LogoMark h={34} />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="font-display font-bold text-[15px] text-navy-900 truncate">
              {step === 'done' ? 'تم التوقيع' : `مرحبًا ${teacher?.name?.split(' ')[0] ?? ''}`}
            </p>
            <p className="text-[11px] font-bold text-ink-400">
              {step === 'read' ? 'الخطوة ١ من ٢ — اقرأ العقد كاملًا' : step === 'sign' ? 'الخطوة ٢ من ٢ — الإقرار والتوقيع' : 'أعد الجهاز إلى المفوض المالي'}
            </p>
          </div>
          {step !== 'done' && <button onClick={exit} className="btn-ghost btn-sm">خروج</button>}
        </div>
        {step === 'read' && (
          <div className="h-1 bg-line"><div className="h-full bg-orange-500 transition-all" style={{ width: `${progress}%` }} /></div>
        )}
      </header>

      {step === 'read' && (
        <>
          <div ref={scroller} onScroll={onScroll} className="flex-1 overflow-y-auto overscroll-contain">
            <div className="max-w-3xl mx-auto p-3 sm:p-6">
              <div className="paper p-5 sm:p-8"><ContractDoc c={c} teacher={teacher} /></div>
            </div>
          </div>
          <footer className="shrink-0 bg-surface border-t border-line" style={{ paddingBottom: 'var(--safe-b)' }}>
            <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
              <p className="flex-1 text-[12px] font-bold text-ink-500">
                {progress >= 97 ? '✓ وصلت إلى نهاية العقد' : `مرّر للأسفل حتى نهاية العقد — قرأت ${progress}%`}
              </p>
              <button className="btn-accent" disabled={progress < 97} onClick={() => setStep('sign')}>متابعة للتوقيع ←</button>
            </div>
          </footer>
        </>
      )}

      {step === 'sign' && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-xl mx-auto p-4 sm:p-6 space-y-4" style={{ paddingBottom: 'max(1.5rem, var(--safe-b))' }}>
            <div className="card p-4 sm:p-5 space-y-2 text-[13px]">
              <p className="font-bold text-navy-900">ملخص العقد</p>
              <div className="flex justify-between"><span className="text-ink-500">الراتب الشهري</span><b>{money(c.salary)}</b></div>
              <div className="flex justify-between"><span className="text-ink-500">مدة العقد</span><b>{fmtDate(c.startDate)} — {fmtDate(c.endDate)}</b></div>
              <div className="flex justify-between"><span className="text-ink-500">الدوام</span><b className="text-left">{c.workDays} · {c.workHours}</b></div>
              <button className="text-[12px] font-bold text-navy-600 hover:text-orange-600" onClick={() => setStep('read')}>↩ العودة لقراءة العقد</button>
            </div>
            <Field label="اسمك الكامل" required>
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <label className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 cursor-pointer transition
              ${agree ? 'bg-navy-50 border-navy-300' : 'bg-surface border-line'}`}>
              <input type="checkbox" className="w-5 h-5 mt-0.5 accent-orange-500 shrink-0" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              <span className="text-[13px] leading-7 font-bold text-ink-800">
                أقرّ أنا <u>{name || '…'}</u> بأنني قرأت بنود هذا العقد كاملة وفهمتها، وأوافق عليها وألتزم بها.
              </span>
            </label>
            <div className={agree ? '' : 'opacity-50 pointer-events-none'}>
              <p className="label">التوقيع</p>
              <SignaturePad onSave={sign} />
            </div>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="flex-1 grid place-items-center p-6">
          <div className="text-center max-w-sm pop-in">
            <div className="w-20 h-20 rounded-full bg-navy-700 text-white grid place-items-center text-4xl mx-auto shadow-lift">✓</div>
            <h2 className="text-navy-900 mt-5">جزاك الله خيرًا</h2>
            <p className="muted mt-2">حُفظ توقيعك على العقد. ستصلك نسخة PDF منه. أعد الجهاز الآن إلى المفوض المالي.</p>
            <button className="btn-primary btn-lg mt-6 w-full" onClick={onClose}>إعادة الجهاز للمفوض</button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}
