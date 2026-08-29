// pg مكتبة CommonJS: الاستيراد الافتراضي أضمن داخل وحدات ESM
import pg from 'pg'
const { Pool } = pg
type Pool = InstanceType<typeof pg.Pool>

/**
 * اتصال قاعدة البيانات (PostgreSQL).
 * يقرأ رابط الاتصال من أول متغيّر بيئة متاح، ليعمل مع Neon و Supabase
 * و Vercel Postgres وأي مزوّد PostgreSQL آخر.
 */
const CONNECTION_ENV_KEYS = [
  'DATABASE_URL',
  'POSTGRES_URL',
  'POSTGRES_PRISMA_URL',
  'POSTGRES_URL_NON_POOLING',
  'PGURL',
]

export function connectionString(): string | undefined {
  for (const k of CONNECTION_ENV_KEYS) {
    const v = process.env[k]
    if (v && v.trim()) return v.trim()
  }
  return undefined
}

export const isConfigured = () => !!connectionString()

let pool: Pool | null = null

export function getPool(): Pool {
  const url = connectionString()
  if (!url) throw new Error('DATABASE_NOT_CONFIGURED')
  if (!pool) {
    pool = new Pool({
      connectionString: url,
      // معظم مزوّدي PostgreSQL السحابيين يفرضون SSL بشهادة وسيطة
      ssl: url.includes('sslmode=disable') ? false : { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    })
  }
  return pool
}

export async function query<T = any>(text: string, params: any[] = []): Promise<T[]> {
  const res = await getPool().query(text, params)
  return res.rows as T[]
}

let schemaReady: Promise<void> | null = null

/** ينشئ الجداول عند أول تشغيل — آمن للتكرار */
export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const p = getPool()
      await p.query(`
        CREATE TABLE IF NOT EXISTS ryd_state (
          id          TEXT PRIMARY KEY,
          doc         JSONB       NOT NULL,
          version     BIGINT      NOT NULL DEFAULT 1,
          updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_by  TEXT
        );
      `)
      await p.query(`
        CREATE TABLE IF NOT EXISTS ryd_files (
          id          TEXT PRIMARY KEY,
          name        TEXT        NOT NULL,
          mime        TEXT        NOT NULL,
          size        INTEGER     NOT NULL,
          data        BYTEA       NOT NULL,
          created_by  TEXT,
          created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `)
    })().catch((e) => { schemaReady = null; throw e })
  }
  return schemaReady
}
