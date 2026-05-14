// ═══════════════════════════════════════════════════════════════
// Clients — read-only for now. Clients are created by the
// /leads/:id/convert atomic transaction (Closed Won → Client + Project),
// not directly. Keeping this router lean prevents drift.
// ═══════════════════════════════════════════════════════════════

import { Router, Request, Response, NextFunction } from 'express'
import { PrismaClient } from '@prisma/client'
import { AppError } from '../middleware/errorHandler.js'

const prisma = new PrismaClient()
const router = Router()

// GET /clients — list
router.get('/', async (_req: Request, res: Response) => {
  const clients = await prisma.client.findMany({
    include: {
      _count: { select: { projects: true, invoices: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  res.json({ data: clients })
})

// GET /clients/:id — detail with projects + invoices
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  const client = await prisma.client.findUnique({
    where: { id: String(req.params.id) },
    include: {
      projects: {
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, health: true, progress: true, contractValue: true, goLiveDate: true },
      },
      invoices: {
        orderBy: { createdAt: 'desc' },
        select: { id: true, invoiceNumber: true, total: true, paidAmount: true, status: true, dueDate: true, sentAt: true },
      },
    },
  })
  if (!client) return next(new AppError(404, 'NOT_FOUND', 'Client not found'))
  res.json({ data: client })
})

export { router as clientsRouter }
