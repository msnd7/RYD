import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useDb, uid } from '../store/db'
import { useAuth } from '../store/auth'
import { Card, Stat, Badge, Modal, Field, Empty, Tabs, useToast, Progress, Select } from '../components/ui'
import { Donut, BarChart, SplitBar, C } from '../components/charts'
import { distanceMeters, getPosition } from '../lib/geo'
import { todayISO, shiftDays, fmtDate, fmtDayName, fmtTime } from '../lib/date'
import { staffOf, attendanceStats, personName, lastNDays, attendanceByDay, payrollFor, mosqueName } from '../lib/selectors'
import type { AttStatus } from '../types'

const ST: Record<AttStatus, { label: string; tone: string }> = {
  present: { label: 'حاضر', tone: 'ok' },
  absent: { label: 'غائب', tone: 'bad' },
  excused: { label: 'مستأذن', tone: 'warn' },
}

export default function Attendance({ scope }: { scope?: 'complex' }) {
  const { mid = '' } = useParams()
  const { db, set } = useDb()
  const { user, isDirector } = useAuth()
  const toast = useToast()
  const isComplex = scope === 'complex'
  const mosqueId = isComplex ? (user?.mosqueId as string) : mid

  // المشرف والعضو يبدآن من «تحضيري» لأنه إجراؤهما اليومي، والمدير من «حضور الفريق»
  const [tab, setTab] = useState<'me' | 'team' | 'leaves'>(
    user?.role === 'director' ? 'team' : 'me')
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [fMosque, setFMosque] = useState('')

  const today = todayISO()
  const canManage = isDirector || user?.role === 'supervisor'

  return (
    <div className="space-y-5">
      <Tabs value={tab} onChange={(v) => setTab(v as any)} items={[
        { value: 'me', label: 'تحضيري' },
        ...(canManage ? [{ value: 'team' as const, label: 'حضور الفريق' }] : []),
        { value: 'leaves', label: 'طلبات الاستئذان', count: db.leaves.filter((l) =>
          (isComplex ? true : l.mosqueId === mid) && l.status === 'pending').length },
      ]} />

      {tab === 'me' && <MyAttendance mosqueId={isComplex ? (user!.mosqueId as string) : mid} onLeave={() => setLeaveOpen(true)} />}

      {tab === 'team' && canManage && (
        <TeamAttendance mid={isComplex ? fMosque : mid} isComplex={isComplex}
          filter={isComplex ? (
            <Select value={fMosque} onChange={setFMosque} placeholder="كل المساجد"
              options={db.mosques.map((m) => ({ value: m.id, label: m.name }))} />
          ) : null} />
      )}

      {tab === 'leaves' && <Leaves mid={isComplex ? '' : mid} onNew={() => setLeaveOpen(true)} />}

      <LeaveModal open={leaveOpen} onClose={() => setLeaveOpen(false)} mosqueId={mosqueId} />
    </div>
  )
}

/* ================= تحضيري ================= */
function MyAttendance({ mosqueId, onLeave }: { mosqueId: string; onLeave: () => void }) {
  const { db, set } = useDb()
  const { user } = useAuth()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const today = todayISO()
  const mosque = db.mosques.find((m) => m.id === mosqueId)
  const mine = db.attendance.find((a) => a.personId === user!.id && a.date === today)
  const from = shiftDays(today, -29)
  const st = attendanceStats(db, user!.id, from, today)
  const pay = payrollFor(db, user!, today)
  const days = lastNDays(14)
  const byDay = attendanceByDay(db.attendance.filter((a) => a.personId === user!.id), days)

  const checkIn = async () => {
    if (!mosque) return
    setBusy(true); setMsg(null)
    try {
      const pos = await getPosition()
      const dist = distanceMeters(pos, mosque.geofence)
      if (dist > mosque.geofence.radius) {
        setMsg({ ok: false, text: `أنت خارج نطاق ${mosque.name}. المسافة الحالية ${dist} متر، والنطاق المسموح ${mosque.geofence.radius} متر.` })
        setBusy(false)
        return
      }
      set((d) => {
        const ex = d.attendance.find((a) => a.personId === user!.id && a.date === today)
        const rec = {
          id: ex?.id ?? uid('a'), mosqueId, personId: user!.id, date: today,
          status: 'present' as AttStatus, checkInAt: new Date().toISOString(),
          distance: dist, source: 'geo' as const,
        }
        if (ex) Object.assign(ex, rec); else d.attendance.push(rec)
      })
      setMsg({ ok: true, text: `تم تسجيل حضورك بنجاح داخل نطاق ${mosque.name} (على بُعد ${dist} متر).` })
      toast('تم تحضيرك اليوم ✅')
    } catch (e: any) {
      setMsg({ ok: false, text: e.message ?? 'تعذّر تحديد الموقع.' })
    } finally { setBusy(false) }
  }

  return (
    <div className="grid lg:grid-cols-3 gap-5">
      <Card title="تحضير اليوم" subtitle={`${fmtDayName(today)} · ${fmtDate(today)}`} className="lg:col-span-2">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="text-center">
            <div className={`w-32 h-32 rounded-3xl grid place-items-center text-5xl shadow-soft
              ${mine?.status === 'present' ? 'bg-navy-100' : mine?.status === 'excused' ? 'bg-orange-100' : mine?.status === 'absent' ? 'bg-orange-100' : 'bg-line'}`}>
              {mine?.status === 'present' ? '✅' : mine?.status === 'excused' ? '📝' : mine?.status === 'absent' ? '❌' : '📍'}
            </div>
            <div className="mt-3 font-extrabold">
              {mine ? ST[mine.status].label : 'لم تُحضّر بعد'}
            </div>
            {mine?.checkInAt && <div className="text-[11px] text-ink-500">الساعة {fmtTime(mine.checkInAt)}</div>}
          </div>

          <div className="flex-1 w-full">
            <div className="rounded-2xl bg-navy-50/70 border border-navy-100 p-4">
              <p className="text-[13px] font-bold text-navy-800">🕌 {mosque?.name}</p>
              <p className="text-[12px] text-ink-500 mt-1 leading-6">
                يتم التحضير فقط عند تواجدك داخل النطاق المكاني للمسجد
                (نطاق {mosque?.geofence.radius} متر حول إحداثيات المسجد المحددة من إدارة المجمع).
              </p>
            </div>

            <div className="flex flex-wrap gap-2 mt-4">
              <button className="btn-primary" onClick={checkIn} disabled={busy || mine?.status === 'present'}>
                {busy ? '⏳ جارٍ تحديد موقعك…' : mine?.status === 'present' ? '✅ تم تحضيرك اليوم' : '📍 تحضير نفسي الآن'}
              </button>
              <button className="btn-gold" onClick={onLeave}>📝 رفع طلب استئذان</button>
            </div>

            {msg && (
              <div className={`mt-3 rounded-xl px-4 py-3 text-[13px] font-bold leading-6
                ${msg.ok ? 'bg-navy-50 text-navy-800 border border-navy-200' : 'bg-orange-50 text-orange-700 border border-orange-200'}`}>
                {msg.ok ? '✔ ' : '⚠ '}{msg.text}
              </div>
            )}
          </div>
        </div>

        <hr className="my-5 border-line" />
        <h4 className="font-extrabold text-[14px] mb-3">آخر ١٤ يومًا</h4>
        <BarChart data={byDay.map((d) => ({
          label: d.date.slice(8),
          values: [
            { key: 'حاضر', value: d.present, color: C.present },
            { key: 'مستأذن', value: d.excused, color: C.excused },
            { key: 'غائب', value: d.absent, color: C.absent },
          ],
        }))} height={90} />
      </Card>

      <div className="space-y-5">
        <Card title="سجلي خلال ٣٠ يومًا">
          <div className="flex justify-center">
            <Donut value={st.rate} tone={st.rate >= 85 ? C.olive : st.rate >= 70 ? C.gold : C.rose} sub="نسبة الحضور" />
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4">
            <Stat label="حضور" value={st.present} tone="olive" />
            <Stat label="غياب" value={st.absent} tone={st.absent ? 'rose' : 'slate'} />
            <Stat label="استئذان" value={st.excused} tone="gold" />
          </div>
        </Card>

        {user!.salary > 0 && (
          <Card title="أثر الحضور على الراتب" subtitle="الشهر الحالي">
            <ul className="space-y-2.5 text-[13px]">
              <li className="flex justify-between"><span className="text-ink-500">الراتب المسجّل</span><b className="tabular-nums">{user!.salary.toLocaleString('en-US')} ر.س</b></li>
              <li className="flex justify-between"><span className="text-ink-500">قيمة اليوم</span><b className="tabular-nums">{pay.dayValue.toLocaleString('en-US')} ر.س</b></li>
              <li className="flex justify-between"><span className="text-ink-500">أيام الغياب (يوم كامل)</span><b className="tabular-nums text-orange-600">{pay.absent}</b></li>
              <li className="flex justify-between"><span className="text-ink-500">أيام الاستئذان (نصف يوم)</span><b className="tabular-nums text-orange-600">{pay.excused}</b></li>
              <li className="flex justify-between border-t border-line pt-2.5"><span className="text-ink-500">إجمالي الخصم</span><b className="tabular-nums text-orange-600">{pay.deduction.toLocaleString('en-US')} ر.س</b></li>
              <li className="flex justify-between"><span className="font-bold">الصافي المستحق</span><b className="tabular-nums text-navy-800 text-base">{pay.net.toLocaleString('en-US')} ر.س</b></li>
            </ul>
          </Card>
        )}
      </div>
    </div>
  )
}

/* ================= حضور الفريق ================= */
function TeamAttendance({ mid, isComplex, filter }: { mid: string; isComplex: boolean; filter: React.ReactNode }) {
  const { db, set } = useDb()
  const { user } = useAuth()
  const toast = useToast()
  const [date, setDate] = useState(todayISO())

  const staff = useMemo(() => {
    if (isComplex && !mid) return db.people.filter((p) => p.mosqueId !== 'complex' && p.active)
    return staffOf(db, mid || (user!.mosqueId as string))
  }, [db.people, mid, isComplex, user])

  const rows = db.attendance.filter((a) => a.date === date)
  const get = (pid: string) => rows.find((r) => r.personId === pid)

  const mark = (pid: string, status: AttStatus) => {
    const p = db.people.find((x) => x.id === pid)!
    set((d) => {
      const ex = d.attendance.find((a) => a.personId === pid && a.date === date)
      if (ex) { ex.status = status; ex.source = 'manual' }
      else d.attendance.push({
        id: uid('a'), mosqueId: p.mosqueId as string, personId: pid, date,
        status, source: 'manual',
      })
    })
    toast(`${p.name}: ${ST[status].label}`)
  }

  const markRestAbsent = () => {
    const missing = staff.filter((p) => !get(p.id))
    if (!missing.length) return toast('لا يوجد من لم يُسجَّل له حضور.', 'info')
    if (!confirm(`سيتم احتساب الغياب لـ ${missing.length} من فريق العمل بتاريخ ${date}. متابعة؟`)) return
    set((d) => {
      missing.forEach((p) => d.attendance.push({
        id: uid('a'), mosqueId: p.mosqueId as string, personId: p.id, date,
        status: 'absent', source: 'system',
      }))
    })
    toast(`تم احتساب الغياب لـ ${missing.length} أشخاص`)
  }

  const present = staff.filter((p) => get(p.id)?.status === 'present').length
  const absent = staff.filter((p) => get(p.id)?.status === 'absent').length
  const excused = staff.filter((p) => get(p.id)?.status === 'excused').length

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="فريق العمل" value={staff.length} tone="brand" />
        <Stat label="حاضر" value={present} tone="olive" />
        <Stat label="مستأذن" value={excused} tone="gold" />
        <Stat label="غائب" value={absent} tone={absent ? 'rose' : 'slate'} />
      </div>

      <Card title="كشف الحضور اليومي" subtitle={`${fmtDayName(date)} · ${fmtDate(date)}`} pad={false}
        action={<div className="flex flex-wrap gap-2 items-center">
          {filter}
          <input type="date" className="field !py-2 !text-[13px] w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
          <button className="btn-ghost btn-sm" onClick={markRestAbsent}>احتساب الغياب للباقين</button>
        </div>}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-navy-50">
              <tr>
                <th className="th">العامل</th>
                {isComplex && !mid && <th className="th">المسجد</th>}
                <th className="th">الوظيفة</th>
                <th className="th">وقت التحضير</th>
                <th className="th">المصدر</th>
                <th className="th">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((p) => {
                const r = get(p.id)
                return (
                  <tr key={p.id} className="row">
                    <td className="td font-bold">{p.name}</td>
                    {isComplex && !mid && <td className="td text-[12px] text-ink-500">{mosqueName(db, p.mosqueId)}</td>}
                    <td className="td text-[12px] text-ink-500">{p.jobTitle}</td>
                    <td className="td text-[12px] tabular-nums">{r?.checkInAt ? fmtTime(r.checkInAt) : '—'}</td>
                    <td className="td">
                      {r ? <Badge tone={r.source === 'geo' ? 'info' : 'mute'}>
                        {r.source === 'geo' ? `📍 ذاتي · ${r.distance} م` : r.source === 'manual' ? 'يدوي' : 'آلي'}
                      </Badge> : <span className="text-ink-300">—</span>}
                    </td>
                    <td className="td">
                      <select value={r?.status ?? ''} onChange={(e) => mark(p.id, e.target.value as AttStatus)}
                        className={`rounded-lg px-2.5 py-1.5 text-[12px] font-black border-0 outline-none cursor-pointer
                          ${r?.status === 'present' ? 'bg-navy-100 text-navy-800'
                            : r?.status === 'absent' ? 'bg-orange-100 text-orange-700'
                            : r?.status === 'excused' ? 'bg-orange-100 text-orange-700' : 'bg-line text-ink-500'}`}>
                        <option value="" disabled>— لم يُسجَّل —</option>
                        <option value="present">حاضر</option>
                        <option value="excused">مستأذن</option>
                        <option value="absent">غائب</option>
                      </select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="نسب الحضور خلال ٣٠ يومًا">
        <div className="space-y-3.5">
          {staff.map((p) => {
            const s = attendanceStats(db, p.id, shiftDays(todayISO(), -29), todayISO())
            return (
              <div key={p.id}>
                <div className="flex justify-between text-[12.5px] font-bold mb-1">
                  <span>{p.name}</span>
                  <span className="tabular-nums text-ink-500">
                    {s.rate}% · غياب {s.absent} · استئذان {s.excused}
                  </span>
                </div>
                <Progress value={s.rate} tone={s.rate >= 85 ? 'olive' : s.rate >= 70 ? 'gold' : 'rose'} />
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}

/* ================= طلبات الاستئذان ================= */
function Leaves({ mid, onNew }: { mid: string; onNew: () => void }) {
  const { db, set } = useDb()
  const { user, isDirector } = useAuth()
  const toast = useToast()

  const canDecide = isDirector
  let rows = mid ? db.leaves.filter((l) => l.mosqueId === mid) : db.leaves
  if (user!.role === 'member') rows = rows.filter((l) => l.personId === user!.id)
  rows = [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const decide = (id: string, status: 'approved' | 'rejected') => {
    const l = db.leaves.find((x) => x.id === id)!
    set((d) => {
      const lv = d.leaves.find((x) => x.id === id)!
      lv.status = status; lv.decidedBy = user!.id; lv.decidedAt = todayISO()
      if (status === 'approved') {
        const ex = d.attendance.find((a) => a.personId === lv.personId && a.date === lv.date)
        if (ex) { ex.status = 'excused'; ex.source = 'system' }
        else d.attendance.push({
          id: uid('a'), mosqueId: lv.mosqueId, personId: lv.personId,
          date: lv.date, status: 'excused', source: 'system',
        })
      }
    })
    toast(status === 'approved'
      ? `تم اعتماد استئذان ${personName(db, l.personId)} — يُخصم نصف يوم`
      : 'تم رفض الطلب', status === 'approved' ? 'ok' : 'info')
  }

  return (
    <Card title="طلبات الاستئذان" subtitle="الاستئذان المعتمد يُخصم منه نصف يوم فقط بدل يوم كامل"
      action={<button className="btn-gold btn-sm" onClick={onNew}>＋ طلب استئذان</button>} pad={false}>
      {rows.length === 0 ? <Empty icon="📝" title="لا توجد طلبات" /> : (
        <ul className="divide-y divide-line">
          {rows.map((l) => (
            <li key={l.id} className="px-5 py-4 flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-extrabold text-[14px]">{personName(db, l.personId)}</span>
                  <Badge tone={l.status === 'approved' ? 'ok' : l.status === 'rejected' ? 'bad' : 'warn'}>
                    {l.status === 'approved' ? 'معتمد' : l.status === 'rejected' ? 'مرفوض' : 'بانتظار الاعتماد'}
                  </Badge>
                  <span className="text-[11.5px] text-ink-500">{mosqueName(db, l.mosqueId)}</span>
                </div>
                <p className="text-[12.5px] text-ink-700 mt-1.5 leading-6">{l.reason}</p>
                <p className="text-[11px] text-ink-500 mt-1">
                  تاريخ الاستئذان: {fmtDate(l.date)}
                  {l.decidedAt && ` · القرار بتاريخ ${fmtDate(l.decidedAt)} من ${personName(db, l.decidedBy)}`}
                </p>
              </div>
              {canDecide && l.status === 'pending' && (
                <div className="flex gap-2 no-print">
                  <button className="btn-olive btn-sm" onClick={() => decide(l.id, 'approved')}>اعتماد</button>
                  <button className="btn-ghost btn-sm" onClick={() => decide(l.id, 'rejected')}>رفض</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function LeaveModal({ open, onClose, mosqueId }: { open: boolean; onClose: () => void; mosqueId: string }) {
  const { set } = useDb()
  const { user } = useAuth()
  const toast = useToast()
  const [date, setDate] = useState(todayISO())
  const [reason, setReason] = useState('')

  const save = () => {
    if (!reason.trim()) return toast('اكتب سبب الاستئذان.', 'bad')
    set((d) => d.leaves.push({
      id: uid('l'), mosqueId: mosqueId || (user!.mosqueId as string), personId: user!.id,
      date, reason: reason.trim(), status: 'pending', createdAt: todayISO(),
    }))
    toast('تم رفع الطلب لمدير المجمع للاعتماد')
    setReason(''); onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="طلب استئذان"
      footer={<><button className="btn-primary" onClick={save}>رفع الطلب</button>
        <button className="btn-ghost" onClick={onClose}>إلغاء</button></>}>
      <div className="space-y-4">
        <div className="rounded-xl bg-orange-50 border border-orange-200 px-4 py-3 text-[12.5px] text-orange-700 font-bold leading-6">
          عند اعتماد المدير للطلب يُحتسب لك «استئذان» ويُخصم نصف يوم فقط، وبدون اعتماد يُحتسب غيابًا بيوم كامل.
        </div>
        <Field label="تاريخ الاستئذان" required>
          <input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="السبب" required>
          <textarea className="field leading-7" rows={4} value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="اذكر سبب الاستئذان بإيجاز…" />
        </Field>
      </div>
    </Modal>
  )
}
