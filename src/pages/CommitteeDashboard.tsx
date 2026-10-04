import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDb } from '../store/db'
import { useAuth } from '../store/auth'
import { Card, Badge, Empty, Progress, Stat } from '../components/ui'
import { PageHeader } from '../components/PageHeader'
import { CustodyRequestModal } from '../components/CustodyRequestModal'
import { LeaderTaskModal, TeamNoteModal, TeamNotesList } from '../components/TeamModals'
import { Donut, C } from '../components/charts'
import { custodyBalance, taskCounts, personName, mosqueName, attendanceStats } from '../lib/selectors'
import { fmtDate, fmtDayName, todayISO, shiftDays, daysBetween, dueLabel } from '../lib/date'
import { money } from '../lib/format'
import { STATUS_LABEL } from './Tasks'
import type { Task, TeamNote } from '../types'

const CST: Record<string, { label: string; tone: string }> = {
  requested: { label: 'بانتظار اعتماد المدير', tone: 'warn' },
  approved: { label: 'عهدة مفتوحة', tone: 'info' },
  closed: { label: 'مقفلة', tone: 'ok' },
  rejected: { label: 'مرفوضة', tone: 'bad' },
}

/** ألوان الحالة في قوائم اللوحة — نفس ألوان قائمة المهام */
const ROW: Record<string, { bar: string; title: string; pill: string }> = {
  done: { bar: 'bg-navy-600', title: 'text-ink-400 line-through', pill: 'bg-navy-600 text-white' },
  pending: { bar: 'bg-navy-300', title: 'text-ink-900', pill: 'bg-navy-50 text-navy-800' },
  postponed: { bar: 'bg-orange-300', title: 'text-orange-800', pill: 'bg-orange-100 text-orange-700' },
  stuck: { bar: 'bg-orange-500', title: 'text-orange-700', pill: 'bg-orange-500 text-white' },
}

/**
 * لوحة تحكم اللجنة — أول ما يراه عضو اللجنة عند دخوله.
 * تجمع في شاشة واحدة: حالة مهام اللجنة (قائمة/متعثرة/قادمة/منجزة)،
 * ومعدّل حضور كل عضو مع معدّل اللجنة، والعهد غير المقفلة، وآخر المحاضر.
 */
export default function CommitteeDashboard() {
  const { db } = useDb()
  const { user } = useAuth()
  const [custodyFor, setCustodyFor] = useState<string | null>(null)
  const [taskFor, setTaskFor] = useState<{ committeeId?: string; assignee?: string } | null>(null)
  const [noteFor, setNoteFor] = useState<{ note?: TeamNote } | null>(null)
  const today = todayISO()
  const from = shiftDays(today, -29)

  const committees = useMemo(
    () => db.committees.filter((c) => user?.committeeIds.includes(c.id)),
    [db.committees, user],
  )

  const tasks = useMemo(
    () => db.tasks.filter((t) => user?.committeeIds.includes(t.committeeId)),
    [db.tasks, user],
  )

  const members = useMemo(
    () => db.people.filter((p) => p.active && p.committeeIds.some((c) => user?.committeeIds.includes(c))),
    [db.people, user],
  )

  if (!user) return null

  if (committees.length === 0) {
    return (
      <div className="space-y-5">
        <PageHeader title="لوحة لجنتي" description="ما يخصّ لجنتك من مهام وحضور وعهد." />
        <Card>
          <Empty icon="🏷️" title="لم تُسكَّن في أي لجنة بعد"
            hint="يسكّنك مشرف المسجد في لجنتك، فتظهر هنا لوحتها ومهامها وعهدها ومحاضرها." />
        </Card>
      </div>
    )
  }

  // اللجان التي يقودها المستخدم: له إسناد المهام ونشر التوصيات لفريقه
  const led = committees.filter((c) => c.leaderId === user.id)
  const isLeader = led.length > 0
  const notes = db.teamNotes
    .filter((n) => user.committeeIds.includes(n.committeeId) &&
      (n.targetIds.length === 0 || n.targetIds.includes(user.id) || n.createdBy === user.id ||
        led.some((c) => c.id === n.committeeId)))
    .sort((a, b) => {
      const unread = (n: TeamNote) => (n.createdBy !== user.id && !n.acks.some((x) => x.personId === user.id) ? 0 : 1)
      return (a.priority === 'high' ? 0 : 1) - (b.priority === 'high' ? 0 : 1) ||
        unread(a) - unread(b) || b.createdAt.localeCompare(a.createdAt)
    })
  const unreadNotes = notes.filter((n) => n.createdBy !== user.id &&
    (n.targetIds.length === 0 || n.targetIds.includes(user.id)) && !n.acks.some((x) => x.personId === user.id)).length

  const tc = taskCounts(tasks)
  const pct = tc.total ? Math.round((tc.done / tc.total) * 100) : 0

  const openTasks = tasks
    .filter((t) => t.status !== 'done')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  // «القادمة» — مهام لم يحن موعدها بعد وتستحق خلال أسبوع
  const upcoming = openTasks.filter((t) => {
    const d = daysBetween(today, t.dueDate)
    return d >= 0 && d <= 7
  })

  const custodies = db.custodies.filter(
    (c) => c.committeeId && user.committeeIds.includes(c.committeeId) && c.status !== 'rejected',
  )
  const openCustodies = custodies.filter((c) => c.status === 'approved' || c.status === 'requested')

  const meetings = db.meetings
    .filter((m) => user.committeeIds.includes(m.committeeId ?? ''))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4)

  // حضور كل عضو خلال ٣٠ يومًا + معدّل اللجنة
  const attendance = members.map((p) => ({ p, st: attendanceStats(db, p.id, from, today) }))
  const counted = attendance.filter((r) => r.st.total > 0)
  const teamRate = counted.length
    ? Math.round(counted.reduce((s, r) => s + r.st.rate, 0) / counted.length)
    : 0
  const teamPresent = attendance.reduce((s, r) => s + r.st.present, 0)
  const teamAbsent = attendance.reduce((s, r) => s + r.st.absent, 0)
  const teamExcused = attendance.reduce((s, r) => s + r.st.excused, 0)

  const CARDS = [
    { label: 'مهام قائمة', value: tc.pending, to: '/my/tasks?f=pending', cls: 'bg-navy-50 border-navy-100 text-navy-800' },
    { label: 'متعثرة', value: tc.stuck, to: '/my/tasks?f=stuck', cls: 'bg-orange-100 border-orange-200 text-orange-700' },
    { label: 'قادمة خلال أسبوع', value: upcoming.length, to: '/my/tasks', cls: 'bg-surface border-line text-ink-900' },
    { label: 'متأخرة', value: tc.late, to: '/my/tasks?f=late', cls: 'bg-orange-50 border-orange-200 text-orange-800' },
    { label: 'مؤجلة', value: tc.postponed, to: '/my/tasks?f=postponed', cls: 'bg-orange-50 border-orange-200 text-orange-800' },
    { label: 'منجزة', value: tc.done, to: '/my/tasks?f=done', cls: 'bg-navy-100 border-navy-200 text-navy-800' },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={mosqueName(db, user.mosqueId)}
        title={committees.length === 1 ? committees[0].name : 'لوحة لجاني'}
        description={isLeader
          ? 'أنت قائد اللجنة: أسند المهام لفريقك، وانشر التوصيات والتوجيهات وتابع من اطّلع عليها، وراقب الحضور والعهد.'
          : 'كل ما يخص لجنتك في شاشة واحدة: حالة المهام، وتوصيات القائد، وحضور الأعضاء، والعهد غير المقفلة.'}
        actions={<>
          <button className={`${isLeader ? 'btn-ghost' : 'btn-accent'} btn-sm`} onClick={() => setCustodyFor(committees[0].id)}>
            طلب صرف عهدة
          </button>
        </>}
      />

      {/* لوحة قائد اللجنة */}
      {isLeader && (
        <section className="hero p-4 sm:p-5">
          <div aria-hidden className="absolute -left-12 -bottom-16 w-56 h-56 rounded-full bg-orange-500/25 blur-3xl" />
          <div className="relative flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-white/60">★ لوحة القائد</p>
              <h2 className="font-display text-[19px] font-bold text-white mt-0.5">فريق {led.map((c) => c.name).join(' · ')}</h2>
            </div>
            <div className="flex gap-2">
              <button className="rounded-xl bg-white font-bold text-[12.5px] px-3.5 h-10 hover:bg-white/90 transition" style={{ color: '#12395F' }} onClick={() => setTaskFor({})}>＋ إسناد مهمة</button>
              <button className="rounded-xl bg-orange-500 text-white font-bold text-[12.5px] px-3.5 h-10 hover:bg-orange-600 transition" onClick={() => setNoteFor({})}>＋ توصية أو توجيه</button>
            </div>
          </div>
          <ul className="relative grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5 mt-4">
            {members.filter((m) => led.some((c) => m.committeeIds.includes(c.id))).map((m) => {
              const open = tasks.filter((t) => t.assigneeId === m.id && t.status !== 'done')
              const late = open.filter((t) => t.dueDate < today).length
              const st = attendanceStats(db, m.id, from, today)
              return (
                <li key={m.id} className="rounded-2xl bg-white/[.07] border border-white/10 p-3 flex items-center gap-3">
                  <span className="w-10 h-10 rounded-full bg-white/15 grid place-items-center font-bold shrink-0">{m.name.trim()[0]}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-[13px] truncate">{m.name}{m.id === user.id ? ' (أنت)' : ''}</p>
                    <p className="text-[11px] text-white/60 truncate">
                      {open.length} مفتوحة{late ? ` · ${late} متأخرة` : ''} · حضور {st.total ? `${st.rate}%` : '—'}
                    </p>
                  </div>
                  <button title={`إسناد مهمة إلى ${m.name}`} onClick={() => setTaskFor({ assignee: m.id, committeeId: led.find((c) => m.committeeIds.includes(c.id))?.id })}
                    className="w-8 h-8 rounded-lg bg-white/10 hover:bg-orange-500 grid place-items-center transition shrink-0">＋</button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* حالة المهام */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {CARDS.map((c) => (
          <Link key={c.label} to={c.to}
            className={`rounded-xl border px-3 py-3 transition hover:brightness-[.98] ${c.cls}`}>
            <div className="num text-[22px] leading-none">{c.value}</div>
            <div className="text-[11px] font-bold mt-1.5 opacity-80 truncate">{c.label}</div>
          </Link>
        ))}
      </div>

      {/* التوصيات والتوجيهات */}
      {(notes.length > 0 || isLeader) && (
        <Card title="توصيات وتوجيهات اللجنة"
          subtitle={isLeader ? 'تابع من اطّلع من فريقك على كل توصية' : unreadNotes ? `${unreadNotes} بانتظار اطّلاعك` : 'من قائد لجنتك'}
          action={isLeader && <button className="btn-soft btn-sm" onClick={() => setNoteFor({})}>＋ توصية</button>}
          pad={false}>
          {notes.length === 0 ? (
            <Empty icon="💡" title="لا توجد توصيات بعد" hint="انشر توصية أو توجيهًا لفريقك، وتابع من اطّلع عليه." />
          ) : (
            <TeamNotesList notes={notes.slice(0, 8)} canManage={(n) => n.createdBy === user.id || led.some((c) => c.id === n.committeeId)}
              onEdit={(n) => setNoteFor({ note: n })} />
          )}
        </Card>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        {/* إنجاز اللجنة + المهام القادمة */}
        <Card title="مهام لجنتي القريبة" className="lg:col-span-2" pad={false}
          action={<Link to="/my/tasks" className="btn-ghost btn-sm">كل المهام</Link>}>
          <div className="px-4 sm:px-5 pt-4">
            <div className="flex justify-between items-baseline text-[11.5px] font-bold text-ink-500 mb-1.5">
              <span>إنجاز اللجنة</span>
              {tc.total ? (
                <span className="flex items-baseline gap-1.5">
                  <b className="num text-ink-900 text-[13px]">{pct}%</b>
                  <span className="text-ink-400">
                    (<span className="num">{tc.done}</span> من <span className="num">{tc.total}</span>)
                  </span>
                </span>
              ) : <span className="text-ink-400">لا توجد مهام</span>}
            </div>
            <Progress value={pct} tone={pct >= 70 ? 'brand' : pct >= 40 ? 'olive' : 'gold'} />
          </div>

          {openTasks.length === 0 ? (
            <Empty icon="✅" title="لا توجد مهام مفتوحة" hint="كل مهام اللجنة منجزة." />
          ) : (
            <ul className="divide-y divide-line mt-3">
              {openTasks.slice(0, 7).map((t: Task) => {
                const s = ROW[t.status] ?? ROW.pending
                const d = dueLabel(t.dueDate)
                return (
                  <li key={t.id} className="flex items-stretch gap-3">
                    <span className={`w-1 shrink-0 ${s.bar}`} />
                    <div className="flex-1 min-w-0 py-3 pl-4 sm:pl-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`font-bold text-[13.5px] ${s.title}`}>{t.title}</span>
                        <span className={`chip ${s.pill}`}>{STATUS_LABEL[t.status]}</span>
                        <span className="mr-auto"><Badge tone={d.tone === 'bad' ? 'bad' : d.tone === 'warn' ? 'warn' : 'mute'}>{d.text}</Badge></span>
                      </div>
                      <p className="text-[11.5px] text-ink-500 mt-1">
                        {personName(db, t.assigneeId)}{t.assigneeId === user.id ? ' (أنت)' : ''} · {fmtDate(t.dueDate)}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        {/* معدّل حضور اللجنة */}
        <Card title="حضور اللجنة" subtitle="آخر ٣٠ يومًا">
          <div className="flex justify-center">
            <Donut value={teamRate} tone={teamRate >= 85 ? C.olive : teamRate >= 70 ? C.gold : C.rose} sub="معدّل اللجنة" />
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4">
            <Stat label="حضور" value={teamPresent} tone="olive" />
            <Stat label="غياب" value={teamAbsent} tone={teamAbsent ? 'rose' : 'slate'} />
            <Stat label="استئذان" value={teamExcused} tone="gold" />
          </div>
        </Card>
      </div>

      {/* حضور كل عضو */}
      <Card title="حضور أعضاء اللجنة" subtitle={`${members.length} عضوًا · آخر ٣٠ يومًا`} pad={false}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-navy-50">
              <tr>
                <th className="th">العضو</th>
                <th className="th">الوظيفة</th>
                <th className="th">حضور</th>
                <th className="th">غياب</th>
                <th className="th">استئذان</th>
                <th className="th">النسبة</th>
              </tr>
            </thead>
            <tbody>
              {attendance.map(({ p, st }) => (
                <tr key={p.id} className="row">
                  <td className="td font-bold">
                    {p.name}
                    {p.id === user.id && <span className="text-[10.5px] text-ink-400 font-normal"> (أنت)</span>}
                    {committees.some((c) => c.leaderId === p.id) && <span className="text-orange-500"> ★</span>}
                  </td>
                  <td className="td text-[12px] text-ink-500">{p.jobTitle}</td>
                  <td className="td num">{st.present}</td>
                  <td className={`td num ${st.absent ? 'text-orange-700 font-bold' : ''}`}>{st.absent}</td>
                  <td className="td num">{st.excused}</td>
                  <td className="td">
                    <div className="flex items-center gap-2 min-w-[110px]">
                      <span className="num font-bold w-10">{st.total ? `${st.rate}%` : '—'}</span>
                      <span className="flex-1"><Progress value={st.rate} tone={st.rate >= 85 ? 'brand' : st.rate >= 70 ? 'gold' : 'rose'} /></span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-navy-50/70 font-bold">
                <td className="td">المجموع</td>
                <td className="td text-[12px] text-ink-500">{members.length} عضوًا</td>
                <td className="td num">{teamPresent}</td>
                <td className="td num">{teamAbsent}</td>
                <td className="td num">{teamExcused}</td>
                <td className="td num">{teamRate}%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* العهد غير المقفلة */}
      <Card title="عهد اللجنة غير المقفلة" subtitle="تبقى مفتوحة حتى تُقفل بفاتورة وإرجاع الفائض" pad={false}
        action={<button className="btn-soft btn-sm" onClick={() => setCustodyFor(committees[0].id)}>طلب صرف عهدة</button>}>
        {openCustodies.length === 0 ? (
          <Empty icon="🧾" title="لا توجد عهد مفتوحة" hint="اطلب صرف عهدة ويعتمدها مدير المجمع." />
        ) : (
          <ul className="divide-y divide-line">
            {openCustodies.map((x) => {
              const b = custodyBalance(x)
              const overdue = x.status === 'approved' && x.closeDate < today
              return (
                <li key={x.id} className="px-4 sm:px-5 py-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-[13px] flex-1 min-w-0 truncate">{x.purpose}</span>
                    <Badge tone={CST[x.status].tone}>{CST[x.status].label}</Badge>
                    {overdue && <Badge tone="bad" dot>تجاوزت موعد الإقفال</Badge>}
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
      </Card>

      {/* المحاضر */}
      {meetings.length > 0 && (
        <Card title="آخر محاضر اللجنة" pad={false}>
          <ul className="divide-y divide-line">
            {meetings.map((m) => (
              <li key={m.id} className="px-4 sm:px-5 py-3">
                <p className="font-bold text-[13px]">{m.title}</p>
                <p className="text-[11px] text-ink-400 mt-0.5">
                  {fmtDayName(m.date)} {fmtDate(m.date)} · {m.place} · {m.attendees.length} حاضرًا
                </p>
                {m.decisions && <p className="text-[12px] text-ink-700 mt-1 leading-6 whitespace-pre-wrap line-clamp-3">{m.decisions}</p>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* أعضاء اللجنة */}
      {committees.map((c) => (
        <Card key={c.id} title={`أعضاء ${c.name}`} subtitle={c.goal}>
          <div className="flex flex-wrap gap-1.5">
            {db.people.filter((p) => p.active && p.committeeIds.includes(c.id)).map((m) => (
              <span key={m.id} className={`chip ${m.id === c.leaderId ? 'bg-navy-700 text-white' : 'bg-navy-50 text-ink-700'}`}>
                {m.id === c.leaderId && '★ '}{m.name}{m.id === user.id ? ' (أنت)' : ''}
              </span>
            ))}
          </div>
        </Card>
      ))}

      {taskFor && (
        <LeaderTaskModal committees={led} initialCommitteeId={taskFor.committeeId}
          initialAssignee={taskFor.assignee} onClose={() => setTaskFor(null)} />
      )}
      {noteFor && <TeamNoteModal committees={led.length ? led : committees} note={noteFor.note} onClose={() => setNoteFor(null)} />}

      <CustodyRequestModal
        open={!!custodyFor} onClose={() => setCustodyFor(null)}
        mosqueId={user.mosqueId as string} committeeId={custodyFor ?? undefined}
        allowCommitteePick={false}
      />
    </div>
  )
}
