import { ensureSchema, query } from './db.js'
import { hashPassword, normEmail } from './auth.js'
import { buildSeed, DEFAULT_PASSWORD } from '../../src/data/seed.js'
import { migrate } from '../../src/lib/migrate.js'
import type { DB, Person } from '../../src/types'

export const DOC_ID = 'main'

/** الشخص كما يُحفظ على الخادم: بلا كلمة مرور صريحة، وبمعامل تجزئة بدلها */
type StoredPerson = Person & { passwordHash?: string }
type StoredDB = Omit<DB, 'people'> & { people: StoredPerson[] }

export type LoadedState = { doc: StoredDB; version: number }

/** ينشئ الوثيقة الابتدائية عند أول تشغيل: المساجد ولجانها وحساب المدير */
function initialDoc(): StoredDB {
  const seed = buildSeed() as StoredDB
  seed.people = seed.people.map((p) => ({
    ...p,
    password: '',
    passwordHash: hashPassword(DEFAULT_PASSWORD),
  }))
  return seed
}

export async function loadState(): Promise<LoadedState> {
  await ensureSchema()
  const rows = await query<{ doc: StoredDB; version: string }>(
    'SELECT doc, version FROM ryd_state WHERE id = $1', [DOC_ID],
  )
  if (rows.length) {
    const doc = rows[0].doc
    const version = Number(rows[0].version)
    // ترقية الوثائق القديمة دون فقد أي بيان، وحفظها إن تغيّرت
    if (migrate(doc)) {
      const saved = await saveState(doc, version, 'migration')
      if (saved) return saved
      // تعارض: أعِد القراءة، وستُرقّى في الطلب التالي
      const again = await query<{ doc: StoredDB; version: string }>(
        'SELECT doc, version FROM ryd_state WHERE id = $1', [DOC_ID],
      )
      const d2 = again[0].doc
      migrate(d2)
      return { doc: d2, version: Number(again[0].version) }
    }
    return { doc, version }
  }

  const doc = initialDoc()
  await query(
    `INSERT INTO ryd_state (id, doc, version) VALUES ($1, $2, 1)
     ON CONFLICT (id) DO NOTHING`, [DOC_ID, doc],
  )
  const again = await query<{ doc: StoredDB; version: string }>(
    'SELECT doc, version FROM ryd_state WHERE id = $1', [DOC_ID],
  )
  return { doc: again[0].doc, version: Number(again[0].version) }
}

/**
 * كتابة متزامنة بالتحقق من الإصدار.
 * ترجع null إن كان الإصدار قديمًا (تعارض) ليعيد العميل المحاولة.
 */
export async function saveState(
  doc: StoredDB, expectedVersion: number, byUserId?: string,
): Promise<LoadedState | null> {
  await ensureSchema()
  const rows = await query<{ version: string }>(
    `UPDATE ryd_state
        SET doc = $1, version = version + 1, updated_at = now(), updated_by = $4
      WHERE id = $2 AND version = $3
      RETURNING version`,
    [doc, DOC_ID, expectedVersion, byUserId ?? null],
  )
  if (!rows.length) return null
  return { doc, version: Number(rows[0].version) }
}

/** يطبّق تعديلًا على الوثيقة مع إعادة المحاولة عند التعارض */
export async function mutateState(
  fn: (doc: StoredDB) => void | Promise<void>, byUserId?: string, attempts = 4,
): Promise<LoadedState> {
  for (let i = 0; i < attempts; i++) {
    const { doc, version } = await loadState()
    await fn(doc)
    const saved = await saveState(doc, version, byUserId)
    if (saved) return saved
  }
  throw new Error('WRITE_CONFLICT')
}

/* ================= حماية الأسرار ================= */

/** النسخة التي تُرسل للمتصفح — بلا كلمات مرور ولا معاملات تجزئة */
export function sanitize(doc: StoredDB): DB {
  return {
    ...doc,
    people: doc.people.map((p) => {
      const { passwordHash, ...rest } = p
      return { ...rest, password: '' }
    }),
  } as DB
}

/**
 * دمج الوثيقة القادمة من المتصفح مع أسرار الخادم:
 * المتصفح لا يرى معاملات التجزئة ولا يستطيع تغييرها،
 * وأي شخص جديد يُنشأ بالرمز المبدئي.
 */
export function mergeSecrets(incoming: StoredDB, current: StoredDB): StoredDB {
  const byId = new Map(current.people.map((p) => [p.id, p]))
  const defaultPw = incoming.settings?.defaultPassword || current.settings?.defaultPassword || DEFAULT_PASSWORD

  const people: StoredPerson[] = incoming.people.map((p) => {
    const prev = byId.get(p.id)
    return {
      ...p,
      password: '',
      passwordHash: prev?.passwordHash ?? hashPassword(defaultPw),
      // حساب جديد يبدأ دائمًا بإلزام تغيير الرمز
      mustChangePassword: prev ? p.mustChangePassword : true,
    }
  })

  return { ...incoming, people }
}

export function findByEmail(doc: StoredDB, email: string): StoredPerson | undefined {
  const e = normEmail(email)
  return doc.people.find((p) => normEmail(p.email) === e)
}

export function findById(doc: StoredDB, id: string): StoredPerson | undefined {
  return doc.people.find((p) => p.id === id)
}


/* ================= صلاحيات الكتابة ================= */

/**
 * حراسة على الخادم: الواجهة تمنع ما لا يجوز، وهذه تمنعه فعليًا.
 * - الإعدادات العامة والصلاحيات المالية والأدوار: لمدير المجمع وحده.
 * - المشرف يضيف ويعدّل أعضاء مسجده فقط، ولا يرفع أحدًا لصلاحية أعلى.
 * - العضو لا يضيف أشخاصًا ولا يحذفهم.
 */
export function enforcePermissions(
  incoming: StoredDB, current: StoredDB, actor: StoredPerson,
): StoredDB {
  if (actor.role === 'director') return incoming

  const isSupervisor = actor.role === 'supervisor'
  const byId = new Map(current.people.map((p) => [p.id, p]))

  const out: StoredDB = { ...incoming }
  // الإعدادات العامة والنطاق المكاني للمساجد: لمدير المجمع وحده
  out.settings = current.settings
  out.mosques = current.mosques

  /** ما يجوز للشخص تغييره في ملفه: جواله وتوقيعه على عقده */
  const selfSafe = (next: StoredPerson, prev: StoredPerson): StoredPerson => ({
    ...prev,
    phone: next.phone ?? prev.phone,
    lastLoginAt: next.lastLoginAt ?? prev.lastLoginAt,
    contract: prev.contract
      ? {
          ...prev.contract,
          signature: next.contract?.signature ?? prev.contract.signature,
          signedAt: next.contract?.signedAt ?? prev.contract.signedAt,
          acknowledged: next.contract?.acknowledged ?? prev.contract.acknowledged,
        }
      : prev.contract,
  })

  const mayManage = (p: StoredPerson) =>
    isSupervisor && p.mosqueId === actor.mosqueId && p.role === 'member'

  const kept: StoredPerson[] = []

  for (const p of incoming.people) {
    const prev = byId.get(p.id)

    if (prev) {
      if (p.id === actor.id) { kept.push(selfSafe(p, prev)); continue }
      // المشرف يعدّل أعضاء مسجده دون رفع صلاحياتهم
      kept.push(mayManage(prev)
        ? { ...p, role: prev.role, financeAccess: prev.financeAccess, mosqueId: prev.mosqueId }
        : prev)
      continue
    }

    // شخص جديد: المشرف فقط، في مسجده، وبصلاحية عضو
    if (isSupervisor) {
      kept.push({ ...p, role: 'member', financeAccess: false, mosqueId: actor.mosqueId })
    }
  }

  // لا يُحذف من لا يملك المستخدم صلاحيته
  const keptIds = new Set(kept.map((p) => p.id))
  for (const prev of current.people) {
    if (!keptIds.has(prev.id) && !mayManage(prev)) kept.push(prev)
  }

  out.people = kept
  return out
}
