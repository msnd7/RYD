import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDb } from '../store/db'
import { useAuth } from '../store/auth'
import { TopBar } from '../components/Layout'
import { Card, Stat, Badge, Empty, Progress, useToast } from '../components/ui'
import { Donut, C } from '../components/charts'
import { todayISO, shiftDays, fmtDate, dueLabel } from '../lib/date'
import {
  attendanceStats, taskCounts, payrollFor, committeeName,
  mosqueName, visibleAnnouncements, personName,
} from '../lib/selectors'
import { KIND_LABEL, STATUS_LABEL } from './Tasks'

export default function MyPage() {
  const { db } = useDb()
  const { user } = useAuth()
  const today = todayISO()
  const from = shiftDays(today, -29)
  if (!user) return null

  const st = attendanceStats(db, user.id, from, today)
  const tasks = db.tasks.filter((t) => t.assigneeId === user.id)
  const tc = taskCounts(tasks)
  const pay = payrollFor(db, user, today)
  const anns = visibleAnnouncements(db, user).slice(0, 5)
  const open = tasks.filter((t) => t.status !== 'done').sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const mine = db.attendance.find((a) => a.personId === user.id && a.date === today)
  // مدير المجمع لا يحضّر نفسه ولا يُحسب له راتب هنا — فلا عمود جانبي في صفحته
  const showSide = user.role !== 'director' || user.salary > 0

  return (
    <div className="min-h-screen">
      <TopBar title="صفحتي" subtitle={`${user.jobTitle} · ${mosqueName(db, user.mosqueId)}`} back="/" />
      <div className="max-w-[1180px] mx-auto p-4 sm:p-6 space-y-5 fade-in">
        <div className="rounded-3xl bg-gradient-to-bl from-navy-700 to-navy-900 text-white p-6 flex flex-wrap items-center gap-5">
          <span className="w-16 h-16 rounded-2xl bg-surface/15 grid place-items-center text-2xl font-display font-black">
            {user.name[0]}
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-display font-black">{user.name}</h1>
            <p className="text-white/70 text-[12.5px]">{user.jobTitle} · {mosqueName(db, user.mosqueId)}</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {user.committeeIds.map((c) => (
                <span key={c} className="chip bg-surface/15 text-white">{committeeName(db, c)}</span>
              ))}
              {user.financeAccess && <span className="chip bg-orange-400 text-white">تفويض مالي</span>}
            </div>
          </div>
          <div className="sm:mr-auto flex items-center gap-4">
            {user.role !== 'director' && (
              <div className="text-center bg-surface/10 rounded-2xl px-5 py-3">
                <div className="text-2xl font-display font-black">{st.rate}%</div>
                <div className="text-[10px] font-bold text-white/70">حضور ٣٠ يومًا</div>
              </div>
            )}
            <div className="text-center bg-surface/10 rounded-2xl px-5 py-3">
              <div className="text-2xl font-display font-black">{tc.total - tc.done}</div>
              <div className="text-[10px] font-bold text-white/70">مهام مفتوحة</div>
            </div>
          </div>
        </div>

        <div className={`grid gap-5 ${showSide ? 'lg:grid-cols-3' : ''}`}>
          <Card title="مهامي المفتوحة" pad={false} className={showSide ? 'lg:col-span-2' : ''}
            action={user.mosqueId !== 'complex' && <Link to={`/m/${user.mosqueId}/tasks`} className="btn-ghost btn-sm">كل المهام</Link>}>
            {open.length === 0 ? <Empty icon="✅" title="لا توجد مهام مفتوحة" hint="أحسنت، كل ما لديك منجز." /> : (
              <ul className="divide-y divide-line">
                {open.map((t) => {
                  const d = dueLabel(t.dueDate)
                  return (
                    <li key={t.id} className="px-5 py-3.5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge tone="info">{KIND_LABEL[t.kind]}</Badge>
                            <span className="font-bold text-[14px]">{t.title}</span>
                          </div>
                          <p className="text-[11.5px] text-ink-500 mt-1">
                            {committeeName(db, t.committeeId)} · {fmtDate(t.dueDate)}
                          </p>
                        </div>
                        <Badge tone={d.tone === 'bad' ? 'bad' : d.tone === 'warn' ? 'warn' : 'mute'}>{d.text}</Badge>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          {showSide && <div className="space-y-5">
            {user.role !== 'director' && <Card title="حضوري">
              <div className="flex justify-center">
                <Donut value={st.rate} tone={st.rate >= 85 ? C.olive : st.rate >= 70 ? C.gold : C.rose} sub="آخر ٣٠ يومًا" />
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4">
                <Stat label="حضور" value={st.present} tone="olive" />
                <Stat label="غياب" value={st.absent} tone={st.absent ? 'rose' : 'slate'} />
                <Stat label="استئذان" value={st.excused} tone="gold" />
              </div>
              {user.mosqueId !== 'complex' && (
                <Link to={`/m/${user.mosqueId}/attendance`} className="btn-primary btn-sm w-full mt-4">
                  {mine?.status === 'present' ? '✅ تم تحضيرك اليوم' : '📍 تحضير نفسي الآن'}
                </Link>
              )}
            </Card>}

            {user.salary > 0 && (
              <Card title="راتبي هذا الشهر">
                <ul className="space-y-2 text-[13px]">
                  <li className="flex justify-between"><span className="text-ink-500">الراتب</span><b>{user.salary.toLocaleString('en-US')}</b></li>
                  <li className="flex justify-between"><span className="text-ink-500">الخصم</span><b className="text-orange-600">{pay.deduction.toLocaleString('en-US')}</b></li>
                  <li className="flex justify-between border-t border-line pt-2"><span className="font-bold">الصافي</span>
                    <b className="text-navy-800 text-base">{pay.net.toLocaleString('en-US')} ر.س</b></li>
                </ul>
              </Card>
            )}
          </div>}
        </div>

        <Card title="آخر الرسائل والإعلانات" pad={false}>
          {anns.length === 0 ? <Empty icon="📣" title="لا توجد رسائل" /> : (
            <ul className="divide-y divide-line">
              {anns.map((a) => (
                <li key={a.id} className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    {a.pinned && <span>📌</span>}
                    <span className="font-bold text-[14px]">{a.title}</span>
                  </div>
                  <p className="text-[12.5px] text-ink-700 mt-1.5 leading-7 whitespace-pre-wrap">{a.body}</p>
                  <p className="text-[11px] text-ink-500 mt-1.5">{personName(db, a.createdBy)} · {fmtDate(a.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
