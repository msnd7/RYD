import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useDb, uid } from '../store/db'
import { useAuth } from '../store/auth'
import { Card, Modal, Field, Select, Badge, Empty, useToast, Menu } from '../components/ui'
import { PageHeader } from '../components/PageHeader'
import { AiTextArea } from '../components/AiTextArea'
import { todayISO, fmtDate } from '../lib/date'
import { visibleAnnouncements, personName, mosqueName, committeeName } from '../lib/selectors'
import type { Announcement, AnnounceTarget } from '../types'

const TARGET_LABEL: Record<AnnounceTarget, string> = {
  all: 'الجميع', mosque: 'مسجد محدد', committee: 'لجنة محددة', person: 'شخص بعينه',
}

export default function Announcements({ scope }: { scope?: 'complex' }) {
  const { mid = '' } = useParams()
  const { db, set } = useDb()
  const { user, isDirector } = useAuth()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Announcement | null>(null)

  const canPublish = isDirector || user?.role === 'supervisor'

  let list = visibleAnnouncements(db, user!)
  if (scope !== 'complex' && mid) {
    list = list.filter((a) =>
      a.target === 'all' ||
      (a.target === 'mosque' && a.targetId === mid) ||
      (a.target === 'committee' && db.committees.find((c) => c.id === a.targetId)?.mosqueId === mid) ||
      (a.target === 'person' && db.people.find((p) => p.id === a.targetId)?.mosqueId === mid))
  }

  const targetText = (a: Announcement) =>
    a.target === 'all' ? 'لجميع منسوبي المجمع'
      : a.target === 'mosque' ? mosqueName(db, a.targetId)
      : a.target === 'committee' ? committeeName(db, a.targetId)
      : personName(db, a.targetId)

  const remove = (a: Announcement) => {
    if (!confirm('حذف الإعلان؟')) return
    set((d) => { d.announcements = d.announcements.filter((x) => x.id !== a.id) })
    toast('تم الحذف', 'info')
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={scope === 'complex' ? 'الإدارة العامة' : mosqueName(db, mid)}
        title="الإعلانات والرسائل"
        description="وجّه رسالتك لجميع منسوبي المجمع أو لمسجد أو للجنة أو لشخص بعينه، مع خيار تنسيق النص بمساعد ذكي قبل النشر."
        actions={canPublish && <button className="btn-primary btn-sm" onClick={() => { setEditing(null); setOpen(true) }}>＋ إعلان جديد</button>}
      />
      <Card pad={false}>
        {list.length === 0 ? <Empty icon="📣" title="لا توجد إعلانات" /> : (
          <ul className="divide-y divide-line">
            {list.map((a) => (
              <li key={a.id} className={`px-5 py-4 ${a.pinned ? 'bg-orange-50/50' : ''}`}>
                <div className="flex flex-wrap items-start gap-3">
                  <span className={`w-11 h-11 shrink-0 rounded-2xl grid place-items-center text-lg
                    ${a.target === 'all' ? 'bg-navy-100 text-navy-700'
                      : a.target === 'mosque' ? 'bg-navy-100 text-navy-800'
                      : a.target === 'committee' ? 'bg-orange-100 text-orange-700' : 'bg-navy-100 text-navy-800'}`}>
                    {a.pinned ? '📌' : '📣'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-extrabold text-[15px]">{a.title}</h4>
                      <Badge tone={a.target === 'all' ? 'info' : a.target === 'person' ? 'purple' : 'ok'}>
                        {targetText(a)}
                      </Badge>
                    </div>
                    <p className="text-[13px] text-ink-700 mt-2 leading-8 whitespace-pre-wrap">{a.body}</p>
                    <p className="text-[11px] text-ink-500 mt-2">
                      {personName(db, a.createdBy)} · {fmtDate(a.createdAt)}
                    </p>
                  </div>
                  {(isDirector || a.createdBy === user?.id) && (
                    <Menu items={[
                      { label: 'تعديل الإعلان', icon: '✎', onClick: () => { setEditing(a); setOpen(true) } },
                      'sep',
                      { label: 'حذف الإعلان', icon: '🗑', danger: true, onClick: () => remove(a) },
                    ]} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <AnnounceModal open={open} onClose={() => { setOpen(false); setEditing(null) }}
        item={editing} defaultMosque={scope === 'complex' ? '' : mid} />
    </div>
  )
}

function AnnounceModal({ open, onClose, item, defaultMosque }: {
  open: boolean; onClose: () => void; item: Announcement | null; defaultMosque: string
}) {
  const { db, set } = useDb()
  const { user, isDirector } = useAuth()
  const toast = useToast()
  const [f, setF] = useState<any>({})
  const [key, setKey] = useState('')
  const sig = `${open}-${item?.id ?? 'new'}`
  if (sig !== key) {
    setKey(sig)
    setF(item ? { ...item } : {
      target: defaultMosque ? 'mosque' : 'all', targetId: defaultMosque || undefined,
      title: '', body: '', pinned: false,
    })
  }

  const targetOptions = () => {
    if (f.target === 'mosque') return db.mosques.map((m) => ({ value: m.id, label: m.name }))
    if (f.target === 'committee') return db.committees.map((c) => ({
      value: c.id, label: `${c.name} — ${mosqueName(db, c.mosqueId)}`,
    }))
    if (f.target === 'person') return db.people.filter((p) => p.active).map((p) => ({
      value: p.id, label: `${p.name} — ${mosqueName(db, p.mosqueId)}`,
    }))
    return []
  }

  const save = () => {
    if (!f.title?.trim()) return toast('اكتب عنوان الإعلان.', 'bad')
    if (!f.body?.trim()) return toast('اكتب نص الإعلان.', 'bad')
    if (f.target !== 'all' && !f.targetId) return toast('حدّد الجهة المستهدفة.', 'bad')
    set((d) => {
      if (item) Object.assign(d.announcements.find((a) => a.id === item.id)!, f)
      else d.announcements.push({ ...f, id: uid('an'), createdBy: user!.id, createdAt: todayISO() })
    })
    toast(item ? 'تم حفظ الإعلان' : 'تم نشر الإعلان')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={item ? 'تعديل إعلان' : 'إعلان جديد'} wide
      footer={<><button className="btn-primary" onClick={save}>{item ? 'حفظ' : 'نشر الإعلان'}</button>
        <button className="btn-ghost" onClick={onClose}>إلغاء</button></>}>
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="موجّه إلى" required>
            <Select value={f.target ?? 'all'} onChange={(v) => setF({ ...f, target: v, targetId: undefined })} placeholder=""
              options={(Object.keys(TARGET_LABEL) as AnnounceTarget[])
                .filter((t) => isDirector || t !== 'all' || true)
                .map((t) => ({ value: t, label: TARGET_LABEL[t] }))} />
          </Field>
          {f.target !== 'all' && (
            <Field label="الجهة المستهدفة" required>
              <Select value={f.targetId ?? ''} onChange={(v) => setF({ ...f, targetId: v })} options={targetOptions()} />
            </Field>
          )}
        </div>

        <Field label="العنوان" required>
          <input className="field" value={f.title ?? ''} onChange={(e) => setF({ ...f, title: e.target.value })} autoFocus />
        </Field>

        <AiTextArea label="نص الرسالة" value={f.body ?? ''} onChange={(v) => setF({ ...f, body: v })}
          kind="announcement" rows={6} placeholder="اكتب نص الإعلان…" />

        <label className="flex items-center gap-3 rounded-xl bg-orange-50 border border-orange-200 px-4 py-3 cursor-pointer">
          <input type="checkbox" className="w-4 h-4 accent-orange-500" checked={!!f.pinned}
            onChange={(e) => setF({ ...f, pinned: e.target.checked })} />
          <span className="text-[13px] font-bold text-orange-700">📌 تثبيت الإعلان في أعلى القائمة</span>
        </label>
      </div>
    </Modal>
  )
}
