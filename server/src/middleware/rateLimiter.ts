import type { Request, Response, NextFunction } from 'express'
import { AppError } from './errorHandler.js'

interface RateLimitEntry {
  count: number
  resetAt: number
}

// In-memory store — replace with Redis in production for multi-instance
const stores = new Map<string, Map<string, RateLimitEntry>>()

function getStore(name: string): Map<string, RateLimitEntry> {
  if (!stores.has(name)) stores.set(name, new Map())
  return stores.get(name)!
}

function getClientKey(req: Request): string {
  // Use X-Forwarded-For behind proxy, fallback to IP
  const forwarded = req.headers['x-forwarded-for']
  const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.ip || 'unknown'
  return ip
}

interface RateLimitOptions {
  name: string
  windowMs: number     // time window in milliseconds
  maxRequests: number  // max requests per window
  message?: string
}

export function rateLimit({ name, windowMs, maxRequests, message }: RateLimitOptions) {
  const store = getStore(name)

  // Cleanup expired entries every 60 seconds
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store) {
      if (now > entry.resetAt) store.delete(key)
    }
  }, 60_000)

  return (req: Request, res: Response, next: NextFunction) => {
    const key = getClientKey(req)
    const now = Date.now()
    let entry = store.get(key)

    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs }
      store.set(key, entry)
    }

    entry.count++

    // Set rate limit headers
    const remaining = Math.max(0, maxRequests - entry.count)
    res.setHeader('X-RateLimit-Limit', maxRequests)
    res.setHeader('X-RateLimit-Remaining', remaining)
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000))

    if (entry.count > maxRequests) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
      res.setHeader('Retry-After', retryAfter)
      return next(new AppError(
        429,
        'RATE_LIMITED',
        message || `Too many requests. Try again in ${retryAfter} seconds.`,
      ))
    }

    next()
  }
}

// Pre-configured limiters
export const loginLimiter = rateLimit({
  name: 'login',
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5,            // 5 attempts per 15 min
  message: 'Too many login attempts. Account temporarily locked for 15 minutes.',
})

export const otpLimiter = rateLimit({
  name: 'otp',
  windowMs: 2 * 60 * 1000,  // 2 minutes
  maxRequests: 3,            // 3 OTP attempts
  message: 'Too many OTP attempts. Please request a new code.',
})

export const apiLimiter = rateLimit({
  name: 'api',
  windowMs: 60 * 1000,      // 1 minute
  maxRequests: 100,          // 100 requests/min
  message: 'API rate limit exceeded.',
})

export const aiLimiter = rateLimit({
  name: 'ai',
  windowMs: 60 * 1000,      // 1 minute
  maxRequests: 10,           // 10 AI calls/min
  message: 'AI generation rate limit exceeded. Please wait.',
})

export const uploadLimiter = rateLimit({
  name: 'upload',
  windowMs: 60 * 1000,      // 1 minute
  maxRequests: 10,           // 10 uploads/min
  message: 'Upload rate limit exceeded.',
})
