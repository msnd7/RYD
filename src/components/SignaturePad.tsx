import { useEffect, useRef, useState } from 'react'

/** لوحة توقيع بالرسم على الشاشة (تعمل باللمس والفأرة) */
export function SignaturePad({ onSave, initial }: {
  onSave: (dataUrl: string) => void
  initial?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [empty, setEmpty] = useState(!initial)
  const drawing = useRef(false)

  useEffect(() => {
    const cv = ref.current!
    const dpr = window.devicePixelRatio || 1
    const w = cv.clientWidth, h = 170
    cv.width = w * dpr; cv.height = h * dpr
    const ctx = cv.getContext('2d')!
    ctx.scale(dpr, dpr)
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#0d3f6b'
    if (initial) {
      const img = new Image()
      img.onload = () => ctx.drawImage(img, 0, 0, w, h)
      img.src = initial
    }
  }, [initial])

  const pos = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const down = (e: React.PointerEvent) => {
    e.preventDefault()
    drawing.current = true
    setEmpty(false)
    const ctx = ref.current!.getContext('2d')!
    const p = pos(e)
    ctx.beginPath(); ctx.moveTo(p.x, p.y)
    ref.current!.setPointerCapture(e.pointerId)
  }
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return
    const ctx = ref.current!.getContext('2d')!
    const p = pos(e)
    ctx.lineTo(p.x, p.y); ctx.stroke()
  }
  const up = () => { drawing.current = false }

  const clear = () => {
    const cv = ref.current!
    cv.getContext('2d')!.clearRect(0, 0, cv.width, cv.height)
    setEmpty(true)
  }

  return (
    <div>
      <div className="rounded-2xl border-2 border-dashed border-ink-300 bg-white overflow-hidden relative">
        <canvas ref={ref} style={{ height: 170, width: '100%', touchAction: 'none' }}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} />
        {empty && (
          <span className="absolute inset-0 grid place-items-center pointer-events-none text-ink-300 font-bold text-sm">
            ✍️ وقّع هنا بإصبعك أو بالفأرة
          </span>
        )}
        <div className="absolute bottom-2 left-3 right-3 h-px bg-line pointer-events-none" />
      </div>
      <div className="flex gap-2 mt-3 no-print">
        <button type="button" className="btn-primary btn-sm" disabled={empty}
          onClick={() => onSave(ref.current!.toDataURL('image/png'))}>
          ✔ اعتماد التوقيع
        </button>
        <button type="button" className="btn-ghost btn-sm" onClick={clear}>مسح</button>
      </div>
    </div>
  )
}
