import React, { useEffect, useRef, useState } from 'react'
import type { UploadedFile } from '../types'
import { useDb } from '../store/db'
import { uploadFile } from '../lib/api'
import { fileSrc, isImage } from '../lib/files'

/* ---------------- Card ---------------- */
export function Card({ title, subtitle, action, children, className = '', pad = true }: {
  title?: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode
  children?: React.ReactNode; className?: string; pad?: boolean
}) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-3 px-4 sm:px-5 pt-4 pb-3 border-b border-line">
          <div>
            {title && <h3 className="sect-title">{title}</h3>}
            {subtitle && <p className="muted mt-0.5">{subtitle}</p>}
          </div>
          {action && <div className="no-print flex flex-wrap items-center gap-2 min-w-0 max-w-full">{action}</div>}
        </header>
      )}
      <div className={pad ? 'p-4 sm:p-5' : ''}>{children}</div>
    </section>
  )
}

/* ---------------- Stat ---------------- */
const TONES = {
  brand: 'from-navy-700 to-navy-900 text-white',
  olive: 'from-navy-500 to-navy-700 text-white',
  gold:  'from-orange-400 to-orange-600 text-white',
  rose:  'from-orange-600 to-orange-800 text-white',
  slate: 'from-white to-white text-ink-900 border border-line',
} as const

export function Stat({ label, value, hint, tone = 'slate', icon }: {
  label: string; value: React.ReactNode; hint?: string
  tone?: keyof typeof TONES; icon?: React.ReactNode
}) {
  const light = tone !== 'slate'
  return (
    <div className={`rounded-2xl bg-gradient-to-bl ${TONES[tone]} p-4 shadow-soft`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[12px] font-bold ${light ? 'text-white/80' : 'text-ink-500'}`}>{label}</span>
        {icon && <span className={light ? 'text-white/70' : 'text-ink-300'}>{icon}</span>}
      </div>
      <div className={`mt-1.5 font-extrabold font-display tabular-nums leading-tight
        ${String(value).length > 11 ? 'text-lg' : String(value).length > 7 ? 'text-2xl' : 'text-3xl'}`}>{value}</div>
      {hint && <div className={`mt-1 text-[11px] font-bold ${light ? 'text-white/70' : 'text-ink-500'}`}>{hint}</div>}
    </div>
  )
}

/* ---------------- Badge ---------------- */
export const BADGE: Record<string, string> = {
  ok: 'bg-navy-100 text-navy-800',
  info: 'bg-navy-50 text-navy-700',
  warn: 'bg-orange-100 text-orange-700',
  bad: 'bg-orange-500 text-white',
  mute: 'bg-navy-50 text-ink-500',
  purple: 'bg-navy-800 text-white',
}

export function Badge({ tone = 'mute', children, dot }: {
  tone?: keyof typeof BADGE | string; children: React.ReactNode; dot?: boolean
}) {
  return (
    <span className={`chip ${BADGE[tone] ?? BADGE.mute}`}>
      {dot && <i className="w-1.5 h-1.5 rounded-full bg-current inline-block" />}
      {children}
    </span>
  )
}


/* ---------------- قائمة إجراءات منسدلة ---------------- */
export function Menu({ items, label = 'إجراءات', align = 'start' }: {
  items: ({ label: string; onClick: () => void; icon?: string; danger?: boolean } | 'sep')[]
  label?: string
  align?: 'start' | 'end'
}) {
  const [open, setOpen] = useState(false)
  const real = items.filter((i) => i !== 'sep') as Exclude<(typeof items)[number], 'sep'>[]
  if (real.length === 0) return null

  return (
    <div className="relative no-print">
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o) }}
        aria-label={label} title={label}
        className={`inline-grid place-items-center w-9 h-9 rounded-lg border transition
          ${open ? 'bg-navy-700 text-white border-navy-700' : 'bg-white text-ink-500 border-line hover:bg-navy-50 hover:text-navy-700'}`}
      >
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="currentColor">
          <circle cx="12" cy="5" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="12" cy="19" r="1.7" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={(e) => { e.stopPropagation(); setOpen(false) }} />
          <div className={`menu ${align === 'start' ? 'left-0' : 'right-0'}`}>
            {items.map((it, i) =>
              it === 'sep' ? <hr key={i} className="menu-sep" /> : (
                <button key={i} className={it.danger ? 'menu-item-danger' : 'menu-item'}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(false); it.onClick() }}>
                  {it.icon && <span className="w-4 text-center">{it.icon}</span>}
                  <span className="flex-1 text-right">{it.label}</span>
                </button>
              ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ---------------- شريط إحصاءات هادئ ---------------- */
const COLS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-2 md:grid-cols-4',
  5: 'grid-cols-2 md:grid-cols-5',
  6: 'grid-cols-3 md:grid-cols-6',
}

export function StatStrip({ items, className = '' }: {
  items: { label: string; value: React.ReactNode; hint?: string; accent?: boolean }[]
  className?: string
}) {
  return (
    <div className={`card overflow-hidden ${className}`}>
      <div className={`stat-grid grid gap-px bg-line ${COLS[Math.min(items.length, 6)] ?? COLS[4]}`}>
        {items.map((it, i) => (
          <div key={i} className={`stat-cell ${it.accent ? 'bg-orange-50' : 'bg-white'}`}>
            <div className="stat-k">{it.label}</div>
            <div className={`stat-v ${it.accent ? 'text-orange-700' : ''}`}>{it.value}</div>
            {it.hint && <div className="stat-h">{it.hint}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---------------- Modal ---------------- */
export function Modal({ open, onClose, title, children, footer, wide }: {
  open: boolean; onClose: () => void; title: string
  children: React.ReactNode; footer?: React.ReactNode; wide?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', h)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', h); document.body.style.overflow = '' }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center no-print">
      <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`relative w-full ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'} max-h-[92vh] overflow-y-auto
        bg-white rounded-t-3xl sm:rounded-3xl shadow-lift pop-in`}>
        <header className="sticky top-0 bg-white/95 backdrop-blur px-5 py-4 border-b border-line flex items-center justify-between z-10">
          <h3 className="text-lg font-extrabold">{title}</h3>
          <button onClick={onClose} className="w-9 h-9 grid place-items-center rounded-xl hover:bg-line text-ink-500" aria-label="إغلاق">✕</button>
        </header>
        <div className="p-5">{children}</div>
        {footer && <footer className="sticky bottom-0 bg-white/95 backdrop-blur px-5 py-4 border-t border-line flex gap-2 justify-start">{footer}</footer>}
      </div>
    </div>
  )
}

/* ---------------- Form fields ---------------- */
export function Field({ label, children, hint, required }: {
  label: string; children: React.ReactNode; hint?: string; required?: boolean
}) {
  return (
    <div>
      <label className="label">{label} {required && <span className="text-orange-500">*</span>}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-ink-500">{hint}</p>}
    </div>
  )
}

export function Select({ value, onChange, options, placeholder = 'اختر…', className = '' }: {
  value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]; placeholder?: string; className?: string
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`field ${className}`}>
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

/* ---------------- Empty ---------------- */
export function Empty({ icon = '📋', title, hint, action }: {
  icon?: string; title: string; hint?: string; action?: React.ReactNode
}) {
  return (
    <div className="text-center py-12 px-4">
      <div className="text-4xl mb-3 opacity-70">{icon}</div>
      <p className="font-bold text-ink-700">{title}</p>
      {hint && <p className="muted mt-1 max-w-sm mx-auto">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

/* ---------------- Tabs ---------------- */
export function Tabs({ value, onChange, items }: {
  value: string; onChange: (v: string) => void; items: { value: string; label: string; count?: number }[]
}) {
  return (
    <div className="flex gap-1 p-1 bg-line/80 rounded-2xl overflow-x-auto no-print">
      {items.map((it) => (
        <button key={it.value} onClick={() => onChange(it.value)}
          className={`tab ${value === it.value ? 'tab-on' : ''}`}>
          {it.label}
          {it.count !== undefined && (
            <span className={`mr-1.5 text-[10px] px-1.5 py-0.5 rounded-md ${value === it.value ? 'bg-navy-100 text-navy-700' : 'bg-white/70 text-ink-500'}`}>
              {it.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

/* ---------------- Toast ---------------- */
type Toast = { id: number; text: string; tone: 'ok' | 'bad' | 'info' }
const ToastCtx = React.createContext<(text: string, tone?: Toast['tone']) => void>(() => {})
export const useToast = () => React.useContext(ToastCtx)

export function ToastHost({ children }: { children: React.ReactNode }) {
  const [list, setList] = useState<Toast[]>([])
  const push = (text: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random()
    setList((l) => [...l, { id, text, tone }])
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 3200)
  }
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 items-center no-print pointer-events-none">
        {list.map((t) => (
          <div key={t.id} className={`pop-in px-4 py-2.5 rounded-xl shadow-lift text-sm font-bold text-white
            ${t.tone === 'ok' ? 'bg-navy-700' : t.tone === 'bad' ? 'bg-orange-600' : 'bg-navy-700'}`}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

/* ---------------- Confirm ---------------- */
export function useConfirm() {
  return (msg: string) => window.confirm(msg)
}

/* ---------------- Progress ---------------- */
export function Progress({ value, tone = 'brand' }: { value: number; tone?: 'brand' | 'olive' | 'gold' | 'rose' }) {
  const bg = { brand: 'bg-navy-700', olive: 'bg-navy-500', gold: 'bg-orange-400', rose: 'bg-orange-600' }[tone]
  return (
    <div className="h-2 rounded-full bg-line overflow-hidden">
      <div className={`h-full rounded-full ${bg} transition-all duration-700`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  )
}

/* ---------------- File upload ---------------- */
export function FileDrop({ onFiles, accept = 'image/*,.pdf,.doc,.docx,.xls,.xlsx', multiple = true, label = 'إرفاق صورة أو ملف' }: {
  onFiles: (files: UploadedFile[]) => void
  accept?: string; multiple?: boolean; label?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const { mode } = useDb()

  const handle = async (fl: FileList | null) => {
    if (!fl?.length) return
    setBusy(true)
    const out: UploadedFile[] = []
    try {
      for (const f of Array.from(fl)) {
        if (f.size > 3 * 1024 * 1024) { alert(`الملف "${f.name}" أكبر من ٣ ميجابايت. اضغط الصورة أو ارفع نسخة أصغر.`); continue }
        const dataUrl = await new Promise<string>((res, rej) => {
          const r = new FileReader()
          r.onload = () => res(r.result as string)
          r.onerror = rej
          r.readAsDataURL(f)
        })
        if (mode === 'remote') {
          // في الوضع المشترك يُرفع الملف للخادم ويُحفظ رابطه فقط
          try {
            const up = await uploadFile({ name: f.name, type: f.type, dataUrl })
            out.push({ name: up.name, type: up.type, size: up.size, url: up.url })
            continue
          } catch {
            alert(`تعذّر رفع "${f.name}" إلى الخادم. تحقّق من الاتصال وأعد المحاولة.`)
            continue
          }
        }
        out.push({ name: f.name, type: f.type, size: f.size, dataUrl })
      }
    } finally {
      setBusy(false)
      if (ref.current) ref.current.value = ''
    }
    if (out.length) onFiles(out)
  }

  return (
    <div>
      <input ref={ref} type="file" accept={accept} multiple={multiple} className="hidden"
        onChange={(e) => handle(e.target.files)} />
      <button type="button" onClick={() => ref.current?.click()} disabled={busy}
        className="w-full rounded-xl border-2 border-dashed border-ink-300 hover:border-navy-400 hover:bg-navy-50/40
          px-4 py-5 text-sm font-bold text-ink-500 transition">
        {busy ? 'جارٍ الرفع…' : `📎 ${label}`}
      </button>
    </div>
  )
}

export function FileChips({ files, onRemove }: {
  files: UploadedFile[]
  onRemove?: (i: number) => void
}) {
  if (!files.length) return null
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {files.map((f, i) => (
        <span key={i} className="chip bg-navy-50 text-ink-700 max-w-[220px]">
          {isImage(f)
            ? <img src={fileSrc(f)} className="w-6 h-6 rounded object-cover" alt="" />
            : <span>📄</span>}
          <a href={fileSrc(f)} download={f.name} target="_blank" rel="noreferrer"
            className="truncate hover:underline">{f.name}</a>
          {onRemove && <button onClick={() => onRemove(i)} className="text-orange-600 font-black no-print">×</button>}
        </span>
      ))}
    </div>
  )
}

/* ---------------- Print button ---------------- */
export function PrintBar({ title, children }: { title?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 no-print">
      {children}
      <button className="btn-primary btn-sm" onClick={() => window.print()}>🖨️ طباعة / حفظ PDF</button>
      {title && (
        <button className="btn-ghost btn-sm" onClick={async () => {
          const url = location.href
          if (navigator.share) { try { await navigator.share({ title, url }) } catch { /* cancelled */ } }
          else { await navigator.clipboard.writeText(url); alert('تم نسخ رابط التقرير.') }
        }}>🔗 مشاركة</button>
      )}
    </div>
  )
}
