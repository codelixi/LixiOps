import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import { AppError } from '../middleware/errorHandler.js'
import { requireManager } from '../middleware/authenticate.js'
import { emitToUser } from '../lib/realtime.js'

const prisma = new PrismaClient()
const router = Router()

// ───────────────────────────────────────────
// Attendance — clock-in / clock-out + leave requests.
//
// Day state per user is computed from AttendanceSession rows:
//   present  → has clockIn today, not on leave
//   remote   → present + location='remote'
//   late     → present + clockIn after 9:30am local
//   on-leave → has approved LeaveRequest covering today
//   absent   → no clockIn today, not on leave
// ───────────────────────────────────────────

const LATE_THRESHOLD_HOUR = 9
const LATE_THRESHOLD_MIN = 30

type DayStatus = 'present' | 'remote' | 'late' | 'on-leave' | 'absent'

interface AttendanceRow {
  userId: string
  name: string
  avatar: string | null
  department: { id: string; name: string } | null
  role: string
  status: DayStatus
  clockIn: string | null
  clockOut: string | null
  hoursToday: number
  location: string | null
  sessionId: string | null
}

function startOfDay(d = new Date()): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function endOfDay(d = new Date()): Date {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

function isLate(clockIn: Date): boolean {
  return (
    clockIn.getHours() > LATE_THRESHOLD_HOUR ||
    (clockIn.getHours() === LATE_THRESHOLD_HOUR && clockIn.getMinutes() > LATE_THRESHOLD_MIN)
  )
}

function deriveStatus(opts: {
  hasSession: boolean
  location: string | null
  late: boolean
  onLeave: boolean
}): DayStatus {
  if (opts.onLeave) return 'on-leave'
  if (!opts.hasSession) return 'absent'
  if (opts.late) return 'late'
  if (opts.location === 'remote') return 'remote'
  return 'present'
}

// ═══════════════════════════════════════════
// GET /today — board view for the current day
// ═══════════════════════════════════════════
router.get('/today', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return next(new AppError(401, 'UNAUTHORIZED', 'Auth required'))
    const dayStart = startOfDay()
    const dayEnd = endOfDay()
    const now = new Date()

    const [users, sessions, leaves] = await Promise.all([
      prisma.user.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          avatar: true,
          role: true,
          department: { select: { id: true, name: true } },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.attendanceSession.findMany({
        where: { clockIn: { gte: dayStart, lte: dayEnd } },
        select: { id: true, userId: true, clockIn: true, clockOut: true, location: true, isLate: true },
        orderBy: { clockIn: 'asc' },
      }),
      prisma.leaveRequest.findMany({
        where: {
          status: 'approved',
          startDate: { lte: dayEnd },
          endDate: { gte: dayStart },
        },
        select: { userId: true, type: true },
      }),
    ])

    // For each user, take their FIRST clock-in of the day. If they have an
    // ongoing session (no clockOut), hours = now - clockIn.
    const sessionByUser = new Map<string, (typeof sessions)[number]>()
    for (const s of sessions) {
      if (!sessionByUser.has(s.userId)) sessionByUser.set(s.userId, s)
    }
    const leaveByUser = new Set(leaves.map((l) => l.userId))

    const rows: AttendanceRow[] = users.map((u) => {
      const s = sessionByUser.get(u.id) ?? null
      const onLeave = leaveByUser.has(u.id)
      const hoursToday = s
        ? Math.round(((s.clockOut?.getTime() ?? now.getTime()) - s.clockIn.getTime()) / 60_000 / 6) / 10
        : 0
      return {
        userId: u.id,
        name: u.name,
        avatar: u.avatar,
        department: u.department,
        role: u.role,
        status: deriveStatus({
          hasSession: !!s,
          location: s?.location ?? null,
          late: !!s?.isLate,
          onLeave,
        }),
        clockIn: s?.clockIn.toISOString() ?? null,
        clockOut: s?.clockOut?.toISOString() ?? null,
        hoursToday,
        location: s?.location ?? null,
        sessionId: s?.id ?? null,
      }
    })

    const myRow = rows.find((r) => r.userId === req.user!.userId) ?? null

    // Stats
    const stats = {
      total: rows.length,
      present: rows.filter((r) => r.status === 'present' || r.status === 'remote' || r.status === 'late').length,
      absent: rows.filter((r) => r.status === 'absent').length,
      onLeave: rows.filter((r) => r.status === 'on-leave').length,
      avgHours:
        rows.filter((r) => r.hoursToday > 0).length > 0
          ? Math.round(
              (rows.filter((r) => r.hoursToday > 0).reduce((s, r) => s + r.hoursToday, 0) /
                rows.filter((r) => r.hoursToday > 0).length) *
                10,
            ) / 10
          : 0,
    }

    res.json({ stats, attendance: rows, me: myRow })
  } catch (err) {
    next(err)
  }
})

// ═══════════════════════════════════════════
// POST /clock-in — start a session for the current user.
// Rejects if there's already an open session today.
// ═══════════════════════════════════════════
const clockInSchema = z.object({
  location: z.enum(['office', 'remote', 'client_site']).default('office'),
})

router.post('/clock-in', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return next(new AppError(401, 'UNAUTHORIZED', 'Auth required'))
    const parse = clockInSchema.safeParse(req.body)
    if (!parse.success) {
      return next(new AppError(400, 'VALIDATION', 'Invalid input: ' + JSON.stringify(parse.error.flatten().fieldErrors)))
    }

    const open = await prisma.attendanceSession.findFirst({
      where: {
        userId: req.user.userId,
        clockIn: { gte: startOfDay(), lte: endOfDay() },
        clockOut: null,
      },
    })
    if (open) return next(new AppError(409, 'ALREADY_CLOCKED_IN', 'You are already clocked in today'))

    const now = new Date()
    const session = await prisma.attendanceSession.create({
      data: {
        userId: req.user.userId,
        clockIn: now,
        location: parse.data.location,
        isLate: isLate(now),
        verificationMethod: 'manual',
      },
    })
    emitToUser(req.user.userId, 'attendance:changed')
    res.status(201).json({ session })
  } catch (err) {
    next(err)
  }
})

// ═══════════════════════════════════════════
// POST /clock-out — end the current open session.
// Computes `duration` in minutes; idempotent if already clocked out.
// ═══════════════════════════════════════════
router.post('/clock-out', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return next(new AppError(401, 'UNAUTHORIZED', 'Auth required'))
    const open = await prisma.attendanceSession.findFirst({
      where: {
        userId: req.user.userId,
        clockIn: { gte: startOfDay(), lte: endOfDay() },
        clockOut: null,
      },
      orderBy: { clockIn: 'desc' },
    })
    if (!open) return next(new AppError(409, 'NO_OPEN_SESSION', "You're not clocked in"))

    const now = new Date()
    const duration = Math.round((now.getTime() - open.clockIn.getTime()) / 60_000)
    const session = await prisma.attendanceSession.update({
      where: { id: open.id },
      data: { clockOut: now, duration },
    })
    emitToUser(req.user.userId, 'attendance:changed')
    res.json({ session })
  } catch (err) {
    next(err)
  }
})

// ═══════════════════════════════════════════
// GET /leave-requests — list. Privileged users see all; everyone else
// sees only their own.
// Optional ?status=pending|approved|declined and ?mine=true filters.
// ═══════════════════════════════════════════
router.get('/leave-requests', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return next(new AppError(401, 'UNAUTHORIZED', 'Auth required'))
    const status = typeof req.query.status === 'string' ? req.query.status : undefined
    const mine = req.query.mine === 'true'
    const isPrivileged = req.user.role === 'CEO' || req.user.role === 'MANAGER'

    const requests = await prisma.leaveRequest.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(mine || !isPrivileged ? { userId: req.user.userId } : {}),
      },
      orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
      include: {
        user: { select: { id: true, name: true, avatar: true, role: true } },
      },
      take: 100,
    })

    // Resolve approvers in batch
    const approverIds = Array.from(new Set(requests.map((r) => r.approvedBy).filter((id): id is string => !!id)))
    const approvers = approverIds.length
      ? await prisma.user.findMany({
          where: { id: { in: approverIds } },
          select: { id: true, name: true },
        })
      : []
    const approverMap = new Map(approvers.map((a) => [a.id, a.name]))

    res.json({
      requests: requests.map((r) => ({
        ...r,
        startDate: r.startDate.toISOString(),
        endDate: r.endDate.toISOString(),
        createdAt: r.createdAt.toISOString(),
        approver: r.approvedBy ? approverMap.get(r.approvedBy) ?? null : null,
        days: Math.max(1, Math.ceil((r.endDate.getTime() - r.startDate.getTime()) / 86_400_000) + 1),
      })),
    })
  } catch (err) {
    next(err)
  }
})

// ═══════════════════════════════════════════
// POST /leave-requests — submit (any auth user, for themselves)
// ═══════════════════════════════════════════
const leaveSchema = z.object({
  type: z.enum(['annual', 'sick', 'personal', 'unpaid']),
  startDate: z.string().refine((d) => !isNaN(Date.parse(d)), 'invalid date'),
  endDate: z.string().refine((d) => !isNaN(Date.parse(d)), 'invalid date'),
  reason: z.string().max(2000).optional(),
})

router.post('/leave-requests', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return next(new AppError(401, 'UNAUTHORIZED', 'Auth required'))
    const parse = leaveSchema.safeParse(req.body)
    if (!parse.success) {
      return next(new AppError(400, 'VALIDATION', 'Invalid input: ' + JSON.stringify(parse.error.flatten().fieldErrors)))
    }
    const start = new Date(parse.data.startDate)
    const end = new Date(parse.data.endDate)
    if (end < start) {
      return next(new AppError(400, 'INVALID_RANGE', 'End date must be on or after start date'))
    }

    const request = await prisma.leaveRequest.create({
      data: {
        userId: req.user.userId,
        type: parse.data.type,
        startDate: start,
        endDate: end,
        reason: parse.data.reason,
        status: 'pending',
      },
      include: { user: { select: { id: true, name: true, avatar: true, role: true } } },
    })

    // Notify managers + CEOs so they can act
    const approvers = await prisma.user.findMany({
      where: { role: { in: ['CEO' as any, 'MANAGER' as any] }, isActive: true },
      select: { id: true },
    })
    await prisma.notification.createMany({
      data: approvers
        .filter((a) => a.id !== req.user!.userId)
        .map((a) => ({
          userId: a.id,
          type: 'leave_request',
          title: `${request.user.name} requested ${parse.data.type} leave`,
          message: `${parse.data.startDate.slice(0, 10)} → ${parse.data.endDate.slice(0, 10)}`,
          link: '/attendance',
          channel: 'in_app',
        })),
    })
    for (const a of approvers) {
      if (a.id !== req.user.userId) emitToUser(a.id, 'notification:new')
    }

    res.status(201).json({ request })
  } catch (err) {
    next(err)
  }
})

// ═══════════════════════════════════════════
// PATCH /leave-requests/:id — approve / decline (CEO/MANAGER)
// ═══════════════════════════════════════════
const decisionSchema = z.object({
  status: z.enum(['approved', 'declined']),
})

router.patch('/leave-requests/:id', requireManager, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return next(new AppError(401, 'UNAUTHORIZED', 'Auth required'))
    const parse = decisionSchema.safeParse(req.body)
    if (!parse.success) {
      return next(new AppError(400, 'VALIDATION', 'Invalid input: ' + JSON.stringify(parse.error.flatten().fieldErrors)))
    }
    const id = String(req.params.id)
    const existing = await prisma.leaveRequest.findUnique({ where: { id } })
    if (!existing) return next(new AppError(404, 'NOT_FOUND', 'Leave request not found'))

    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: { status: parse.data.status, approvedBy: req.user.userId },
      include: { user: { select: { id: true, name: true, avatar: true } } },
    })

    // Notify the requester
    await prisma.notification.create({
      data: {
        userId: existing.userId,
        type: 'leave_decision',
        title: `Your leave request was ${parse.data.status}`,
        message: `${existing.type} leave · ${existing.startDate.toISOString().slice(0, 10)} → ${existing.endDate.toISOString().slice(0, 10)}`,
        link: '/attendance',
        channel: 'in_app',
      },
    })
    emitToUser(existing.userId, 'notification:new')

    res.json({ request: updated })
  } catch (err) {
    next(err)
  }
})

export { router as attendanceRouter }
