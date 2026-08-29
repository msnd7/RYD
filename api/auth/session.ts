import type { VercelRequest, VercelResponse } from '@vercel/node'
import { fail, sessionFrom } from '../_lib/auth.js'
import { findById, loadState, sanitize } from '../_lib/state.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  const s = sessionFrom(req)
  if (!s) return fail(res, 401, 'unauthenticated')
  try {
    const { doc } = await loadState()
    const person = findById(doc, s.uid)
    if (!person || !person.active) return fail(res, 401, 'unauthenticated')
    res.status(200).json({ user: sanitize(doc).people.find((p) => p.id === person.id) })
  } catch (e: any) {
    if (e?.message === 'DATABASE_NOT_CONFIGURED') return fail(res, 503, 'no_database')
    return fail(res, 500, 'server_error', e?.message)
  }
}
