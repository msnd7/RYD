import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useDb } from '../store/db'
import { useAuth } from '../store/auth'
import { Card, Select } from '../components/ui'
import { PageHeader } from '../components/PageHeader'
import {
  KnightCard, Leaderboard, Seg, Medal, Avatar, fmtScore,
  personEntries, committeeEntries, type Entry,
} from '../components/honors'
import { IconScreen, IconPin, IconCheck, IconBook, IconPulse } from '../components/icons'
import {
  weekPeriod, monthPeriod, scorePeople, scoreCommittees, scoreTeachers,
  topAttendance, topTasks, knightOf, WEIGHTS,
} from '../lib/excellence'

type Level = 'people' | 'committees'
type Span = 'current' | 'previous'

/**
 * لوحة الشرف — الخانة التحفيزية الإدارية:
 * فارس الأسبوع وفارس الشهر، والأعلى حضورًا والأعلى إنجازًا للمهام،
 * على مستوى الأفراد وعلى مستوى اللجان بالمعايير نفسها.
 */
export default function Excellence({ scope = 'mosque' }: { scope?: 'complex' | 'mosque' | 'mine' }) {
  const { db } = useDb()
  const { user } = useAuth()
  const { mid = '' } = useParams()
  const [level, setLevel] = useState<Level>('people')
  const [span, setSpan] = useState<Span>('current')
  const [board, setBoard] = useState<'week' | 'month'>('month')
  const [pick, setPick] = useState<string>('all')
  const [showAll, setShowAll] = useState(false)

  const mosqueId = scope === 'complex' ? pick : scope === 'mine' ? (user?.mosqueId as string) : mid
  const showMosque = mosqueId === 'all'
  const off = span === 'current' ? 0 : -1
  const week = weekPeriod(off)
  const month = monthPeriod(off)

  const data = useMemo(() => {
    const opts = { showMosque, meId: user?.id }
    const copts = { showMosque, mine: user?.committeeIds }
    const pw = personEntries(db, scorePeople(db, week, mosqueId), opts)
    const pm = personEntries(db, scorePeople(db, month, mosqueId), opts)
    const cw = committeeEntries(db, scoreCommittees(db, week, mosqueId), copts)
    const cm = committeeEntries(db, scoreCommittees(db, month, mosqueId), copts)
    const teachers = scoreTeachers(db, month, mosqueId).filter((t) => t.total > 0).slice(0, 5)
    return { pw, pm, cw, cm, teachers }
  }, [db, mosqueId, week.from, week.to, month.from, month.to, showMosque, user?.id, user?.committeeIds])

  if (!user) return null

  const wk = level === 'people' ? data.pw : data.cw
  const mo = level === 'people' ? data.pm : data.cm
  const ranked = board === 'week' ? wk : mo
  const boardPeriod = board === 'week' ? week : month
  const kind = level === 'people' ? 'person' : 'committee'
  const showHref = `/show${mosqueId !== 'all' ? `?m=${mosqueId}` : ''}`
  const mosque = db.mosques.find((m) => m.id === mosqueId)
  const noun = level === 'people' ? 'فارس' : 'لجنة'

  const winW = knightOf(wk)
  const winM = knightOf(mo)
  const runners = (rows: Entry[], w?: Entry) => (w ? rows.filter((r) => r.qualified && r.score > 0 && r.id !== w.id).slice(0, 2) : [])
  const full = ranked.filter((r) => r.att.total > 0 || r.tasks.total > 0)
  const list = showAll ? full : full.slice(0, 8)

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={scope === 'complex' ? 'التحفيز والأداء · المجمع' : `التحفيز والأداء · ${mosque?.name ?? ''}`}
        title="لوحة الشرف"
        description="تكريم المتميزين أسبوعيًا وشهريًا: فارس الأسبوع وفارس الشهر، والأعلى حضورًا والأعلى إنجازًا للمهام — للأفراد وللجان."
        actions={<>
          {scope === 'complex' && (
            <Select value={pick === 'all' ? '' : pick} onChange={(v) => setPick(v || 'all')} placeholder="كل المساجد"
              className="!h-10 !w-auto min-w-[170px] !text-[13px]"
              options={db.mosques.map((m) => ({ value: m.id, label: m.name }))} />
          )}
          <Link to={showHref} className="btn-accent btn-sm !h-10"><IconScreen className="w-4 h-4" /> شاشة العرض</Link>
        </>}
      />

      {/* أدوات التحكم */}
      <div className="flex flex-wrap items-center gap-2.5">
        <Seg value={level} onChange={setLevel} items={[
          { value: 'people', label: 'الأفراد' }, { value: 'committees', label: 'اللجان' },
        ]} />
        <Seg value={span} onChange={setSpan} items={[
          { value: 'current', label: 'الفترة الجارية' }, { value: 'previous', label: 'الفترة المكتملة السابقة' },
        ]} />
        <span className="text-[11.5px] font-bold text-ink-400 mr-auto">
          {span === 'current' ? 'النتائج حيّة وتتحدّث مع كل تحضير وإنجاز' : 'نتائج نهائية لأسبوع وشهر مكتملين'}
        </span>
      </div>

      {/* الفرسان */}
      <div className="grid lg:grid-cols-2 gap-4">
        <KnightCard title={`${noun} الأسبوع`} range={week.range} winner={winW} runners={runners(wk, winW)} kind={kind} />
        <KnightCard title={`${noun} الشهر`} range={month.range} winner={winM} runners={runners(mo, winM)} kind={kind} gold />
      </div>

      {/* لوحات الترتيب */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div>
          <h2 className="sect-title !text-[17px]">{level === 'people' ? 'ترتيب الأفراد' : 'ترتيب اللجان'}</h2>
          <p className="text-[11.5px] font-bold text-ink-400 mt-1">{boardPeriod.label} · {boardPeriod.range}</p>
        </div>
        <Seg value={board} onChange={setBoard} items={[
          { value: 'week', label: span === 'current' ? 'هذا الأسبوع' : 'الأسبوع الماضي' },
          { value: 'month', label: span === 'current' ? 'هذا الشهر' : 'الشهر الماضي' },
        ]} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Leaderboard title="الأعلى نسبة حضور" subtitle="الحضور من مجموع الأيام المسجّلة" icon={<IconPin className="w-[18px] h-[18px]" />}
          rows={topAttendance(ranked)} metric="att" empty="لا توجد سجلات حضور في هذه الفترة بعد." />
        <Leaderboard title="الأعلى إنجازًا للمهام" subtitle="المنجز من المهام المستحقة أو المنجزة في الفترة" icon={<IconCheck className="w-[18px] h-[18px]" />}
          rows={topTasks(ranked)} metric="tasks" empty="لا توجد مهام مستحقة في هذه الفترة بعد." />
      </div>

      <div className="grid xl:grid-cols-3 gap-4 items-start">
        {/* الترتيب العام بالدرجة المركّبة */}
        <Card className="xl:col-span-2" pad={false}
          title="الترتيب العام بدرجة التميّز"
          subtitle={`الدرجة = الحضور ${WEIGHTS.attendance}٪ + الإنجاز ${WEIGHTS.tasks}٪ + الالتزام بالموعد ${WEIGHTS.onTime}٪`}
          action={scope !== 'mine' && (
            <Link to={scope === 'complex' ? '/complex/insights' : `/m/${mid}/insights`} className="btn-ghost btn-sm">
              <IconPulse className="w-4 h-4" /> كل الأرقام
            </Link>
          )}>
          {full.length === 0 ? (
            <p className="text-center text-[12.5px] font-bold text-ink-400 py-12">لا توجد بيانات في هذه الفترة بعد.</p>
          ) : (
            <>
              <ol className="divide-y divide-line/70">
                {list.map((r, i) => (
                  <li key={r.id} className={`grid grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_1fr_repeat(3,72px)_110px] items-center gap-3 px-4 sm:px-5 py-3
                    ${r.mine ? 'bg-orange-50/70' : ''}`}>
                    <Medal rank={i + 1} />
                    <div className="flex items-center gap-2.5 min-w-0">
                      {level === 'people' && <Avatar name={r.name} size={34} />}
                      <div className="min-w-0">
                        <p className="font-bold text-[13.5px] truncate">
                          {r.name} {r.mine && <span className="chip !py-0.5 bg-orange-500 text-white mr-1">{level === 'people' ? 'أنت' : 'لجنتك'}</span>}
                        </p>
                        <p className="text-[10.5px] font-bold text-ink-400 truncate">
                          {r.sub}{!r.qualified && ' · سجلات غير كافية للمنافسة'}
                        </p>
                      </div>
                    </div>
                    <Metric k="الحضور" v={r.att.total ? `${r.att.rate}%` : '—'} />
                    <Metric k="الإنجاز" v={r.tasks.total ? `${r.tasks.rate}%` : '—'} />
                    <Metric k="بالموعد" v={r.tasks.done ? `${r.tasks.onTimeRate}%` : '—'} />
                    <div className="flex items-center gap-2 justify-end">
                      <div className="hidden sm:block flex-1 h-1.5 rounded-full bg-line overflow-hidden">
                        <div className={`h-full rounded-full ${i === 0 ? 'bg-orange-500' : 'bg-navy-600'}`} style={{ width: `${r.score}%` }} />
                      </div>
                      <span className="num text-[15px] w-10 text-left">{fmtScore(r.score)}</span>
                    </div>
                  </li>
                ))}
              </ol>
              {full.length > 8 && (
                <div className="px-5 py-3 border-t border-line/70">
                  <button className="btn-ghost btn-sm w-full" onClick={() => setShowAll((s) => !s)}>
                    {showAll ? 'عرض أقل' : `عرض الكل (${full.length})`}
                  </button>
                </div>
              )}
            </>
          )}
        </Card>

        <div className="space-y-4">
          {level === 'people' && (
            <Card title="المعلمون الأكثر انضباطًا" subtitle={`${month.label} · الحضور دون تأخير`} pad={false}
              action={<span className="w-9 h-9 rounded-xl grid place-items-center bg-navy-50 text-navy-700"><IconBook className="w-[18px] h-[18px]" /></span>}>
              {data.teachers.length === 0 ? (
                <p className="text-center text-[12.5px] font-bold text-ink-400 py-8 px-4">لم يُرصد حضور المعلمين في هذه الفترة.</p>
              ) : (
                <ol className="divide-y divide-line/70">
                  {data.teachers.map((t, i) => (
                    <li key={t.id} className="flex items-center gap-3 px-4 sm:px-5 py-2.5">
                      <Medal rank={i + 1} size={24} />
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-[13px] truncate">{t.teacher.name}</p>
                        <p className="text-[10.5px] font-bold text-ink-400 truncate">
                          {t.teacher.circle || 'حلقة'} · {t.present} في الوقت · {t.late} تأخير
                        </p>
                      </div>
                      <span className="num text-[15px]">{t.punctual}%</span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          )}

          <Card title="كيف يُختار الفارس؟">
            <ul className="space-y-3 text-[12.5px] leading-6 text-ink-700">
              <li className="flex gap-2.5"><Dot /> <span><b>الحضور ({WEIGHTS.attendance}٪):</b> أيام الحضور من مجموع الأيام المسجّلة في الفترة.</span></li>
              <li className="flex gap-2.5"><Dot /> <span><b>إنجاز المهام ({WEIGHTS.tasks}٪):</b> المنجز من المهام التي استحقت أو أُنجزت في الفترة.</span></li>
              <li className="flex gap-2.5"><Dot /> <span><b>الالتزام بالموعد ({WEIGHTS.onTime}٪):</b> ما أُنجز قبل موعده أو فيه.</span></li>
              <li className="flex gap-2.5"><Dot /> <span><b>عدالة المنافسة:</b> لا يدخل المنافسة إلا من سُجّل له نصف أيام الأكثر سجلات على الأقل، وعند التساوي يتقدّم الأكثر إنجازًا ثم الأكثر حضورًا.</span></li>
              <li className="flex gap-2.5"><Dot /> <span><b>اللجان:</b> متوسط حضور أعضائها، ونسبة إنجاز مهام اللجنة بالمعايير نفسها.</span></li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Metric({ k, v }: { k: string; v: string }) {
  return (
    <div className="hidden sm:block text-center">
      <p className="num text-[13.5px]">{v}</p>
      <p className="text-[9.5px] font-bold text-ink-400">{k}</p>
    </div>
  )
}

const Dot = () => <i className="mt-[9px] w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />
