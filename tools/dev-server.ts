/**
 * خادم تطوير محلي يحاكي بيئة Vercel:
 * يخدم مجلد dist ويوجّه /api/** إلى الدوال في مجلد api.
 *
 *   DATABASE_URL=... AUTH_SECRET=... npm run dev:api
 */
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { pathToFileURL } from 'node:url'

const PORT = Number(process.env.PORT ?? 3000)
const ROOT = process.cwd()
const DIST = join(ROOT, 'dist')

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
  '.ico': 'image/x-icon', '.pdf': 'application/pdf',
}

/** يحوّل مسار الطلب إلى ملف الدالة، مع دعم [id] */
async function resolveHandler(pathname: string): Promise<{ file: string; params: Record<string, string> } | null> {
  const parts = pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean)
  const candidates: { file: string; params: Record<string, string> }[] = []

  const direct = join(ROOT, 'api', ...parts) + '.ts'
  candidates.push({ file: direct, params: {} })
  candidates.push({ file: join(ROOT, 'api', ...parts, 'index.ts'), params: {} })

  if (parts.length >= 1) {
    const head = parts.slice(0, -1)
    const last = parts[parts.length - 1]
    candidates.push({ file: join(ROOT, 'api', ...head, '[id].ts'), params: { id: last } })
  }

  for (const c of candidates) {
    try { await stat(c.file); return c } catch { /* التالي */ }
  }
  return null
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)

  if (url.pathname.startsWith('/api/')) {
    const found = await resolveHandler(url.pathname)
    if (!found) { res.statusCode = 404; return res.end(JSON.stringify({ error: 'not_found' })) }

    const chunks: Buffer[] = []
    for await (const c of req) chunks.push(c as Buffer)
    const raw = Buffer.concat(chunks).toString()
    let body: any = undefined
    if (raw) { try { body = JSON.parse(raw) } catch { body = raw } }

    const query: Record<string, string> = { ...found.params }
    url.searchParams.forEach((v, k) => { query[k] = v })

    const vreq: any = { ...req, method: req.method, headers: req.headers, url: req.url, body, query, cookies: {} }
    const vres: any = res
    vres.status = (c: number) => { res.statusCode = c; return vres }
    vres.json = (o: unknown) => {
      if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify(o))
      return vres
    }
    vres.send = (b: any) => { res.end(Buffer.isBuffer(b) ? b : String(b)); return vres }

    try {
      const mod = await import(pathToFileURL(found.file).href)
      await mod.default(vreq, vres)
    } catch (e: any) {
      console.error('API error', url.pathname, e)
      if (!res.headersSent) { res.statusCode = 500; res.end(JSON.stringify({ error: 'server_error', message: e?.message })) }
    }
    return
  }

  // ملفات ثابتة من dist، وأي مسار آخر يذهب إلى index.html
  const safe = normalize(url.pathname).replace(/^(\.\.[/\\])+/, '')
  let file = join(DIST, safe)
  try {
    const st = await stat(file)
    if (st.isDirectory()) file = join(file, 'index.html')
  } catch {
    file = join(DIST, 'index.html')
  }
  try {
    const buf = await readFile(file)
    res.setHeader('Content-Type', MIME[extname(file)] ?? 'application/octet-stream')
    res.end(buf)
  } catch {
    res.statusCode = 404
    res.end('not found')
  }
})

server.listen(PORT, () => {
  console.log(`الخادم المحلي يعمل على http://localhost:${PORT}`)
  console.log(`قاعدة البيانات: ${process.env.DATABASE_URL ? 'مضبوطة' : 'غير مضبوطة (وضع محلي)'}`)
})
