/**
 * طبقة الاتصال بالخادم.
 *
 * تعمل المنصة في وضعين:
 *  - «مشترك» (remote): يوجد خادم وقاعدة بيانات، فتُحفظ البيانات مركزيًا
 *    ويراها الجميع من أي جهاز.
 *  - «محلي» (local): لا يوجد خادم، فتُحفظ البيانات في متصفح الجهاز فقط
 *    (وضع المعاينة والتجربة).
 */

export type StorageMode = 'remote' | 'local'

export class ApiError extends Error {
  constructor(public status: number, public code: string, public data?: any) {
    super(code)
  }
}

const base = '/api'

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(base + path, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
      ...init,
    })
  } catch {
    throw new ApiError(0, 'network')
  }

  const text = await res.text()
  let data: any = null
  try { data = text ? JSON.parse(text) : null } catch { /* ليس JSON */ }

  if (!res.ok) throw new ApiError(res.status, data?.error ?? `http_${res.status}`, data)
  if (data === null && text) throw new ApiError(res.status, 'bad_response')
  return data as T
}

export const apiGet = <T>(p: string) => request<T>(p)
export const apiPost = <T>(p: string, body?: unknown) =>
  request<T>(p, { method: 'POST', body: JSON.stringify(body ?? {}) })
export const apiPut = <T>(p: string, body?: unknown) =>
  request<T>(p, { method: 'PUT', body: JSON.stringify(body ?? {}) })

/* ================= اكتشاف الوضع ================= */

export type BuildInfo = { commit: string | null; branch: string | null; env: string }

let modePromise: Promise<StorageMode> | null = null
let build: BuildInfo | null = null

/** معلومات النسخة المنشورة على الخادم (بعد أول اتصال) */
export const buildInfo = () => build

export function detectMode(): Promise<StorageMode> {
  if (!modePromise) {
    modePromise = apiGet<{ ok: boolean; storage: string; build?: BuildInfo }>('/health')
      .then((r) => {
        build = r?.build ?? null
        return r?.storage === 'database' ? 'remote' : 'local'
      })
      .catch(() => 'local' as StorageMode)
  }
  return modePromise
}

/* ================= الملفات ================= */

export type RemoteFile = { id: string; url: string; name: string; type: string; size: number }

export async function uploadFile(file: { name: string; type: string; dataUrl: string }): Promise<RemoteFile> {
  const dataBase64 = file.dataUrl.slice(file.dataUrl.indexOf(',') + 1)
  return apiPost<RemoteFile>('/files', { name: file.name, mime: file.type || 'application/octet-stream', dataBase64 })
}
