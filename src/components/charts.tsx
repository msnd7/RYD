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

/* ---------------- منحنى اتجاه بنسب مئوية (محور واحد ٠–١٠٠) ---------------- */
export function TrendChart({ points, series, height = 220 }: {
  points: { label: string; hint?: string; values: (number | null)[] }[]
  series: { name: string; color: string }[]
  height?: number
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [w, setW] = React.useState(600)
  const [hover, setHover] = React.useState<number | null>(null)

  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const padL = 34, padR = 12, padT = 12, padB = 26
  const iw = w - padL - padR, ih = height - padT - padB
  const n = points.length
  // الاتجاه من اليمين إلى اليسار: الأقدم يمينًا والأحدث يسارًا
  const x = (i: number) => padL + (n <= 1 ? iw / 2 : iw - (i / (n - 1)) * iw)
  const y = (v: number) => padT + ih - (v / 100) * ih

  const path = (si: number) => {
    let d = ''
    points.forEach((p, i) => {
      const v = p.values[si]
      if (v == null) return
      d += `${d ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`
    })
    return d
  }

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - r.left
    let best = 0, dist = Infinity
    for (let i = 0; i < n; i++) { const d = Math.abs(x(i) - px); if (d < dist) { dist = d; best = i } }
    setHover(best)
  }

  return (
    <div ref={ref} className="relative select-none" dir="ltr">
      <svg width={w} height={height} onPointerMove={onMove} onPointerLeave={() => setHover(null)} className="block touch-none">
        {[0, 25, 50, 75, 100].map((g) => (
          <g key={g}>
            <line x1={padL} x2={w - padR} y1={y(g)} y2={y(g)} stroke="rgb(var(--line))" strokeWidth={1}
              strokeDasharray={g === 0 ? undefined : '3 4'} />
            <text x={padL - 8} y={y(g) + 3.5} textAnchor="end" fontSize="10" fontWeight="700" fill="rgb(var(--ink-400))">{g}%</text>
          </g>
        ))}
        {points.map((p, i) => (
          <text key={i} x={x(i)} y={height - 8} textAnchor="middle" fontSize="10" fontWeight="700"
            fill={hover === i ? 'rgb(var(--ink-900))' : 'rgb(var(--ink-400))'}>{p.label}</text>
        ))}
        {hover != null && (
          <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + ih} stroke="rgb(var(--ink-300))" strokeWidth={1} />
        )}
        {series.map((s, si) => (
          <g key={s.name}>
            <path d={path(si)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {points.map((p, i) => p.values[si] == null ? null : (
              <circle key={i} cx={x(i)} cy={y(p.values[si]!)} r={hover === i ? 5 : 3.5}
                fill={s.color} stroke="rgb(var(--surface))" strokeWidth={2} />
            ))}
          </g>
        ))}
      </svg>
      {hover != null && (
        <div className="pointer-events-none absolute top-1 z-10 min-w-[150px] rounded-xl border border-line bg-surface shadow-lift px-3 py-2 text-right"
          dir="rtl" style={{ left: Math.min(Math.max(8, x(hover) - 75), w - 160) }}>
          <p className="text-[11px] font-bold text-ink-500 mb-1">{points[hover].hint ?? points[hover].label}</p>
          {series.map((s, si) => (
            <p key={s.name} className="flex items-center gap-2 text-[12px] font-bold text-ink-900">
              <i className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />
              <span className="flex-1">{s.name}</span>
              <span className="tabular-nums">{points[hover].values[si] == null ? '—' : `${points[hover].values[si]}%`}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------------- أعمدة أفقية مقارنة (لكل صف قيمة أو أكثر من ٠–١٠٠) ---------------- */
export function HBars({ rows, series }: {
  rows: { label: string; values: number[] }[]
  series: { name: string; color: string }[]
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {series.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1.5 text-[11px] font-bold text-ink-700">
            <i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: s.color }} />{s.name}
          </span>
        ))}
      </div>
      {rows.map((r) => (
        <div key={r.label}>
          <p className="text-[12.5px] font-bold text-ink-900 mb-1.5">{r.label}</p>
          <div className="space-y-[3px]">
            {r.values.map((v, i) => (
              <div key={i} className="flex items-center gap-2" title={`${r.label} — ${series[i].name}: ${v}%`}>
                <div className="flex-1 h-2.5 rounded-full bg-line/70 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${v}%`, background: series[i].color }} />
                </div>
                <span className="w-10 text-left text-[11px] font-bold tabular-nums text-ink-700">{v}%</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
