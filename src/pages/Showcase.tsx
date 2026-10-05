import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useDb } from '../store/db'
import { useAuth } from '../store/auth'
import { LogoMark } from '../components/Brand'
import { Avatar, Medal, Ring, fmtScore, personEntries, committeeEntries, type Entry } from '../components/honors'
import { IconCrown, IconTrophy } from '../components/icons'
import {
  weekPeriod, monthPeriod, scorePeople, scoreCommittees, scoreTeachers,
  topAttendance, topTasks, knightOf, type Period,
} from '../lib/excellence'
import { fmtDayName, fmtDate, fmtHijri, todayISO } from '../lib/date'

const SLIDE_MS = 10000

type Slide =
  | { kind: 'intro' }
  | { kind: 'knight'; title: string; period: Period; winner: Entry; runners: Entry[]; level: 'person' | 'committee' }
  | { kind: 'top'; title: string; sub: string; rows: Entry[]; metric: 'att' | 'tasks' }
  | { kind: 'teachers'; rows: { name: string; sub: string; value: number }[] }

/**
 * شاشة العرض — تُفتح على شاشة المسجد أو قاعة الاجتماعات:
 * شرائح تتبدّل تلقائيًا تعرض فرسان الأسبوع والشهر والأعلى حضورًا وإنجازًا، أفرادًا ولجانًا.
 */
export default function Showcase() {
  const { db } = useDb()
  const { user } = useAuth()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [idle, setIdle] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const idleTimer = useRef<ReturnType<typeof setTimeout>>()

  // مدير المجمع يختار أي مسجد أو المجمع كله، وغيره يرى مسجده فقط
  const requested = params.get('m') ?? 'all'
  const mosqueId = user?.role === 'director'
    ? (requested === 'all' || db.mosques.some((m) => m.id === requested) ? requested : 'all')
    : (user?.mosqueId as string)
  const mosque = db.mosques.find((m) => m.id === mosqueId)
  const showMosque = mosqueId === 'all'

  const slides = useMemo<Slide[]>(() => {
    const week = weekPeriod(0)
    const month = monthPeriod(0)
    const pw = personEntries(db, scorePeople(db, week, mosqueId), { showMosque })
    const pm = personEntries(db, scorePeople(db, month, mosqueId), { showMosque })
    const cw = committeeEntries(db, scoreCommittees(db, week, mosqueId), { showMosque })
    const cm = committeeEntries(db, scoreCommittees(db, month, mosqueId), { showMosque })
    const out: Slide[] = [{ kind: 'intro' }]
    const knight = (rows: Entry[], title: string, period: Period, level: 'person' | 'committee') => {
      const w = knightOf(rows)
      if (w) out.push({ kind: 'knight', title, period, winner: w, level,
        runners: rows.filter((r) => r.qualified && r.score > 0 && r.id !== w.id).slice(0, 2) })
    }
    knight(pw, 'فارس الأسبوع', week, 'person')
    knight(pm, 'فارس الشهر', month, 'person')
    const ta = topAttendance(pm, 5)
    if (ta.length) out.push({ kind: 'top', title: 'الأعلى نسبة حضور', sub: `الأفراد · ${month.label}`, rows: ta, metric: 'att' })
    const tt = topTasks(pm, 5)
    if (tt.length) out.push({ kind: 'top', title: 'الأعلى إنجازًا للمهام', sub: `الأفراد · ${month.label}`, rows: tt, metric: 'tasks' })
    knight(cw, 'لجنة الأسبوع المتميزة', week, 'committee')
    knight(cm, 'لجنة الشهر المتميزة', month, 'committee')
    const ca = topAttendance(cm, 5)
    if (ca.length) out.push({ kind: 'top', title: 'اللجان الأعلى حضورًا', sub: month.label, rows: ca, metric: 'att' })
    const ct = topTasks(cm, 5)
    if (ct.length) out.push({ kind: 'top', title: 'اللجان الأعلى إنجازًا', sub: month.label, rows: ct, metric: 'tasks' })
    const teachers = scoreTeachers(db, month, mosqueId).filter((t) => t.total > 0).slice(0, 5)
    if (teachers.length) out.push({
      kind: 'teachers',
      rows: teachers.map((t) => ({ name: t.teacher.name, sub: t.teacher.circle || 'حلقة', value: t.punctual })),
    })
    return out
  }, [db, mosqueId, showMosque])

  const count = slides.length
  const go = useCallback((d: number) => setI((x) => (x + d + count) % count), [count])

  useEffect(() => { if (i >= count) setI(0) }, [count, i])

  useEffect(() => {
    if (!playing || count < 2) return
    const t = setTimeout(() => go(1), SLIDE_MS)
    return () => clearTimeout(t)
  }, [i, playing, count, go])

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000)
    return () => clearInterval(t)
  }, [])

  // إخفاء أدوات التحكم بعد السكون
  const wake = useCallback(() => {
    setIdle(false)
    clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => setIdle(true), 3500)
  }, [])
  useEffect(() => { wake(); return () => clearTimeout(idleTimer.current) }, [wake])

  const fullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen?.().catch(() => {})
  }

  const exit = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen()
    if (window.history.length > 1) nav(-1)
    else nav('/')
  }, [nav])

  // المقاسات بالبكسل تتبع ارتفاع الشاشة
  const [, setVh] = useState(window.innerHeight)
  useEffect(() => {
    const h = () => setVh(window.innerHeight)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      wake()
      if (e.key === 'ArrowLeft') go(1)
      else if (e.key === 'ArrowRight') go(-1)
      else if (e.key === ' ') { e.preventDefault(); setPlaying((p) => !p) }
      else if (e.key.toLowerCase() === 'f') fullscreen()
      else if (e.key === 'Escape' && !document.fullscreenElement) exit()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [go, wake, exit])

  const slide = slides[Math.min(i, count - 1)]
  const today = todayISO()
  const time = now.toLocaleTimeString('ar-SA-u-nu-latn', { hour: 'numeric', minute: '2-digit' })

  return (
    <div onPointerMove={wake} onClick={wake}
      className={`fixed inset-0 overflow-hidden text-white select-none ${idle ? 'cursor-none' : ''}`}
      style={{ background: 'radial-gradient(80% 60% at 85% 0%, #1D5287 0%, transparent 60%), radial-gradient(60% 60% at 0% 100%, rgba(240,130,14,.22) 0%, transparent 60%), linear-gradient(160deg, #0B2744 0%, #071A2E 55%, #040F1C 100%)' }}>
      {/* زخرفة */}
      <div aria-hidden className="absolute inset-0 opacity-[.07]"
        style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)', backgroundSize: '34px 34px' }} />

      {/* الترويسة */}
      <header className="absolute top-0 inset-x-0 flex items-center gap-4 px-[4vw] pt-[3vh]">
        <span className="rounded-2xl bg-white grid place-items-center shrink-0" style={{ width: '6.5vh', height: '6.5vh' }}>
          <LogoMark h={Math.round(window.innerHeight * 0.05)} />
        </span>
        <div className="min-w-0">
          <p className="font-display font-bold leading-tight" style={{ fontSize: 'clamp(16px,2.4vh,30px)' }}>
            {db.settings.complexName || 'مجمع رياض القرآن'}
          </p>
          <p className="text-white/55 font-bold" style={{ fontSize: 'clamp(11px,1.6vh,20px)' }}>
            {mosque ? mosque.name : 'جميع مساجد المجمع'} · لوحة الشرف
          </p>
        </div>
        <div className="mr-auto text-left">
          <p className="num" style={{ fontSize: 'clamp(18px,3vh,40px)' }}>{time}</p>
          <p className="text-white/55 font-bold" style={{ fontSize: 'clamp(10px,1.5vh,18px)' }}>
            {fmtDayName(today)} · {fmtHijri(today)}
          </p>
        </div>
      </header>

      {/* الشريحة */}
      <main className="absolute inset-0 flex items-center justify-center px-[5vw] pt-[12vh] pb-[12vh]">
        <div key={`${i}-${slide.kind}`} className="w-full max-w-[1500px] rise">
          {slide.kind === 'intro' && <Intro count={count - 1} mosqueName={mosque?.name} />}
          {slide.kind === 'knight' && <KnightSlide s={slide} />}
          {slide.kind === 'top' && <TopSlide s={slide} />}
          {slide.kind === 'teachers' && <TeachersSlide rows={slide.rows} />}
        </div>
      </main>

      {/* شريط التقدّم */}
      <div className="absolute bottom-0 inset-x-0 px-[4vw] pb-[3vh]">
        <div className="flex items-center gap-1.5 justify-center">
          {slides.map((_, k) => (
            <button key={k} onClick={() => setI(k)} aria-label={`الشريحة ${k + 1}`}
              className="relative h-1.5 rounded-full overflow-hidden bg-white/15 transition-all"
              style={{ width: k === i ? 56 : 18 }}>
              {k === i && (
                <span key={`${i}-${playing}`} className="absolute inset-y-0 right-0 bg-[#F5B544] rounded-full"
                  style={{ width: playing ? undefined : '100%', animation: playing && count > 1 ? `showbar ${SLIDE_MS}ms linear both` : undefined }} />
              )}
              {k < i && <span className="absolute inset-0 bg-white/40" />}
            </button>
          ))}
        </div>
      </div>

      {/* أدوات التحكم */}
      <div className={`absolute top-[12vh] left-[4vw] flex flex-col gap-2 transition-opacity duration-500 ${idle ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        {user?.role === 'director' && (
          <select value={mosqueId} onChange={(e) => { setI(0); setParams(e.target.value === 'all' ? {} : { m: e.target.value }) }}
            className="h-10 rounded-xl bg-white/10 border border-white/15 text-white text-[13px] font-bold px-3 outline-none backdrop-blur [&>option]:text-ink-900">
            <option value="all">جميع المساجد</option>
            {db.mosques.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        )}
        <div className="flex gap-2">
          {[
            { l: 'السابق', t: '→', f: () => go(-1) },
            { l: playing ? 'إيقاف مؤقت' : 'تشغيل', t: playing ? '❚❚' : '▶', f: () => setPlaying((p) => !p) },
            { l: 'التالي', t: '←', f: () => go(1) },
            { l: 'ملء الشاشة (F)', t: '⛶', f: fullscreen },
            { l: 'خروج', t: '✕', f: exit },
          ].map((b) => (
            <button key={b.l} onClick={b.f} title={b.l} aria-label={b.l}
              className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 grid place-items-center text-[14px] font-black backdrop-blur transition">
              {b.t}
            </button>
          ))}
        </div>
      </div>

      <style>{`@keyframes showbar { from { width: 0 } to { width: 100% } }`}</style>
    </div>
  )
}

/* ================= الشرائح ================= */

const H = (vh: number, min: number, max: number) => ({ fontSize: `clamp(${min}px, ${vh}vh, ${max}px)` })

function Intro({ count, mosqueName }: { count: number; mosqueName?: string }) {
  return (
    <div className="text-center">
      <span className="inline-grid place-items-center rounded-full text-[#FFD27A] bg-[#F5B544]/10 border border-[#F5B544]/30 float-y"
        style={{ width: '16vh', height: '16vh' }}>
        <IconTrophy className="w-[8vh] h-[8vh]" />
      </span>
      <h1 className="!text-white font-display font-bold mt-[4vh] leading-tight" style={H(8, 36, 110)}>لوحة الشرف</h1>
      <p className="text-white/65 font-bold mt-[2vh]" style={H(2.8, 15, 36)}>
        نحتفي بالمتميزين في الحضور والإنجاز{mosqueName ? ` — ${mosqueName}` : ''}
      </p>
      {count === 0 && (
        <p className="text-white/45 font-bold mt-[5vh]" style={H(2.2, 13, 28)}>
          تظهر هنا أسماء الفرسان تلقائيًا مع أول سجلات حضور وإنجاز للأسبوع والشهر.
        </p>
      )}
    </div>
  )
}

function KnightSlide({ s }: { s: Extract<Slide, { kind: 'knight' }> }) {
  const w = s.winner
  return (
    <div className="grid lg:grid-cols-[auto_1fr] items-center gap-[5vw]">
      <div className="relative mx-auto">
        <div aria-hidden className="absolute inset-0 rounded-full blur-3xl bg-[#F5B544]/25 scale-125" />
        <Ring value={w.score} size={Math.round(window.innerHeight * 0.36)} stroke={Math.round(window.innerHeight * 0.014)}>
          <span className="grid place-items-center">
            <span className="text-[#FFD27A] -mb-[1vh]"><IconCrown className="w-[7vh] h-[7vh]" /></span>
            {s.level === 'person'
              ? <Avatar name={w.name} size={Math.round(window.innerHeight * 0.17)} />
              : <span className="avatar" style={{ width: '17vh', height: '17vh', fontSize: '7vh' }}><IconTrophy className="w-[8vh] h-[8vh]" /></span>}
          </span>
        </Ring>
      </div>
      <div className="text-center lg:text-right min-w-0">
        <p className="inline-flex items-center gap-2 rounded-full bg-[#F5B544] text-[#3D2800] font-black px-[1.6vh] py-[.6vh]" style={H(2.2, 13, 26)}>
          <IconCrown className="w-[2.4vh] h-[2.4vh]" /> {s.title}
        </p>
        <h2 className="!text-white font-display font-bold leading-[1.15] mt-[2.5vh] break-words" style={H(8.5, 34, 120)}>{w.name}</h2>
        <p className="text-white/60 font-bold mt-[1.5vh]" style={H(2.6, 14, 32)}>{w.sub}</p>
        <p className="text-white/40 font-bold mt-[.6vh]" style={H(1.9, 12, 22)}>{fmtDate(s.period.from)} — {fmtDate(s.period.to)}</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-[1.4vh] mt-[4vh] max-w-[900px] mx-auto lg:mx-0">
          {[
            ['درجة التميّز', fmtScore(w.score)],
            ['الحضور', w.att.total ? `${w.att.rate}%` : '—'],
            ['إنجاز المهام', w.tasks.total ? `${w.tasks.rate}%` : '—'],
            ['في الموعد', w.tasks.done ? `${w.tasks.onTimeRate}%` : '—'],
          ].map(([k, v], idx) => (
            <div key={k} className={`rounded-[2vh] border px-[2vh] py-[1.8vh] ${idx === 0 ? 'bg-[#F5B544]/15 border-[#F5B544]/40' : 'bg-white/[.06] border-white/10'}`}>
              <p className="text-white/55 font-bold" style={H(1.7, 11, 20)}>{k}</p>
              <p className={`num mt-[.6vh] ${idx === 0 ? 'text-[#FFD27A]' : ''}`} style={H(4.6, 22, 60)}>{v}</p>
            </div>
          ))}
        </div>

        {s.runners.length > 0 && (
          <div className="flex flex-wrap gap-[1.2vh] mt-[3vh] justify-center lg:justify-start">
            {s.runners.map((r, k) => (
              <span key={r.id} className="inline-flex items-center gap-[1vh] rounded-full bg-white/[.07] border border-white/10 pl-[2vh] pr-[.6vh] py-[.6vh]">
                <Medal rank={k + 2} size={Math.round(window.innerHeight * 0.04)} />
                <span className="font-bold" style={H(2.1, 12, 26)}>{r.name}</span>
                <span className="num text-white/55" style={H(1.9, 11, 22)}>{fmtScore(r.score)}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TopSlide({ s }: { s: Extract<Slide, { kind: 'top' }> }) {
  return (
    <div>
      <div className="text-center mb-[4vh]">
        <h2 className="!text-white font-display font-bold" style={H(6, 28, 80)}>{s.title}</h2>
        <p className="text-white/55 font-bold mt-[1vh]" style={H(2.3, 13, 28)}>{s.sub}</p>
      </div>
      <ol className="space-y-[1.4vh] max-w-[1200px] mx-auto">
        {s.rows.map((r, k) => {
          const v = s.metric === 'att' ? r.att.rate : r.tasks.rate
          const hint = s.metric === 'att' ? `${r.att.present} يوم حضور` : `${r.tasks.done} من ${r.tasks.total} مهمة`
          return (
            <li key={r.id} className={`rise flex items-center gap-[2.4vh] rounded-[2.2vh] border px-[2.6vh] py-[1.6vh]
              ${k === 0 ? 'bg-[#F5B544]/12 border-[#F5B544]/35' : 'bg-white/[.05] border-white/10'}`}
              style={{ animationDelay: `${k * 120}ms` }}>
              <Medal rank={k + 1} size={Math.round(window.innerHeight * 0.06)} />
              <div className="min-w-0 flex-1">
                <p className="font-display font-bold truncate" style={H(3.4, 16, 44)}>{r.name}</p>
                <p className="text-white/50 font-bold truncate" style={H(1.8, 11, 22)}>{r.sub} · {hint}</p>
              </div>
              <div className="hidden sm:block w-[26vw] h-[1.2vh] rounded-full bg-white/10 overflow-hidden">
                <div className={`h-full rounded-full ${k === 0 ? 'bg-[#F5B544]' : 'bg-[#5BA4E6]'}`} style={{ width: `${v}%` }} />
              </div>
              <span className="num w-[12vh] text-left" style={H(4.4, 20, 56)}>{v}%</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function TeachersSlide({ rows }: { rows: { name: string; sub: string; value: number }[] }) {
  return (
    <div>
      <div className="text-center mb-[4vh]">
        <h2 className="!text-white font-display font-bold" style={H(6, 28, 80)}>المعلمون الأكثر انضباطًا</h2>
        <p className="text-white/55 font-bold mt-[1vh]" style={H(2.3, 13, 28)}>الحضور في الوقت دون تأخير · هذا الشهر</p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-[2vh] max-w-[1400px] mx-auto">
        {rows.map((r, k) => (
          <div key={r.name} className={`rise text-center rounded-[2.4vh] border px-[2vh] py-[3vh]
            ${k === 0 ? 'bg-[#F5B544]/12 border-[#F5B544]/35' : 'bg-white/[.05] border-white/10'}`}
            style={{ animationDelay: `${k * 120}ms` }}>
            <div className="flex justify-center"><Medal rank={k + 1} size={Math.round(window.innerHeight * 0.06)} /></div>
            <p className="font-display font-bold mt-[2vh] leading-snug" style={H(2.8, 15, 36)}>{r.name}</p>
            <p className="text-white/50 font-bold mt-[.6vh] truncate" style={H(1.7, 11, 20)}>{r.sub}</p>
            <p className="num mt-[2vh] text-[#FFD27A]" style={H(5, 24, 64)}>{r.value}%</p>
          </div>
        ))}
      </div>
    </div>
  )
}
