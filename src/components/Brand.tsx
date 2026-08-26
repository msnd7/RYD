import logo from '../assets/logo.jpg'

/** الشعار الأصلي كما هو دون أي تعديل — يوضع دائمًا على خلفية بيضاء */
export function LogoMark({ size = 44, rounded = 'rounded-2xl', pad = 'p-0', shadow = true }: {
  size?: number; rounded?: string; pad?: string; shadow?: boolean
}) {
  return (
    <span
      className={`inline-grid place-items-center bg-white ${rounded} ${pad} ${shadow ? 'shadow-soft' : ''} shrink-0`}
      style={{ width: size, height: size }}
    >
      <img src={logo} alt="شعار رياض القرآن" className="w-full h-full object-contain" draggable={false} />
    </span>
  )
}

export function Wordmark({ light = false, size = 'md' }: { light?: boolean; size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'lg' ? 60 : size === 'sm' ? 38 : 46
  return (
    <div className="flex items-center gap-3 min-w-0">
      <LogoMark size={dim} shadow={!light} />
      <div className="leading-tight min-w-0">
        <div className={`font-display font-extrabold truncate ${size === 'lg' ? 'text-[22px]' : size === 'sm' ? 'text-[15px]' : 'text-[18px]'} ${light ? 'text-white' : 'text-navy-800'}`}>
          رياض القرآن
        </div>
        <div className={`font-bold truncate ${size === 'sm' ? 'text-[10px]' : 'text-[11px]'} ${light ? 'text-white/60' : 'text-orange-600'}`}>
          منصة إدارة المجمع
        </div>
      </div>
    </div>
  )
}
