import { useRef, useState } from 'react'
import { useDb, uid } from '../store/db'
import { useAuth } from '../store/auth'
import { Card, Modal, Select, Badge, Empty, useToast, Tabs, StatStrip, Progress } from '../components/ui'
import { DocActions } from '../components/DocActions'
import logoSrc from '../assets/logo.png'
import { fmtDate, fmtHijri, monthLabel, todayISO } from '../lib/date'
import { money, num } from '../lib/format'
import { mosqueName, personName, custodyBalance } from '../lib/selectors'
import {
  availableMonths, computeLines, linesFor, totalsOf, monthStatus, MONTH_STATUS, runOf,
  payDateOf, cycleInfo, monthSummary, shiftMonth,
} from '../lib/payroll'
import type { PayrollLine } from '../types'

/* =====================================================================
   مسيّر الرواتب الشهري
   ===================================================================== */
export function Payroll({ mosqueId, isComplex, month, setMonth, onPrint, mosqueFilter }: {
  mosqueId: string; isComplex: boolean
  month: string; setMonth: (m: string) => void
  onPrint: (month: string) => void
  mosqueFilter?: React.ReactNode
}) {
  const { db, set } = useDb()
  const { user, isDirector } = useAuth()
  const toast = useToast()
  const [who, setWho] = useState<'staff' | 'teacher'>('staff')

  const months = availableMonths(db)
  const status = monthStatus(db, month)
  const run = runOf(db, month)
  const lines = linesFor(db, month, mosqueId || undefined)
  const t = totalsOf(lines)
  const rows = lines.filter((l) => l.kind === who)
  const rt = totalsOf(rows)
  const cyc = cycleInfo(db)
  const prevStatus = monthStatus(db, cyc.previous)

  const approve = () => {
    const snapshot = computeLines(db, month)
    if (!snapshot.length) return toast('لا يوجد مستحقون برواتب مسجّلة لهذا الشهر.', 'bad')
    if (!confirm(`اعتماد مسيّر ${monthLabel(month)} لكل مساجد المجمع وتثبيت أرقامه؟\nلن تتغيّر أرقام هذا الشهر بعد الاعتماد حتى لو تغيّر راتب أحد.`)) return
    set((d) => {
      d.payrollRuns = d.payrollRuns.filter((r) => r.month !== month)
      d.payrollRuns.push({ id: uid('pr'), month, lines: snapshot, approvedBy: user!.id, approvedAt: new Date().toISOString() })
    })
    toast(`اعتُمد مسيّر ${monthLabel(month)}`)
  }
  const markPaid = () => {
    if (!confirm(`تأكيد صرف رواتب ${monthLabel(month)}؟`)) return
    set((d) => {
      const r = d.payrollRuns.find((x) => x.month === month)
      if (r) { r.paidAt = todayISO(); r.paidBy = user!.id }
    })
    toast('سُجّل صرف الرواتب — أُقفل الشهر')
  }
  const reopen = () => {
    if (!confirm('إلغاء اعتماد هذا الشهر وإعادته للاحتساب من البيانات الحية؟')) return
    set((d) => { d.payrollRuns = d.payrollRuns.filter((r) => r.month !== month) })
    toast('أُلغي الاعتماد', 'info')
  }

  return (
    <div className="space-y-4">
      {/* دورة الرواتب الحالية */}
      <section className="hero p-5 sm:p-6">
        <div aria-hidden className="absolute -left-10 -top-16 w-56 h-56 rounded-full bg-orange-500/25 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-white/60 tracking-wide">دورة الرواتب الحالية</p>
            <h2 className="font-display text-[22px] sm:text-[26px] font-bold mt-1 text-white">{cyc.label}</h2>
            <p className="text-[12.5px] text-white/75 mt-1">
              يُحتسب من {fmtDate(cyc.start)} إلى {fmtDate(cyc.end)} · يُصرف يوم <b className="text-white">{fmtDate(cyc.payDate)}</b>
            </p>
          </div>
          <div className="text-left">
            <div className="num text-[34px] leading-none">{cyc.daysToPay}</div>
            <div className="text-[11px] font-bold text-white/60 mt-1">يومًا على الصرف</div>
          </div>
        </div>
        <div className="relative mt-4">
          <div className="h-2 rounded-full bg-white/15 overflow-hidden">
            <div className="h-full rounded-full bg-orange-400 transition-all duration-700" style={{ width: `${cyc.pct}%` }} />
          </div>
          <div className="flex justify-between text-[10.5px] font-bold text-white/60 mt-1.5">
            <span>اليوم {cyc.elapsed} من {cyc.total}</span>
            <span>بعد الصرف يبدأ احتساب شهر جديد تلقائيًا</span>
          </div>
        </div>
        {(prevStatus === 'due' || prevStatus === 'approved') && (
          <button onClick={() => setMonth(cyc.previous)}
            className="relative mt-4 w-full sm:w-auto inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 px-3.5 h-10 text-[12.5px] font-bold transition">
            <i className="w-2 h-2 rounded-full bg-orange-400" />
            مسيّر {monthLabel(cyc.previous)}: {MONTH_STATUS[prevStatus].label} ←
          </button>
        )}
      </section>

      {/* اختيار الشهر */}
      <Card pad={false}>
        <div className="px-4 sm:px-5 py-3.5 flex flex-wrap items-center gap-3 border-b border-line">
          <div className="min-w-0 flex-1">
            <p className="eyebrow">الشهر المعروض</p>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <h3 className="sect-title !text-[17px]">{monthLabel(month)}</h3>
              <Badge tone={MONTH_STATUS[status].tone} dot>{MONTH_STATUS[status].label}</Badge>
            </div>
            <p className="text-[11.5px] text-ink-500 mt-1">
              {MONTH_STATUS[status].hint} · تاريخ الصرف {fmtDate(payDateOf(db, month))}
              {run && <> · اعتمده {personName(db, run.approvedBy)} في {fmtDate(run.approvedAt)}</>}
              {run?.paidAt && <> · صُرف في {fmtDate(run.paidAt)}</>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 no-print">
            {mosqueFilter}
            <button className="btn-ghost btn-sm" onClick={() => onPrint(month)}>🖨 مسيّر PDF</button>
            {status === 'due' && <button className="btn-accent btn-sm" onClick={approve}>اعتماد المسيّر وتثبيته</button>}
            {status === 'approved' && <button className="btn-primary btn-sm" onClick={markPaid}>✓ تأكيد صرف الرواتب</button>}
            {(status === 'approved' || status === 'paid') && isDirector && (
              <button className="btn-ghost btn-sm" onClick={reopen}>إلغاء الاعتماد</button>
            )}
          </div>
        </div>
        <div className="px-3 sm:px-4 py-3 flex gap-2 overflow-x-auto no-print">
          {months.map((m) => {
            const st = monthStatus(db, m)
            const on = m === month
            return (
              <button key={m} onClick={() => setMonth(m)}
                className={`shrink-0 rounded-2xl border px-3.5 py-2 text-right transition
                  ${on ? 'bg-navy-700 border-navy-700 text-white shadow-soft' : 'bg-surface border-line hover:border-navy-300'}`}>
                <span className="block text-[12.5px] font-bold whitespace-nowrap">{monthLabel(m)}</span>
                <span className={`flex items-center gap-1 text-[10px] font-bold mt-0.5 whitespace-nowrap ${on ? 'text-white/70' : 'text-ink-400'}`}>
                  <i className={`w-1.5 h-1.5 rounded-full ${st === 'paid' ? 'bg-navy-400' : st === 'open' ? 'bg-navy-300' : 'bg-orange-500'}`} />
                  {MONTH_STATUS[st].label.split(' — ')[0]}
                </span>
              </button>
            )
          })}
        </div>
      </Card>

      <StatStrip items={[
        { label: 'إجمالي الرواتب', value: money(t.gross) },
        { label: 'إجمالي الخصومات', value: money(t.deduction), accent: t.deduction > 0 },
        { label: 'الصافي المستحق', value: money(t.net) },
        { label: 'عدد المستحقين', value: t.count, hint: `${t.staff} موظفًا · ${t.teachers} معلمًا` },
      ]} />

      <Card
        title={`مسيّر رواتب ${monthLabel(month)}`}
        subtitle={`الغياب يُخصم يومًا كاملًا، والاستئذان المعتمد نصف يوم، على أساس ${db.settings.workDaysPerMonth} يوم عمل شهريًا`}
        action={
          <Tabs value={who} onChange={(v) => setWho(v as any)} items={[
            { value: 'staff', label: 'الموظفون', count: t.staff },
            { value: 'teacher', label: 'المعلمون', count: t.teachers },
          ]} />
        }
        pad={false}
      >
        {rows.length === 0 ? (
          <Empty icon="💼"
            title={who === 'staff' ? 'لا يوجد إداريون برواتب في هذا الشهر' : 'لا يوجد معلمون برواتب في هذا الشهر'}
            hint={who === 'staff'
              ? 'سجّل الراتب في بيانات كل موظف ليظهر في المسيّر.'
              : 'سجّل راتب كل معلم أو أنشئ له عقدًا من «عقود المعلمين».'} />
        ) : (
          <>
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-navy-50"><tr>
                  <th className="th">{who === 'staff' ? 'الموظف' : 'المعلم'}</th>
                  {!mosqueId && <th className="th">المسجد</th>}
                  <th className="th">الراتب</th><th className="th">قيمة اليوم</th>
                  <th className="th">غياب</th><th className="th">استئذان</th>
                  {who === 'teacher' && <th className="th">تأخير</th>}
                  <th className="th">أيام الخصم</th><th className="th">الخصم</th><th className="th">الصافي</th>
                </tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.personId} className="row">
                      <td className="td font-bold">{r.name}
                        {r.sub && <span className="block text-[11px] text-ink-400 font-normal">{r.sub}</span>}</td>
                      {!mosqueId && <td className="td text-[12px] text-ink-500">{mosqueName(db, r.mosqueId)}</td>}
                      <td className="td num">{num(r.salary)}</td>
                      <td className="td num text-ink-400">{num(r.dayValue)}</td>
                      <td className="td"><Badge tone={r.absent ? 'bad' : 'mute'}>{r.absent}</Badge></td>
                      <td className="td"><Badge tone={r.excused ? 'warn' : 'mute'}>{r.excused}</Badge></td>
                      {who === 'teacher' && <td className="td"><Badge tone={r.late ? 'warn' : 'mute'}>{r.late}</Badge></td>}
                      <td className="td num">{r.deductionDays}</td>
                      <td className="td num text-orange-700">{num(r.deduction)}</td>
                      <td className="td num text-navy-800">{num(r.net)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-navy-50">
                  <tr>
                    <td className="td font-bold" colSpan={mosqueId ? 1 : 2}>الإجمالي</td>
                    <td className="td num">{num(rt.gross)}</td>
                    <td className="td" colSpan={who === 'teacher' ? 5 : 4} />
                    <td className="td num text-orange-700">{num(rt.deduction)}</td>
                    <td className="td num text-navy-800">{num(rt.net)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <ul className="lg:hidden divide-y divide-line">
              {rows.map((r) => (
                <li key={r.personId} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-[13.5px] truncate">{r.name}</p>
                      <p className="text-[11px] text-ink-400 truncate">{[r.sub, !mosqueId && mosqueName(db, r.mosqueId)].filter(Boolean).join(' · ')}</p>
                    </div>
                    <div className="text-left shrink-0">
                      <p className="num text-[16px] text-navy-800">{money(r.net)}</p>
                      <p className="text-[10px] font-bold text-ink-400">الصافي</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <Badge tone="mute">الراتب {money(r.salary)}</Badge>
                    {r.absent > 0 && <Badge tone="bad">غياب {r.absent}</Badge>}
                    {r.excused > 0 && <Badge tone="warn">استئذان {r.excused}</Badge>}
                    {r.late > 0 && <Badge tone="warn">تأخير {r.late}</Badge>}
                    {r.deduction > 0 && <Badge tone="warn">خصم {money(r.deduction)}</Badge>}
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

/* =====================================================================
   وثيقة مسيّر الرواتب — للتنزيل والطباعة PDF
   ===================================================================== */
export function PayrollSheet({ month, mosqueId }: { month: string; mosqueId?: string }) {
  const { db } = useDb()
  const { user } = useAuth()
  const lines = linesFor(db, month, mosqueId || undefined)
  const status = monthStatus(db, month)
  const run = runOf(db, month)
  const t = totalsOf(lines)
  const mosques = mosqueId ? db.mosques.filter((m) => m.id === mosqueId) : db.mosques

  const Table = ({ rows, title }: { rows: PayrollLine[]; title: string }) => {
    if (!rows.length) return null
    const tt = totalsOf(rows)
    return (
      <div className="mt-3 pdf-keep">
        <p className="text-[12px] font-black text-navy-800 mb-1.5">{title} <span className="text-ink-400 font-bold">({rows.length})</span></p>
        <table className="doc-table">
          <thead><tr>
            <th style={{ width: 26 }}>م</th><th>الاسم</th><th>الراتب</th>
            <th title="غياب · استئذان · تأخير">غ · س · ت</th><th>أيام الخصم</th><th>الخصم</th><th>الصافي</th>
            <th style={{ width: 92 }}>توقيع المستلم</th>
          </tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.personId}>
                <td className="text-center tabular-nums">{i + 1}</td>
                <td><b>{r.name}</b>{r.sub && <span className="block text-[10px] text-ink-500">{r.sub}</span>}</td>
                <td className="tabular-nums">{num(r.salary)}</td>
                <td className="tabular-nums text-center whitespace-nowrap">{r.absent} · {r.excused} · {r.late}</td>
                <td className="tabular-nums text-center">{r.deductionDays}</td>
                <td className="tabular-nums">{num(r.deduction)}</td>
                <td className="tabular-nums font-black">{num(r.net)}</td>
                <td />
              </tr>
            ))}
          </tbody>
          <tfoot><tr>
            <td colSpan={2}>المجموع</td>
            <td className="tabular-nums">{num(tt.gross)}</td>
            <td colSpan={2} />
            <td className="tabular-nums">{num(tt.deduction)}</td>
            <td className="tabular-nums">{num(tt.net)}</td>
            <td />
          </tr></tfoot>
        </table>
      </div>
    )
  }

  return (
    <div className="bg-surface text-ink-900">
      <header className="flex items-center gap-4 border-b-2 border-navy-700 pb-4">
        <img src={logoSrc} alt="" style={{ height: 56 }} className="w-auto object-contain" />
        <div className="flex-1 min-w-0">
          <h2 className="font-display font-black text-[18px] text-navy-800">{db.settings.complexName}</h2>
          <p className="text-[10.5px] text-ink-500">{db.settings.complexSubtitle}</p>
        </div>
        <div className="text-left shrink-0">
          <h3 className="font-extrabold text-[16px] text-navy-900">مسيّر رواتب {monthLabel(month)}</h3>
          <p className="text-[11px] text-ink-500">{mosqueId ? mosqueName(db, mosqueId) : 'جميع مساجد المجمع'}</p>
          <p className="text-[10.5px] text-ink-500 mt-0.5">تاريخ الصرف: {fmtDate(payDateOf(db, month))}</p>
        </div>
      </header>

      <div className="grid grid-cols-4 gap-px bg-line border border-line rounded-lg overflow-hidden mt-4 pdf-keep">
        {[
          ['عدد المستحقين', String(t.count)],
          ['إجمالي الرواتب', money(t.gross)],
          ['إجمالي الخصومات', money(t.deduction)],
          ['الصافي المستحق', money(t.net)],
        ].map(([k, v]) => (
          <div key={k} className="bg-surface px-3 py-2.5">
            <p className="doc-k !text-[10.5px]">{k}</p>
            <p className="num text-[15px] mt-0.5 text-navy-900">{v}</p>
          </div>
        ))}
      </div>
      <p className="text-[10.5px] text-ink-500 mt-2">
        حالة المسيّر: <b className="text-ink-900">{MONTH_STATUS[status].label}</b>
        {run && <> — اعتُمد في {fmtDate(run.approvedAt)}</>}
        {run?.paidAt && <> — صُرف في {fmtDate(run.paidAt)}</>}
        {' · '}الغياب يُخصم يومًا والاستئذان نصف يوم على أساس {db.settings.workDaysPerMonth} يوم عمل.
      </p>

      {lines.length === 0 && <p className="text-center text-ink-400 font-bold py-10">لا يوجد مستحقون برواتب مسجّلة في هذا الشهر.</p>}

      {mosques.map((m) => {
        const ml = lines.filter((l) => l.mosqueId === m.id)
        if (!ml.length) return null
        return (
          <section key={m.id} className="mt-5">
            {!mosqueId && (
              <h4 className="text-[13.5px] font-black text-navy-900 border-r-4 border-orange-500 pr-2">{m.name}</h4>
            )}
            <Table title="الموظفون الإداريون" rows={ml.filter((l) => l.kind === 'staff')} />
            <Table title="المعلمون" rows={ml.filter((l) => l.kind === 'teacher')} />
          </section>
        )
      })}

      <div className="grid grid-cols-3 gap-6 mt-10 pdf-keep">
        {['المُعِد', 'المفوض المالي', 'مدير المجمع'].map((r) => (
          <div key={r} className="text-center">
            <p className="text-[11px] font-bold text-ink-500">{r}</p>
            <div className="h-14 border-b border-ink-300 mt-2" />
            <p className="text-[10px] text-ink-400 mt-1">الاسم والتوقيع</p>
          </div>
        ))}
      </div>

      <footer className="mt-6 pt-2.5 border-t border-line flex justify-between gap-2 text-[9.5px] text-ink-500">
        <span>صادر عن منصة إدارة مجمع رياض القرآن{user ? ` — ${user.name}` : ''}</span>
        <span>{fmtDate(todayISO())} · {fmtHijri(todayISO())}</span>
      </footer>
    </div>
  )
}

export function PayrollPrintModal({ open, onClose, initialMonth, mosqueId, allowMosquePick }: {
  open: boolean; onClose: () => void; initialMonth: string; mosqueId: string; allowMosquePick: boolean
}) {
  const { db } = useDb()
  const [month, setMonth] = useState(initialMonth)
  const [mos, setMos] = useState(mosqueId)
  const [key, setKey] = useState('')
  const sig = `${open}-${initialMonth}-${mosqueId}`
  if (sig !== key) { setKey(sig); setMonth(initialMonth); setMos(mosqueId) }
  const ref = useRef<HTMLDivElement>(null)
  if (!open) return null
  const months = availableMonths(db)
  const scope = mos ? (db.mosques.find((m) => m.id === mos)?.shortName ?? '') : 'المجمع'

  return (
    <Modal open onClose={onClose} title="طباعة مسيّر الرواتب" wide>
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">الشهر</label>
            <Select value={month} onChange={(v) => v && setMonth(v)} placeholder="اختر الشهر…"
              options={months.map((m) => ({ value: m, label: `${monthLabel(m)} — ${MONTH_STATUS[monthStatus(db, m)].label}` }))} />
          </div>
          {allowMosquePick && (
            <div>
              <label className="label">النطاق</label>
              <Select value={mos} onChange={setMos} placeholder="جميع المساجد"
                options={db.mosques.map((m) => ({ value: m.id, label: m.name }))} />
            </div>
          )}
        </div>
        <DocActions target={() => ref.current} filename={`مسير رواتب ${monthLabel(month)} - ${scope}`}
          shareText={`مسيّر رواتب ${monthLabel(month)}`} />
        <div className="rounded-2xl bg-canvas border border-line p-2 sm:p-3 overflow-x-auto">
          <div ref={ref} className="paper p-5 sm:p-7 min-w-[640px]">
            <PayrollSheet month={month} mosqueId={mos || undefined} />
          </div>
        </div>
      </div>
    </Modal>
  )
}

/* =====================================================================
   التقارير الشهرية — أرشيف الأشهر الماضية + تقرير مالي لشهر محدد
   ===================================================================== */
export function MonthlyReports({ mosqueId, month, setMonth, onOpenPayroll, onPrint, mosqueFilter }: {
  mosqueId: string
  month: string; setMonth: (m: string) => void
  onOpenPayroll: (m: string) => void
  onPrint: (m: string) => void
  mosqueFilter?: React.ReactNode
}) {
  const { db } = useDb()
  const months = availableMonths(db)
  const ref = useRef<HTMLDivElement>(null)
  const sum = monthSummary(db, month, mosqueId || undefined)
  const prev = monthSummary(db, shiftMonth(month, -1), mosqueId || undefined)
  const diff = sum.net - prev.net
  const scope = mosqueId ? mosqueName(db, mosqueId) : 'جميع مساجد المجمع'

  const custodies = db.custodies.filter((c) => (!mosqueId || c.mosqueId === mosqueId) &&
    ((c.approvedAt ?? '').startsWith(month) || (c.closedAt ?? '').startsWith(month) ||
      c.expenses.some((e) => e.date.startsWith(month))))

  return (
    <div className="space-y-5">
      <Card title="أرشيف الأشهر" subtitle="كل شهر بأرقامه — المعتمد منها مثبّت لا يتغيّر" pad={false}
        action={mosqueFilter}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead className="bg-navy-50"><tr>
              <th className="th">الشهر</th><th className="th">الحالة</th><th className="th">المستحقون</th>
              <th className="th">الإجمالي</th><th className="th">الخصومات</th><th className="th">الصافي</th>
              <th className="th">منصرف العهد</th><th className="th no-print"></th>
            </tr></thead>
            <tbody>
              {months.map((m) => {
                const s = monthSummary(db, m, mosqueId || undefined)
                return (
                  <tr key={m} className={`row cursor-pointer ${m === month ? '!bg-navy-50' : ''}`} onClick={() => setMonth(m)}>
                    <td className="td font-bold">{monthLabel(m)}
                      <span className="block text-[10.5px] text-ink-400 font-normal">يُصرف {fmtDate(payDateOf(db, m))}</span></td>
                    <td className="td"><Badge tone={MONTH_STATUS[s.status].tone} dot>{MONTH_STATUS[s.status].label.split(' — ')[0]}</Badge></td>
                    <td className="td num">{s.count}</td>
                    <td className="td num">{num(s.gross)}</td>
                    <td className="td num text-orange-700">{num(s.deduction)}</td>
                    <td className="td num text-navy-800">{num(s.net)}</td>
                    <td className="td num">{num(s.spent)}</td>
                    <td className="td no-print">
                      <div className="flex gap-1.5 justify-end">
                        <button className="btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); onOpenPayroll(m) }}>المسيّر</button>
                        <button className="btn-soft btn-sm" onClick={(e) => { e.stopPropagation(); onPrint(m) }}>PDF</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title={`التقرير المالي — ${monthLabel(month)}`} subtitle="اختر أي شهر من الأرشيف لعرض تقريره"
        action={<DocActions compact target={() => ref.current} filename={`التقرير المالي ${monthLabel(month)}`} />}>
        <div className="rounded-2xl bg-canvas border border-line p-2 sm:p-3 overflow-x-auto">
          <div ref={ref} className="paper p-5 sm:p-7 min-w-[640px]">
            <header className="flex items-center gap-4 border-b-2 border-navy-700 pb-4">
              <img src={logoSrc} alt="" style={{ height: 52 }} className="w-auto object-contain" />
              <div className="flex-1 min-w-0">
                <h2 className="font-display font-black text-[18px] text-navy-800">{db.settings.complexName}</h2>
                <p className="text-[10.5px] text-ink-500">{db.settings.complexSubtitle}</p>
              </div>
              <div className="text-left shrink-0">
                <h3 className="font-extrabold text-[15px]">التقرير المالي الشهري</h3>
                <p className="text-[11.5px] text-ink-500">{monthLabel(month)} · {scope}</p>
                <p className="text-[10.5px] text-ink-500">{MONTH_STATUS[sum.status].label}</p>
              </div>
            </header>

            <div className="grid grid-cols-3 gap-px bg-line border border-line rounded-lg overflow-hidden mt-4 pdf-keep">
              {[
                ['صافي الرواتب', money(sum.net), diff ? `${diff > 0 ? '▲' : '▼'} ${money(Math.abs(diff))} عن الشهر السابق` : 'دون تغيّر عن الشهر السابق'],
                ['الخصومات', money(sum.deduction), `${sum.count} مستحقًا`],
                ['إجمالي الرواتب', money(sum.gross), `${sum.staff} موظفًا · ${sum.teachers} معلمًا`],
                ['عهد صُرفت', money(sum.granted), 'اعتُمدت خلال الشهر'],
                ['منصرف بفواتير', money(sum.spent), 'مصروفات مؤرخة بالشهر'],
                ['مبالغ مُعادة', money(sum.returned), 'من عهد أُقفلت خلاله'],
              ].map(([k, v, h]) => (
                <div key={k} className="bg-surface px-3 py-2.5">
                  <p className="doc-k !text-[10.5px]">{k}</p>
                  <p className="num text-[15px] mt-0.5 text-navy-900">{v}</p>
                  <p className="text-[9.5px] text-ink-400 mt-0.5">{h}</p>
                </div>
              ))}
            </div>

            <h4 className="font-extrabold text-[13px] mt-5 mb-2">الرواتب حسب المسجد</h4>
            <table className="doc-table">
              <thead><tr><th>المسجد</th><th>موظفون</th><th>معلمون</th><th>الإجمالي</th><th>الخصومات</th><th>الصافي</th></tr></thead>
              <tbody>
                {(mosqueId ? db.mosques.filter((m) => m.id === mosqueId) : db.mosques).map((m) => {
                  const ls = sum.lines.filter((l) => l.mosqueId === m.id)
                  const tt = totalsOf(ls)
                  return (
                    <tr key={m.id}>
                      <td><b>{m.name}</b></td>
                      <td className="tabular-nums">{tt.staff}</td><td className="tabular-nums">{tt.teachers}</td>
                      <td className="tabular-nums">{num(tt.gross)}</td><td className="tabular-nums">{num(tt.deduction)}</td>
                      <td className="tabular-nums font-black">{num(tt.net)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <h4 className="font-extrabold text-[13px] mt-5 mb-2">حركة العهد خلال الشهر</h4>
            {custodies.length === 0 ? (
              <p className="text-[12px] text-ink-400">لا توجد حركة عهد في هذا الشهر.</p>
            ) : (
              <table className="doc-table">
                <thead><tr><th>الغرض</th>{!mosqueId && <th>المسجد</th>}<th>مقدّم الطلب</th><th>المبلغ</th><th>منصرف الشهر</th><th>المتبقي</th><th>الحالة</th></tr></thead>
                <tbody>
                  {custodies.map((c) => (
                    <tr key={c.id}>
                      <td><b>{c.purpose}</b></td>
                      {!mosqueId && <td>{mosqueName(db, c.mosqueId)}</td>}
                      <td>{personName(db, c.requesterId)}</td>
                      <td className="tabular-nums">{num(c.amount)}</td>
                      <td className="tabular-nums">{num(c.expenses.filter((e) => e.date.startsWith(month)).reduce((s, e) => s + e.amount, 0))}</td>
                      <td className="tabular-nums">{num(custodyBalance(c).remaining)}</td>
                      <td>{c.status === 'closed' ? 'مقفلة' : c.status === 'approved' ? 'مفتوحة' : c.status === 'requested' ? 'بانتظار الاعتماد' : 'مرفوضة'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className="mt-5 pdf-keep">
              <div className="flex justify-between text-[11px] font-bold text-ink-500 mb-1">
                <span>نسبة الخصومات من إجمالي الرواتب</span>
                <span className="num text-ink-900">{sum.gross ? Math.round((sum.deduction / sum.gross) * 100) : 0}%</span>
              </div>
              <Progress value={sum.gross ? (sum.deduction / sum.gross) * 100 : 0} tone="gold" />
            </div>

            <footer className="mt-6 pt-2.5 border-t border-line flex justify-between gap-2 text-[9.5px] text-ink-500">
              <span>صادر عن منصة إدارة مجمع رياض القرآن</span>
              <span>{fmtDate(todayISO())} · {fmtHijri(todayISO())}</span>
            </footer>
          </div>
        </div>
      </Card>
    </div>
  )
}
