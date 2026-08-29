import type { VercelRequest, VercelResponse } from '@vercel/node'
import { fail, hashPassword, sessionFrom, verifyPassword } from '../_lib/auth.js'
import { mutateState, loadState, findById } from '../_lib/state.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return fail(res, 405, 'method_not_allowed')
    res.setHeader('Cache-Control', 'no-store')

  const s = sessionFrom(req)
    if (!s) return fail(res, 401, 'unauthenticated')

  const { current, next } = (req.body ?? {}) as { current?: string; next?: string }
    if (!current || !next) return fail(res, 400, 'missing_fields')
    if (next.length < 4) return fail(res, 400, 'too_short')

  try {
        const { doc } = await loadState()
        const me = findById(doc, s.uid)
        if (!me) return fail(res, 401, 'unauthenticated')
        if (!verifyPassword(current, me.passwordHash)) return fail(res, 400, 'wrong_current')
        if (next === doc.settings.defaultPassword) return fail(res, 400, 'is_default')

      await mutateState((d) => {
              const p = d.people.find((x) => x.id === s.uid)
              if (!p) throw new Error('NOT_FOUND')
              p.passwordHash = hashPassword(next)
              p.password = ''
              p.mustChangePassword = false
      }, s.uid)

      res.status(200).json({ ok: true })
  } catch (e: any) {
        if (e?.message === 'DATABASE_NOT_CONFIGURED') return fail(res, 503, 'no_database')
        return fail(res, 500, 'server_error', e?.message)
  }
}
