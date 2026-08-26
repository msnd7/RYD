import logoSrc from '../assets/logo.png'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useDb, uid } from '../store/db'
import { useAuth, normEmail } from '../store/auth'
import { Card, Modal, Field, Select, Badge, Empty, useToast, StatStrip, PrintBar, Menu } from '../components/ui'
import { PageHeader } from '../components/PageHeader'
import { SignaturePad } from '../components/SignaturePad'
import { todayISO, shiftDays, fmtDate } from '../lib/date'
import { staffOf, committeesOf, attendanceStats, payrollFor, mosqueName, committeeName } from '../lib/selectors'
import { money } from '../lib/format'
import type { Person, Role } from '../types'

const ROLE_LABEL: Record<Role, string> = {
  director: 'مدير المجمع', supervisor: 'مشرف المسجد', member: 'عضو فريق العمل',
}

export default function Staff({ scope }: { scope?: 'complex' }) {
  const { mid = '' } = useParams()
  const { db, set } = useDb()
  const { user, isDirector, resetPassword: doReset } = useAuth()
  const toast = useToast()
  const isComplex = scope === 'complex'

  const [editing, setEditing] = useState<Person | null>(null)
  const [open, setOpen] = useState(false)
  const [contractFor, setContractFor] = useState<Person | null>(null)
  const [credentials, setCredentials] = useState<{ name: string; email: string; password: string } | null>(null)
  const [fMosque, setFMosque] = useState('')
  const [q, setQ] = useState('')

  let list = isComplex
    ? db.people.filter((p) => p.mosqueId !== 'complex' && p.active)
    : staffOf(db, mid)
  if (fMosque) list = list.filter((p) => p.mosqueId === fMosque)
  if (q.trim()) list = list.filter((p) => (p.name + p.jobTitle + p.phone + p.email).includes(q.trim()))

  const canAdd = isDirector || (user?.role === 'supervisor' && !isComplex && user.mosqueId === mid)
  const canEditRow = (p: Person) =>
    isDirector || (user?.role === 'supervisor' && user.mosqueId === p.mosqueId && p.role === 'member')

  const stop = (p: Person) => {
    if (!confirm(`إيقاف ${p.name}؟ لن يستطيع الدخول وتبقى سجلاته محفوظة.`)) return
    set((d) => { const x = d.people.find((y) => y.id === p.id); if (x) x.active = false })
    toast('تم إيقاف الحساب')
  }

  const resetPassword = async (p: Person) => {
    if (!confirm(`إعادة تعيين رمز ${p.name} إلى الرمز المبدئي (${db.settings.defaultPassword})؟`)) return
    const r = await doReset(p.id)
    if (!r.ok) return toast(r.error ?? 'تعذّرت إعادة التعيين', 'bad')
    setCredentials({ name: p.name, email: p.email, password: db.settings.defaultPassword })
    toast('تمت إعادة تعيين الرمز')
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={isComplex ? 'الإدارة العامة' : mosqueName(db, mid)}
        title="الإداريون"
        description={isComplex
          ? 'أضف مشرف كل مسجد ببريده الإلكتروني، ثم يتولّى كل مشرف إضافة إداريي مسجده. لكل إداري حساب يدخل به ويحضّر نفسه.'
          : 'أضف إداريي المسجد وسكّنهم في اللجان. لكل إداري حساب يدخل به ويحضّر نفسه داخل نطاق المسجد.'}
        actions={
          <>
            {isComplex && (
              <Select value={fMosque} onChange={setFMosque} placeholder="كل المساجد"
                options={db.mosques.map((m) => ({ value: m.id, label: m.shortName }))} />
            )}
            {canAdd && (
              <button className="btn-primary btn-sm" onClick={() => { setEditing(null); setOpen(true) }}>
                ＋ {isComplex ? 'إضافة مشرف أو إداري' : 'إضافة إداري'}
              </button>
            )}
          </>
        }
      />

      <StatStrip items={[
        { label: 'عدد الإداريين', value: list.length },
        { label: 'مشرفو المساجد', value: list.filter((p) => p.role === 'supervisor').length },
        { label: 'عقود موقّعة', value: list.filter((p) => p.contract?.signedAt).length, hint: `من ${list.length}` },
        { label: 'لم يغيّروا الرمز', value: list.filter((p) => p.mustChangePassword).length,
          accent: list.some((p) => p.mustChangePassword) },
      ]} />

      <Card pad={false}>
        {list.length > 0 && (
          <div className="px-4 sm:px-5 py-3 no-print">
            <input className="field" placeholder="بحث بالاسم أو البريد أو الوظيفة…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        )}

        {list.length === 0 ? (
          <Empty
            icon="👥"
            title={isComplex ? 'لم يُضف أي مشرف بعد' : 'لا يوجد أعضاء في هذا المسجد'}
            hint={isComplex
              ? 'ابدأ بإضافة مشرف لكل مسجد ببريده الإلكتروني، وسيُسلَّم رمزًا مبدئيًا يغيّره عند أول دخول.'
              : 'أضف أعضاء فريق العمل ببياناتهم وبريدهم الإلكتروني.'}
            action={canAdd && <button className="btn-primary btn-sm" onClick={() => setOpen(true)}>＋ إضافة</button>}
          />
        ) : (
          <>
            {/* جدول لسطح المكتب */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-navy-50">
                  <tr>
                    <th className="th">العامل</th>
                    {isComplex && <th className="th">المسجد</th>}
                    <th className="th">الصلاحية</th>
                    <th className="th">اللجان</th>
                    <th className="th">الحضور (٣٠ يومًا)</th>
                    <th className="th">الراتب / الصافي</th>
                    <th className="th">الحساب</th>
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
                            <span className="w-9 h-9 rounded-xl bg-navy-700 text-white grid place-items-center font-extrabold text-[13px] shrink-0">
                              {p.name.trim()[0]}
                            </span>
                            <span className="min-w-0">
                              <span className="block font-bold truncate">{p.name}</span>
                              <span className="block text-[11px] text-ink-500 truncate" dir="ltr">{p.email}</span>
                            </span>
                          </div>
                        </td>
                        {isComplex && <td className="td text-[12px] text-ink-500">{mosqueName(db, p.mosqueId)}</td>}
                        <td className="td">
                          <div className="text-[12.5px] font-bold">{p.jobTitle}</div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            <Badge tone={p.role === 'supervisor' ? 'info' : 'mute'}>{ROLE_LABEL[p.role]}</Badge>
                            {p.financeAccess && <Badge tone="purple">تفويض مالي</Badge>}
                          </div>
                        </td>
                        <td className="td">
                          <div className="flex flex-wrap gap-1 max-w-[180px]">
                            {p.committeeIds.length === 0 && <span className="text-ink-300 text-[12px]">—</span>}
                            {p.committeeIds.map((c) => <Badge key={c} tone="ok">{committeeName(db, c)}</Badge>)}
                          </div>
                        </td>
                        <td className="td">
                          <span className="font-black tabular-nums">{s.total ? `${s.rate}%` : '—'}</span>
                          <span className="block text-[11px] text-ink-500">غياب {s.absent} · استئذان {s.excused}</span>
                        </td>
                        <td className="td tabular-nums">
                          <span className="font-bold">{p.salary ? money(p.salary) : '—'}</span>
                          {p.salary > 0 && <span className="block text-[11px] text-navy-700 font-bold">صافي {money(pay.net)}</span>}
                        </td>
                        <td className="td">
                          {p.mustChangePassword
                            ? <Badge tone="warn">رمز مبدئي</Badge>
                            : <Badge tone="ok">مفعّل</Badge>}
                        </td>
                        <td className="td no-print">
                          <Menu items={[
                            { label: 'عرض العقد', icon: '📄', onClick: () => setContractFor(p) },
                            ...(canEditRow(p) ? [{ label: 'تعديل البيانات', icon: '✎', onClick: () => { setEditing(p); setOpen(true) } }] : []),
                            ...(isDirector ? [
                              { label: 'إعادة تعيين الرمز', icon: '🔑', onClick: () => { void resetPassword(p) } },
                              'sep' as const,
                              { label: 'إيقاف الحساب', icon: '⏻', danger: true, onClick: () => stop(p) },
                            ] : []),
                          ]} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* بطاقات للجوال */}
            <ul className="lg:hidden divide-y divide-line">
              {list.map((p) => {
                const s = attendanceStats(db, p.id, shiftDays(todayISO(), -29), todayISO())
                return (
                  <li key={p.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <span className="w-11 h-11 rounded-xl bg-navy-700 text-white grid place-items-center font-extrabold shrink-0">
                        {p.name.trim()[0]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-extrabold text-[14px] truncate">{p.name}</p>
                        <p className="text-[11.5px] text-ink-500 truncate" dir="ltr">{p.email}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          <Badge tone={p.role === 'supervisor' ? 'info' : 'mute'}>{ROLE_LABEL[p.role]}</Badge>
                          {isComplex && <Badge tone="mute">{mosqueName(db, p.mosqueId)}</Badge>}
                          {p.mustChangePassword && <Badge tone="warn">رمز مبدئي</Badge>}
                          {p.committeeIds.map((c) => <Badge key={c} tone="ok">{committeeName(db, c)}</Badge>)}
                        </div>
                        <p className="text-[11.5px] text-ink-500 mt-2">
                          الحضور: <b className="text-ink-900">{s.total ? `${s.rate}%` : '—'}</b>
                          {p.salary > 0 && <> · الراتب: <b className="text-ink-900">{money(p.salary)}</b></>}
                        </p>
                      </div>
                      <Menu items={[
                        { label: 'عرض العقد', icon: '📄', onClick: () => setContractFor(p) },
                        ...(canEditRow(p) ? [{ label: 'تعديل البيانات', icon: '✎', onClick: () => { setEditing(p); setOpen(true) } }] : []),
                        ...(isDirector ? [
                          { label: 'إعادة تعيين الرمز', icon: '🔑', onClick: () => { void resetPassword(p) } },
                          'sep' as const,
                          { label: 'إيقاف الحساب', icon: '⏻', danger: true, onClick: () => stop(p) },
                        ] : []),
                      ]} />
                    </div>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </Card>

      <PersonModal
        open={open} onClose={() => { setOpen(false); setEditing(null) }}
        person={editing}
        mosqueId={isComplex ? (editing?.mosqueId as string ?? '') : mid}
        allowMosquePick={isComplex}
        allowRolePick={isDirector}
        onCreated={setCredentials}
      />
      <ContractModal person={contractFor} onClose={() => setContractFor(null)} />
      <CredentialsModal data={credentials} onClose={() => setCredentials(null)} />
    </div>
  )
}

/* ================= بطاقة بيانات الدخول ================= */
function CredentialsModal({ data, onClose }: {
  data: { name: string; email: string; password: string } | null; onClose: () => void
}) {
  const toast = useToast()
  if (!data) return null
  const text = `بيانات الدخول لمنصة رياض القرآن\nالاسم: ${data.name}\nالبريد: ${data.email}\nالرمز المبدئي: ${data.password}\n(يُطلب منك تغيير الرمز عند أول دخول)`
  return (
    <Modal open onClose={onClose} title="بيانات الدخول"
      footer={<>
        <button className="btn-primary" onClick={async () => {
          try { await navigator.clipboard.writeText(text); toast('تم نسخ البيانات') }
          catch { toast('تعذّر النسخ', 'bad') }
        }}>نسخ البيانات</button>
        <button className="btn-ghost" onClick={onClose}>تم</button>
      </>}>
      <div className="space-y-4">
        <p className="muted">سلّم هذه البيانات لصاحب الحساب. سيُطلب منه تغيير الرمز عند أول دخول.</p>
        <div className="rounded-2xl bg-navy-50 border border-navy-100 p-4 space-y-3">
          {[['الاسم', data.name], ['البريد الإلكتروني', data.email], ['الرمز المبدئي', data.password]].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-3">
              <span className="text-[12px] font-bold text-ink-500">{k}</span>
              <span className="font-extrabold text-[14px] tabular-nums" dir={k === 'الاسم' ? 'rtl' : 'ltr'}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  )
}

/* ================= نموذج العامل ================= */
function PersonModal({ open, onClose, person, mosqueId, allowMosquePick, allowRolePick, onCreated }: {
  open: boolean; onClose: () => void; person: Person | null
  mosqueId: string; allowMosquePick?: boolean; allowRolePick?: boolean
  onCreated: (c: { name: string; email: string; password: string }) => void
}) {
  const { db, set } = useDb()
  const { isDirector, user } = useAuth()
  const toast = useToast()
  const [f, setF] = useState<any>({})
  const [key, setKey] = useState('')

  const sig = `${open}-${person?.id ?? 'new'}`
  if (sig !== key) {
    setKey(sig)
    setF(person ? { ...person } : {
      mosqueId: mosqueId || db.mosques[0].id,
      name: '', jobTitle: allowRolePick && allowMosquePick ? 'مشرف المسجد' : 'عضو فريق العمل',
      phone: '', email: '',
      role: allowRolePick && allowMosquePick ? 'supervisor' : 'member',
      committeeIds: [], salary: 0,
      financeAccess: false, active: true, hiredAt: todayISO(),
      contract: {
        title: 'عقد عمل', startDate: todayISO(), salary: 0,
        terms: 'العمل ضمن فريق المسجد وتنفيذ المهام الموكلة، والالتزام بالحضور اليومي داخل النطاق المكاني للمسجد.',
      },
    })
  }

  const committees = committeesOf(db, f.mosqueId ?? mosqueId)
  const toggleCommittee = (cid: string) => setF((s: any) => ({
    ...s, committeeIds: s.committeeIds.includes(cid)
      ? s.committeeIds.filter((x: string) => x !== cid) : [...s.committeeIds, cid],
  }))

  const save = () => {
    if (!f.name?.trim()) return toast('اكتب اسم العامل.', 'bad')
    const email = normEmail(f.email ?? '')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return toast('اكتب بريدًا إلكترونيًا صحيحًا.', 'bad')
    if (db.people.some((p) => normEmail(p.email) === email && p.id !== person?.id)) {
      return toast('هذا البريد مستخدم في حساب آخر.', 'bad')
    }
    if (!f.mosqueId) return toast('اختر المسجد.', 'bad')

    const salary = Number(f.salary) || 0
    if (person) {
      set((d) => {
        const p = d.people.find((x) => x.id === person.id)!
        Object.assign(p, { ...f, email, salary })
        if (p.contract) p.contract.salary = salary
        if (p.role === 'supervisor') {
          const m = d.mosques.find((x) => x.id === p.mosqueId)
          if (m) m.supervisorId = p.id
        }
      })
      toast('تم حفظ البيانات')
    } else {
      const id = uid('p')
      const pw = db.settings.defaultPassword
      set((d) => {
        d.people.push({
          ...f, id, email, salary,
          password: pw, mustChangePassword: true,
          createdBy: user?.id, active: true,
          contract: { ...(f.contract ?? {}), salary },
        })
        if (f.role === 'supervisor') {
          const m = d.mosques.find((x) => x.id === f.mosqueId)
          if (m) m.supervisorId = id
        }
      })
      onCreated({ name: f.name.trim(), email, password: pw })
    }
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={person ? 'تعديل بيانات' : 'إضافة عامل جديد'} wide
      footer={<>
        <button className="btn-primary" onClick={save}>{person ? 'حفظ' : 'إضافة وإنشاء الحساب'}</button>
        <button className="btn-ghost" onClick={onClose}>إلغاء</button>
      </>}>
      <div className="space-y-5">
        <section>
          <h4 className="text-[12px] font-black text-ink-500 mb-3">البيانات الأساسية</h4>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="الاسم الكامل" required>
              <input className="field" value={f.name ?? ''} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus />
            </Field>
            <Field label="البريد الإلكتروني" required hint="يُستخدم للدخول إلى المنصة">
              <input className="field text-left" dir="ltr" type="email" inputMode="email"
                value={f.email ?? ''} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="name@example.com" />
            </Field>
            <Field label="رقم الجوال">
              <input className="field text-left" dir="ltr" inputMode="tel"
                value={f.phone ?? ''} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="05xxxxxxxx" />
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
            {allowRolePick ? (
              <Field label="الصلاحية" required>
                <Select value={f.role ?? 'member'} onChange={(v) => setF({ ...f, role: v })} placeholder=""
                  options={[
                    { value: 'supervisor', label: 'مشرف المسجد' },
                    { value: 'member', label: 'عضو فريق العمل' },
                  ]} />
              </Field>
            ) : (
              <Field label="الصلاحية"><input className="field bg-navy-50" value="عضو فريق العمل" disabled /></Field>
            )}
            <Field label="الراتب الشهري (ر.س)" hint="أساس احتساب الخصومات — اتركه صفرًا للمتطوعين">
              <input type="number" inputMode="numeric" className="field" value={f.salary ?? 0}
                onChange={(e) => setF({ ...f, salary: e.target.value })} />
            </Field>
          </div>
        </section>

        <section>
          <h4 className="text-[12px] font-black text-ink-500 mb-3">التسكين في اللجان</h4>
          <div className="flex flex-wrap gap-2">
            {committees.length === 0 && <span className="text-[12px] text-ink-300">لا توجد لجان في هذا المسجد.</span>}
            {committees.map((c) => {
              const on = (f.committeeIds ?? []).includes(c.id)
              return (
                <button key={c.id} type="button" onClick={() => toggleCommittee(c.id)}
                  className={`chip transition ${on ? 'bg-navy-700 text-white' : 'bg-navy-50 text-ink-700 hover:bg-navy-100'}`}>
                  {on ? '✓ ' : '＋ '}{c.name}
                </button>
              )
            })}
          </div>
          <p className="muted mt-2">يظهر اسمه تلقائيًا في صفحة اللجنة وفي قوائم إسناد المهام.</p>
        </section>

        {isDirector && (
          <label className="flex items-start gap-3 rounded-xl bg-navy-50 border border-navy-100 px-4 py-3 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 mt-0.5 accent-orange-500" checked={!!f.financeAccess}
              onChange={(e) => setF({ ...f, financeAccess: e.target.checked })} />
            <span className="text-[13px] font-bold text-navy-900">
              تفويض بالوصول للإدارة المالية
              <span className="block text-[11.5px] font-normal text-ink-500 mt-0.5">ستظهر له صفحة المالية في قائمته</span>
            </span>
          </label>
        )}

        <Field label="بنود العقد" hint="تظهر في صفحة العقد ليوقّع عليها">
          <textarea className="field leading-7" rows={4} value={f.contract?.terms ?? ''}
            onChange={(e) => setF({ ...f, contract: { ...(f.contract ?? {}), terms: e.target.value } })} />
        </Field>

        {!person && (
          <div className="rounded-xl bg-orange-50 border border-orange-200 px-4 py-3 text-[12.5px] font-bold text-orange-800 leading-6">
            سيُنشأ الحساب برمز مبدئي <b className="tabular-nums">{db.settings.defaultPassword}</b>،
            ويُطلب منه تغييره عند أول دخول.
          </div>
        )}
      </div>
    </Modal>
  )
}

/* ================= العقد والتوقيع ================= */
function ContractModal({ person, onClose }: { person: Person | null; onClose: () => void }) {
  const { db, set } = useDb()
  const { user, isDirector, resetPassword: doReset } = useAuth()
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
    toast('تم اعتماد التوقيع وحفظه في السجل')
    onClose()
  }

  return (
    <Modal open onClose={onClose} title="عقد العمل" wide>
      <div id="print-area">
        <div className="border border-line rounded-2xl p-5 sm:p-6">
          <header className="text-center border-b border-line pb-4">
            <img src={logoSrc} alt="" style={{ height: 54 }} className="w-auto object-contain mx-auto" />
            <h2 className="font-display font-black text-[19px] text-navy-800 mt-2">{db.settings.complexName}</h2>
            <p className="text-[11.5px] text-ink-500 mt-1">{db.settings.complexSubtitle}</p>
            <h3 className="mt-3 font-extrabold text-[16px]">{c?.title ?? 'عقد عمل'}</h3>
          </header>

          <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-3 mt-5 text-[13px]">
            {[
              ['الاسم', person.name],
              ['البريد الإلكتروني', person.email],
              ['المسمى الوظيفي', person.jobTitle],
              ['المسجد', mosqueName(db, person.mosqueId)],
              ['تاريخ المباشرة', fmtDate(c?.startDate ?? person.hiredAt)],
              ['الراتب الشهري', person.salary ? money(person.salary) : 'تطوّع'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-dashed border-line pb-1.5">
                <dt className="text-ink-500 font-bold shrink-0">{k}</dt>
                <dd className="font-extrabold text-left truncate" dir={k === 'البريد الإلكتروني' ? 'ltr' : 'rtl'}>{v}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-5">
            <h4 className="font-extrabold text-[14px] mb-2">بنود العقد</h4>
            <p className="text-[13px] leading-8 text-ink-700 whitespace-pre-wrap">{c?.terms}</p>
            {person.salary > 0 && (
              <div className="mt-3 rounded-xl bg-navy-50 border border-navy-100 p-4 text-[12.5px] leading-7 text-ink-700">
                <b>الانضباط والخصومات:</b> يرتبط هذا العقد بسجل الحضور في المنصة؛ يُخصم
                <b> يوم كامل </b> عن كل يوم غياب، و<b> نصف يوم </b> عن كل استئذان معتمد من مدير المجمع،
                وتُحتسب قيمة اليوم ({money(pay.dayValue)}) على أساس {db.settings.workDaysPerMonth} يوم عمل شهريًا.
              </div>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-6 mt-8">
            <div>
              <p className="text-[11.5px] font-bold text-ink-500 mb-2">الطرف الأول — إدارة المجمع</p>
              <div className="h-20 border-b-2 border-line grid place-items-center text-navy-800 font-display font-black">
                {db.settings.complexName}
              </div>
            </div>
            <div>
              <p className="text-[11.5px] font-bold text-ink-500 mb-2">الطرف الثاني — {person.name}</p>
              {c?.signature ? (
                <div className="h-20 border-b-2 border-line grid place-items-center">
                  <img src={c.signature} alt="التوقيع" className="max-h-[74px]" />
                </div>
              ) : (
                <div className="h-20 border-b-2 border-dashed border-line grid place-items-center text-ink-300 text-[12px] font-bold">
                  لم يُوقَّع بعد
                </div>
              )}
              {c?.signedAt && <p className="text-[11px] text-navy-700 font-bold mt-1.5">✔ وُقّع بتاريخ {fmtDate(c.signedAt)}</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 no-print">
        <PrintBar title="عقد العمل" />
        {!c?.signature && (mine || isDirector) && (
          <div className="mt-4">
            <p className="label">{mine ? 'أقر بالاطلاع على بنود العقد وأوقّع عليه:' : 'توقيع العامل على الشاشة:'}</p>
            <SignaturePad onSave={sign} />
          </div>
        )}
        {c?.signature && isDirector && (
          <button className="btn-ghost btn-sm mt-3" onClick={() => {
            if (!confirm('إلغاء التوقيع الحالي؟')) return
            set((d) => {
              const p = d.people.find((x) => x.id === person.id)!
              if (p.contract) { p.contract.signature = undefined; p.contract.signedAt = undefined }
            })
            toast('تم إلغاء التوقيع')
          }}>إلغاء التوقيع</button>
        )}
      </div>
    </Modal>
  )
}
