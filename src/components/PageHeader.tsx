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
    <header className="mb-4">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
          <h1 className="text-navy-900">{title}</h1>
          {description && <p className="muted mt-1.5 max-w-[62ch]">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 no-print">{actions}</div>}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </header>
  )
}
