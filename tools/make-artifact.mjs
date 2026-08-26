/**
 * يحوّل ناتج `npm run build:single` إلى صفحة واحدة صالحة للنشر
 * كـ Artifact (بدون وسوم html/head/body، ومع ضبط اتجاه الصفحة).
 */
import fs from 'node:fs'
import path from 'node:path'

const src = process.argv[2] ?? 'dist-single/index.html'
const out = process.argv[3] ?? 'dist-single/artifact.html'
let html = fs.readFileSync(src, 'utf8')

const grab = (re) => [...html.matchAll(re)].map((m) => m[0]).join('\n')
const styles = grab(/<style[\s\S]*?<\/style>/g)
const scripts = grab(/<script(?![^>]*\bsrc=)[\s\S]*?<\/script>/g)

// شعار الصفحة الافتتاحية كـ data URI
const logo = fs.readFileSync(path.join(path.dirname(src), 'logo.png')).toString('base64')

// ترميز المحارف غير اللاتينية داخل الجافاسكربت إلى \uXXXX
// ليعمل الملف مهما كان ترميز الخادم المُضيف
const escapeJs = (code) => code.replace(/[\u0080-\uFFFF]/g, (c) =>
  '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))
// وترميز النصوص الظاهرة في الوسوم إلى كيانات HTML رقمية
const escapeHtml = (t) => t.replace(/[\u0080-\uFFFF]/g, (c) => `&#${c.charCodeAt(0)};`)

const safeScripts = scripts.replace(/(<script[^>]*>)([\s\S]*?)(<\/script>)/g,
  (_, a, body, b) => a + escapeJs(body) + b)

const page = `<title>رياض القرآن</title>
<style>
  html { direction: rtl; }
  #boot { position: fixed; inset: 0; display: grid; place-items: center; background: #F4F7FB; z-index: 9999; }
  #boot img { width: 96px; height: 96px; object-fit: contain; animation: bp 1.4s ease-in-out infinite; }
  @keyframes bp { 0%,100% { opacity:.55; transform: scale(.97) } 50% { opacity:1; transform: scale(1) } }
</style>
${styles}
<script>
  document.documentElement.setAttribute('dir','rtl');
  document.documentElement.setAttribute('lang','ar');
</script>
<div id="boot"><img src="data:image/png;base64,${logo}" alt="${escapeHtml('رياض القرآن')}" /></div>
<div id="root"></div>
${safeScripts}
`

fs.writeFileSync(out, page)
console.log(`${out} — ${(Buffer.byteLength(page) / 1024 / 1024).toFixed(2)} MB`)
