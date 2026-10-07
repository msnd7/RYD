import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useDb, uid } from '../store/db'
import { useAuth } from '../store/auth'
import {
  Card, Modal, Field, Select, Badge, Empty, useToast, Tabs,
  FileDrop, FileChips, Progress, StatStrip,
} from '../components/ui'
import { PageHeader } from '../components/PageHeader'
import { CustodyRequestModal } from '../components/CustodyRequestModal'
import { todayISO, fmtDate } from '../lib/date'
import { fileSrc } from '../lib/files'
import { money } from '../lib/format'
import {
  staffOf, personName, committeeName, mosqueName, custodyBalance, expenseSettled, financeOfficers,
} from '../lib/selectors'
import { currentMonth } from '../lib/payroll'
import { Payroll, PayrollPrintModal, MonthlyReports } from './FinancePayroll'
import { TeacherContracts } from './TeacherContracts'
import type { Custody, Expense, InvoiceSettle, UploadedFile } from '../types'

const CST: Record<string, { label: string; tone: string }> = {
  requested: { label: 'بانتظار الاعتماد', tone: 'warn' },
  approved: { label: 'عهدة مفتوحة', tone: 'info' },
  closed: { label: 'مقفلة', tone: 'ok' },
  rejected: { label: 'مرفوضة', tone: 'bad' },
}

export default function Finance({ scope }: { scope?: 'complex' }) {
  const params = useParams()
  const { db } = useDb()
  const { canFinance, user } = useAuth()
  const isComplex = scope === 'complex'
  // المفوض المالي من فريق المسجد يصل من مساحته بلا معرّف مسجد في الرابط
  const mid = params.mid ?? (user?.mosqueId !== 'complex' ? (user?.mosqueId as string) : '') ?? ''
  const [tab, setTab] = useState<'custody' | 'payroll' | 'months' | 'contracts'>('payroll')
  const [fMosque, setFMosque] = useState('')
  const [month, setMonth] = useState(currentMonth())
  const [printFor, setPrintFor] = useState<string | null>(null)

  if (!canFinance) {
    return (
      <Card>
        <Empty icon="🔒" title="الإدارة المالية مقصورة على المدير ومن يفوّضه"
          hint="يمكن لمدير المجمع منحك الصلاحية من صفحة الموظفين بتفعيل «تفويض بالوصول للإدارة المالية»." />
      </Card>
    )
  }

  const mosqueId = isComplex ? fMosque : mid
  const mosqueFilter = isComplex
    ? <Select className="!h-9 !text-[12.5px] !w-auto" value={fMosque} onChange={setFMosque} placeholder="كل المساجد"
        options={db.mosques.map((m) => ({ value: m.id, label: m.name }))} />
    : null
  const awaiting = db.teacherContracts.filter((c) => (!mosqueId || c.mosqueId === mosqueId) && c.status === 'awaiting').length
  const requested = db.custodies.filter((c) => (!mosqueId || c.mosqueId === mosqueId) && c.status === 'requested').length

  return (
    <div>
      <PageHeader
        eyebrow={isComplex ? 'الإدارة العامة' : mosqueName(db, mid)}
        title="الإدارة المالية"
        description="الرواتب تُحتسب لكل شهر ميلادي وتُصرف يوم ١ من الشهر التالي ثم يبدأ شهر جديد. هنا المسيّر الشهري وأرشيف الأشهر، والعهد ومصروفاتها، وعقود المعلمين."
        actions={<button className="btn-ghost btn-sm" onClick={() => setPrintFor(month)}>🖨 طباعة مسيّر الرواتب PDF</button>}
      />
      <Tabs value={tab} onChange={(v) => setTab(v as any)} items={[
        { value: 'payroll', label: 'مسيّر الرواتب' },
        { value: 'months', label: 'التقارير الشهرية' },
        { value: 'custody', label: 'العهد والمصروفات', ...(requested ? { count: requested } : {}) },
        { value: 'contracts', label: 'عقود المعلمين', ...(awaiting ? { count: awaiting } : {}) },
      ]} />
      <div className="mt-4">
        {tab === 'custody' && <Custodies mosqueId={mosqueId} isComplex={isComplex} filter={mosqueFilter} />}
        {tab === 'payroll' && (
          <Payroll mosqueId={mosqueId} isComplex={isComplex} month={month} setMonth={setMonth}
            onPrint={setPrintFor} mosqueFilter={mosqueFilter} />
        )}
        {tab === 'months' && (
          <MonthlyReports mosqueId={mosqueId} month={month} setMonth={setMonth}
            onOpenPayroll={(m) => { setMonth(m); setTab('payroll') }} onPrint={setPrintFor} mosqueFilter={mosqueFilter} />
        )}
        {tab === 'contracts' && <TeacherContracts mosqueId={mosqueId} isComplex={isComplex} mosqueFilter={mosqueFilter} />}
      </div>
      <PayrollPrintModal open={!!printFor} onClose={() => setPrintFor(null)} initialMonth={printFor ?? month}
        mosqueId={mosqueId} allowMosquePick={isComplex} />
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
        { label: 'المنصرف المُقفل بفواتير', value: money(totals.spent) },
        { label: 'مبالغ مُعادة', value: money(totals.returned) },
        { label: 'مفتوحة تحت التسوية', value: money(totals.open),
          hint: `${list.filter((c) => c.status === 'approved').length} عهدة`, accent: totals.open > 0 },
      ]} />

      <Card title="العهد والمصروفات"
        subtitle="يطلب المشرف أو اللجنة صرف عهدة، ويعتمدها المدير، ثم يُقفل كل مصروف بفاتورته — تسليمًا للمسؤول المالي أو رفعًا على الموقع — وتُقفل العهدة ويُعاد المتبقي"
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
                              <InvoiceChip e={e} />
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
                      <button className="btn-primary btn-sm" onClick={() => setExpenseFor(c)}>＋ إقفال مصروف بفاتورة</button>
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

function InvoiceChip({ e }: { e: Expense }) {
  const { db } = useDb()
  if (e.invoice) {
    return <a href={fileSrc(e.invoice)} download={e.invoice.name} target="_blank" rel="noreferrer"
      className="chip bg-navy-100 text-navy-800">🧾 الفاتورة مرفوعة</a>
  }
  if (e.settle === 'finance' && e.receivedBy) {
    return <span className="chip bg-navy-50 text-navy-800 ring-1 ring-navy-200" title="سُلِّمت الفاتورة الأصلية للمسؤول المالي">
      🤝 لدى المسؤول المالي: {personName(db, e.receivedBy)}</span>
  }
  return <span className="chip bg-orange-100 text-orange-700">بدون فاتورة</span>
}

const SETTLE_OPTIONS: { value: InvoiceSettle; icon: string; label: string; hint: string }[] = [
  { value: 'finance', icon: '🤝', label: 'الإقفال عند المسؤول المالي', hint: 'تُسلَّم الفاتورة الأصلية للمسؤول المالي ويُسجَّل استلامه لها' },
  { value: 'upload', icon: '📤', label: 'رفع الفاتورة على الموقع', hint: 'صورة الفاتورة أو ملف PDF تُحفظ مع المصروف' },
]

function ExpenseModal({ custody, onClose }: { custody: Custody; onClose: () => void }) {
  const { db, set } = useDb()
  const { user } = useAuth()
  const toast = useToast()
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(todayISO())
  const [settle, setSettle] = useState<InvoiceSettle | undefined>()
  const [invoice, setInvoice] = useState<UploadedFile | undefined>()
  const officers = financeOfficers(db, custody.mosqueId)
  const [receivedBy, setReceivedBy] = useState(
    officers.some((p) => p.id === user?.id) ? user!.id : officers.length === 1 ? officers[0].id : '')

  const b = custodyBalance(custody)

  const save = () => {
    const amt = Number(amount)
    if (!amt) return toast('حدّد مبلغ المصروف.', 'bad')
    if (!description.trim()) return toast('اكتب بيان المصروف.', 'bad')
    if (!settle) return toast('اختر طريقة إقفال الفاتورة: عند المسؤول المالي أو رفعها على الموقع.', 'bad')
    if (settle === 'upload' && !invoice) return toast('أرفق صورة الفاتورة أو ملفها.', 'bad')
    if (settle === 'finance' && !receivedBy) return toast('حدّد المسؤول المالي الذي استلم الفاتورة.', 'bad')
    if (amt > b.remaining) return toast(`المبلغ يتجاوز المتبقي في العهدة (${money(b.remaining)}).`, 'bad')
    set((d) => {
      const c = d.custodies.find((x) => x.id === custody.id)!
      c.expenses.push({
        id: uid('e'), amount: amt, description: description.trim(), date, settle,
        ...(settle === 'upload' ? { invoice } : { receivedBy }),
        recordedBy: user?.id,
      })
    })
    toast(settle === 'upload' ? 'تم إقفال المصروف برفع الفاتورة' : 'تم إقفال المصروف عند المسؤول المالي')
    onClose()
  }

  return (
    <Modal open onClose={onClose} title="إقفال مصروف بفاتورة"
      footer={<><button className="btn-primary" onClick={save}>إقفال المصروف</button>
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

        <div>
          <label className="label">طريقة إقفال الفاتورة <span className="text-orange-600">*</span></label>
          <div className="grid sm:grid-cols-2 gap-2" role="radiogroup" aria-label="طريقة إقفال الفاتورة">
            {SETTLE_OPTIONS.map((o) => {
              const on = settle === o.value
              return (
                <button key={o.value} type="button" role="radio" aria-checked={on} onClick={() => setSettle(o.value)}
                  className={`text-right rounded-2xl border-2 px-3.5 py-3 transition
                    ${on ? 'border-navy-600 bg-navy-50 shadow-soft' : 'border-line bg-surface hover:bg-navy-50/50'}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-[16px]">{o.icon}</span>
                    <span className={`font-bold text-[13.5px] ${on ? 'text-navy-800' : 'text-ink-900'}`}>{o.label}</span>
                  </div>
                  <p className="text-[11px] font-bold text-ink-500 mt-1 leading-5">{o.hint}</p>
                </button>
              )
            })}
          </div>
        </div>

        {settle === 'finance' && (
          <Field label="المسؤول المالي المستلم للفاتورة" required hint="يحتفظ بالفاتورة الأصلية، ويُحتسب المبلغ ضمن المنصرف">
            <Select value={receivedBy} onChange={setReceivedBy} placeholder="اختر…"
              options={officers.map((p) => ({ value: p.id, label: `${p.name} — ${p.jobTitle}` }))} />
          </Field>
        )}
        {settle === 'upload' && (
          <Field label="الفاتورة" required hint="صورة أو ملف PDF">
            <FileDrop multiple={false} label="إرفاق الفاتورة (صورة أو ملف)"
              onFiles={(fs) => setInvoice(fs[0])} />
            {invoice && <FileChips files={[invoice]} onRemove={() => setInvoice(undefined)} />}
          </Field>
        )}
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

  const noInvoice = custody.expenses.filter((e) => !expenseSettled(e)).length
  const uploaded = custody.expenses.filter((e) => e.invoice)
  const atFinance = custody.expenses.filter((e) => e.settle === 'finance' && e.receivedBy)
  const sum = (xs: Expense[]) => xs.reduce((s, e) => s + e.amount, 0)

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
          <li className="flex justify-between text-[12px] pr-3"><span className="text-ink-500">🤝 مُقفل عند المسؤول المالي ({atFinance.length})</span><b>{money(sum(atFinance))}</b></li>
          <li className="flex justify-between text-[12px] pr-3"><span className="text-ink-500">📤 مرفوع على الموقع ({uploaded.length})</span><b>{money(sum(uploaded))}</b></li>
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
