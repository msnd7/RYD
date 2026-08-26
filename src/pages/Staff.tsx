import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useDb, uid } from '../store/db'
import { useAuth } from '../store/auth'
import { Card, Modal, Field, Select, Badge, Empty, useToast, Stat, PrintBar } from '../components/ui'
import { SignaturePad } from '../components/SignaturePad'
import { todayISO, shiftDays, fmtDate } from '../lib/date'
import { staffOf, committeesOf, attendanceStats, payrollFor, mosqueName, committeeName } from '../lib/selectors'
import type { Person, Role } from '../types'

const ROLE_LABEL: Record<Role, string> = { director: 'مدير المجمع', supervisor: 'مشرف المسجد', member: 'عضو فريق العمل' }

export default function Staff({ scope }: { scope?: 'complex' }) {
  const { mid = '' } = useParams()
  const { db, set } = useDb()
  const { user, isDirector } = useAuth()
  const toast = useToast()
  const isComplex = scope === 'complex'

  const [editing, setEditing] = useState<Person | null>(null)
  const [open, setOpen] = useState(false)
  const [contractFor, setContractFor] = useState<Person | null>(null)
  const [fMosque, setFMosque] = useState('')
  const [q, setQ] = useState('')

  let list = isComplex
    ? db.people.filter((p) => p.mosqueId !== 'complex')
    : staffOf(db, mid)
  if (fMosque) list = list.filter((p) => p.mosqueId === fMosque)
  if (q.trim()) list = list.filter((p) => (p.name + p.jobTitle + p.phone).includes(q.trim()))

  const canEdit = isDirector || (user?.role === 'supervisor' && !isComplex && user.mosqueId === mid)

  const remove = (p: Person) => {
    if (!confirm(`إيقاف ${p.name}؟ سيختفي من القوائم مع بقاء سجلاته.`)) return
    set((d) => { const x = d.people.find((y) => y.id === p.id); if (x) x.active = false })
    toast('تم إيقاف العامل', 'info')
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="عدد العاملين" value={list.length} tone="brand" />
        <Stat label="مشرفون" value={list.filter((p) => p.role === 'supervisor').length} tone="olive" />
        <Stat label="عقود موقّعة" value={list.filter((p) => p.contract?.signedAt).length} tone="gold" />
        <Stat label="بانتظار التوقيع" value={list.filter((p) => p.contract && !p.contract.signedAt).length}
          tone={list.some((p) => p.contract && !p.contract.signedAt) ? 'rose' : 'slate'} />
      </div>

      <Card title="بيانات العاملين وتسكينهم في اللجان"
        subtitle="بمجرد تحديد اللجنة يظهر اسم العامل في لجنته تلقائيًا"
        action={<div className="flex gap-2">
          {isComplex && <Select value={fMosque} onChange={setFMosque} placeholder="كل المساجد"
            options={db.mosques.map((m) => ({ value: m.id, label: m.shortName }))} />}
          {canEdit && <button className="btn-primary btn-sm" onClick={() => { setEditing(null); setOpen(true) }}>＋ عامل جديد</button>}
        </div>} pad={false}>

        <div className="px-5 py-3 no-print">
          <input className="field" placeholder="🔍 بحث بالاسم أو الوظيفة أو الجوال…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        {list.length === 0 ? <Empty icon="👥" title="لا يوجد عاملون" /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">الاسم</th>
                  {isComplex && <th className="th">المسجد</th>}
                  <th className="th">الوظيفة</th>
                  <th className="th">اللجان</th>
                  <th className="th">الحضور (٣٠ يومًا)</th>
                  <th className="th">الراتب / الصافي</th>
                  <th className="th">العقد</th>
                  <th className="th no-print"></th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => {
                  const s = attendanceStats(db, p.id, shiftDays(todayISO(), -29), todayISO())
                  const pay = payrollFor(db, p, todayISO())
                  return (
                    <tr key={p.id} className="row">
                      <td className="td">
                        <div className="flex items-center gap-2.5">
                          <span className="w-9 h-9 rounded-xl bg-gradient-to-bl from-brand-400 to-brand-700 text-white grid place-items-center font-extrabold text-[13px]">
                            {p.name[0]}
                          </span>
                          <span>
                            <span className="block font-bold">{p.name}</span>
                            <span className="block text-[11px] text-ink-500">{p.phone} · {p.username}</span>
                          </span>
                        </div>
                      </td>
                      {isComplex && <td className="td text-[12px] text-ink-500">{mosqueName(db, p.mosqueId)}</td>}
                      <td className="td">
                        <div className="text-[12.5px] font-bold">{p.jobTitle}</div>
                        <Badge tone={p.role === 'supervisor' ? 'info' : 'mute'}>{ROLE_LABEL[p.role]}</Badge>
                        {p.financeAccess && <Badge tone="purple">تفويض مالي</Badge>}
                      </td>
                      <td className="td">
                        <div className="flex flex-wrap gap-1">
                          {p.committeeIds.length === 0 && <span className="text-ink-300 text-[12px]">—</span>}
                          {p.committeeIds.map((c) => <Badge key={c} tone="ok">{committeeName(db, c)}</Badge>)}
                        </div>
                      </td>
                      <td className="td">
                        <span className={`font-black tabular-nums ${s.rate >= 85 ? 'text-olive-700' : s.rate >= 70 ? 'text-gold-600' : 'text-rose-600'}`}>{s.rate}%</span>
                        <span className="block text-[11px] text-ink-500">غياب {s.absent} · استئذان {s.excused}</span>
                      </td>
                      <td className="td tabular-nums">
                        <span className="font-bold">{p.salary.toLocaleString('en-US')}</span>
                        <span className="block text-[11px] text-olive-700 font-bold">صافي {pay.net.toLocaleString('en-US')}</span>
                      </td>
                      <td className="td">
                        {p.contract?.signedAt
                          ? <Badge tone="ok">موقّع {fmtDate(p.contract.signedAt)}</Badge>
                          : <Badge tone="warn">بانتظار التوقيع</Badge>}
                      </td>
                      <td className="td no-print">
                        <div className="flex gap-1.5">
                          <button className="btn-ghost btn-sm" onClick={() => setContractFor(p)}>العقد</button>
                          {canEdit && <button className="btn-ghost btn-sm" onClick={() => { setEditing(p); setOpen(true) }}>تعديل</button>}
                          {isDirector && <button className="btn-sm px-2 rounded-lg text-rose-600 hover:bg-rose-50" onClick={() => remove(p)}>إيقاف</button>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <PersonModal open={open} onClose={() => { setOpen(false); setEditing(null) }}
        person={editing} mosqueId={isComplex ? (editing?.mosqueId as string ?? db.mosques[0].id) : mid} allowMosquePick={isComplex} />
      <ContractModal person={contractFor} onClose={() => setContractFor(null)} />
    </div>
  )
}

/* ================= نموذج العامل ================= */
function PersonModal({ open, onClose, person, mosqueId, allowMosquePick }: {
  open: boolean; onClose: () => void; person: Person | null; mosqueId: string; allowMosquePick?: boolean
}) {
  const { db, set } = useDb()
  const { isDirector } = useAuth()
  const toast = useToast()
  const [f, setF] = useState<any>({})
  const [key, setKey] = useState('')
  const sig = `${open}-${person?.id ?? 'new'}`
  if (sig !== key) {
    setKey(sig)
    setF(person ? { ...person } : {
      mosqueId, name: '', jobTitle: 'عضو فريق العمل', phone: '', role: 'member',
      committeeIds: [], salary: 3000, username: '', password: '1234',
      financeAccess: false, active: true, hiredAt: todayISO(),
      contract: { title: 'عقد عمل', startDate: todayISO(), salary: 3000, terms: 'العمل ضمن لجنة المسجد وتنفيذ المهام الموكلة، والالتزام بالحضور اليومي.' },
    })
  }

  const committees = committeesOf(db, f.mosqueId ?? mosqueId)
  const toggleCommittee = (cid: string) => setF((s: any) => ({
    ...s, committeeIds: s.committeeIds.includes(cid)
      ? s.committeeIds.filter((x: string) => x !== cid) : [...s.committeeIds, cid],
  }))

  const save = () => {
    if (!f.name?.trim()) return toast('اكتب اسم العامل.', 'bad')
    if (!f.username?.trim()) return toast('حدّد اسم مستخدم للدخول.', 'bad')
    const dup = db.people.find((p) => p.username.toLowerCase() === f.username.trim().toLowerCase() && p.id !== person?.id)
    if (dup) return toast('اسم المستخدم مستخدم مسبقًا.', 'bad')
    set((d) => {
      if (person) {
        const p = d.people.find((x) => x.id === person.id)!
        Object.assign(p, { ...f, salary: Number(f.salary) || 0 })
        if (p.contract) p.contract.salary = Number(f.salary) || 0
      } else {
        d.people.push({ ...f, id: uid('p'), salary: Number(f.salary) || 0 })
      }
      // ربط المشرف بالمسجد
      if (f.role === 'supervisor') {
        const m = d.mosques.find((x) => x.id === f.mosqueId)
        if (m) m.supervisorId = person?.id ?? d.people[d.people.length - 1].id
      }
    })
    toast(person ? 'تم حفظ البيانات' : 'تمت إضافة العامل')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={person ? 'تعديل بيانات عامل' : 'عامل جديد'} wide
      footer={<><button className="btn-primary" onClick={save}>حفظ</button>
        <button className="btn-ghost" onClick={onClose}>إلغاء</button></>}>
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="الاسم الكامل" required>
            <input className="field" value={f.name ?? ''} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus />
          </Field>
          <Field label="المسمى الوظيفي">
            <input className="field" value={f.jobTitle ?? ''} onChange={(e) => setF({ ...f, jobTitle: e.target.value })} />
          </Field>
          {allowMosquePick && (
            <Field label="المسجد" required>
              <Select value={f.mosqueId ?? ''} onChange={(v) => setF({ ...f, mosqueId: v, committeeIds: [] })}
                options={db.mosques.map((m) => ({ value: m.id, label: m.name }))} />
            </Field>
          )}
          <Field label="رقم الجوال">
            <input className="field" value={f.phone ?? ''} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="05xxxxxxxx" />
          </Field>
          <Field label="الصلاحية" required>
            <Select value={f.role ?? 'member'} onChange={(v) => setF({ ...f, role: v })} placeholder=""
              options={[
                { value: 'member', label: 'عضو فريق العمل' },
                { value: 'supervisor', label: 'مشرف المسجد' },
                ...(isDirector ? [{ value: 'director', label: 'مدير المجمع' }] : []),
              ]} />
          </Field>
          <Field label="الراتب الشهري (ر.س)" hint="يُستخدم في احتساب الخصومات">
            <input type="number" className="field" value={f.salary ?? 0} onChange={(e) => setF({ ...f, salary: e.target.value })} />
          </Field>
          <Field label="اسم المستخدم" required>
            <input className="field" value={f.username ?? ''} onChange={(e) => setF({ ...f, username: e.target.value })} dir="ltr" />
          </Field>
          <Field label="كلمة المرور" required>
            <input className="field" value={f.password ?? ''} onChange={(e) => setF({ ...f, password: e.target.value })} dir="ltr" />
          </Field>
        </div>

        <Field label="التسكين في اللجان" hint="يظهر اسمه تلقائيًا في صفحة اللجنة وفي قوائم إسناد المهام">
          <div className="flex flex-wrap gap-2">
            {committees.map((c) => {
              const on = (f.committeeIds ?? []).includes(c.id)
              return (
                <button key={c.id} type="button" onClick={() => toggleCommittee(c.id)}
                  className={`chip transition ${on ? 'bg-olive-600 text-white' : 'bg-slate-100 text-ink-700 hover:bg-slate-200'}`}>
                  {on ? '✓ ' : '＋ '}{c.name}
                </button>
              )
            })}
          </div>
        </Field>

        {isDirector && (
          <label className="flex items-center gap-3 rounded-xl bg-violet-50 border border-violet-200 px-4 py-3 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 accent-violet-600" checked={!!f.financeAccess}
              onChange={(e) => setF({ ...f, financeAccess: e.target.checked })} />
            <span className="text-[13px] font-bold text-violet-800">
              تفويض بالوصول للإدارة المالية
              <span className="block text-[11px] font-normal text-violet-600">ستظهر له صفحة المالية في قائمته</span>
            </span>
          </label>
        )}

        <Field label="بنود العقد" hint="تظهر في صفحة العقد ليوقّع عليها العامل">
          <textarea className="field leading-7" rows={4} value={f.contract?.terms ?? ''}
            onChange={(e) => setF({ ...f, contract: { ...(f.contract ?? {}), terms: e.target.value } })} />
        </Field>
      </div>
    </Modal>
  )
}

/* ================= العقد والتوقيع ================= */
function ContractModal({ person, onClose }: { person: Person | null; onClose: () => void }) {
  const { db, set } = useDb()
  const { user, isDirector } = useAuth()
  const toast = useToast()
  if (!person) return null

  const c = person.contract
  const mine = user?.id === person.id
  const pay = payrollFor(db, person, todayISO())

  const sign = (dataUrl: string) => {
    set((d) => {
      const p = d.people.find((x) => x.id === person.id)!
      p.contract = { ...(p.contract as any), signature: dataUrl, signedAt: todayISO(), acknowledged: true }
    })
    toast('تم اعتماد التوقيع وحفظه في سجلك ✅')
    onClose()
  }

  return (
    <Modal open onClose={onClose} title="عقد العمل" wide>
      <div id="print-area">
        <div className="border border-slate-200 rounded-2xl p-6">
          <header className="text-center border-b border-slate-200 pb-4">
            <h2 className="font-display font-black text-xl text-brand-800">مجمع رياض القرآن</h2>
            <p className="text-[12px] text-ink-500 mt-1">{db.settings.complexSubtitle}</p>
            <h3 className="mt-3 font-extrabold text-lg">{c?.title ?? 'عقد عمل'}</h3>
          </header>

          <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-3 mt-5 text-[13px]">
            {[
              ['الاسم', person.name],
              ['المسمى الوظيفي', person.jobTitle],
              ['المسجد', mosqueName(db, person.mosqueId)],
              ['تاريخ المباشرة', fmtDate(c?.startDate ?? person.hiredAt)],
              ['الراتب الشهري', `${person.salary.toLocaleString('en-US')} ريال`],
              ['قيمة اليوم الواحد', `${pay.dayValue.toLocaleString('en-US')} ريال`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-dashed border-slate-200 pb-1.5">
                <dt className="text-ink-500 font-bold">{k}</dt><dd className="font-extrabold">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-5">
            <h4 className="font-extrabold text-[14px] mb-2">بنود العقد</h4>
            <p className="text-[13px] leading-8 text-ink-700 whitespace-pre-wrap">{c?.terms}</p>
            <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200 p-4 text-[12.5px] leading-7 text-ink-700">
              <b>الانضباط والخصومات:</b> يرتبط هذا العقد بسجل الحضور في المنصة؛ يُخصم
              <b> يوم كامل </b> عن كل يوم غياب، و<b> نصف يوم </b> عن كل استئذان معتمد من مدير المجمع،
              وتُحتسب قيمة اليوم على أساس {db.settings.workDaysPerMonth} يوم عمل في الشهر.
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-6 mt-7">
            <div>
              <p className="text-[12px] font-bold text-ink-500 mb-2">توقيع الطرف الأول (إدارة المجمع)</p>
              <div className="h-24 border-b-2 border-slate-300 grid place-items-center text-brand-800 font-display font-black text-lg">
                مجمع رياض القرآن
              </div>
            </div>
            <div>
              <p className="text-[12px] font-bold text-ink-500 mb-2">توقيع الطرف الثاني ({person.name})</p>
              {c?.signature ? (
                <div className="h-24 border-b-2 border-slate-300 grid place-items-center">
                  <img src={c.signature} alt="التوقيع" className="max-h-[86px]" />
                </div>
              ) : (
                <div className="h-24 border-b-2 border-dashed border-slate-300 grid place-items-center text-ink-300 text-[12px] font-bold">
                  لم يُوقَّع بعد
                </div>
              )}
              {c?.signedAt && <p className="text-[11px] text-olive-700 font-bold mt-1.5">✔ تم التوقيع بتاريخ {fmtDate(c.signedAt)}</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 no-print">
        <PrintBar title="عقد العمل" />
        {!c?.signature && (mine || isDirector) && (
          <div className="mt-4">
            <p className="label">
              {mine ? 'أقر بالاطلاع على بنود العقد وأوقّع عليه:' : 'توقيع العامل على الشاشة:'}
            </p>
            <SignaturePad onSave={sign} />
          </div>
        )}
        {c?.signature && isDirector && (
          <button className="btn-ghost btn-sm mt-3" onClick={() => {
            if (!confirm('إلغاء التوقيع الحالي؟')) return
            set((d) => { const p = d.people.find((x) => x.id === person.id)!; if (p.contract) { p.contract.signature = undefined; p.contract.signedAt = undefined } })
            toast('تم إلغاء التوقيع', 'info')
          }}>إلغاء التوقيع</button>
        )}
      </div>
    </Modal>
  )
}
