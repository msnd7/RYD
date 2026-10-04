import { useState } from 'react'
import { useToast } from './ui'
import { renderPdf, downloadBlob, sharePdf, canShareFiles, safeName } from '../lib/pdf'

/**
 * أزرار الوثيقة: تنزيل PDF · مشاركة PDF (واتساب وغيره) · طباعة.
 * كلها تولّد ملف PDF حقيقيًا من الوثيقة المعروضة، فيخرج الملف المطبوع
 * والمُرسَل والمحفوظ بالشكل نفسه تمامًا.
 */
export function DocActions({ target, filename, shareText, onShared, compact }: {
  /** يرجع عنصر الوثيقة المراد تحويلها */
  target: () => HTMLElement | null
  filename: string
  shareText?: string
  onShared?: (how: 'shared' | 'downloaded') => void
  compact?: boolean
}) {
  const toast = useToast()
  const [busy, setBusy] = useState<'' | 'dl' | 'share' | 'print'>('')
  const name = safeName(filename.endsWith('.pdf') ? filename : `${filename}.pdf`)

  const build = async () => {
    const el = target()
    if (!el) throw new Error('no-target')
    return renderPdf(el)
  }

  const run = async (kind: 'dl' | 'share' | 'print') => {
    if (busy) return
    // نافذة الطباعة تُفتح فورًا قبل التوليد، حتى لا يحجبها المتصفح
    const win = kind === 'print' ? window.open('', '_blank') : null
    if (win) win.document.write('<p style="font-family:sans-serif;text-align:center;margin-top:40vh" dir="rtl">جارٍ تجهيز الملف…</p>')
    setBusy(kind)
    try {
      const blob = await build()
      if (kind === 'dl') {
        downloadBlob(blob, name)
        toast('تم تنزيل الملف')
        onShared?.('downloaded')
      } else if (kind === 'share') {
        const r = await sharePdf(blob, name, shareText)
        if (r === 'shared') { toast('تمت المشاركة'); onShared?.('shared') }
        else if (r === 'downloaded') { toast('نُزّل الملف — أرفقه في المحادثة', 'info'); onShared?.('downloaded') }
      } else {
        const url = URL.createObjectURL(blob)
        if (win) win.location.href = url
        else downloadBlob(blob, name)
        setTimeout(() => URL.revokeObjectURL(url), 60_000)
      }
    } catch {
      win?.close()
      toast('تعذّر تجهيز ملف PDF. حاول مرة أخرى.', 'bad')
    } finally {
      setBusy('')
    }
  }

  const sz = compact ? 'btn-sm' : ''
  return (
    <div className="flex flex-wrap items-center gap-2 no-print">
      <button className={`btn-primary ${sz}`} onClick={() => run('dl')} disabled={!!busy}>
        {busy === 'dl' ? 'جارٍ التجهيز…' : '⬇ تنزيل PDF'}
      </button>
      <button className={`btn-accent ${sz}`} onClick={() => run('share')} disabled={!!busy}
        title={canShareFiles() ? 'مشاركة الملف عبر واتساب أو البريد' : 'يُنزَّل الملف لترفقه في المحادثة'}>
        {busy === 'share' ? 'جارٍ التجهيز…' : '↗ إرسال PDF'}
      </button>
      <button className={`btn-ghost ${sz}`} onClick={() => run('print')} disabled={!!busy}>
        {busy === 'print' ? 'جارٍ التجهيز…' : '🖨 طباعة'}
      </button>
    </div>
  )
}
