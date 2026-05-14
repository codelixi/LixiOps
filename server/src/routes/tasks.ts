import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import { AppError } from '../middleware/errorHandler.js'

const prisma = new PrismaClient()
const router = Router()

// ═══════════════════════════════════════════
// Validation
// ═══════════════════════════════════════════

const priorityEnum = z.enum(['critical', 'high', 'medium', 'low'])
const statusEnum = z.enum(['todo', 'in_progress', 'in_review', 'done'])

const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  projectId: z.string().optional(),
  departmentId: z.string().optional(),
  assigneeId: z.string().optional(),
  priority: priorityEnum.default('medium'),
  status: statusEnum.default('todo'),
  estimatedHours: z.number().min(0).max(10_000).optional(),
  dueDate: z.string().refine((d) => !isNaN(Date.parse(d))).optional(),
  sprintId: z.string().optional(),
  blockedBy: z.string().optional(),
})

const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  priority: priorityEnum.optional(),
  status: statusEnum.optional(),
  estimatedHours: z.number().min(0).max(10_000).nullable().optional(),
  actualHours: z.number().min(0).max(10_000).nullable().optional(),
  dueDate: z.string().refine((d) => !isNaN(Date.parse(d))).nullable().optional(),
  sprintId: z.string().nullable().optional(),
  blockedBy: z.string().nullable().optional(),
})

const taskIncludes = {
  assignee: { select: { id: true, name: true, avatar: true, email: true } },
  creator: { select: { id: true, name: true, avatar: true } },
  project: { select: { id: true, name: true } },
}

// ═══════════════════════════════════════════
// GET /tasks — list, filterable by project/assignee/status/sprint
// ═══════════════════════════════════════════
router.get('/', async (req: Request, res: Response) => {
  const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined
  const assigneeId = typeof req.query.assigneeId === 'string' ? req.query.assigneeId : undefined
  const status = typeof req.query.status === 'string' ? req.query.status : undefined
  const sprintId = typeof req.query.sprintId === 'string' ? req.query.sprintId : undefined
  const mine = req.query.mine === 'true'

  const tasks = await prisma.task.findMany({
    where: {
      ...(projectId ? { projectId } : {}),
      ...(assigneeId ? { assigneeId } : {}),
      ...(mine && req.user ? { assigneeId: req.user.userId } : {}),
      ...(status ? { status } : {}),
      ...(sprintId ? { sprintId } : {}),
    },
    include: taskIncludes,
    orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
    take: 500,
  })

  res.json({ tasks })
})

// ═══════════════════════════════════════════
// GET /tasks/:id
// ═══════════════════════════════════════════
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  const task = await prisma.task.findUnique({
    where: { id: String(req.params.id) },
    include: {
      ...taskIncludes,
      timeEntries: { orderBy: { date: 'desc' }, take: 30 },
      dependencies: { include: { prerequisite: { select: { id: true, title: true, status: true } } } },
    },
  })
  if (!task) return next(new AppError(404, 'NOT_FOUND', 'Task not found'))
  res.json({ task })
})

// ═══════════════════════════════════════════
// POST /tasks — create
// RULE ("No Work Without Assignment"): assigneeId is required
// unless the task is still in `todo` and a projectId is supplied
// (planning placeholder). Enforce at move-to-in_progress time too.
// ═══════════════════════════════════════════
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) return next(new AppError(401, 'UNAUTHORIZED', 'Auth required'))
  const parse = createTaskSchema.safeParse(req.body)
  if (!parse.success) {
    return next(new AppError(400, 'VALIDATION', 'Invalid input: ' + JSON.stringify(parse.error.flatten().fieldErrors)))
  }

  const { projectId, assigneeId, status } = parse.data

  // Guard: moving directly to in_progress/review/done without an assignee
  if ((status === 'in_progress' || status === 'in_review' || status === 'done') && !assigneeId) {
    return next(new AppError(400, 'ASSIGNEE_REQUIRED', 'Tasks in progress must have an assignee (No Work Without Assignment rule)'))
  }

  if (projectId) {
    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project) return next(new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found'))
  }

  const task = await prisma.task.create({
    data: {
      ...parse.data,
      dueDate: parse.data.dueDate ? new Date(parse.data.dueDate) : null,
      creatorId: req.user.userId,
    },
    include: taskIncludes,
  })
  res.status(201).json({ task })
})

// ═══════════════════════════════════════════
// PATCH /tasks/:id — update (fires "assignee required" check on status flip)
// ═══════════════════════════════════════════
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  const parse = updateTaskSchema.safeParse(req.body)
  if (!parse.success) {
    return next(new AppError(400, 'VALIDATION', 'Invalid input: ' + JSON.stringify(parse.error.flatten().fieldErrors)))
  }

  const existing = await prisma.task.findUnique({ where: { id: String(req.params.id) } })
  if (!existing) return next(new AppError(404, 'NOT_FOUND', 'Task not found'))

  const nextStatus = parse.data.status ?? existing.status
  const nextAssignee = parse.data.assigneeId !== undefined ? parse.data.assigneeId : existing.assigneeId
  if ((nextStatus === 'in_progress' || nextStatus === 'in_review') && !nextAssignee) {
    return next(new AppError(400, 'ASSIGNEE_REQUIRED', 'Cannot move task to in-progress without an assignee'))
  }

  // Completion stamps
  const extra: Record<string, unknown> = {}
  if (nextStatus === 'done' && existing.status !== 'done') extra.completedAt = new Date()
  if (nextStatus !== 'done' && existing.status === 'done') extra.completedAt = null

  const data: Record<string, unknown> = { ...parse.data, ...extra }
  if (parse.data.dueDate === null) data.dueDate = null
  else if (typeof parse.data.dueDate === 'string') data.dueDate = new Date(parse.data.dueDate)

  const task = await prisma.task.update({
    where: { id: existing.id },
    data,
    include: taskIncludes,
  })
  res.json({ task })
})

// ═══════════════════════════════════════════
// DELETE /tasks/:id
// ═══════════════════════════════════════════
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  const existing = await prisma.task.findUnique({ where: { id: String(req.params.id) } })
  if (!existing) return next(new AppError(404, 'NOT_FOUND', 'Task not found'))
  // Clean up dependencies first to avoid FK violations
  await prisma.taskDependency.deleteMany({
    where: { OR: [{ taskId: existing.id }, { prerequisiteId: existing.id }] },
  })
  await prisma.task.delete({ where: { id: existing.id } })
  res.status(204).end()
})

export { router as tasksRouter }
