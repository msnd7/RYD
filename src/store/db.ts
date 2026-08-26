import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { DB } from '../types'
import { buildSeed } from '../data/seed'

const KEY = 'ryd.db.v3'

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DB
      if (parsed && parsed.version === 3) return parsed
    }
  } catch { /* ignore */ }
  return buildSeed()
}

type Ctx = {
  db: DB
  set: (fn: (d: DB) => void) => void
  reset: () => void
  exportJson: () => void
  importJson: (file: File) => Promise<void>
}

const DbCtx = createContext<Ctx | null>(null)

export function DbProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<DB>(load)

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(db)) } catch { /* quota */ }
  }, [db])

  // مزامنة بين تبويبات المتصفح
  useEffect(() => {
    const h = (e: StorageEvent) => {
      if (e.key === KEY && e.newValue) {
        try { setDb(JSON.parse(e.newValue)) } catch { /* ignore */ }
      }
    }
    window.addEventListener('storage', h)
    return () => window.removeEventListener('storage', h)
  }, [])

  const value = useMemo<Ctx>(() => ({
    db,
    set: (fn) => setDb((prev) => {
      const next: DB = JSON.parse(JSON.stringify(prev))
      fn(next)
      return next
    }),
    reset: () => { localStorage.removeItem(KEY); setDb(buildSeed()) },
    exportJson: () => {
      const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `نسخة-رياض-القرآن-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(a.href)
    },
    importJson: async (file: File) => {
      const text = await file.text()
      const parsed = JSON.parse(text) as DB
      if (!parsed.mosques || !parsed.people) throw new Error('ملف غير صالح')
      setDb(parsed)
    },
  }), [db])

  return React.createElement(DbCtx.Provider, { value }, children)
}

export function useDb() {
  const c = useContext(DbCtx)
  if (!c) throw new Error('useDb خارج DbProvider')
  return c
}

export const uid = (p = 'id') => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
