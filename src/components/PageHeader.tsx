import React from 'react'

/**
 * ترويسة موحّدة لكل شاشة: تعريف بما تفعله الشاشة + الإجراء الرئيسي،
 * حتى يعرف المستخدم في كل صفحة أين هو وماذا يفعل.
 */
export function PageHeader({ eyebrow, title, description, actions, children }: {
  eyebrow?: string
  title: string
  description?: string
  actions?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <header className="mb-5">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          {eyebrow && (
            <p className="inline-flex items-center gap-1.5 text-[11px] font-bold text-navy-700 bg-surface/80 border border-line rounded-full px-2.5 py-1 mb-2.5">
              <i className="w-1.5 h-1.5 rounded-full bg-orange-500" />{eyebrow}
            </p>
          )}
          <h1 className="text-navy-900 !text-[23px] sm:!text-[28px]">{title}</h1>
          {description && <p className="muted mt-1.5 max-w-[68ch]">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 no-print">{actions}</div>}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </header>
  )
}
