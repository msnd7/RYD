export const todayISO = () => new Date().toISOString().slice(0, 10)

export function shiftDays(iso: string, n: number) {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

export function daysBetween(a: string, b: string) {
  const A = new Date(a + 'T12:00:00').getTime()
  const B = new Date(b + 'T12:00:00').getTime()
  return Math.round((B - A) / 86400000)
}

const AR_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
const AR_DAYS = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت']

export function fmtDate(iso?: string) {
  if (!iso) return '—'
  const d = new Date(iso.length > 10 ? iso : iso + 'T12:00:00')
  if (isNaN(d.getTime())) return iso
  return `${d.getDate()} ${AR_MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export function fmtDayName(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso.length > 10 ? iso : iso + 'T12:00:00')
  return isNaN(d.getTime()) ? '' : AR_DAYS[d.getDay()]
}

export function fmtHijri(iso?: string) {
  if (!iso) return ''
  try {
    const d = new Date(iso.length > 10 ? iso : iso + 'T12:00:00')
    return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
      day: 'numeric', month: 'long', year: 'numeric',
    }).format(d) + 'هـ'
  } catch { return '' }
}

export function fmtTime(iso?: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  const h = d.getHours(), m = d.getMinutes()
  const suffix = h < 12 ? 'ص' : 'م'
  const hh = h % 12 === 0 ? 12 : h % 12
  return `${hh}:${String(m).padStart(2, '0')} ${suffix}`
}

/** وصف قرب الموعد */
export function dueLabel(due: string) {
  const diff = daysBetween(todayISO(), due)
  if (diff === 0) return { text: 'اليوم', tone: 'warn' as const, diff }
  if (diff === 1) return { text: 'غدًا', tone: 'warn' as const, diff }
  if (diff < 0) return { text: `متأخرة ${Math.abs(diff)} يوم`, tone: 'bad' as const, diff }
  if (diff <= 3) return { text: `بعد ${diff} أيام`, tone: 'warn' as const, diff }
  return { text: `بعد ${diff} يومًا`, tone: 'ok' as const, diff }
}

export function monthKey(iso: string) { return iso.slice(0, 7) }
export function monthLabel(key: string) {
  const [y, m] = key.split('-')
  return `${AR_MONTHS[Number(m) - 1]} ${y}`
}
