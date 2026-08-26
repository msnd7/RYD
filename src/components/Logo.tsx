import logo from '../assets/logo.svg'

export function Logo({ size = 44 }: { size?: number }) {
  return <img src={logo} width={size} height={size} alt="شعار رياض القرآن" className="shrink-0 select-none" draggable={false} />
}

export function Wordmark({ compact = false, light = false }: { compact?: boolean; light?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Logo size={compact ? 38 : 52} />
      <div className="leading-tight">
        <div className={`font-display font-extrabold ${compact ? 'text-[17px]' : 'text-2xl'} ${light ? 'text-white' : 'text-brand-800'}`}>
          رياض القرآن
        </div>
        <div className={`${compact ? 'text-[10px]' : 'text-xs'} font-bold ${light ? 'text-white/70' : 'text-gold-600'}`}>
          {compact ? 'منصة إدارة المجمع' : 'لتحفيظ القرآن الكريم — ديراب'}
        </div>
      </div>
    </div>
  )
}
