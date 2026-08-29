import { useEffect, useState } from 'react'
import { Modal } from './ui'
import { LogoMark } from './Brand'
import { canInstall, isStandalone, onPwaChange, promptInstall } from '../lib/pwa'

const STEPS: Record<string, string[]> = {
  'آيفون / آيباد (Safari)': [
    'افتح المنصة في متصفح Safari.',
    'اضغط زر المشاركة ⬆️ في الأسفل.',
    'اختر «إضافة إلى الشاشة الرئيسية».',
  ],
  'أندرويد (Chrome)': [
    'افتح المنصة في متصفح Chrome.',
    'اضغط قائمة ⋮ في الأعلى.',
    'اختر «تثبيت التطبيق».',
  ],
  'الحاسب (Chrome / Edge)': [
    'افتح المنصة في المتصفح.',
    'اضغط أيقونة التثبيت ⊕ في شريط العنوان.',
    'اختر «تثبيت».',
  ],
}

/** نافذة إرشاد تثبيت المنصة كتطبيق على الجهاز */
export function InstallAppModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [, force] = useState(0)
  useEffect(() => onPwaChange(() => force((n) => n + 1)), [])
  const installed = isStandalone()

  return (
    <Modal open={open} onClose={onClose} title="تثبيت التطبيق على جهازك" wide
      footer={<button className="btn-ghost" onClick={onClose}>تم</button>}>
      <div className="space-y-4">
        <div className="flex items-center gap-4 rounded-2xl border border-line p-4">
          <LogoMark h={52} />
          <div className="min-w-0">
            <p className="font-bold text-[14px]">رياض القرآن</p>
            <p className="muted">يفتح كتطبيق مستقل، ويعمل بدون إنترنت بعد أول تشغيل، وتصله تذكيرات المواعيد.</p>
          </div>
        </div>

        {installed ? (
          <div className="rounded-xl bg-navy-50 border border-navy-100 p-4 text-[13px] font-bold text-navy-800">
            ✔ التطبيق مثبَّت ويعمل الآن في وضع التطبيق المستقل.
          </div>
        ) : (
          <>
            {canInstall() && (
              <button className="btn-accent w-full" onClick={async () => { await promptInstall(); onClose() }}>
                ⬇ تثبيت التطبيق الآن
              </button>
            )}
            <div className="grid sm:grid-cols-3 gap-3">
              {Object.entries(STEPS).map(([title, steps]) => (
                <div key={title} className="rounded-2xl border border-line p-4">
                  <h4 className="font-extrabold text-[12.5px] mb-2">{title}</h4>
                  <ol className="space-y-1.5">
                    {steps.map((t, i) => (
                      <li key={i} className="flex gap-2 text-[12px] text-ink-700 leading-6">
                        <span className="w-5 h-5 rounded-md bg-navy-100 text-navy-800 text-[10px] font-black grid place-items-center shrink-0 mt-0.5">{i + 1}</span>
                        {t}
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
