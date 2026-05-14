import type { Request, Response, NextFunction } from 'express'
import { AppError } from './errorHandler.js'
import { env } from '../lib/env.js'

const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
])

const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.com', '.msi', '.dll', '.scr',
  '.ps1', '.sh', '.bash', '.csh', '.vbs', '.js', '.ws',
  '.php', '.py', '.rb', '.pl', '.jar', '.war',
])

const MAX_SIZE_BYTES = env.MAX_UPLOAD_SIZE_MB * 1024 * 1024

export function validateUpload(req: Request, _res: Response, next: NextFunction) {
  const contentType = req.headers['content-type'] || ''

  if (!contentType.includes('multipart/form-data')) {
    return next()
  }

  const contentLength = parseInt(req.headers['content-length'] || '0', 10)
  if (contentLength > MAX_SIZE_BYTES) {
    return next(new AppError(413, 'FILE_TOO_LARGE', `File size exceeds ${env.MAX_UPLOAD_SIZE_MB}MB limit`))
  }

  next()
}

export function validateFileType(mimeType: string, fileName: string): void {
  // Check MIME type
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new AppError(400, 'INVALID_FILE_TYPE', `File type ${mimeType} is not allowed`)
  }

  // Check extension — double extension attack prevention
  const lowerName = fileName.toLowerCase()
  for (const ext of BLOCKED_EXTENSIONS) {
    if (lowerName.endsWith(ext) || lowerName.includes(ext + '.')) {
      throw new AppError(400, 'BLOCKED_FILE_TYPE', `File extension ${ext} is not allowed`)
    }
  }

  // Check for null bytes in filename (path traversal)
  if (fileName.includes('\0') || fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
    throw new AppError(400, 'INVALID_FILENAME', 'Invalid filename')
  }
}
