import { useState } from 'react'
import { useDb, uid } from '../store/db'
import { useAuth } from '../store/auth'
import { Modal, Field, Select, useToast } from './ui'
import { todayISO, shiftDays } from '../lib/date'
import { staffOf, committeesOf } from '../lib/selectors'
import { money } from '../lib/format'

/**
 * طلب صرف عهدة — يُفتح من صفحة اللجنة أو من الإدارة المالية.
 * يبقى الطلب مفتوحًا حتى يُقفل بفواتير، ويُعاد المبلغ المتبقي إن وُجد.
 */
export function CustodyRequestModal({ open, onClose, mosqueId, committeeId, allowMosquePick, allowCommitteePick = true }: {
  open: boolean
  onClose: () => void
  mosqueId: string
  committeeId?: string
  allowMosquePick?: boolean
  allowCommitteePick?: boolean
}) {
  const { db, set } = useDb()
  const { user } = useAuth()
  const toast = useToast()
  const [f, setF] = useState<any>({})
  const [key, setKey] = useState('')

  const sig = `${open}-${committeeId ?? ''}-${mosqueId}`
  if (sig !== key) {
    setKey(sig)
    setF({
      mosqueId: mosqueId || db.mosques[0].id,
      committeeId: committeeId ?? '',
      amount: '', purpose: '',
      closeDate: shiftDays(todayISO(), 30),
      responsibleId: '', note: '',
    })
  }

  const save = () => {
    if (!f.purpose?.trim()) return toast('اذكر الغرض من العهدة.', 'bad')
    if (!Number(f.amount)) return toast('حدّد المبلغ المطلوب.', 'bad')
    if (!f.closeDate) return toast('حدّد تاريخ الإقفال.', 'bad')
    set((d) => d.custodies.push({
      id: uid('c'), mosqueId: f.mosqueId, requesterId: user!.id,
      committeeId: f.committeeId || undefined,
      amount: Number(f.amount), purpose: f.purpose.trim(),
      closeDate: f.closeDate, status: 'requested',
      responsibleId: f.responsibleId || undefined,
      createdAt: todayISO(), expenses: [], note: f.note,
    }))
    toast('رُفع طلب العهدة لمدير المجمع للاعتماد')
    onClose()
  }

  const committee = db.committees.find((c) => c.id === f.committeeId)

  return (
    <Modal open={open} onClose={onClose} wide
      title={committee ? `طلب صرف عهدة — ${committee.name}` : 'طلب صرف عهدة'}
      footer={<>
        <button className="btn-primary" onClick={save}>رفع الطلب</button>
        <button className="btn-ghost" onClick={onClose}>إلغاء</button>
      </>}>
      <div className="space-y-4">
        <div className="rounded-xl bg-navy-50 border border-navy-100 px-4 py-3 text-[12.5px] text-navy-900 leading-7">
          يُرفع الطلب لمدير المجمع. بعد اعتماده تُصبح <b>عهدة مفتوحة</b> باسمك، وتبقى مفتوحة حتى
          تُسجَّل مصروفاتها بفواتيرها ثم تُقفل، ويُعاد المبلغ المتبقي إن وُجد.
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {allowMosquePick && (
            <Field label="المسجد" required>
              <Select value={f.mosqueId ?? ''} onChange={(v) => setF({ ...f, mosqueId: v, committeeId: '', responsibleId: '' })}
                options={db.mosques.map((m) => ({ value: m.id, label: m.name }))} />
            </Field>
          )}
          {allowCommitteePick && (
            <Field label="اللجنة" hint="تظهر العهدة في صفحة اللجنة لمتابعتها">
              <Select value={f.committeeId ?? ''} onChange={(v) => setF({ ...f, committeeId: v })}
                placeholder="عهدة للمسجد (بدون لجنة)"
                options={committeesOf(db, f.mosqueId).map((c) => ({ value: c.id, label: c.name }))} />
            </Field>
          )}
          <Field label="المبلغ المطلوب (ر.س)" required>
            <input type="number" inputMode="numeric" className="field" value={f.amount ?? ''}
              onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="مثال: 2500" autoFocus />
          </Field>
          <Field label="تاريخ الإقفال" required hint="آخر موعد لتسليم الفواتير">
            <input type="date" className="field" value={f.closeDate ?? ''}
              onChange={(e) => setF({ ...f, closeDate: e.target.value })} />
          </Field>
          <Field label="المسؤول عن الاستلام والإقفال">
            <Select value={f.responsibleId ?? ''} onChange={(v) => setF({ ...f, responsibleId: v })}
              placeholder="يُحدَّد لاحقًا"
              options={staffOf(db, f.mosqueId).map((p) => ({ value: p.id, label: `${p.name} — ${p.jobTitle}` }))} />
          </Field>
        </div>

        <Field label="الغرض من العهدة" required>
          <textarea className="field leading-7" rows={3} value={f.purpose ?? ''}
            onChange={(e) => setF({ ...f, purpose: e.target.value })}
            placeholder="مثال: جوائز مسابقة الحفظ الشهرية" />
        </Field>

        {Number(f.amount) > 0 && (
          <p className="muted">المبلغ المطلوب: <b className="text-ink-900">{money(Number(f.amount))}</b></p>
        )}
      </div>
    </Modal>
  )
}
