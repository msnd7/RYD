import logo from '../assets/logo.png'

/**
 * شعار مجمع رياض القرآن — بخلفية شفافة وبلا هوامش،
 * يوضع مباشرة على الأسطح الفاتحة دون إطار أو مربع.
 */
export function LogoMark({ h = 34, className = '' }: { h?: number; className?: string }) {
  return (
    <img
      src={logo}
      alt="شعار رياض القرآن"
      height={h}
      style={{ height: h }}
      className={`w-auto object-contain select-none shrink-0 ${className}`}
      draggable={false}
    />
  )
}

/** الشعار مع اسم المنصة — للقائمة الجانبية */
export function Wordmark({ h = 38 }: { h?: number }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <LogoMark h={h} />
      <span className="min-w-0 leading-tight border-r border-line pr-2.5">
        <span className="block font-display font-bold text-[13.5px] text-navy-800 truncate">رياض القرآن</span>
        <span className="block text-[10px] font-bold text-ink-400 truncate">منصة إدارة المجمع</span>
      </span>
    </div>
  )
}
