import type { Request } from 'express'

interface AuditEntry {
  userId: string | null
  action: string
  entity: string
  entityId: string | null
  metadata: Record<string, unknown> | null
  ipAddress: string | null
  timestamp: string
}

// In-memory audit log — replace with Prisma insert in production
const auditEntries: AuditEntry[] = []

function getClientIp(req: Request): string | null {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim()
  return req.ip || null
}

export function logAudit(
  req: Request,
  action: string,
  entity: string,
  entityId?: string,
  metadata?: Record<string, unknown>,
) {
  const entry: AuditEntry = {
    userId: req.user?.userId || null,
    action,
    entity,
    entityId: entityId || null,
    metadata: metadata || null,
    ipAddress: getClientIp(req),
    timestamp: new Date().toISOString(),
  }

  auditEntries.push(entry)

  // Log security-relevant events to console for monitoring
  const securityActions = ['LOGIN_SUCCESS', 'LOGIN_FAILED', 'OTP_FAILED', 'ACCOUNT_LOCKED', 'UNAUTHORIZED_ACCESS', 'ROLE_CHANGED', 'PASSWORD_CHANGED']
  if (securityActions.includes(action)) {
    console.warn(`[SECURITY] ${action} | user=${entry.userId} | ip=${entry.ipAddress} | entity=${entity}:${entityId || 'n/a'}`)
  }

  // TODO: Replace with Prisma.auditLog.create({ data: entry })
}

export function logAuthAttempt(req: Request, success: boolean, email: string) {
  logAudit(
    req,
    success ? 'LOGIN_SUCCESS' : 'LOGIN_FAILED',
    'auth',
    undefined,
    { email, userAgent: req.headers['user-agent'] || 'unknown' },
  )
}

export function logApiError(req: Request, error: string, statusCode: number) {
  logAudit(
    req,
    'API_ERROR',
    'error',
    undefined,
    {
      path: req.path,
      method: req.method,
      statusCode,
      error,
      userAgent: req.headers['user-agent'] || 'unknown',
    },
  )
}
