import { useState } from 'react'
import { useDb } from '../store/db'
import { useAuth } from '../store/auth'
import { Card, Badge, Empty, Progress, StatStrip } from '../components/ui'
import { PageHeader } from '../components/PageHeader'
import { CustodyRequestModal } from '../components/CustodyRequestModal'
import { custodyBalance, taskCounts, personName, mosqueName } from '../lib/selectors'
import { fmtDate, fmtDayName, todayISO } from '../lib/date'
import { money } from '../lib/format'

const CST: Record<string, { label: string; tone: string }> = {
  requested: { label: 'بانتظار اعتماد المدير', tone: 'warn' },
  approved: { label: 'عهدة مفتوحة', tone: 'info' },
  closed: { label: 'مقفلة', tone: 'ok' },
  rejected: { label: 'مرفوضة', tone: 'bad' },
}

/** مساحة اللجنة كما يراها عضوها: مهام لجنته وعهدها ومحاضرها فقط */
export default function MyCommittee() {
  const { db } = useDb()
  const { user } = useAuth()
  const [custodyFor, setCustodyFor] = useState<string | null>(null)
  if (!user) return null

  const committees = db.committees.filter((c) => user.committeeIds.includes(c.id))

  if (committees.length === 0) {
    return (
      <div>
        <PageHeader title="لجنتي" description="اللجان التي أنت عضو فيها." />
        <Card>
          <Empty icon="🏷️" title="لم تُسكَّن في أي لجنة بعد"
            hint="يسكّنك مشرف المسجد في لجنتك، فتظهر هنا مهامها وعهدها ومحاضرها." />
        </Card>
      </div>
    )
  }

  const allCustodies = db.custodies.filter((c) => c.committeeId && user.committeeIds.includes(c.committeeId))
  const openCustodies = allCustodies.filter((c) => c.status === 'approved')

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={mosqueName(db, user.mosqueId)}
        title={committees.length === 1 ? committees[0].name : 'لجاني'}
        description="مهام لجنتك وعهدها المفتوحة ومحاضر اجتماعاتها. اطلب صرف عهدة ويعتمدها مدير المجمع."
        actions={<button className="btn-accent btn-sm" onClick={() => setCustodyFor(committees[0].id)}>طلب صرف عهدة</button>}
      />

      <StatStrip items={[
        { label: 'أعضاء لجنتك', value: db.people.filter((p) => p.active && p.committeeIds.some((c) => user.committeeIds.includes(c))).length },
        { label: 'بنود اللجنة', value: db.tasks.filter((t) => user.committeeIds.includes(t.committeeId)).length },
        { label: 'عهد مفتوحة', value: openCustodies.length,
          hint: openCustodies.length ? `${money(openCustodies.reduce((s, c) => s + custodyBalance(c).remaining, 0))} متبقٍ` : undefined,
          accent: openCustodies.length > 0 },
        { label: 'بانتظار الاعتماد', value: allCustodies.filter((c) => c.status === 'requested').length },
      ]} />

      {committees.map((c) => {
        const tasks = db.tasks.filter((t) => t.committeeId === c.id)
        const tc = taskCounts(tasks)
        const pct = tc.total ? Math.round((tc.done / tc.total) * 100) : 0
        const members = db.people.filter((p) => p.committeeIds.includes(c.id) && p.active)
        const custodies = db.custodies.filter((x) => x.committeeId === c.id && x.status !== 'rejected')
        const meetings = db.meetings.filter((m) => m.committeeId === c.id)
          .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4)

        return (
          <Card key={c.id} title={c.name} subtitle={c.goal} pad={false}
            action={<button className="btn-soft btn-sm" onClick={() => setCustodyFor(c.id)}>طلب صرف عهدة</button>}>
            <div className="p-4 sm:p-5 space-y-4">
              <div>
                <div className="flex justify-between text-[11.5px] font-bold text-ink-500 mb-1.5">
                  <span>إنجاز اللجنة</span>
                  <span className="num text-ink-900">{tc.total ? `${pct}% · ${tc.done} من ${tc.total}` : 'لا توجد بنود'}</span>
                </div>
                <Progress value={pct} tone={pct >= 70 ? 'brand' : pct >= 40 ? 'olive' : 'gold'} />
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {tc.pending > 0 && <Badge tone="info">{tc.pending} قيد التنفيذ</Badge>}
                  {tc.stuck > 0 && <Badge tone="bad">{tc.stuck} متعثرة</Badge>}
                  {tc.postponed > 0 && <Badge tone="warn">{tc.postponed} مؤجلة</Badge>}
                  {tc.late > 0 && <Badge tone="warn" dot>{tc.late} متأخرة</Badge>}
                </div>
              </div>

              <div>
                <p className="text-[11px] font-bold text-ink-400 mb-2">الأعضاء ({members.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {members.map((m) => (
                    <span key={m.id} className={`chip ${m.id === c.leaderId ? 'bg-navy-700 text-white' : 'bg-navy-50 text-ink-700'}`}>
                      {m.id === c.leaderId && '★ '}{m.name}{m.id === user.id ? ' (أنت)' : ''}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* العهد */}
            <div className="border-t border-line px-4 sm:px-5 py-3.5 bg-navy-50/40">
              <p className="text-[11.5px] font-bold text-ink-700 mb-2">عهد اللجنة</p>
              {custodies.length === 0 ? (
                <p className="text-[11.5px] text-ink-400">لا توجد عهد لهذه اللجنة.</p>
              ) : (
                <ul className="space-y-2">
                  {custodies.map((x) => {
                    const b = custodyBalance(x)
                    const overdue = x.status === 'approved' && x.closeDate < todayISO()
                    return (
                      <li key={x.id} className="rounded-lg bg-surface border border-line px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-[12.5px] flex-1 min-w-0 truncate">{x.purpose}</span>
                          <Badge tone={CST[x.status].tone}>{CST[x.status].label}</Badge>
                          {overdue && <Badge tone="bad" dot>تجاوزت الإقفال</Badge>}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-500 mt-1.5">
                          <span>المبلغ <b className="num text-ink-900">{money(x.amount)}</b></span>
                          {x.status === 'approved' && <>
                            <span>المنصرف <b className="num text-ink-900">{money(b.spent)}</b></span>
                            <span>المتبقي <b className="num text-orange-700">{money(b.remaining)}</b></span>
                            <span>الإقفال {fmtDate(x.closeDate)}</span>
                          </>}
                          <span>مقدّم الطلب: {personName(db, x.requesterId)}</span>
                        </div>
                        {x.status === 'approved' && (
                          <div className="mt-2"><Progress value={x.amount ? (b.spent / x.amount) * 100 : 0} tone="gold" /></div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {/* المحاضر */}
            {meetings.length > 0 && (
              <div className="border-t border-line">
                <p className="px-4 sm:px-5 pt-3 text-[11.5px] font-bold text-ink-700">آخر محاضر اللجنة</p>
                <ul className="divide-y divide-line mt-1">
                  {meetings.map((m) => (
                    <li key={m.id} className="px-4 sm:px-5 py-2.5">
                      <p className="font-bold text-[12.5px]">{m.title}</p>
                      <p className="text-[11px] text-ink-400 mt-0.5">
                        {fmtDayName(m.date)} {fmtDate(m.date)} · {m.place} · {m.attendees.length} حاضرًا
                      </p>
                      {m.decisions && <p className="text-[12px] text-ink-700 mt-1 leading-6 whitespace-pre-wrap line-clamp-3">{m.decisions}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        )
      })}

      <CustodyRequestModal
        open={!!custodyFor} onClose={() => setCustodyFor(null)}
        mosqueId={user.mosqueId as string} committeeId={custodyFor ?? undefined}
        allowCommitteePick={false}
      />
    </div>
  )
}
