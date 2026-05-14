import { promises as fs } from 'fs'
import { createReadStream } from 'fs'
import type { Readable } from 'stream'
import path from 'path'
import { randomBytes } from 'crypto'
import { env } from './env.js'

// ───────────────────────────────────────────
// Storage abstraction for file uploads.
//
// Default: local filesystem under `uploads/`. The interface matches
// what an S3/MinIO/R2 adapter would expose so swapping later is
// a single-file change — just point `storage` at a new implementation.
// ───────────────────────────────────────────

export interface StorageAdapter {
  put(buffer: Buffer, opts: { filename: string; contentType: string }): Promise<{ storageKey: string }>
  getStream(storageKey: string): Promise<Readable>
  delete(storageKey: string): Promise<void>
  /** Optional — adapters that support signed URLs (S3) implement this. */
  signedUrl?(storageKey: string, expiresInSeconds: number): Promise<string>
}

class LocalFsAdapter implements StorageAdapter {
  private root: string

  constructor(root: string) {
    this.root = root
  }

  private resolveKey(storageKey: string): string {
    // Defence: keys can't traverse outside root
    const safe = path.normalize(storageKey).replace(/^(\.\.[/\\])+/, '')
    return path.join(this.root, safe)
  }

  async put(buffer: Buffer, opts: { filename: string; contentType: string }): Promise<{ storageKey: string }> {
    // Bucket by year-month so the upload dir doesn't grow to one big folder.
    const now = new Date()
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const ext = path.extname(opts.filename) || ''
    const id = randomBytes(12).toString('hex')
    const storageKey = `${yyyy}/${mm}/${id}${ext}`
    const fullPath = this.resolveKey(storageKey)
    await fs.mkdir(path.dirname(fullPath), { recursive: true })
    await fs.writeFile(fullPath, buffer)
    return { storageKey }
  }

  async getStream(storageKey: string): Promise<Readable> {
    const fullPath = this.resolveKey(storageKey)
    // Verify existence so callers get a clean error instead of a stream error
    await fs.access(fullPath)
    return createReadStream(fullPath)
  }

  async delete(storageKey: string): Promise<void> {
    const fullPath = this.resolveKey(storageKey)
    try {
      await fs.unlink(fullPath)
    } catch (err: any) {
      if (err?.code !== 'ENOENT') throw err
      // Already gone — idempotent delete is fine
    }
  }
}

// ─── Adapter selection ──────────────────────
// When you set STORAGE_BACKEND=s3 and provide S3_* env vars, swap this for
// an S3Adapter. The interface stays identical.
const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads')

export const storage: StorageAdapter = new LocalFsAdapter(UPLOAD_ROOT)

// ─── Limits ──────────────────────────────────
export const MAX_UPLOAD_BYTES = env.MAX_UPLOAD_SIZE_MB * 1024 * 1024

// Safelist by MIME — keep this narrow to avoid uploading executables.
export const ALLOWED_MIME_PREFIXES = [
  'image/',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.',
  'application/vnd.ms-excel',
  'application/json',
  'application/zip',
  'text/',
]

export function isAllowedMime(mime: string): boolean {
  return ALLOWED_MIME_PREFIXES.some((p) => mime === p || mime.startsWith(p))
}
