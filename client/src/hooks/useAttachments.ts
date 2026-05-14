import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '@/lib/api'

// ───────────────────────────────────────────
// Attachments hook — polymorphic file attachments for any entity.
// Upload uses FormData (bypassing the JSON wrapper in lib/api), but
// list/delete go through the regular api helper.
// ───────────────────────────────────────────

export type AttachmentEntity =
  | 'DOCUMENT'
  | 'COMMENT'
  | 'PROJECT'
  | 'TASK'
  | 'INVOICE'
  | 'CLIENT'
  | 'LEAD'
  | 'MILESTONE'
  | 'RISK'

export interface Attachment {
  id: string
  entityType: AttachmentEntity
  entityId: string
  fileName: string
  fileType: string
  fileSize: number
  uploadedBy: { id: string; name: string; avatar: string | null } | null
  createdAt: string
}

const BASE = (import.meta as any).env?.VITE_API_URL || '/api/v1'

/**
 * Auth-aware download: fetches the file as a blob with the Bearer token,
 * then triggers a save dialog with the original filename. A plain <a href>
 * can't carry the token, so this is the safe path.
 */
export async function downloadAttachment(attachmentId: string, fileName: string): Promise<void> {
  const token = localStorage.getItem('token')
  const res = await fetch(`${BASE}/attachments/${attachmentId}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  if (!res.ok) {
    throw new Error(`Download failed (${res.status})`)
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function useAttachments(entityType: AttachmentEntity, entityId: string | undefined) {
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [loading, setLoading] = useState(true)
  const [usingFallback, setUsingFallback] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)

  const load = useCallback(async () => {
    if (!entityId) return
    try {
      const res = await api.get<{ attachments: Attachment[] }>(
        `/attachments?entityType=${entityType}&entityId=${encodeURIComponent(entityId)}`,
      )
      setAttachments(res.attachments)
      setUsingFallback(false)
    } catch (err) {
      setUsingFallback(err instanceof ApiError && err.status === 0)
    } finally {
      setLoading(false)
    }
  }, [entityType, entityId])

  useEffect(() => {
    load()
  }, [load])

  const upload = useCallback(
    async (file: File): Promise<Attachment> => {
      if (!entityId) throw new Error('No entityId — cannot upload')
      const token = localStorage.getItem('token')
      const form = new FormData()
      form.append('file', file)
      form.append('entityType', entityType)
      form.append('entityId', entityId)

      setUploadProgress(0)
      try {
        // Use XHR so we can wire upload progress
        const result = await new Promise<{ attachment: Attachment }>((resolve, reject) => {
          const xhr = new XMLHttpRequest()
          xhr.open('POST', `${BASE}/attachments`)
          if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100))
          }
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                resolve(JSON.parse(xhr.responseText))
              } catch (err) {
                reject(err)
              }
            } else {
              try {
                const body = JSON.parse(xhr.responseText)
                reject(new Error(body?.error?.message || body?.message || `Upload failed (${xhr.status})`))
              } catch {
                reject(new Error(`Upload failed (${xhr.status})`))
              }
            }
          }
          xhr.onerror = () => reject(new Error('Network error during upload'))
          xhr.send(form)
        })
        setAttachments((prev) => [result.attachment, ...prev])
        return result.attachment
      } finally {
        setUploadProgress(null)
      }
    },
    [entityType, entityId],
  )

  const remove = useCallback(async (id: string) => {
    await api.del<unknown>(`/attachments/${id}`)
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }, [])

  return { attachments, loading, usingFallback, uploadProgress, upload, remove, refresh: load }
}
