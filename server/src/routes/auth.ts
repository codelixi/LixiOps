import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { PrismaClient } from '@prisma/client'
import { signToken, signRefreshToken, authenticate } from '../middleware/authenticate.js'
import { AppError } from '../middleware/errorHandler.js'
import { loginLimiter, otpLimiter } from '../middleware/rateLimiter.js'
import { logAuthAttempt } from '../services/auditLog.js'

const prisma = new PrismaClient()

export const authRouter = Router()

// ═══════════════════════════════════════════
// Zod Schemas — strict input validation
// ═══════════════════════════════════════════

const loginSchema = z.object({
  email: z.string().email().max(255).trim().toLowerCase(),
  password: z.string().min(8).max(128),
})

const otpSchema = z.object({
  email: z.string().email().max(255).trim().toLowerCase(),
  otp: z.string().regex(/^\d{6}$/, 'OTP must be exactly 6 digits'),
})

const resetRequestSchema = z.object({
  email: z.string().email().max(255).trim().toLowerCase(),
})

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128)
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128)
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
})

// ═══════════════════════════════════════════
// In-memory stores (replace with Redis/DB)
// ═══════════════════════════════════════════

interface OTPEntry {
  code: string
  expiresAt: number
  attempts: number
}

interface LockoutEntry {
  failedAttempts: number
  lockedUntil: number | null
}

interface ResetToken {
  email: string
  expiresAt: number
  used: boolean
}

const otpStore = new Map<string, OTPEntry>()
const lockoutStore = new Map<string, LockoutEntry>()
const resetTokenStore = new Map<string, ResetToken>()

const BCRYPT_COST = 12
const MAX_LOGIN_ATTEMPTS = 3
const LOCKOUT_DURATION_MS = 15 * 60 * 1000 // 15 minutes
const OTP_EXPIRY_MS = 2 * 60 * 1000        // 2 minutes
const OTP_MAX_ATTEMPTS = 3
const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000 // 1 hour

// Generic dummy hash for constant-time compares on missing-user paths.
// bcrypt.compare against this always returns false — keeps timing identical
// to a real-user-wrong-password flow so we don't leak which emails exist.
const DUMMY_HASH = '$2a$12$Cf3SqI4Y3yNb6KhJ.WyKgu1WNvLdfQ0YR9o1c0w9Z9c4D6f4kgKwm'

// ═══════════════════════════════════════════
// POST /api/v1/auth/login
// ═══════════════════════════════════════════

authRouter.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body)

    // Check account lockout
    const lockout = lockoutStore.get(email)
    if (lockout?.lockedUntil && Date.now() < lockout.lockedUntil) {
      const remainingMs = lockout.lockedUntil - Date.now()
      const remainingMin = Math.ceil(remainingMs / 60000)
      logAuthAttempt(req, false, email)
      throw new AppError(
        429,
        'ACCOUNT_LOCKED',
        `Account locked. Try again in ${remainingMin} minutes.`,
      )
    }

    // Find user in DB. If missing, still run a bcrypt compare against a
    // dummy hash to keep the timing identical to a wrong-password attempt —
    // prevents email enumeration via response-time analysis.
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, role: true, passwordHash: true, isActive: true },
    })

    if (!user || !user.isActive) {
      await bcrypt.compare(password, DUMMY_HASH)
      recordFailedLogin(email)
      logAuthAttempt(req, false, email)
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password')
    }

    // Verify password — bcrypt cost 12
    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      recordFailedLogin(email)
      logAuthAttempt(req, false, email)
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password')
    }

    // Clear lockout on success
    lockoutStore.delete(email)

    // Generate OTP — cryptographically secure
    const code = generateSecureOTP()
    otpStore.set(email, {
      code,
      expiresAt: Date.now() + OTP_EXPIRY_MS,
      attempts: 0,
    })

    // In development, log OTP to console
    if (process.env.NODE_ENV === 'development') {
      console.log(`[OTP] Code for ${email}: ${code}`)
    }

    // TODO: Send OTP via Resend email API
    logAuthAttempt(req, true, email)

    // Never expose OTP in response
    res.json({
      data: { message: 'Verification code sent to your email' },
    })
  } catch (err) {
    next(err)
  }
})

// ═══════════════════════════════════════════
// POST /api/v1/auth/verify-otp
// ═══════════════════════════════════════════

authRouter.post('/verify-otp', otpLimiter, async (req, res, next) => {
  try {
    const { email, otp } = otpSchema.parse(req.body)

    const stored = otpStore.get(email)
    if (!stored) {
      throw new AppError(400, 'OTP_NOT_FOUND', 'No verification code found. Please login again.')
    }

    if (Date.now() > stored.expiresAt) {
      otpStore.delete(email)
      throw new AppError(400, 'OTP_EXPIRED', 'Verification code expired. Please login again.')
    }

    if (stored.attempts >= OTP_MAX_ATTEMPTS) {
      otpStore.delete(email)
      logAuthAttempt(req, false, email)
      throw new AppError(429, 'OTP_MAX_ATTEMPTS', 'Too many failed attempts. Please login again.')
    }

    // Constant-time comparison to prevent timing attacks
    const otpBuffer = Buffer.from(otp)
    const storedBuffer = Buffer.from(stored.code)
    if (otpBuffer.length !== storedBuffer.length || !crypto.timingSafeEqual(otpBuffer, storedBuffer)) {
      stored.attempts++
      throw new AppError(400, 'OTP_INVALID', 'Invalid verification code')
    }

    // OTP valid — clean up
    otpStore.delete(email)

    // Fetch user from DB
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, role: true, isActive: true, avatar: true },
    })
    if (!user || !user.isActive) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found')
    }

    // Update lastLoginAt — fire and forget
    void prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    }).catch(() => undefined)

    // Issue tokens
    const tokenPayload = { userId: user.id, email: user.email, role: user.role }
    const accessToken = signToken(tokenPayload)
    const refreshToken = signRefreshToken(tokenPayload)

    logAuthAttempt(req, true, email)

    // Return tokens — never include password hash or sensitive data
    res.json({
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          avatar: user.avatar,
        },
      },
    })
  } catch (err) {
    next(err)
  }
})

// ═══════════════════════════════════════════
// POST /api/v1/auth/forgot-password
// ═══════════════════════════════════════════

authRouter.post('/forgot-password', loginLimiter, async (req, res, next) => {
  try {
    const { email } = resetRequestSchema.parse(req.body)

    // Generate reset token — always return success (prevent email enumeration)
    const token = crypto.randomBytes(32).toString('hex')
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

    resetTokenStore.set(hashedToken, {
      email,
      expiresAt: Date.now() + RESET_TOKEN_EXPIRY_MS,
      used: false,
    })

    // TODO: Send reset email via Resend
    if (process.env.NODE_ENV === 'development') {
      console.log(`[RESET] Token for ${email}: ${token}`)
    }

    // Always same response — prevents email enumeration attacks
    res.json({
      data: { message: 'If an account exists with this email, a reset link has been sent.' },
    })
  } catch (err) {
    next(err)
  }
})

// ═══════════════════════════════════════════
// POST /api/v1/auth/reset-password
// ═══════════════════════════════════════════

authRouter.post('/reset-password', loginLimiter, async (req, res, next) => {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body)

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex')
    const stored = resetTokenStore.get(hashedToken)

    if (!stored || stored.used || Date.now() > stored.expiresAt) {
      throw new AppError(400, 'INVALID_RESET_TOKEN', 'Reset link is invalid or expired')
    }

    // Mark token as used (one-time use)
    stored.used = true

    // Look up the user this token belongs to + update the hash
    const user = await prisma.user.findUnique({ where: { email: stored.email } })
    if (!user) {
      throw new AppError(400, 'INVALID_RESET_TOKEN', 'Reset link is invalid')
    }

    const newHash = await bcrypt.hash(password, BCRYPT_COST)
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: newHash } })

    // Clear any pending lockouts so the user can immediately log in
    lockoutStore.delete(stored.email)

    res.json({
      data: { message: 'Password updated successfully. Please login.' },
    })
  } catch (err) {
    next(err)
  }
})

// ═══════════════════════════════════════════
// POST /api/v1/auth/change-password — authenticated self-service password change.
// Requires the current password as proof-of-presence. Rate-limited via loginLimiter
// to slow down brute-force attempts against the current password.
// ═══════════════════════════════════════════

authRouter.post('/change-password', loginLimiter, authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, 'UNAUTHORIZED', 'Auth required')
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body)

    if (currentPassword === newPassword) {
      throw new AppError(400, 'SAME_PASSWORD', 'New password must be different from current')
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.userId } })
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found')

    const valid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!valid) {
      logAuthAttempt(req, false, user.email)
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Current password is incorrect')
    }

    const newHash = await bcrypt.hash(newPassword, BCRYPT_COST)
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: newHash } })

    logAuthAttempt(req, true, user.email)
    res.json({
      data: { message: 'Password updated successfully' },
    })
  } catch (err) {
    next(err)
  }
})

// ═══════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════

function generateSecureOTP(): string {
  // Cryptographically secure 6-digit OTP
  const bytes = crypto.randomBytes(4)
  const num = bytes.readUInt32BE(0) % 900000 + 100000
  return num.toString()
}

function recordFailedLogin(email: string) {
  const entry = lockoutStore.get(email) || { failedAttempts: 0, lockedUntil: null }
  entry.failedAttempts++

  if (entry.failedAttempts >= MAX_LOGIN_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCKOUT_DURATION_MS
    console.warn(`[SECURITY] Account locked: ${email} after ${MAX_LOGIN_ATTEMPTS} failed attempts`)
  }

  lockoutStore.set(email, entry)
}
