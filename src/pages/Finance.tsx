import { useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useDb } from '../store/db'
import { useAuth } from '../store/auth'
import {
  Card, Modal, Field, Select, Badge, Empty, useToast, Tabs, Progress, StatStrip,
} from '../components/ui'
import { PageHeader } from '../components/PageHeader'
import { CustodyRequestModal } from '../components/CustodyRequestModal'
import { ExpenseModal, ExpenseItems } from '../components/CustodyExpense'
import { todayISO, fmtDate } from '../lib/date'
import { money } from '../lib/format'
import {
  staffOf, personName, committeeName, mosqueName, custodyBalance, expenseSettled,
} from '../lib/selectors'
import { currentMonth } from '../lib/payroll'
import { Payroll, PayrollPrintModal, MonthlyReports } from './FinancePayroll'
import { TeacherContracts } from './TeacherContracts'
import type { Custody, Expense } from '../types'

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
  const [search] = useSearchParams()
  const [tab, setTab] = useState<'custody' | 'payroll' | 'months' | 'contracts'>(
    search.get('tab') === 'custody' ? 'custody' : 'payroll')
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

                      <ExpenseItems custody={c} />

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

function CloseModal({ custody, onClose }: { custody: Custody; onClose: () => void }) {
  const { db, set } = useDb()
  const toast = useToast()
  const b = custodyBalance(custody)
  const [returned, setReturned] = useState(String(Math.max(0, b.remaining)))
  const [responsibleId, setResponsibleId] = useState(custody.responsibleId ?? '')
  const [note, setNote] = useState('')

  const noInvoice = custody.expenses.filter((e) => !expenseSettled(e)).length
  const unconfirmed = custody.expenses.filter((e) => e.settle === 'finance' && !e.confirmedAt).length
  const uploaded = custody.expenses.filter((e) => e.invoice)
  const atFinance = custody.expenses.filter((e) => e.settle === 'finance' && e.receivedBy)
  const sum = (xs: Expense[]) => xs.reduce((s, e) => s + e.amount, 0)

  const save = () => {
    if (!responsibleId) return toast('حدّد المسؤول عن الاستلام والإقفال.', 'bad')
    if (noInvoice > 0 && !confirm(`يوجد ${noInvoice} مصروف بلا فاتورة مرفقة. الإقفال على أي حال؟`)) return
    if (unconfirmed > 0 && !confirm(`يوجد ${unconfirmed} فاتورة لم يؤكد المسؤول المالي استلامها. الإقفال على أي حال؟`)) return
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
