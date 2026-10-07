import { useState } from 'react'
import { useDb, uid } from '../store/db'
import { useAuth } from '../store/auth'
import { Card, Modal, Field, Select, Badge, Progress, FileDrop, FileChips, useToast } from './ui'
import { todayISO, fmtDate } from '../lib/date'
import { fileSrc } from '../lib/files'
import { money } from '../lib/format'
import {
  personName, committeeName, custodyBalance, financeOfficers, myOpenCustodies,
} from '../lib/selectors'
import type { Custody, Expense, InvoiceSettle, Person, UploadedFile } from '../types'

/** يُقفل مصروفات العهدة صاحبُ الطلب نفسه، والمدير ومن يحمل تفويضًا ماليًا */
export const canCloseExpenses = (user: Person | null, canFinance: boolean, c: Custody) =>
  !!user && c.status === 'approved' && (canFinance || c.requesterId === user.id)

export function InvoiceChip({ e }: { e: Expense }) {
  const { db } = useDb()
  if (e.invoice) {
    return <a href={fileSrc(e.invoice)} download={e.invoice.name} target="_blank" rel="noreferrer"
      className="chip bg-navy-100 text-navy-800">🧾 الفاتورة مرفوعة</a>
  }
  if (e.settle === 'finance' && e.receivedBy) {
    return e.confirmedAt
      ? <span className="chip bg-navy-50 text-navy-800 ring-1 ring-navy-200" title={`أكّد الاستلام ${fmtDate(e.confirmedAt)}`}>
          🤝 استلمها المسؤول المالي: {personName(db, e.receivedBy)}</span>
      : <span className="chip bg-orange-50 text-orange-700 ring-1 ring-orange-200">
          ⏳ سُلِّمت لـ{personName(db, e.receivedBy)} — بانتظار تأكيد الاستلام</span>
  }
  return <span className="chip bg-orange-100 text-orange-700">بدون فاتورة</span>
}

/** قائمة مصروفات العهدة، مع زر تأكيد الاستلام للمسؤول المالي المستلم */
export function ExpenseItems({ custody }: { custody: Custody }) {
  const { set } = useDb()
  const { user, isDirector } = useAuth()
  const toast = useToast()
  if (custody.expenses.length === 0) return null

  const confirm = (e: Expense) => {
    set((d) => {
      const x = d.custodies.find((c) => c.id === custody.id)?.expenses.find((y) => y.id === e.id)
      if (x) x.confirmedAt = todayISO()
    })
    toast('تم تأكيد استلام الفاتورة')
  }

  return (
    <ul className="mt-3 space-y-1.5">
      {custody.expenses.map((e) => (
        <li key={e.id} className="flex flex-wrap items-center gap-2 text-[12px] bg-navy-50 rounded-xl px-3 py-2">
          <span className="font-bold">{e.description}</span>
          <span className="tabular-nums font-black text-navy-700">{money(e.amount)}</span>
          <span className="text-ink-500">{fmtDate(e.date)}</span>
          <InvoiceChip e={e} />
          {e.settle === 'finance' && !e.confirmedAt && (user?.id === e.receivedBy || isDirector) && (
            <button className="btn-primary btn-sm !h-7 !text-[11.5px]" onClick={() => confirm(e)}>تأكيد الاستلام</button>
          )}
        </li>
      ))}
    </ul>
  )
}

const SETTLE_OPTIONS: { value: InvoiceSettle; icon: string; label: string; hint: string }[] = [
  { value: 'finance', icon: '🤝', label: 'الإقفال عند المسؤول المالي', hint: 'تُسلَّم الفاتورة الأصلية للمسؤول المالي ويُسجَّل استلامه لها' },
  { value: 'upload', icon: '📤', label: 'رفع الفاتورة على الموقع', hint: 'صورة الفاتورة أو ملف PDF تُحفظ مع المصروف' },
]

export function ExpenseModal({ custody, onClose }: { custody: Custody; onClose: () => void }) {
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
        ...(settle === 'upload' ? { invoice } : {
          receivedBy,
          // من يسجّلها لنفسه فقد استلمها؛ وإلا تنتظر تأكيده
          ...(receivedBy === user?.id ? { confirmedAt: todayISO() } : {}),
        }),
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
          <Field label="المسؤول المالي المستلم للفاتورة" required
            hint={receivedBy && receivedBy !== user?.id
              ? 'يُحتسب المبلغ ضمن المنصرف، ويؤكد المسؤول المالي استلام الفاتورة من حسابه'
              : 'يحتفظ بالفاتورة الأصلية، ويُحتسب المبلغ ضمن المنصرف'}>
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

/**
 * «عهدي المفتوحة» — تظهر لصاحب العهدة في شاشته الرئيسية،
 * فيُقفل مصروفاتها بنفسه: تسليمًا للمسؤول المالي أو رفعًا على الموقع.
 */
export function MyCustodies() {
  const { db } = useDb()
  const { user } = useAuth()
  const [expenseFor, setExpenseFor] = useState<Custody | null>(null)
  if (!user) return null
  const list = myOpenCustodies(db, user.id)
  if (list.length === 0) return null
  const today = todayISO()

  return (
    <Card title="عهدي المفتوحة" pad={false}
      subtitle="أقفل كل مصروف بفاتورته: سلّمها للمسؤول المالي أو ارفعها على الموقع، ويُعاد المتبقي عند إقفال العهدة">
      <ul className="divide-y divide-line">
        {list.map((c) => {
          const b = custodyBalance(c)
          const pct = c.amount ? (b.spent / c.amount) * 100 : 0
          const overdue = c.closeDate < today
          return (
            <li key={c.id} className="px-4 sm:px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="font-extrabold text-[14px] flex-1 min-w-0">{c.purpose}</h4>
                {overdue
                  ? <Badge tone="bad" dot>تجاوزت تاريخ الإقفال</Badge>
                  : <Badge tone="info">الإقفال {fmtDate(c.closeDate)}</Badge>}
              </div>
              {c.committeeId && <p className="text-[11.5px] text-ink-500 font-bold mt-1">🏷️ {committeeName(db, c.committeeId)}</p>}
              <div className="mt-3 max-w-lg">
                <div className="flex justify-between text-[11.5px] font-bold mb-1">
                  <span>المنصرف {money(b.spent)} من {money(c.amount)}</span>
                  <span className={b.remaining > 0 ? 'text-orange-600' : 'text-navy-800'}>المتبقي {money(b.remaining)}</span>
                </div>
                <Progress value={pct} tone={pct >= 100 ? 'olive' : 'gold'} />
              </div>
              <ExpenseItems custody={c} />
              <div className="mt-3">
                <button className="btn-primary btn-sm" onClick={() => setExpenseFor(c)}>＋ إقفال مصروف بفاتورة</button>
              </div>
            </li>
          )
        })}
      </ul>
      {expenseFor && <ExpenseModal custody={expenseFor} onClose={() => setExpenseFor(null)} />}
    </Card>
  )
}
