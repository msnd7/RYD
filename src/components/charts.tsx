import React from 'react'

/* شريط أعمدة بسيط */
export function BarChart({ data, height = 150, colors }: {
  data: { label: string; values: { key: string; value: number; color: string }[] }[]
  height?: number
  colors?: Record<string, string>
}) {
  const max = Math.max(1, ...data.flatMap((d) => d.values.map((v) => v.value)))
  const dense = data.length > 16
  const barW = dense ? 5 : 10
  return (
    <div className="flex items-end gap-1.5 sm:gap-2 pb-1" style={{ height: height + 30 }}>
      {data.map((d, i) => (
        <div key={i} className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
          <div className="flex items-end gap-[2px] justify-center w-full" style={{ height }}>
            {d.values.map((v, j) => (
              <div key={j} title={`${d.label} — ${v.key}: ${v.value}`}
                className="rounded-t-md bar origin-bottom"
                style={{
                  width: barW, height: `${(v.value / max) * 100}%`,
                  minHeight: v.value ? 4 : 0, background: v.color,
                  animationDelay: `${Math.min(i * 35, 500)}ms`,
                }} />
            ))}
          </div>
          <span className={`font-bold text-ink-500 whitespace-nowrap ${dense ? 'text-[8.5px]' : 'text-[10px]'}`}>{d.label}</span>
        </div>
      ))}
    </div>
  )
}

/* دائرة نسبة */
export function Donut({ value, size = 118, stroke = 13, tone = 'rgb(var(--navy-600))', label, sub }: {
  value: number; size?: number; stroke?: number; tone?: string; label?: string; sub?: string
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const off = c - (Math.min(100, Math.max(0, value)) / 100) * c
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--line))" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tone} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off}
          style={{ transition: 'stroke-dashoffset .9s cubic-bezier(.2,.8,.2,1)' }} />
      </svg>
      <div className="absolute text-center">
        <div className="text-2xl font-extrabold font-display tabular-nums">{label ?? `${value}%`}</div>
        {sub && <div className="text-[10px] font-bold text-ink-500">{sub}</div>}
      </div>
    </div>
  )
}

/* شريط تقسيم أفقي */
export function SplitBar({ parts }: { parts: { value: number; color: string; label: string }[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1
  return (
    <div>
      <div className="flex h-3 rounded-full overflow-hidden bg-line">
        {parts.map((p, i) => (
          <div key={i} title={`${p.label}: ${p.value}`} style={{ width: `${(p.value / total) * 100}%`, background: p.color }}
            className="transition-all duration-700" />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5">
        {parts.map((p, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 text-[11px] font-bold text-ink-700">
            <i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: p.color }} />
            {p.label} <span className="text-ink-500 tabular-nums">{p.value}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

export const C = {
  present: 'rgb(var(--navy-600))', absent: 'rgb(var(--orange-500))', excused: 'rgb(var(--orange-300))',
  done: 'rgb(var(--navy-600))', stuck: 'rgb(var(--orange-500))',
  postponed: 'rgb(var(--orange-300))', pending: 'rgb(var(--navy-300))',
  navy: 'rgb(var(--navy-600))', navyMid: 'rgb(var(--navy-500))', navySoft: 'rgb(var(--navy-300))',
  orange: 'rgb(var(--orange-500))', orangeDeep: 'rgb(var(--orange-600))', orangeSoft: 'rgb(var(--orange-300))',
  // أسماء متوافقة مع الاستخدامات السابقة
  brand: 'rgb(var(--navy-600))', olive: 'rgb(var(--navy-500))',
  gold: 'rgb(var(--orange-300))', rose: 'rgb(var(--orange-500))',
}
