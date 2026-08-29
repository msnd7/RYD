import type { VercelRequest, VercelResponse } from '@vercel/node'
import { fail, hashPassword, sessionFrom } from '../_lib/auth.js'
import { findById, loadState, mutateState } from '../_lib/state.js'

/** إعادة تعيين رمز أي حساب إلى الرمز المبدئي — لمدير المجمع فقط */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return fail(res, 405, 'method_not_allowed')
    res.setHeader('Cache-Control', 'no-store')

  const s = sessionFrom(req)
    if (!s) return fail(res, 401, 'unauthenticated')

  const { personId } = (req.body ?? {}) as { personId?: string }
    if (!personId) return fail(res, 400, 'missing_person')

  try {
        const { doc } = await loadState()
        const me = findById(doc, s.uid)
        if (!me || me.role !== 'director') return fail(res, 403, 'forbidden')

      const target = findById(doc, personId)
        if (!target) return fail(res, 404, 'not_found')

      const defaultPassword = doc.settings.defaultPassword
        await mutateState((d) => {
                const p = d.people.find((x) => x.id === personId)
                if (!p) throw new Error('NOT_FOUND')
                p.passwordHash = hashPassword(defaultPassword)
                p.password = ''
                p.mustChangePassword = true
        }, s.uid)

      res.status(200).json({ ok: true, defaultPassword })
  } catch (e: any) {
        if (e?.message === 'DATABASE_NOT_CONFIGURED') return fail(res, 503, 'no_database')
        return fail(res, 500, 'server_error', e?.message)
  }
}
