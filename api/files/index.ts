import type { VercelRequest, VercelResponse } from '@vercel/node'
import { randomUUID } from 'node:crypto'
import { fail, sessionFrom } from '../_lib/auth'
import { ensureSchema, query } from '../_lib/db'

/** حدّ Vercel لجسم الطلب ٤٫٥ ميجابايت، و base64 يزيد الحجم نحو ٣٣٪ */
const MAX_BYTES = 3 * 1024 * 1024

/** رفع فاتورة أو شاهد — يُخزَّن في قاعدة البيانات ويُشار إليه برابط */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return fail(res, 405, 'method_not_allowed')
  res.setHeader('Cache-Control', 'no-store')

  const s = sessionFrom(req)
  if (!s) return fail(res, 401, 'unauthenticated')

  const { name, mime, dataBase64 } = (req.body ?? {}) as
    { name?: string; mime?: string; dataBase64?: string }
  if (!name || !mime || !dataBase64) return fail(res, 400, 'bad_request')

  const buf = Buffer.from(dataBase64, 'base64')
  if (!buf.length) return fail(res, 400, 'empty_file')
  if (buf.length > MAX_BYTES) return fail(res, 413, 'too_large')

  try {
    await ensureSchema()
    const id = randomUUID().replace(/-/g, '')
    await query(
      'INSERT INTO ryd_files (id, name, mime, size, data, created_by) VALUES ($1,$2,$3,$4,$5,$6)',
      [id, String(name).slice(0, 200), String(mime).slice(0, 120), buf.length, buf, s.uid],
    )
    res.status(200).json({ id, url: `/api/files/${id}`, name, type: mime, size: buf.length })
  } catch (e: any) {
    if (e?.message === 'DATABASE_NOT_CONFIGURED') return fail(res, 503, 'no_database')
    return fail(res, 500, 'server_error', e?.message)
  }
}
