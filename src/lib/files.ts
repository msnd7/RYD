import type { UploadedFile } from '../types'

/** مصدر عرض/تنزيل الملف: رابط الخادم إن وُجد، وإلا البيانات المضمّنة */
export const fileSrc = (f: Pick<UploadedFile, 'url' | 'dataUrl'>) => f.url ?? f.dataUrl ?? ''

export const isImage = (f: Pick<UploadedFile, 'type'>) => (f.type ?? '').startsWith('image/')
