import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createSessionToken, fail, setSessionCookie, verifyPassword } from '../_lib/auth.js'
import { findByEmail, loadState, sanitize, saveState } from '../_lib/state.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return fail(res, 405, 'method_not_allowed')
  res.setHeader('Cache-Control', 'no-store')

  const { email, password } = (req.body ?? {}) as { email?: string; password?: string }
  if (!email || !password) return fail(res, 400, 'missing_credentials')

  try {
    const { doc, version } = await loadState()
    const person = findByEmail(doc, email)
    if (!person) return fail(res, 401, 'notfound')
    if (!person.active) return fail(res, 403, 'inactive')
    if (!verifyPassword(password, person.passwordHash)) return fail(res, 401, 'wrong')

    person.lastLoginAt = new Date().toISOString()
    await saveState(doc, version, person.id)   // تجاهل التعارض: تسجيل وقت الدخول غير حرج

    setSessionCookie(res, createSessionToken(person.id))
    res.status(200).json({ user: sanitize(doc).people.find((p) => p.id === person.id) })
  } catch (e: any) {
    if (e?.message === 'DATABASE_NOT_CONFIGURED') return fail(res, 503, 'no_database')
    return fail(res, 500, 'server_error', e?.message)
  }
}
