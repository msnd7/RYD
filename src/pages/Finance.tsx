import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useDb, uid } from '../store/db'
import { useAuth } from '../store/auth'
import {
  Card, Modal, Field, Select, Badge, Empty, useToast, Stat, Tabs,
  FileDrop, FileChips, Progress, PrintBar, Menu, StatStrip,
} from '../components/ui'
import { ReportHeader, ReportFooter } from '../components/ReportShell'
import { PageHeader } from '../components/PageHeader'
import { CustodyRequestModal } from '../components/CustodyRequestModal'
import { SplitBar, C } from '../components/charts'
import { todayISO, fmtDate, daysBetween } from '../lib/date'
import { fileSrc } from '../lib/files'
import {
  staffOf, committeesOf, personName, committeeName, mosqueName,
  custodyBalance, payrollFor, teachersOf, teacherPayroll,
} from '../lib/selectors'
import type { Custody, UploadedFile } from '../types'

const money = (n: number) => `${Math.round(n).toLocaleString('en-US')} ر.س`

const CST: Record<string, { label: string; tone: string }> = {
  requested: { label: 'بانتظار الاعتماد', tone: 'warn' },
  approved: { label: 'عهدة مفتوحة', tone: 'info' },
  closed: { label: 'مقفلة', tone: 'ok' },
  rejected: { label: 'مرفوضة', tone: 'bad' },
}

export default function Finance({ scope }: { scope?: 'complex' }) {
  const { mid = '' } = useParams()
  const { db } = useDb()
  const { canFinance, user } = useAuth()
  const isComplex = scope === 'complex'
  const [tab, setTab] = useState<'custody' | 'payroll' | 'report'>('custody')
  const [fMosque, setFMosque] = useState('')

  if (!canFinance) {
    return (
      <Card>
        <Empty icon="🔒" title="الإدارة المالية مقصورة على المدير ومن يفوّضه"
          hint="يمكن لمدير المجمع منحك الصلاحية من صفحة فريق العمل بتفعيل «تفويض بالوصول للإدارة المالية»." />
      </Card>
    )
  }

  const mosqueId = isComplex ? fMosque : mid

  return (
    <div>
      <PageHeader
        eyebrow={isComplex ? 'الإدارة العامة' : mosqueName(db, mid)}
        title="الإدارة المالية"
        description="طلبات صرف العهد واعتمادها، وتسجيل المصروفات بفواتيرها، وإقفال العهد وإعادة المتبقي، ورواتب الإداريين والمعلمين بعد خصومات الحضور."
      />
      <Tabs value={tab} onChange={(v) => setTab(v as any)} items={[
        { value: 'custody', label: 'العهد والمصروفات' },
        { value: 'payroll', label: 'الرواتب والخصومات' },
        { value: 'report', label: 'التقرير المالي' },
      ]} />
      <div className="mt-4">
      {tab === 'custody' && <Custodies mosqueId={mosqueId} isComplex={isComplex}
        filter={isComplex ? <Select value={fMosque} onChange={setFMosque} placeholder="كل المساجد"
          options={db.mosques.map((m) => ({ value: m.id, label: m.name }))} /> : null} />}
      {tab === 'payroll' && <Payroll mosqueId={mosqueId} isComplex={isComplex} />}
      {tab === 'report' && <FinanceReport mosqueId={mosqueId} isComplex={isComplex} />}
      </div>
    </div>
  )
}

/* ================= العهد ================= */
function Custodies({ mosqueId, isComplex, filter }: {
  mosqueId: string; isComplex: boolean; filter: React.ReactNode
}) {
  const { db, set } = useDb()
  const { user, isDirector } = useAuth()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [expenseFor, setExpenseFor] = useState<Custody | null>(null)
  const [closeFor, setCloseFor] = useState<Custody | null>(null)

  const list = useMemo(() => {
    let rows = mosqueId ? db.custodies.filter((c) => c.mosqueId === mosqueId) : db.custodies
    return [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [db.custodies, mosqueId])

  const totals = list.reduce((acc, c) => {
    const b = custodyBalance(c)
    if (c.status === 'approved' || c.status === 'closed') {
      acc.granted += c.amount; acc.spent += b.spent; acc.returned += c.returned ?? 0
    }
    if (c.status === 'approved') acc.open += b.remaining
    return acc
  }, { granted: 0, spent: 0, returned: 0, open: 0 })

  const decide = (c: Custody, status: 'approved' | 'rejected') => {
    set((d) => {
      const x = d.custodies.find((y) => y.id === c.id)!
      x.status = status
      x.approvedAt = status === 'approved' ? todayISO() : undefined
    })
    toast(status === 'approved' ? 'تم اعتماد العهدة وصرفها' : 'تم رفض الطلب', status === 'approved' ? 'ok' : 'info')
  }

  return (
    <div className="space-y-5">
      <StatStrip items={[
        { label: 'إجمالي العهد المصروفة', value: money(totals.granted) },
        { label: 'المنصرف بفواتير', value: money(totals.spent) },
        { label: 'مبالغ مُعادة', value: money(totals.returned) },
        { label: 'مفتوحة تحت التسوية', value: money(totals.open),
          hint: `${list.filter((c) => c.status === 'approved').length} عهدة`, accent: totals.open > 0 },
      ]} />

      <Card title="العهد والمصروفات"
        subtitle="يطلب المشرف أو اللجنة صرف عهدة، ويعتمدها المدير، ثم تُسجَّل مصروفاتها بفواتيرها وتُقفل ويُعاد المتبقي"
        action={<>{filter}
          <button className="btn-primary btn-sm" onClick={() => setOpen(true)}>＋ طلب صرف عهدة</button></>}
        pad={false}>
        {list.length === 0 ? <Empty icon="💳" title="لا توجد عهد" /> : (
          <ul className="divide-y divide-line">
            {list.map((c) => {
              const b = custodyBalance(c)
              const overdue = c.status === 'approved' && c.closeDate < todayISO()
              const pct = c.amount ? (b.spent / c.amount) * 100 : 0
              return (
                <li key={c.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-extrabold text-[14.5px]">{c.purpose}</h4>
                        <Badge tone={CST[c.status].tone}>{CST[c.status].label}</Badge>
                        {overdue && <Badge tone="bad" dot>تجاوزت تاريخ الإقفال</Badge>}
                      </div>
                      <p className="text-[11.5px] text-ink-500 mt-1.5 font-bold">
                        👤 مقدّم الطلب: {personName(db, c.requesterId)}
                        {c.committeeId && ` · 🏷️ ${committeeName(db, c.committeeId)}`}
                        {isComplex && ` · 🕌 ${mosqueName(db, c.mosqueId)}`}
                        {' · 📅 الإقفال: '}{fmtDate(c.closeDate)}
                        {c.responsibleId && ` · 🔑 المسؤول عن الإقفال: ${personName(db, c.responsibleId)}`}
                      </p>

                      {(c.status === 'approved' || c.status === 'closed') && (
                        <div className="mt-3 max-w-lg">
                          <div className="flex justify-between text-[11.5px] font-bold mb-1">
                            <span>المنصرف {money(b.spent)} من {money(c.amount)}</span>
                            <span className={b.remaining > 0 ? 'text-orange-600' : 'text-navy-800'}>
                              المتبقي {money(b.remaining)}
                            </span>
                          </div>
                          <Progress value={pct} tone={pct >= 100 ? 'olive' : 'gold'} />
                        </div>
                      )}

                      {c.expenses.length > 0 && (
                        <ul className="mt-3 space-y-1.5">
                          {c.expenses.map((e) => (
                            <li key={e.id} className="flex flex-wrap items-center gap-2 text-[12px] bg-navy-50 rounded-xl px-3 py-2">
                              <span className="font-bold">{e.description}</span>
                              <span className="tabular-nums font-black text-navy-700">{money(e.amount)}</span>
                              <span className="text-ink-500">{fmtDate(e.date)}</span>
                              {e.invoice
                                ? <a href={fileSrc(e.invoice)} download={e.invoice.name} target="_blank" rel="noreferrer"
                                    className="chip bg-navy-100 text-navy-800">🧾 الفاتورة</a>
                                : <span className="chip bg-orange-100 text-orange-700">بدون فاتورة</span>}
                            </li>
                          ))}
                        </ul>
                      )}

                      {c.status === 'closed' && (
                        <p className="text-[12px] text-navy-800 font-bold mt-2">
                          ✔ أُقفلت بتاريخ {fmtDate(c.closedAt)} — أُعيد مبلغ {money(c.returned ?? 0)}
                        </p>
                      )}
                      {c.note && <p className="text-[12px] text-ink-500 mt-1.5">ملاحظة: {c.note}</p>}
                    </div>

                    <div className="text-left shrink-0">
                      <div className="text-2xl font-display font-black tabular-nums text-navy-800">{c.amount.toLocaleString('en-US')}</div>
                      <div className="text-[10px] font-bold text-ink-500">ريال سعودي</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-3 no-print">
                    {c.status === 'requested' && isDirector && <>
                      <button className="btn-primary btn-sm" onClick={() => decide(c, 'approved')}>اعتماد وصرف</button>
                      <button className="btn-ghost btn-sm" onClick={() => decide(c, 'rejected')}>رفض الطلب</button>
                    </>}
                    {c.status === 'approved' && <>
                      <button className="btn-primary btn-sm" onClick={() => setExpenseFor(c)}>＋ تسجيل مصروف بفاتورة</button>
                      <button className="btn-accent btn-sm" onClick={() => setCloseFor(c)}>إقفال العهدة</button>
                    </>}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <CustodyRequestModal open={open} onClose={() => setOpen(false)}
        mosqueId={mosqueId || db.mosques[0].id} allowMosquePick={isComplex} />
      {expenseFor && <ExpenseModal custody={expenseFor} onClose={() => setExpenseFor(null)} />}
      {closeFor && <CloseModal custody={closeFor} onClose={() => setCloseFor(null)} />}
    </div>
  )
}

function ExpenseModal({ custody, onClose }: { custody: Custody; onClose: () => void }) {
  const { set } = useDb()
  const toast = useToast()
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(todayISO())
  const [invoice, setInvoice] = useState<UploadedFile | undefined>()

  const b = custodyBalance(custody)

  const save = () => {
    const amt = Number(amount)
    if (!amt) return toast('حدّد مبلغ المصروف.', 'bad')
    if (!description.trim()) return toast('اكتب بيان المصروف.', 'bad')
    if (!invoice) return toast('أرفق صورة الفاتورة أو ملفها — لا يُسجَّل مصروف بلا فاتورة.', 'bad')
    if (amt > b.remaining) return toast(`المبلغ يتجاوز المتبقي في العهدة (${money(b.remaining)}).`, 'bad')
    set((d) => {
      const c = d.custodies.find((x) => x.id === custody.id)!
      c.expenses.push({ id: uid('e'), amount: amt, description: description.trim(), date, invoice })
    })
    toast('تم تسجيل المصروف وإرفاق الفاتورة')
    onClose()
  }

  return (
    <Modal open onClose={onClose} title="تسجيل مصروف وإرفاق الفاتورة"
      footer={<><button className="btn-primary" onClick={save}>حفظ المصروف</button>
        <button className="btn-ghost" onClick={onClose}>إلغاء</button></>}>
      <div className="space-y-4">
        <div className="rounded-xl bg-navy-50 border border-navy-100 px-4 py-3 text-[12.5px] font-bold text-navy-800">
          العهدة: {custody.purpose} — المتبقي {money(b.remaining)} من {money(custody.amount)}
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="المبلغ (ر.س)" required>
            <input type="number" className="field" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
          </Field>
          <Field label="تاريخ الصرف" required>
            <input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <Field label="بيان المصروف" required>
          <input className="field" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="مثال: شراء جوائز" />
        </Field>
        <Field label="الفاتورة" required hint="صورة أو ملف PDF — لا يُسجَّل مصروف بلا فاتورة">
          <FileDrop multiple={false} label="إرفاق الفاتورة (صورة أو ملف)"
            onFiles={(fs) => setInvoice(fs[0])} />
          {invoice && <FileChips files={[invoice]} onRemove={() => setInvoice(undefined)} />}
        </Field>
      </div>
    </Modal>
  )
}

function CloseModal({ custody, onClose }: { custody: Custody; onClose: () => void }) {
  const { db, set } = useDb()
  const toast = useToast()
  const b = custodyBalance(custody)
  const [returned, setReturned] = useState(String(Math.max(0, b.remaining)))
  const [responsibleId, setResponsibleId] = useState(custody.responsibleId ?? '')
  const [note, setNote] = useState('')

  const noInvoice = custody.expenses.filter((e) => !e.invoice).length

  const save = () => {
    if (!responsibleId) return toast('حدّد المسؤول عن الاستلام والإقفال.', 'bad')
    if (noInvoice > 0 && !confirm(`يوجد ${noInvoice} مصروف بلا فاتورة مرفقة. الإقفال على أي حال؟`)) return
    const ret = Number(returned) || 0
    if (Math.abs(b.spent + ret - custody.amount) > 0.5) {
      if (!confirm(`المنصرف ${money(b.spent)} + المُعاد ${money(ret)} لا يساوي مبلغ العهدة ${money(custody.amount)}. المتابعة على أي حال؟`)) return
    }
    set((d) => {
      const c = d.custodies.find((x) => x.id === custody.id)!
      c.status = 'closed'; c.closedAt = todayISO(); c.returned = ret
      c.responsibleId = responsibleId
      if (note) c.note = note
    })
    toast('تم إقفال العهدة')
    onClose()
  }

  return (
    <Modal open onClose={onClose} title="إقفال العهدة"
      footer={<><button className="btn-primary" onClick={save}>إقفال</button>
        <button className="btn-ghost" onClick={onClose}>إلغاء</button></>}>
      <div className="space-y-4">
        <ul className="rounded-2xl bg-navy-50 border border-line p-4 space-y-2 text-[13px]">
          <li className="flex justify-between"><span className="text-ink-500">مبلغ العهدة</span><b>{money(custody.amount)}</b></li>
          <li className="flex justify-between"><span className="text-ink-500">المنصرف بفواتير</span><b>{money(b.spent)}</b></li>
          <li className="flex justify-between border-t border-line pt-2"><span className="text-ink-500">المتبقي الواجب إعادته</span>
            <b className="text-orange-700">{money(b.remaining)}</b></li>
        </ul>
        <Field label="المبلغ المُعاد فعليًا (ر.س)" required>
          <input type="number" className="field" value={returned} onChange={(e) => setReturned(e.target.value)} />
        </Field>
        <Field label="المسؤول عن الاستلام والإقفال" required>
          <Select value={responsibleId} onChange={setResponsibleId} placeholder="اختر…"
            options={staffOf(db, custody.mosqueId).map((p) => ({ value: p.id, label: `${p.name} — ${p.jobTitle}` }))} />
        </Field>
        <Field label="ملاحظة">
          <input className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="اختياري" />
        </Field>
      </div>
    </Modal>
  )
}

/* ================= الرواتب ================= */
function Payroll({ mosqueId, isComplex }: { mosqueId: string; isComplex: boolean }) {
  const { db } = useDb()
  const [who, setWho] = useState<'staff' | 'teachers'>('staff')

  const people = (mosqueId ? staffOf(db, mosqueId) : db.people.filter((p) => p.mosqueId !== 'complex' && p.active))
    .filter((p) => p.salary > 0)
  const teachers = (mosqueId ? teachersOf(db, mosqueId) : db.teachers.filter((t) => t.active))
    .filter((t) => t.salary > 0)

  const staffRows = people.map((p) => ({ id: p.id, name: p.name, sub: p.jobTitle, mosqueId: p.mosqueId, salary: p.salary, pay: payrollFor(db, p, todayISO()), late: 0 }))
  const teacherRows = teachers.map((t) => {
    const pay = teacherPayroll(db, t, todayISO())
    return { id: t.id, name: t.name, sub: [t.circle, t.level].filter(Boolean).join(' · '), mosqueId: t.mosqueId, salary: t.salary, pay, late: pay.late }
  })
  const rows = who === 'staff' ? staffRows : teacherRows

  const gross = rows.reduce((s, r) => s + r.salary, 0)
  const ded = rows.reduce((s, r) => s + r.pay.deduction, 0)

  return (
    <div className="space-y-4">
      <StatStrip items={[
        { label: 'إجمالي الرواتب', value: money(gross) },
        { label: 'إجمالي الخصومات', value: money(ded), accent: ded > 0 },
        { label: 'الصافي المستحق', value: money(gross - ded) },
        { label: 'عدد المستحقين', value: rows.length },
      ]} />

      <Card
        title="مسيّر الرواتب — الشهر الحالي"
        subtitle={`الغياب يُخصم يومًا كاملًا، والاستئذان المعتمد نصف يوم، على أساس ${db.settings.workDaysPerMonth} يوم عمل شهريًا`}
        action={
          <Tabs value={who} onChange={(v) => setWho(v as any)} items={[
            { value: 'staff', label: 'الإداريون', count: staffRows.length },
            { value: 'teachers', label: 'المعلمون', count: teacherRows.length },
          ]} />
        }
        pad={false}
      >
        {rows.length === 0 ? (
          <Empty icon="💼"
            title={who === 'staff' ? 'لا يوجد إداريون برواتب مسجّلة' : 'لا يوجد معلمون برواتب مسجّلة'}
            hint={who === 'staff'
              ? 'سجّل الراتب في بيانات كل إداري ليظهر في المسيّر.'
              : 'سجّل راتب كل معلم من صفحة المعلمين ليُحتسب خصم الغياب والاستئذان.'} />
        ) : (
          <>
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-navy-50"><tr>
                  <th className="th">{who === 'staff' ? 'الموظف' : 'المعلم'}</th>
                  {!mosqueId && <th className="th">المسجد</th>}
                  <th className="th">الراتب</th><th className="th">قيمة اليوم</th>
                  <th className="th">غياب</th><th className="th">استئذان</th>
                  {who === 'teachers' && <th className="th">تأخير</th>}
                  <th className="th">أيام الخصم</th><th className="th">الخصم</th><th className="th">الصافي</th>
                </tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="row">
                      <td className="td font-bold">{r.name}
                        {r.sub && <span className="block text-[11px] text-ink-400 font-normal">{r.sub}</span>}</td>
                      {!mosqueId && <td className="td text-[12px] text-ink-500">{mosqueName(db, r.mosqueId)}</td>}
                      <td className="td num">{r.salary.toLocaleString('en-US')}</td>
                      <td className="td num text-ink-400">{r.pay.dayValue.toLocaleString('en-US')}</td>
                      <td className="td"><Badge tone={r.pay.absent ? 'bad' : 'mute'}>{r.pay.absent}</Badge></td>
                      <td className="td"><Badge tone={r.pay.excused ? 'warn' : 'mute'}>{r.pay.excused}</Badge></td>
                      {who === 'teachers' && <td className="td"><Badge tone={r.late ? 'warn' : 'mute'}>{r.late}</Badge></td>}
                      <td className="td num">{r.pay.deductionDays}</td>
                      <td className="td num text-orange-700">{r.pay.deduction.toLocaleString('en-US')}</td>
                      <td className="td num text-navy-800">{r.pay.net.toLocaleString('en-US')}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-navy-50">
                  <tr>
                    <td className="td font-bold" colSpan={(mosqueId ? 7 : 8) + (who === 'teachers' ? 1 : 0)}>الإجمالي</td>
                    <td className="td num text-navy-800">{(gross - ded).toLocaleString('en-US')}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <ul className="lg:hidden divide-y divide-line">
              {rows.map((r) => (
                <li key={r.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-[13.5px] truncate">{r.name}</p>
                      {r.sub && <p className="text-[11px] text-ink-400 truncate">{r.sub}</p>}
                    </div>
                    <div className="text-left shrink-0">
                      <p className="num text-[16px] text-navy-800">{money(r.pay.net)}</p>
                      <p className="text-[10px] font-bold text-ink-400">الصافي</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <Badge tone="mute">الراتب {money(r.salary)}</Badge>
                    {r.pay.absent > 0 && <Badge tone="bad">غياب {r.pay.absent}</Badge>}
                    {r.pay.excused > 0 && <Badge tone="warn">استئذان {r.pay.excused}</Badge>}
                    {r.pay.deduction > 0 && <Badge tone="warn">خصم {money(r.pay.deduction)}</Badge>}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </div>
  )
}

/* ================= التقرير المالي ================= */
function FinanceReport({ mosqueId, isComplex }: { mosqueId: string; isComplex: boolean }) {
  const { db } = useDb()
  const { user } = useAuth()
  const rows = mosqueId ? db.custodies.filter((c) => c.mosqueId === mosqueId) : db.custodies
  const people = mosqueId ? staffOf(db, mosqueId) : db.people.filter((p) => p.mosqueId !== 'complex' && p.active)

  const granted = rows.filter((c) => c.status !== 'requested' && c.status !== 'rejected')
    .reduce((s, c) => s + c.amount, 0)
  const spent = rows.reduce((s, c) => s + custodyBalance(c).spent, 0)
  const returned = rows.reduce((s, c) => s + (c.returned ?? 0), 0)
  const salaries = people.reduce((s, p) => s + payrollFor(db, p, todayISO()).net, 0)

  return (
    <Card title="التقرير المالي" action={<PrintBar title="التقرير المالي" />}>
      <div id="print-area">
        <ReportHeader title="التقرير المالي"
          subtitle={mosqueId ? mosqueName(db, mosqueId) : 'جميع مساجد المجمع'} />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          <Stat label="العهد المصروفة" value={money(granted)} tone="brand" />
          <Stat label="المنصرف بفواتير" value={money(spent)} tone="olive" />
          <Stat label="المُعاد" value={money(returned)} tone="gold" />
          <Stat label="صافي الرواتب" value={money(salaries)} />
        </div>

        <div className="mt-5">
          <SplitBar parts={[
            { label: 'منصرف بفواتير', value: spent, color: C.olive },
            { label: 'مُعاد', value: returned, color: C.gold },
            { label: 'تحت التسوية', value: Math.max(0, granted - spent - returned), color: C.rose },
          ]} />
        </div>

        <h4 className="font-extrabold text-[14px] mt-6 mb-2">تفصيل العهد</h4>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border border-line rounded-xl overflow-hidden">
            <thead className="bg-navy-50"><tr>
              <th className="th">الغرض</th>{!mosqueId && <th className="th">المسجد</th>}
              <th className="th">مقدّم الطلب</th><th className="th">المبلغ</th>
              <th className="th">المنصرف</th><th className="th">المتبقي</th>
              <th className="th">تاريخ الإقفال</th><th className="th">الحالة</th>
            </tr></thead>
            <tbody>
              {rows.map((c) => {
                const b = custodyBalance(c)
                return (
                  <tr key={c.id} className="row">
                    <td className="td font-bold text-[12.5px]">{c.purpose}</td>
                    {!mosqueId && <td className="td text-[12px]">{mosqueName(db, c.mosqueId)}</td>}
                    <td className="td text-[12px]">{personName(db, c.requesterId)}</td>
                    <td className="td tabular-nums">{c.amount.toLocaleString('en-US')}</td>
                    <td className="td tabular-nums">{b.spent.toLocaleString('en-US')}</td>
                    <td className="td tabular-nums">{b.remaining.toLocaleString('en-US')}</td>
                    <td className="td text-[12px]">{fmtDate(c.closeDate)}</td>
                    <td className="td"><Badge tone={CST[c.status].tone}>{CST[c.status].label}</Badge></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <ReportFooter by={user?.name} />
      </div>
    </Card>
  )
}
