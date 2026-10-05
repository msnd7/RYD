import React from 'react'
import type { DB } from '../types'
import type { AttMetrics, TaskMetrics, PersonScore, CommitteeScore } from '../lib/excellence'
import { Link } from 'react-router-dom'
import { useDb } from '../store/db'
import { useAuth } from '../store/auth'
import { initials, weekPeriod, monthPeriod, scorePeople, scoreCommittees, knightOf } from '../lib/excellence'
import { IconCrown } from './icons'

/** صيغة موحّدة لعرض فرد أو لجنة في لوحات الشرف */
export interface Entry {
  id: string
  name: string
  sub: string
  att: AttMetrics
  tasks: TaskMetrics
  score: number
  qualified: boolean
  /** يُميَّز في القوائم (المستخدم الحالي أو لجنته) */
  mine?: boolean
  /** للجان: عدد الأعضاء */
  members?: number
}

export const fmtScore = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

/* ---------------- حلقة نسبة على خلفية داكنة ---------------- */
export function Ring({ value, size = 64, stroke = 6, color = '#F5B544', track = 'rgba(255,255,255,.14)', children }: {
  value: number; size?: number; stroke?: number; color?: string; track?: string; children?: React.ReactNode
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const off = c - (Math.min(100, Math.max(0, value)) / 100) * c
  return (
    <span className="relative inline-grid place-items-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.2,.8,.2,1)' }} />
      </svg>
      <span className="absolute inset-0 grid place-items-center">{children}</span>
    </span>
  )
}

/** أسماء صريحة ليلتقطها Tailwind عند البناء */
const MEDAL: Record<number, string> = { 1: 'medal-1', 2: 'medal-2', 3: 'medal-3' }

export function Medal({ rank, size = 28 }: { rank: number; size?: number }) {
  return (
    <span className={`medal ${MEDAL[rank] ?? 'medal-n'}`}
      style={{ width: size, height: size, fontSize: size * 0.42 }}>
      {rank}
    </span>
  )
}

export function Avatar({ name, size = 40, ring }: { name: string; size?: number; ring?: string }) {
  return (
    <span className="avatar" style={{
      width: size, height: size, fontSize: size * 0.36,
      boxShadow: ring ? `0 0 0 3px ${ring}` : undefined,
    }}>
      {initials(name)}
    </span>
  )
}

/* ---------------- بطاقة الفارس ---------------- */
export function KnightCard({ title, range, winner, runners, kind, gold }: {
  title: string
  range: string
  winner?: Entry
  runners: Entry[]
  kind: 'person' | 'committee'
  gold?: boolean
}) {
  return (
    <article className={`honor ${gold ? 'honor-gold' : ''} p-5 sm:p-6`}>
      {/* زخرفة نجمية هادئة */}
      <svg aria-hidden viewBox="0 0 200 200" className="absolute -left-10 -bottom-12 w-56 h-56 text-white/[.05]">
        <path fill="currentColor" d="M100 0l22 60 62-18-40 50 40 50-62-18-22 60-22-60-62 18 40-50L16 42l62 18z" />
      </svg>

      <header className="relative flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-9 h-9 rounded-xl grid place-items-center bg-[#F5B544]/15 text-[#FFD27A] shrink-0">
            <IconCrown className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <h3 className="!text-white text-[16px] sm:text-[17px]">{title}</h3>
            <p className="text-[10.5px] font-bold text-white/50 truncate">{range}</p>
          </div>
        </div>
        {winner?.mine && <span className="chip bg-[#F5B544] text-[#4A3000]">أنت!</span>}
      </header>

      {winner ? (
        <div className="relative mt-5">
          <div className="flex items-center gap-4">
            <span className="relative float-y">
              <Avatar name={winner.name} size={72} ring="#F5B544" />
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[#FFD27A] drop-shadow">
                <IconCrown className="w-6 h-6" />
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display font-bold text-[20px] sm:text-[23px] leading-tight truncate">{winner.name}</p>
              <p className="text-[12px] text-white/60 font-bold mt-1 truncate">{winner.sub}</p>
            </div>
            <Ring value={winner.score} size={74} stroke={7}>
              <span className="text-center leading-none">
                <span className="block num text-[19px]">{fmtScore(winner.score)}</span>
                <span className="block text-[8.5px] font-bold text-white/55 mt-1">الدرجة</span>
              </span>
            </Ring>
          </div>

          <dl className="grid grid-cols-3 gap-2 mt-5">
            {[
              ['الحضور', winner.att.total ? `${winner.att.rate}%` : '—', winner.att.total ? `${winner.att.present} من ${winner.att.total} يوم` : 'لا سجلات'],
              ['إنجاز المهام', winner.tasks.total ? `${winner.tasks.rate}%` : '—', winner.tasks.total ? `${winner.tasks.done} من ${winner.tasks.total}` : 'لا مهام'],
              ['في الموعد', winner.tasks.done ? `${winner.tasks.onTimeRate}%` : '—', kind === 'committee' ? `${winner.members ?? 0} أعضاء` : 'من المنجز'],
            ].map(([k, v, h]) => (
              <div key={k} className="rounded-2xl bg-white/[.07] border border-white/10 px-3 py-2.5 min-w-0">
                <dt className="text-[10.5px] font-bold text-white/55 truncate">{k}</dt>
                <dd className="num text-[18px] mt-1">{v}</dd>
                <dd className="text-[9.5px] font-bold text-white/45 mt-0.5 truncate">{h}</dd>
              </div>
            ))}
          </dl>

          {runners.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap gap-2">
              {runners.map((r, i) => (
                <span key={r.id} className="inline-flex items-center gap-2 rounded-full bg-white/[.07] border border-white/10 pl-3 pr-1 py-1 min-w-0 max-w-full">
                  <Medal rank={i + 2} size={22} />
                  <span className="text-[12px] font-bold truncate">{r.name}</span>
                  <span className="num text-[11px] text-white/55">{fmtScore(r.score)}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="relative mt-6 rounded-2xl border border-dashed border-white/20 px-4 py-8 text-center">
          <p className="font-bold text-[14px]">لم يُحسم اللقب بعد</p>
          <p className="text-[12px] text-white/55 mt-1.5 leading-6">
            يظهر {kind === 'person' ? 'الفارس' : 'اللجنة المتميزة'} تلقائيًا مع أول سجلات حضور وإنجاز في هذه الفترة.
          </p>
        </div>
      )}
    </article>
  )
}

/* ---------------- قائمة ترتيب ---------------- */
export function Leaderboard({ title, subtitle, icon, rows, metric, empty }: {
  title: string
  subtitle?: string
  icon: React.ReactNode
  rows: Entry[]
  metric: 'att' | 'tasks'
  empty: string
}) {
  return (
    <section className="card overflow-hidden">
      <header className="flex items-center gap-3 px-4 sm:px-5 pt-4 pb-3.5 border-b border-line/70">
        <span className="w-9 h-9 rounded-xl grid place-items-center bg-navy-50 text-navy-700 shrink-0">{icon}</span>
        <div className="min-w-0">
          <h3 className="sect-title">{title}</h3>
          {subtitle && <p className="text-[11px] font-bold text-ink-400 mt-0.5">{subtitle}</p>}
        </div>
      </header>
      {rows.length === 0 ? (
        <p className="text-center text-[12.5px] font-bold text-ink-400 py-10 px-4">{empty}</p>
      ) : (
        <ol className="divide-y divide-line/70">
          {rows.map((r, i) => {
            const v = metric === 'att' ? r.att.rate : r.tasks.rate
            const hint = metric === 'att'
              ? `${r.att.present} حضور · ${r.att.absent} غياب · ${r.att.excused} استئذان`
              : `${r.tasks.done} منجزة من ${r.tasks.total} · ${r.tasks.onTimeRate}% في الموعد`
            return (
              <li key={r.id} className={`flex items-center gap-3 px-4 sm:px-5 py-3 ${r.mine ? 'bg-orange-50/70' : ''}`}>
                <Medal rank={i + 1} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[13.5px] truncate">{r.name}</span>
                    {r.mine && <span className="chip !py-0.5 bg-orange-500 text-white">أنت</span>}
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-line overflow-hidden">
                    <div className={`h-full rounded-full ${i === 0 ? 'bg-orange-500' : 'bg-navy-600'} transition-all duration-700`}
                      style={{ width: `${v}%` }} />
                  </div>
                  <p className="text-[10.5px] font-bold text-ink-400 mt-1 truncate">{r.sub} · {hint}</p>
                </div>
                <span className="num text-[17px] text-ink-900 w-12 text-left">{v}%</span>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

/* ---------------- أزرار مجزّأة ---------------- */
export function Seg<T extends string>({ value, onChange, items, className = '' }: {
  value: T; onChange: (v: T) => void; items: { value: T; label: string }[]; className?: string
}) {
  return (
    <div className={`seg ${className}`} role="tablist">
      {items.map((it) => (
        <button key={it.value} role="tab" aria-selected={value === it.value}
          onClick={() => onChange(it.value)} className={`seg-btn ${value === it.value ? 'seg-on' : ''}`}>
          {it.label}
        </button>
      ))}
    </div>
  )
}

/* ---------------- تحويل النتائج إلى صيغة العرض ---------------- */

export function personEntries(db: DB, rows: PersonScore[], opts: { showMosque: boolean; meId?: string }): Entry[] {
  return rows.map((r) => {
    const cm = r.committeeIds.map((id) => db.committees.find((c) => c.id === id)?.name).filter(Boolean)
    const mosque = db.mosques.find((m) => m.id === r.mosqueId)?.shortName
    const sub = [r.person.jobTitle || cm[0] || 'فريق العمل', opts.showMosque ? mosque : ''].filter(Boolean).join(' · ')
    return {
      id: r.id, name: r.person.name, sub,
      att: r.att, tasks: r.tasks, score: r.score, qualified: r.qualified,
      mine: !!opts.meId && r.id === opts.meId,
    }
  })
}

export function committeeEntries(db: DB, rows: CommitteeScore[], opts: { showMosque: boolean; mine?: string[] }): Entry[] {
  return rows.map((r) => {
    const mosque = db.mosques.find((m) => m.id === r.mosqueId)?.shortName
    const leader = db.people.find((p) => p.id === r.committee.leaderId)?.name
    const sub = [opts.showMosque ? mosque : '', leader ? `القائد: ${leader.split(' ').slice(0, 2).join(' ')}` : `${r.members.length} أعضاء`]
      .filter(Boolean).join(' · ')
    return {
      id: r.id, name: r.committee.name, sub,
      att: r.att, tasks: r.tasks, score: r.score, qualified: r.qualified,
      mine: !!opts.mine?.includes(r.id), members: r.members.length,
    }
  })
}

/* ---------------- بطاقة مختصرة للوحات الرئيسية ---------------- */

export function HonorsTeaser({ mosqueId, to }: { mosqueId: string | 'all'; to: string }) {
  const { db } = useDb()
  const { user } = useAuth()
  const showMosque = mosqueId === 'all'
  const week = weekPeriod(0)
  const month = monthPeriod(0)
  const pw = knightOf(personEntries(db, scorePeople(db, week, mosqueId), { showMosque, meId: user?.id }))
  const pm = knightOf(personEntries(db, scorePeople(db, month, mosqueId), { showMosque, meId: user?.id }))
  const cm = knightOf(committeeEntries(db, scoreCommittees(db, month, mosqueId), { showMosque, mine: user?.committeeIds }))

  const cells: { k: string; e?: Entry; committee?: boolean }[] = [
    { k: 'فارس الأسبوع', e: pw },
    { k: 'فارس الشهر', e: pm },
    { k: 'لجنة الشهر', e: cm, committee: true },
  ]

  return (
    <section className="honor p-4 sm:p-5">
      <div className="relative flex items-center justify-between gap-3 mb-3.5">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl grid place-items-center bg-[#F5B544]/15 text-[#FFD27A]"><IconCrown className="w-5 h-5" /></span>
          <div>
            <h3 className="!text-white text-[15px]">لوحة الشرف</h3>
            <p className="text-[10.5px] font-bold text-white/50">المتميزون في الحضور والإنجاز</p>
          </div>
        </div>
        <Link to={to} className="rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 px-3 h-9 inline-flex items-center text-[12px] font-bold transition">
          عرض اللوحة ←
        </Link>
      </div>
      <div className="relative grid sm:grid-cols-3 gap-2.5">
        {cells.map((c) => (
          <div key={c.k} className="rounded-2xl bg-white/[.07] border border-white/10 p-3 flex items-center gap-3 min-w-0">
            {c.e && !c.committee ? <Avatar name={c.e.name} size={40} ring="#F5B544" />
              : <span className="w-10 h-10 rounded-full grid place-items-center bg-white/10 text-[#FFD27A] shrink-0"><IconCrown className="w-5 h-5" /></span>}
            <div className="min-w-0 flex-1">
              <p className="text-[10.5px] font-bold text-[#FFD27A]">{c.k}</p>
              <p className="font-bold text-[13.5px] truncate">{c.e ? c.e.name : 'لم يُحسم بعد'}</p>
              <p className="text-[10.5px] font-bold text-white/50 truncate">
                {c.e ? `الدرجة ${fmtScore(c.e.score)} · حضور ${c.e.att.total ? `${c.e.att.rate}%` : '—'}` : 'بانتظار سجلات الفترة'}
              </p>
            </div>
            {c.e?.mine && <span className="chip !py-0.5 bg-[#F5B544] text-[#4A3000]">أنت</span>}
          </div>
        ))}
      </div>
    </section>
  )
}
