import { Router, Request, Response, NextFunction } from 'express'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const router = Router()

// ───────────────────────────────────────────
// Employees overview — read-only aggregate for the Team Directory.
// Joins each active user with department, weekly hours from
// TimeEntry, and their current in-progress task. Schema lacks
// location/jobTitle, so we surface role + department instead.
// ───────────────────────────────────────────

type EmployeeStatus = 'active' | 'away' | 'on-leave' | 'inactive'

interface EmployeeRow {
  id: string
  name: string
  email: string
  role: string
  avatar: string | null
  phone: string | null
  department: { id: string; name: string } | null
  status: EmployeeStatus
  joinDate: string
  hoursThisWeek: number
  currentTask: string | null
  lastLoginAt: string | null
}

const ACTIVE_WITHIN_HOURS = 24
const AWAY_WITHIN_DAYS = 7

function deriveStatus(isActive: boolean, lastLoginAt: Date | null): EmployeeStatus {
  if (!isActive) return 'inactive'
  if (!lastLoginAt) return 'away'
  const ageHours = (Date.now() - lastLoginAt.getTime()) / 3_600_000
  if (ageHours <= ACTIVE_WITHIN_HOURS) return 'active'
  if (ageHours / 24 <= AWAY_WITHIN_DAYS) return 'away'
  return 'on-leave'
}

router.get('/overview', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const weekStart = new Date(Date.now() - 7 * 86_400_000)

    const [users, timeEntries, openTasks] = await Promise.all([
      prisma.user.findMany({
        where: { isActive: true },
        orderBy: [{ name: 'asc' }],
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          avatar: true,
          phone: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          department: { select: { id: true, name: true } },
        },
      }),
      prisma.timeEntry.findMany({
        where: { date: { gte: weekStart } },
        select: { userId: true, hours: true },
      }),
      prisma.task.findMany({
        where: { status: 'in_progress', assigneeId: { not: null } },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, title: true, assigneeId: true },
      }),
    ])

    const hoursByUser = new Map<string, number>()
    for (const t of timeEntries) {
      hoursByUser.set(t.userId, (hoursByUser.get(t.userId) ?? 0) + t.hours)
    }

    // Pick the most-recently-updated in_progress task per user
    const taskByUser = new Map<string, string>()
    for (const t of openTasks) {
      if (t.assigneeId && !taskByUser.has(t.assigneeId)) {
        taskByUser.set(t.assigneeId, t.title)
      }
    }

    const rows: EmployeeRow[] = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      avatar: u.avatar,
      phone: u.phone,
      department: u.department,
      status: deriveStatus(u.isActive, u.lastLoginAt),
      joinDate: u.createdAt.toISOString(),
      hoursThisWeek: Math.round((hoursByUser.get(u.id) ?? 0) * 10) / 10,
      currentTask: taskByUser.get(u.id) ?? null,
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    }))

    // Department counts for the filter row
    const deptCounts = new Map<string, { id: string; name: string; count: number }>()
    for (const row of rows) {
      if (!row.department) continue
      const k = row.department.id
      const entry = deptCounts.get(k) ?? { ...row.department, count: 0 }
      entry.count += 1
      deptCounts.set(k, entry)
    }

    const stats = {
      total: rows.length,
      active: rows.filter((r) => r.status === 'active').length,
      away: rows.filter((r) => r.status === 'away').length,
      onLeave: rows.filter((r) => r.status === 'on-leave').length,
      avgHoursThisWeek:
        rows.filter((r) => r.hoursThisWeek > 0).length > 0
          ? Math.round(
              rows.filter((r) => r.hoursThisWeek > 0).reduce((s, r) => s + r.hoursThisWeek, 0) /
                rows.filter((r) => r.hoursThisWeek > 0).length,
            )
          : 0,
    }

    res.json({
      stats,
      departments: Array.from(deptCounts.values()).sort((a, b) => a.name.localeCompare(b.name)),
      employees: rows,
    })
  } catch (err) {
    next(err)
  }
})

export { router as employeesRouter }
