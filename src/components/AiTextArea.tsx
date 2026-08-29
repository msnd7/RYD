import { useState } from 'react'
import { polishAsync, type PolishKind } from '../lib/ai'

/**
 * صندوق كتابة مع خيار "تنسيق ذكي".
 * لا يُطبّق أي تعديل إلا بعد موافقتك، ويمكنك دائمًا الإبقاء على نصك الأصلي.
 */
export function AiTextArea({ value, onChange, rows = 5, placeholder, kind = 'message', label }: {
  value: string
  onChange: (v: string) => void
  rows?: number
  placeholder?: string
  kind?: PolishKind
  label?: string
}) {
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState<string | null>(null)
  const [original, setOriginal] = useState<string>('')

  const run = async () => {
    if (!value.trim()) return
    setBusy(true)
    setOriginal(value)
    try { setDraft(await polishAsync(value, kind)) } finally { setBusy(false) }
  }

  return (
    <div>
      {label && <label className="label">{label}</label>}
      <div className="relative">
        <textarea
          className="field resize-y leading-7"
          rows={rows}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-2 mt-2 no-print">
        <button type="button" onClick={run} disabled={busy || !value.trim()} className="btn-ghost btn-sm">
          {busy ? '⏳ جارٍ التنسيق…' : '✨ تنسيق ذكي'}
        </button>
        <span className="text-[11px] text-ink-500">يقترح صياغة أفضل، والقرار لك.</span>
      </div>

      {draft !== null && (
        <div className="mt-3 rounded-2xl border border-navy-200 bg-navy-50/60 p-4 fade-in">
          <div className="flex items-center gap-2 mb-2">
            <span className="chip bg-navy-600 text-white">✨ الصياغة المقترحة</span>
          </div>
          <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-ink-900 bg-surface rounded-xl p-3 border border-navy-100">
            {draft}
          </pre>
          <div className="flex flex-wrap gap-2 mt-3">
            <button type="button" className="btn-primary btn-sm"
              onClick={() => { onChange(draft); setDraft(null) }}>
              ✔ اعتماد الصياغة الجديدة
            </button>
            <button type="button" className="btn-ghost btn-sm"
              onClick={() => { onChange(original); setDraft(null) }}>
              ↩ الإبقاء على كتابتي
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
