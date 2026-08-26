import { useDb } from '../store/db'
import { fmtDate, fmtHijri, todayISO } from '../lib/date'

/** ترويسة موحّدة لكل التقارير المطبوعة */
export function ReportHeader({ title, subtitle, period }: {
  title: string; subtitle?: string; period?: string
}) {
  const { db } = useDb()
  return (
    <header className="flex items-center gap-4 border-b-2 border-brand-700 pb-4">
      <img src="./logo.svg" width={58} height={58} alt="" />
      <div className="flex-1 min-w-0">
        <h2 className="font-display font-black text-[19px] text-brand-800">{db.settings.complexName}</h2>
        <p className="text-[11px] text-ink-500">{db.settings.complexSubtitle}</p>
      </div>
      <div className="text-left shrink-0">
        <h3 className="font-extrabold text-[15px]">{title}</h3>
        {subtitle && <p className="text-[12px] text-ink-500">{subtitle}</p>}
        {period && <p className="text-[11px] text-ink-500">{period}</p>}
        <p className="text-[10.5px] text-ink-500 mt-0.5">{fmtDate(todayISO())} · {fmtHijri(todayISO())}</p>
      </div>
    </header>
  )
}

export function ReportFooter({ by }: { by?: string }) {
  return (
    <footer className="mt-6 pt-3 border-t border-slate-200 flex flex-wrap justify-between gap-2 text-[10.5px] text-ink-500">
      <span>صادر عن منصة إدارة مجمع رياض القرآن{by ? ` — أُعدّ بواسطة: ${by}` : ''}</span>
      <span>{fmtDate(todayISO())}</span>
    </footer>
  )
}

/** غلاف منطقة الطباعة — لا يُطبع من الصفحة سوى ما بداخله */
export function PrintArea({ children }: { children: React.ReactNode }) {
  return <div id="print-area" className="bg-white">{children}</div>
}
