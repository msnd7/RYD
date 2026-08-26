/**
 * مساعد التنسيق الذكي.
 *
 * يعمل محليًا داخل المتصفح (بدون إنترنت) عبر قواعد لغوية عربية:
 * تصحيح الإملاء الشائع، ضبط علامات الترقيم، ترتيب النقاط، وإضافة
 * مقدمة وخاتمة مناسبة لنوع النص.
 *
 * ويمكن ربطه لاحقًا بنموذج لغوي حقيقي: يكفي حفظ عنوان الخدمة في
 * localStorage تحت المفتاح "ryd.ai.endpoint" ليتم استخدامه بدلًا من
 * القواعد المحلية (يجب أن يستقبل { text, kind } ويعيد { text }).
 */

export type PolishKind = 'announcement' | 'minutes' | 'task' | 'report' | 'message'

const FIXES: [RegExp, string][] = [
  [/\bان شاء الله\b/g, 'إن شاء الله'],
  [/\bانشاء الله\b/g, 'إن شاء الله'],
  [/\bبإذن الله تعالي\b/g, 'بإذن الله تعالى'],
  [/\bالسلام عليكم ورحمة الله\b(?!\s*وبركاته)/g, 'السلام عليكم ورحمة الله وبركاته'],
  [/\bاللجنه\b/g, 'اللجنة'],
  [/\bالاداره\b/g, 'الإدارة'],
  [/\bالادارة\b/g, 'الإدارة'],
  [/\bالمسجد\s+الجامع\b/g, 'الجامع'],
  [/\bمشرف\s+المسجد\b/g, 'مشرف المسجد'],
  [/\bانه\b/g, 'أنه'],
  [/\bاليكم\b/g, 'إليكم'],
  [/\bالي\s/g, 'إلى '],
  [/\bعلي\s+ان\b/g, 'على أن'],
  [/\bمن فضلكم\b/g, 'تفضلوا مشكورين'],
  [/\bارجو\b/g, 'أرجو'],
  [/\bاتمنى\b/g, 'أتمنى'],
  [/\bالتزام\b/g, 'الالتزام'],
  [/\bانتباه\b/g, 'الانتباه'],
]

function normalize(t: string) {
  let s = t.replace(/\r/g, '').replace(/[ \t]+/g, ' ')
  s = s.replace(/\n{3,}/g, '\n\n')
  // الترقيم العربي
  s = s.replace(/\s+([،؛:؟!.])/g, '$1')
  s = s.replace(/([،؛:؟!])(?=\S)/g, '$1 ')
  s = s.replace(/,/g, '،').replace(/;/g, '؛').replace(/\?/g, '؟')
  s = s.replace(/\.{3,}/g, '…')
  FIXES.forEach(([re, to]) => (s = s.replace(re, to)))
  return s.trim()
}

function bulletize(lines: string[]) {
  return lines.map((l) => {
    const clean = l.replace(/^\s*[-*•·]\s*/, '').replace(/^\s*\d+[.)-]\s*/, '').trim()
    return clean
  }).filter(Boolean)
}

function sentence(s: string) {
  const t = s.trim()
  if (!t) return t
  return /[.!؟…:]$/.test(t) ? t : t + '.'
}

const OPENERS: Record<PolishKind, string> = {
  announcement: 'السلام عليكم ورحمة الله وبركاته،',
  minutes: 'الحمد لله والصلاة والسلام على رسول الله، وبعد:',
  task: '',
  report: 'الحمد لله رب العالمين، وبعد:',
  message: 'السلام عليكم ورحمة الله وبركاته،',
}

const CLOSERS: Record<PolishKind, string> = {
  announcement: 'وفقكم الله وسدد خطاكم.',
  minutes: 'وبهذا انتهى الاجتماع، والحمد لله رب العالمين.',
  task: '',
  report: 'هذا ما تم إنجازه، والله ولي التوفيق.',
  message: 'شاكرين لكم تعاونكم.',
}

export function polish(text: string, kind: PolishKind = 'message'): string {
  const src = normalize(text)
  if (!src) return ''

  const rawLines = src.split('\n').map((l) => l.trim())
  const hasList = rawLines.filter(Boolean).length > 2 ||
    rawLines.some((l) => /^\s*[-*•·]/.test(l) || /^\s*\d+[.)-]/.test(l))

  const opener = OPENERS[kind]
  const closer = CLOSERS[kind]
  const out: string[] = []

  if (opener) out.push(opener)

  if (hasList) {
    const items = bulletize(rawLines)
    const [head, ...rest] = items
    if (rest.length === 0) {
      out.push(sentence(head))
    } else {
      // أول سطر يُعامل كتمهيد إن كان قصيرًا
      if (head.length <= 70 && !/[،؛]/.test(head)) {
        out.push(sentence(head))
        rest.forEach((it, i) => out.push(`${arabicIndex(i + 1)} ${sentence(it)}`))
      } else {
        items.forEach((it, i) => out.push(`${arabicIndex(i + 1)} ${sentence(it)}`))
      }
    }
  } else {
    src.split(/\n+/).forEach((p) => p && out.push(sentence(p)))
  }

  if (closer) out.push(closer)
  return out.join('\n')
}

const AR_NUM = ['', '١)', '٢)', '٣)', '٤)', '٥)', '٦)', '٧)', '٨)', '٩)', '١٠)']
function arabicIndex(n: number) { return AR_NUM[n] ?? `${n})` }

/** يستخدم خدمة خارجية إن كانت مُعرّفة، وإلا يرجع للقواعد المحلية */
export async function polishAsync(text: string, kind: PolishKind = 'message'): Promise<string> {
  const endpoint = localStorage.getItem('ryd.ai.endpoint')
  if (endpoint) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, kind }),
      })
      if (res.ok) {
        const data = await res.json()
        if (typeof data?.text === 'string' && data.text.trim()) return data.text
      }
    } catch { /* fallback */ }
  }
  await new Promise((r) => setTimeout(r, 420)) // إحساس بالمعالجة
  return polish(text, kind)
}
