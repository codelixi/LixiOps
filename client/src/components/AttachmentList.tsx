import { useRef, useState } from 'react'
import { Upload, File, FileText, FileImage, Download, Trash2, Loader2, AlertTriangle, Paperclip } from 'lucide-react'
import { Avatar } from '@/components/ui'
import { useAttachments, downloadAttachment } from '@/hooks/useAttachments'
import type { AttachmentEntity, Attachment } from '@/hooks/useAttachments'
import { useAuthStore } from '@/stores/useAuthStore'

// ───────────────────────────────────────────
// AttachmentList — drag-drop upload + list of files for any entity.
// Drop this into any detail page; it handles its own state.
// ───────────────────────────────────────────

interface AttachmentListProps {
  entityType: AttachmentEntity
  entityId: string | undefined
  /** Compact layout for inline use (e.g. inside a comment) */
  compact?: boolean
  className?: string
}

function fileIcon(mime: string) {
  if (mime.startsWith('image/')) return <FileImage className="h-4 w-4 text-info-500" />
  if (mime === 'application/pdf') return <FileText className="h-4 w-4 text-danger-500" />
  if (mime.includes('word') || mime.includes('document')) return <FileText className="h-4 w-4 text-brand-500" />
  if (mime.includes('sheet') || mime.includes('excel')) return <FileText className="h-4 w-4 text-success-500" />
  return <File className="h-4 w-4 text-neutral-500" />
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return 'just now'
  const min = Math.floor(ms / 60_000)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function AttachmentList({ entityType, entityId, compact = false, className = '' }: AttachmentListProps) {
  const userId = useAuthStore((s) => s.user?.id)
  const role = useAuthStore((s) => s.user?.role)
  const isPrivileged = role === 'CEO' || role === 'MANAGER'

  const { attachments, loading, uploadProgress, upload, remove } = useAttachments(entityType, entityId)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  if (!entityId) return null

  const triggerSelect = () => inputRef.current?.click()

  const handleFile = async (file: File) => {
    setError(null)
    try {
      await upload(file)
    } catch (err: any) {
      setError(err?.message ?? 'Upload failed')
    }
  }

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) await handleFile(file)
  }

  const handlePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) await handleFile(file)
    e.target.value = ''
  }

  const handleDownload = async (a: Attachment) => {
    setError(null)
    try {
      await downloadAttachment(a.id, a.fileName)
    } catch (err: any) {
      setError(err?.message ?? 'Download failed')
    }
  }

  const handleDelete = async (a: Attachment) => {
    if (!window.confirm(`Delete "${a.fileName}"? This cannot be undone.`)) return
    setDeletingId(a.id)
    try {
      await remove(a.id)
    } catch (err: any) {
      setError(err?.message ?? 'Failed to delete')
    } finally {
      setDeletingId(null)
    }
  }

  const canDelete = (a: Attachment) => a.uploadedBy?.id === userId || isPrivileged

  return (
    <div className={className}>
      {!compact && (
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-neutral-400" />
            Attachments
            {attachments.length > 0 && (
              <span className="text-2xs font-normal text-neutral-400">({attachments.length})</span>
            )}
          </h3>
        </div>
      )}

      {/* Dropzone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onClick={triggerSelect}
        className={`relative border-2 border-dashed rounded-lg transition-all cursor-pointer ${
          dragOver
            ? 'border-brand-400 bg-brand-50/50'
            : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50/50'
        } ${compact ? 'py-3 px-3' : 'py-6 px-4'}`}
      >
        <input
          ref={inputRef}
          type="file"
          onChange={handlePick}
          className="hidden"
          disabled={uploadProgress !== null}
        />
        <div className="flex items-center justify-center gap-2 text-xs text-neutral-500">
          {uploadProgress !== null ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Uploading… {uploadProgress}%</span>
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 text-neutral-400" />
              <span>
                <span className="font-medium text-neutral-700">Click</span> or drag a file here
              </span>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-danger-50 border border-danger-200 text-xs text-danger-700">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* File list */}
      {!loading && attachments.length > 0 && (
        <div className={`${compact ? 'mt-2 space-y-1' : 'mt-4 space-y-2'}`}>
          {attachments.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-3 px-3 py-2 bg-white border border-neutral-200/60 rounded-lg hover:border-neutral-300 transition-colors group"
            >
              <div className="flex-shrink-0">{fileIcon(a.fileType)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-900 truncate">{a.fileName}</p>
                <div className="flex items-center gap-1.5 text-2xs text-neutral-500">
                  <span>{formatBytes(a.fileSize)}</span>
                  <span className="text-neutral-300">·</span>
                  {a.uploadedBy ? (
                    <>
                      <Avatar name={a.uploadedBy.name} size="xs" />
                      <span>{a.uploadedBy.name}</span>
                    </>
                  ) : (
                    <span>Unknown</span>
                  )}
                  <span className="text-neutral-300">·</span>
                  <span>{formatRelative(a.createdAt)}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleDownload(a)}
                  className="h-8 w-8 flex items-center justify-center text-neutral-400 hover:text-brand-600 hover:bg-brand-50 rounded cursor-pointer"
                  aria-label={`Download ${a.fileName}`}
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
                {canDelete(a) && (
                  <button
                    onClick={() => handleDelete(a)}
                    disabled={deletingId === a.id}
                    className="h-8 w-8 flex items-center justify-center text-neutral-400 hover:text-danger-600 hover:bg-danger-50 rounded cursor-pointer disabled:opacity-50"
                    aria-label="Delete attachment"
                  >
                    {deletingId === a.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
