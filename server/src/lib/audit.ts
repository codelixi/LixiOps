import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ───────────────────────────────────────────
// Audit helper — fire-and-forget. Failures are logged but never
// block the request that triggered the audit. Routes import this
// instead of touching prisma.auditLog directly so the schema field
// names (entity vs entityType) are contained here.
// ───────────────────────────────────────────

export function audit(opts: {
  userId: string | null | undefined
  action: string
  entity: string
  entityId?: string | null
  metadata?: Record<string, unknown> | unknown
  ipAddress?: string | null
}): void {
  if (!opts.userId) return
  void prisma.auditLog
    .create({
      data: {
        userId: opts.userId,
        action: opts.action,
        entity: opts.entity,
        entityId: opts.entityId ?? null,
        metadata: (opts.metadata ?? undefined) as any,
        ipAddress: opts.ipAddress ?? null,
      },
    })
    .catch((err) => {
      console.error('[audit] failed to write log', err)
    })
}
