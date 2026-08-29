import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isConfigured } from './_lib/db.js'

/** يخبر المتصفح هل الخادم وقاعدة البيانات جاهزان (وضع المشاركة) أم لا (وضع محلي) */
export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json({ ok: true, storage: isConfigured() ? 'database' : 'none' })
}
