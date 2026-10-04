/**
 * تحويل وثيقة معروضة في الصفحة (عقد، مسيّر رواتب…) إلى ملف PDF حقيقي.
 *
 * تُصوَّر الوثيقة بمحرك المتصفح نفسه (html-to-image) فيبقى الخط العربي
 * واتجاه النص كما يظهر تمامًا، ثم تُوزَّع على صفحات A4 مع تجنّب قطع السطور.
 * المكتبتان تُحمّلان عند الحاجة فقط حتى لا تُثقلا فتح المنصة.
 */

const A4 = { w: 210, h: 297 }        // مم
const MARGIN = 10                     // مم
const CAPTURE_WIDTH = 794             // بكسل ≈ عرض A4 على ٩٦ نقطة

/** عناصر يُفضَّل أن يقع فاصل الصفحة بعدها لا في وسطها */
const BREAKABLE = 'tr, li, p, h1, h2, h3, h4, dl > div, .pdf-keep, section, header, footer'

export async function renderPdf(node: HTMLElement, opts: { landscape?: boolean } = {}): Promise<Blob> {
  const [{ toCanvas }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')])
  const landscape = !!opts.landscape
  const pageW = landscape ? A4.h : A4.w
  const pageH = landscape ? A4.w : A4.h
  const width = landscape ? Math.round(CAPTURE_WIDTH * (A4.h / A4.w)) : CAPTURE_WIDTH

  // نسخة خارج الشاشة بعرض ثابت وبألوان النظام النهاري، فلا يتأثر الملف بحجم الجهاز أو النظام الليلي
  const host = document.createElement('div')
  host.className = 'force-light pdf-host'
  host.setAttribute('dir', 'rtl')
  Object.assign(host.style, {
    position: 'fixed', top: '0', left: '-20000px', width: `${width}px`,
    background: '#ffffff', zIndex: '-1', pointerEvents: 'none',
  })
  const clone = node.cloneNode(true) as HTMLElement
  clone.removeAttribute('id')
  clone.querySelectorAll('.no-print, .no-pdf').forEach((el) => el.remove())
  Object.assign(clone.style, { width: '100%', padding: '28px 30px', margin: '0', boxShadow: 'none', border: '0' })
  host.appendChild(clone)
  document.body.appendChild(host)

  try {
    if (document.fonts?.ready) await document.fonts.ready
    await Promise.all(Array.from(clone.querySelectorAll('img')).map((img) =>
      img.complete ? Promise.resolve() : new Promise((r) => { img.onload = img.onerror = () => r(null) })))

    // نقاط القطع المقترحة (بالبكسل من أعلى الوثيقة)
    const top = clone.getBoundingClientRect().top
    const cuts = Array.from(clone.querySelectorAll<HTMLElement>(BREAKABLE))
      .map((el) => Math.round(el.getBoundingClientRect().bottom - top))
      .filter((y) => y > 0)
      .sort((a, b) => a - b)

    const scale = 2
    const canvas = await toCanvas(clone, {
      pixelRatio: scale, backgroundColor: '#ffffff', cacheBust: true,
      width: clone.offsetWidth, height: clone.scrollHeight,
    })

    const pdf = new jsPDF({ orientation: landscape ? 'l' : 'p', unit: 'mm', format: 'a4', compress: true })
    const contentW = pageW - MARGIN * 2
    const contentH = pageH - MARGIN * 2
    const pxPerMm = canvas.width / contentW               // بكسل اللوحة لكل مم
    const pageHpx = Math.floor(contentH * pxPerMm)         // ارتفاع الصفحة بكسل اللوحة
    // ما بعد آخر عنصر هو حشوة سفلية فقط — لا تُفرد لها صفحة
    const lastCut = cuts.length ? cuts[cuts.length - 1] : 0
    const totalH = lastCut ? Math.min(canvas.height, Math.round((lastCut + 12) * scale)) : canvas.height

    let y = 0
    let first = true
    while (y < totalH - 2) {
      let end = Math.min(totalH, y + pageHpx)
      if (end < totalH) {
        // أقرب نقطة قطع آمنة لا تقل عن نصف الصفحة
        const limitCss = end / scale
        const minCss = (y + pageHpx * 0.5) / scale
        const safe = cuts.filter((c) => c <= limitCss && c >= minCss).pop()
        if (safe) end = Math.round(safe * scale) + 2
      }
      const sliceH = end - y
      const part = document.createElement('canvas')
      part.width = canvas.width
      part.height = sliceH
      const ctx = part.getContext('2d')!
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, part.width, part.height)
      ctx.drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH)

      if (!first) pdf.addPage()
      pdf.addImage(part.toDataURL('image/jpeg', 0.92), 'JPEG', MARGIN, MARGIN, contentW, sliceH / pxPerMm)
      first = false
      y = end
    }

    // ترقيم الصفحات
    const pages = pdf.getNumberOfPages()
    if (pages > 1) {
      for (let i = 1; i <= pages; i++) {
        pdf.setPage(i)
        pdf.setFontSize(8)
        pdf.setTextColor(140)
        pdf.text(`${i} / ${pages}`, pageW / 2, pageH - 4, { align: 'center' })
      }
    }
    return pdf.output('blob')
  } finally {
    host.remove()
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}

/** هل يدعم الجهاز مشاركة الملفات (واتساب، البريد…) من قائمة المشاركة؟ */
export function canShareFiles() {
  try {
    const probe = new File([new Blob(['x'], { type: 'application/pdf' })], 'x.pdf', { type: 'application/pdf' })
    return !!navigator.canShare?.({ files: [probe] })
  } catch { return false }
}

/**
 * مشاركة ملف PDF عبر قائمة المشاركة في الجهاز (واتساب وغيره).
 * ترجع 'shared' أو 'downloaded' (عند عدم الدعم) أو 'cancelled'.
 */
export async function sharePdf(blob: Blob, filename: string, text?: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], filename, { type: 'application/pdf' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename.replace(/\.pdf$/i, ''), text })
      return 'shared'
    } catch (e: any) {
      if (e?.name === 'AbortError') return 'cancelled'
    }
  }
  downloadBlob(blob, filename)
  return 'downloaded'
}

/** اسم ملف آمن للأنظمة المختلفة مع الإبقاء على العربية */
export const safeName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim()
