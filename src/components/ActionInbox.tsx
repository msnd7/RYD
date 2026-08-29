import { Link } from 'react-router-dom'
import { useDb } from '../store/db'
import { useAuth } from '../store/auth'
import { todayISO } from '../lib/date'
import { personName, mosqueName } from '../lib/selectors'
import { Card, Empty } from './ui'

type Item = { id: string; icon: string; tone: string; text: string; sub: string; to: string; cta: string }

/**
 * صندوق "ما يحتاج قرارك اليوم" — يجمع كل ما ينتظر تدخل المدير أو المشرف
 * في مكان واحد بدل التنقل بين الشاشات.
 */
export function ActionInbox({ mosqueId }: { mosqueId?: string }) {
  const { db } = useDb()
  const { user, isDirector } = useAuth()
  const today = todayISO()
  if (!user) return null

  const inScope = <T extends { mosqueId: string }>(rows: T[]) =>
    mosqueId ? rows.filter((r) => r.mosqueId === mosqueId)
      : isDirector ? rows : rows.filter((r) => r.mosqueId === user.mosqueId)

  const items: Item[] = []

  // ١) طلبات الاستئذان
  inScope(db.leaves.filter((l) => l.status === 'pending')).forEach((l) => {
    items.push({
      id: `lv-${l.id}`, icon: '📝', tone: 'bg-orange-100 text-orange-700',
      text: `طلب استئذان من ${personName(db, l.personId)}`,
      sub: `${mosqueName(db, l.mosqueId)} · بتاريخ ${l.date}`,
      to: `/m/${l.mosqueId}/attendance`, cta: 'مراجعة واعتماد',
    })
  })

  // ٢) طلبات العهد
  if (isDirector || user.financeAccess) {
    inScope(db.custodies.filter((c) => c.status === 'requested')).forEach((c) => {
      items.push({
        id: `cu-${c.id}`, icon: '💳', tone: 'bg-navy-100 text-navy-700',
        text: `طلب عهدة بمبلغ ${c.amount.toLocaleString('en-US')} ريال`,
        sub: `${personName(db, c.requesterId)} · ${c.purpose}`,
        to: `/m/${c.mosqueId}/finance`, cta: 'اعتماد أو رفض',
      })
    })
    // عهد تجاوزت تاريخ الإقفال
    inScope(db.custodies.filter((c) => c.status === 'approved' && c.closeDate < today)).forEach((c) => {
      items.push({
        id: `cx-${c.id}`, icon: '⏰', tone: 'bg-orange-100 text-orange-700',
        text: `عهدة تجاوزت تاريخ الإقفال`,
        sub: `${personName(db, c.requesterId)} · ${c.purpose}`,
        to: `/m/${c.mosqueId}/finance`, cta: 'متابعة الإقفال',
      })
    })
  }

  // ٣) مهام متأخرة أو متعثرة
  inScope(db.tasks.filter((t) => t.status === 'stuck' || (t.status !== 'done' && t.dueDate < today)))
    .slice(0, 8).forEach((t) => {
      items.push({
        id: `tk-${t.id}`, icon: t.status === 'stuck' ? '🚧' : '⚠️',
        tone: t.status === 'stuck' ? 'bg-orange-100 text-orange-700' : 'bg-orange-100 text-orange-700',
        text: t.title,
        sub: `${personName(db, t.assigneeId)} · ${t.status === 'stuck' ? 'متعثرة' : 'تجاوزت موعدها'}`,
        to: `/m/${t.mosqueId}/tasks`, cta: 'فتح المهمة',
      })
    })

  // ٤) عقود لم تُوقَّع
  const unsigned = (isDirector ? db.people : db.people.filter((p) => p.mosqueId === user.mosqueId))
    .filter((p) => p.mosqueId !== 'complex' && p.contract && !p.contract.signedAt)
    .filter((p) => !mosqueId || p.mosqueId === mosqueId)
  unsigned.slice(0, 4).forEach((p) => {
    items.push({
      id: `ct-${p.id}`, icon: '🖊️', tone: 'bg-navy-100 text-navy-800',
      text: `عقد ${p.name} بانتظار التوقيع`,
      sub: mosqueName(db, p.mosqueId), to: `/m/${p.mosqueId}/staff`, cta: 'فتح ملف الموظف',
    })
  })

  // ٥) تحضير المعلمين لم يُسجّل اليوم
  const mosquesToCheck = mosqueId ? db.mosques.filter((m) => m.id === mosqueId)
    : isDirector ? db.mosques : db.mosques.filter((m) => m.id === user.mosqueId)
  mosquesToCheck.forEach((m) => {
    const has = db.teacherAttendance.some((t) => t.mosqueId === m.id && t.date === today)
    const count = db.teachers.filter((t) => t.mosqueId === m.id && t.active).length
    if (!has && count > 0 && new Date().getDay() !== 5) {
      items.push({
        id: `tt-${m.id}`, icon: '📚', tone: 'bg-navy-100 text-navy-800',
        text: `لم يُسجَّل حضور المعلمين اليوم — ${m.name}`,
        sub: `${count} معلمًا في المسجد`, to: `/m/${m.id}/teachers`, cta: 'تسجيل الحضور',
      })
    }
  })

  return (
    <Card
      title="ما يحتاج قرارك اليوم"
      subtitle={items.length ? `${items.length} بندًا في انتظارك` : undefined}
      pad={false}
    >
      {items.length === 0 ? (
        <Empty icon="🌿" title="لا يوجد ما ينتظر قرارك" hint="كل الطلبات والمهام تحت السيطرة، بارك الله فيك." />
      ) : (
        <ul className="divide-y divide-line max-h-[430px] overflow-y-auto">
          {items.map((it) => (
            <li key={it.id}>
              <Link to={it.to} className="flex items-center gap-3 px-5 py-3.5 hover:bg-navy-50/50 transition group">
                <span className={`w-10 h-10 shrink-0 grid place-items-center rounded-xl text-lg ${it.tone}`}>{it.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-sm truncate">{it.text}</span>
                  <span className="block text-[11px] text-ink-500 truncate">{it.sub}</span>
                </span>
                <span className="shrink-0 text-[11px] font-black text-navy-600 opacity-0 group-hover:opacity-100 transition hidden sm:block">
                  {it.cta} ←
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
