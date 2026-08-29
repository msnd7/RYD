import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'

export type ThemeChoice = 'light' | 'dark' | 'system'
const KEY = 'ryd.theme'

const readChoice = (): ThemeChoice => {
  const v = localStorage.getItem(KEY)
  return v === 'light' || v === 'dark' ? v : 'system'
}

const systemPrefersDark = () =>
  window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false

function apply(choice: ThemeChoice) {
  const dark = choice === 'dark' || (choice === 'system' && systemPrefersDark())
  const root = document.documentElement
  root.setAttribute('data-theme', dark ? 'dark' : 'light')
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', dark ? '#0A1420' : '#12395F')
  return dark
}

type Ctx = {
  choice: ThemeChoice
  isDark: boolean
  setChoice: (c: ThemeChoice) => void
  toggle: () => void
}

const ThemeCtx = createContext<Ctx | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>(readChoice)
  const [isDark, setIsDark] = useState(() => apply(readChoice()))

  const setChoice = useCallback((c: ThemeChoice) => {
    setChoiceState(c)
    if (c === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, c)
    setIsDark(apply(c))
  }, [])

  // تتبّع إعداد الجهاز عندما يكون الاختيار «حسب النظام»
  useEffect(() => {
    if (choice !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const h = () => setIsDark(apply('system'))
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [choice])

  const toggle = useCallback(() => {
    setChoice(isDark ? 'light' : 'dark')
  }, [isDark, setChoice])

  return React.createElement(ThemeCtx.Provider, { value: { choice, isDark, setChoice, toggle } }, children)
}

export function useTheme() {
  const c = useContext(ThemeCtx)
  if (!c) throw new Error('useTheme خارج ThemeProvider')
  return c
}

/** زر تبديل النظام الليلي والنهاري */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { isDark, toggle } = useTheme()
  return (
    <button
      onClick={toggle}
      className={`btn-icon ${className}`}
      title={isDark ? 'التحويل إلى النظام النهاري' : 'التحويل إلى النظام الليلي'}
      aria-label={isDark ? 'التحويل إلى النظام النهاري' : 'التحويل إلى النظام الليلي'}
    >
      {isDark ? (
        <svg viewBox="0 0 24 24" className="w-[19px] h-[19px]" fill="none" stroke="currentColor"
          strokeWidth="1.8" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="w-[19px] h-[19px]" fill="none" stroke="currentColor"
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.5 14.5A8.6 8.6 0 0 1 9.5 3.5a8.6 8.6 0 1 0 11 11z" />
        </svg>
      )}
    </button>
  )
}
