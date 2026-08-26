import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const COOKIE = 'ryd_session'
const MAX_AGE = 60 * 60 * 24 * 30 // ثلاثون يومًا

function secret(): string {
  const s = process.env.AUTH_SECRET || process.env.SESSION_SECRET
  if (s && s.length >= 16) return s
  // احتياط: مشتق من رابط قاعدة البيانات حتى لا تنهار الجلسات إن نُسي المتغيّر
  const fallback = process.env.DATABASE_URL || process.env.POSTGRES_URL || ''
  if (!fallback) throw new Error('AUTH_SECRET_MISSING')
  return createHmac('sha256', 'ryd-fallback').update(fallback).digest('hex')
}

/* ================= كلمات المرور ================= */

/** scrypt مع ملح عشوائي — الصيغة: scrypt$<salt hex>$<hash hex> */
export function hashPassword(plain: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(plain.normalize('NFKC'), salt, 64)
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`
}

export function verifyPassword(plain: string, stored?: string): boolean {
  if (!stored) return false
  const parts = stored.split('$')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false
  try {
    const salt = Buffer.from(parts[1], 'hex')
    const expected = Buffer.from(parts[2], 'hex')
    const actual = scryptSync(plain.normalize('NFKC'), salt, expected.length)
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

/* ================= الجلسة ================= */

type Session = { uid: string; exp: number }

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url')
}

export function createSessionToken(uid: string): string {
  const body = Buffer.from(JSON.stringify({ uid, exp: Date.now() + MAX_AGE * 1000 })).toString('base64url')
  return `${body}.${sign(body)}`
}

export function readSessionToken(token?: string): Session | null {
  if (!token || !token.includes('.')) return null
  const [body, sig] = token.split('.')
  let expected: string
  try { expected = sign(body) } catch { return null }
  if (sig.length !== expected.length) return null
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  try {
    const s = JSON.parse(Buffer.from(body, 'base64url').toString()) as Session
    if (!s.uid || typeof s.exp !== 'number' || s.exp < Date.now()) return null
    return s
  } catch {
    return null
  }
}

/* ================= الكوكيز ================= */

export function setSessionCookie(res: VercelResponse, token: string) {
  res.setHeader('Set-Cookie',
    `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${MAX_AGE}`)
}

export function clearSessionCookie(res: VercelResponse) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`)
}

export function sessionFrom(req: VercelRequest): Session | null {
  const raw = req.headers.cookie
  if (!raw) return null
  const jar = Object.fromEntries(
    raw.split(';').map((c) => {
      const i = c.indexOf('=')
      return [c.slice(0, i).trim(), decodeURIComponent(c.slice(i + 1))]
    }),
  )
  return readSessionToken(jar[COOKIE])
}

/* ================= أدوات مساعدة ================= */

export function fail(res: VercelResponse, status: number, code: string, message?: string) {
  res.status(status).json({ error: code, message })
}

export const normEmail = (e: string) => (e ?? '').trim().toLowerCase()
