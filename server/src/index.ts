import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { createServer } from 'http'
import { Server as SocketServer } from 'socket.io'
import { env } from './lib/env.js'
import { authRouter } from './routes/auth.js'
import { dashboardRouter } from './routes/dashboard.js'
import { commentsRouter } from './routes/comments.js'
import { invoiceRouter } from './routes/invoices.js'
import { leadsRouter } from './routes/leads.js'
import { projectsRouter } from './routes/projects.js'
import { webhookRouter } from './routes/webhooks.js'
import { errorHandler } from './middleware/errorHandler.js'
import { authenticate } from './middleware/authenticate.js'
import { apiLimiter } from './middleware/rateLimiter.js'
import { sanitizeInputs } from './middleware/sanitize.js'
import { securityHeaders, requestId } from './middleware/security.js'
import { validateUpload } from './middleware/upload.js'
import { startActionEngine } from './services/actionEngine.js'
import { notificationsRouter } from './routes/notifications.js'
import { portalRouter } from './routes/portal.js'
import { clientsRouter } from './routes/clients.js'
import { usersRouter } from './routes/users.js'
import { risksRouter } from './routes/risks.js'
import { tasksRouter } from './routes/tasks.js'
import { activityRouter } from './routes/activity.js'
import { actionEngineRouter } from './routes/actionEngine.js'
import { reportsRouter } from './routes/reports.js'
import { okrsRouter } from './routes/okrs.js'
import { departmentsRouter } from './routes/departments.js'
import { clientHealthRouter } from './routes/clientHealth.js'
import { employeesRouter } from './routes/employees.js'
import { decisionsRouter } from './routes/decisions.js'
import { operationsRouter } from './routes/operations.js'
import { designBriefsRouter } from './routes/designBriefs.js'
import { insightsRouter } from './routes/insights.js'
import { broadcastsRouter } from './routes/broadcasts.js'
import { knowledgeRouter } from './routes/knowledge.js'
import { attendanceRouter } from './routes/attendance.js'
import { documentsRouter } from './routes/documents.js'
import { attachmentsRouter } from './routes/attachments.js'
import { auditRouter } from './routes/audit.js'

const app = express()
const httpServer = createServer(app)

// ═══════════════════════════════════════════
// Socket.io — Authenticated connections only
// ═══════════════════════════════════════════
const io = new SocketServer(httpServer, {
  cors: { origin: env.CORS_ORIGIN, credentials: true },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// ═══════════════════════════════════════════
// Global Middleware Stack (order matters)
// ═══════════════════════════════════════════

// 1. Request ID for tracing
app.use(requestId)

// 2. Security headers (helmet + custom CSP)
app.use(helmet({
  contentSecurityPolicy: false, // We set our own in securityHeaders
  crossOriginEmbedderPolicy: false,
}))
app.use(securityHeaders)

// 3. CORS — strict origin
app.use(cors({
  origin: env.CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  maxAge: 86400, // 24 hours
}))

// 4a. Stripe webhook needs raw body — mount BEFORE json parser
app.use('/api/v1/webhooks/stripe', express.raw({ type: 'application/json' }), (req, _res, next) => {
  (req as any).rawBody = req.body
  next()
})

// 4b. Body parsing — limit size to prevent large payload attacks
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: false, limit: '1mb' }))

// 5. Upload size validation
app.use(validateUpload)

// 6. Input sanitization — XSS prevention on all inputs
app.use(sanitizeInputs)

// 7. Logging
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'short'))

// 8. API rate limiting (global)
app.use('/api/', apiLimiter)

// ═══════════════════════════════════════════
// Routes
// ═══════════════════════════════════════════

// Health check (no auth, no rate limit beyond global)
app.get('/api/v1/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
  })
})

// Public routes
app.use('/api/v1/auth', authRouter)

// Protected routes — all require authentication
app.use('/api/v1/dashboard', authenticate, dashboardRouter)
app.use('/api/v1/leads', authenticate, leadsRouter)
app.use('/api/v1/projects', authenticate, projectsRouter)
app.use('/api/v1/invoices', authenticate, invoiceRouter)
app.use('/api/v1/comments', authenticate, commentsRouter)
app.use('/api/v1/notifications', authenticate, notificationsRouter)
app.use('/api/v1/clients', authenticate, clientsRouter)
app.use('/api/v1/users', authenticate, usersRouter)
app.use('/api/v1/risks', authenticate, risksRouter)
app.use('/api/v1/tasks', authenticate, tasksRouter)
app.use('/api/v1/activity', authenticate, activityRouter)
app.use('/api/v1/action-engine', authenticate, actionEngineRouter)
app.use('/api/v1/reports', authenticate, reportsRouter)
app.use('/api/v1/okrs', authenticate, okrsRouter)
app.use('/api/v1/departments', authenticate, departmentsRouter)
app.use('/api/v1/client-health', authenticate, clientHealthRouter)
app.use('/api/v1/employees', authenticate, employeesRouter)
app.use('/api/v1/decisions', authenticate, decisionsRouter)
app.use('/api/v1/operations', authenticate, operationsRouter)
app.use('/api/v1/design-briefs', authenticate, designBriefsRouter)
app.use('/api/v1/ai-engine/insights', authenticate, insightsRouter)
app.use('/api/v1/broadcasts', authenticate, broadcastsRouter)
app.use('/api/v1/knowledge', authenticate, knowledgeRouter)
app.use('/api/v1/attendance', authenticate, attendanceRouter)
app.use('/api/v1/documents', authenticate, documentsRouter)
app.use('/api/v1/attachments', authenticate, attachmentsRouter)
app.use('/api/v1/audit', authenticate, auditRouter)

// Webhook routes (no auth — verified by Stripe signature)
app.use('/api/v1/webhooks', webhookRouter)

// Public client-portal routes (no auth — tokenized URLs)
app.use('/api/v1/portal', portalRouter)

// ═══════════════════════════════════════════
// Error Handling
// ═══════════════════════════════════════════
app.use(errorHandler)

// ═══════════════════════════════════════════
// Socket.io — JWT-authenticated connections + room routing
// ═══════════════════════════════════════════
import jwt from 'jsonwebtoken'
import { setRealtime } from './lib/realtime.js'

interface SocketAuth {
  userId: string
  email: string
  role: string
}

io.use((socket, next) => {
  const token = socket.handshake.auth?.token
  if (!token || typeof token !== 'string') {
    return next(new Error('Authentication required'))
  }
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ['HS256'],
      maxAge: `${env.SESSION_TIMEOUT_HOURS}h`,
    }) as SocketAuth
    ;(socket.data as { auth: SocketAuth }).auth = payload
    next()
  } catch {
    next(new Error('Authentication failed'))
  }
})

io.on('connection', (socket) => {
  const auth = (socket.data as { auth?: SocketAuth }).auth
  if (!auth) {
    socket.disconnect(true)
    return
  }
  // Auto-join the user's personal stream so notifications can fan out.
  socket.join(`user:${auth.userId}`)
  console.log(`[WS] Connected: ${socket.id} user=${auth.email}`)

  socket.on('join:dashboard', () => {
    socket.join('dashboard')
  })

  // Subscribe to a specific entity's comment / activity stream while the
  // user is viewing that detail page.
  socket.on('subscribe:entity', (msg: { entityType?: string; entityId?: string }) => {
    if (!msg?.entityType || !msg?.entityId) return
    socket.join(`entity:${msg.entityType}:${msg.entityId}`)
  })
  socket.on('unsubscribe:entity', (msg: { entityType?: string; entityId?: string }) => {
    if (!msg?.entityType || !msg?.entityId) return
    socket.leave(`entity:${msg.entityType}:${msg.entityId}`)
  })

  socket.on('disconnect', () => {
    console.log(`[WS] Disconnected: ${socket.id}`)
  })
})

// Expose the io instance to server-side emitters (notifications, comments, action engine).
setRealtime(io)

// ═══════════════════════════════════════════
// Start Server
// ═══════════════════════════════════════════
httpServer.listen(env.PORT, () => {
  console.log(`[LixiOps] Server running on port ${env.PORT} (${env.NODE_ENV})`)
  if (env.NODE_ENV === 'development') {
    console.log(`[LixiOps] CORS origin: ${env.CORS_ORIGIN}`)
  }
  // Start Action Engine (rule-driven automation scanner). Runs in-process.
  startActionEngine()
})

export { io }
