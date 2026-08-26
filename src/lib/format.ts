/** تنسيق موحّد للأرقام والمبالغ (أرقام لاتينية مع فاصل الآلاف لسهولة القراءة) */
export const num = (n: number) => Number(n || 0).toLocaleString('en-US')
export const money = (n: number) => `${Math.round(n || 0).toLocaleString('en-US')} ر.س`
export const pct = (n: number) => `${Math.round(n || 0)}%`
