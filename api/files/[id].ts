import type { VercelRequest, VercelResponse } from '@vercel/node'
import { fail, sessionFrom } from '../_lib/auth.js'
import { ensureSchema, query } from '../_lib/db.js'

/** تنزيل ملف مرفوع — يتطلب جلسة صالحة */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const s = sessionFrom(req)
  if (!s) return fail(res, 401, 'unauthenticated')

  const id = String(req.query.id ?? '')
  if (!/^[a-f0-9]{32}$/.test(id)) return fail(res, 400, 'bad_id')

  try {
    await ensureSchema()
    const rows = await query<{ name: string; mime: string; data: Buffer }>(
      'SELECT name, mime, data FROM ryd_files WHERE id = $1', [id],
    )
    if (!rows.length) return fail(res, 404, 'not_found')
    const f = rows[0]
    res.setHeader('Content-Type', f.mime)
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(f.name)}`)
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable')
    res.status(200).send(f.data)
  } catch (e: any) {
    if (e?.message === 'DATABASE_NOT_CONFIGURED') return fail(res, 503, 'no_database')
    return fail(res, 500, 'server_error', e?.message)
  }
}
