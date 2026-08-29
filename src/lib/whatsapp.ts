/** تحويل رقم سعودي إلى صيغة دولية صالحة لرابط واتساب */
export function toIntlPhone(raw?: string): string | null {
  if (!raw) return null
  const d = raw.replace(/[^\d+]/g, '').replace(/^\+/, '')
  if (!d) return null
  if (d.startsWith('966')) return d.length >= 12 ? d : null
  if (d.startsWith('05')) return '966' + d.slice(1)
  if (d.startsWith('5') && d.length === 9) return '966' + d
  if (d.startsWith('00')) return d.slice(2)
  return d.length >= 10 ? d : null
}

export const hasWhatsapp = (phone?: string) => !!toIntlPhone(phone)

/** رابط رسالة واتساب جاهزة */
export function waLink(phone: string | undefined, message: string): string | null {
  const p = toIntlPhone(phone)
  if (!p) return null
  return `https://wa.me/${p}?text=${encodeURIComponent(message)}`
}

/** نص تذكير بمهمة */
export function taskReminder(opts: {
  name: string; title: string; kind: string; due: string; complex: string; late: boolean
}) {
  const { name, title, kind, due, complex, late } = opts
  return [
    `السلام عليكم ورحمة الله، ${name}`,
    '',
    late ? `تذكير: ${kind} تجاوز موعده المحدد.` : `تذكير باقتراب موعد ${kind}.`,
    `• المهمة: ${title}`,
    `• الموعد: ${due}`,
    '',
    `${complex} — نشكر لك تعاونك.`,
  ].join('\n')
}
