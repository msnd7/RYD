import type { VercelRequest, VercelResponse } from '@vercel/node'
import { fail, sessionFrom } from './_lib/auth.js'
import { enforcePermissions, findById, loadState, mergeSecrets, sanitize, saveState } from './_lib/state.js'

/**
 * GET  /api/state           → { doc, version } الوثيقة كاملة بلا أسرار
 * PUT  /api/state           → { version, doc } كتابة بالتحقق من الإصدار
 *                             ترجع 409 عند التعارض ليعيد المتصفح تطبيق تعديله
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')

  const s = sessionFrom(req)
  if (!s) return fail(res, 401, 'unauthenticated')

  try {
    const current = await loadState()
    const me = findById(current.doc, s.uid)
    if (!me || !me.active) return fail(res, 401, 'unauthenticated')

    if (req.method === 'GET') {
      return res.status(200).json({ doc: sanitize(current.doc), version: current.version })
    }

    if (req.method === 'PUT') {
      const body = (req.body ?? {}) as { version?: number; doc?: any }
      if (!body.doc || typeof body.version !== 'number') return fail(res, 400, 'bad_request')

      if (body.version !== current.version) {
        // إصدار قديم: أعِد الحالي ليعيد المتصفح تطبيق تعديله عليه
        return res.status(409).json({
          error: 'version_conflict',
          doc: sanitize(current.doc),
          version: current.version,
        })
      }

      const allowed = enforcePermissions(body.doc, current.doc, me)
      const merged = mergeSecrets(allowed, current.doc)
      const saved = await saveState(merged, current.version, s.uid)
      if (!saved) {
        const fresh = await loadState()
        return res.status(409).json({
          error: 'version_conflict',
          doc: sanitize(fresh.doc),
          version: fresh.version,
        })
      }
      return res.status(200).json({ version: saved.version })
    }

    return fail(res, 405, 'method_not_allowed')
  } catch (e: any) {
    if (e?.message === 'DATABASE_NOT_CONFIGURED') return fail(res, 503, 'no_database')
    return fail(res, 500, 'server_error', e?.message)
  }
}
