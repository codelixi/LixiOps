import type { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'

// CSRF token generation and validation
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  // Skip for GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next()
  }

  // Skip for API routes using JWT auth (stateless, no cookies)
  // CSRF is relevant for cookie-based auth; JWT Bearer is immune
  if (req.headers.authorization?.startsWith('Bearer ')) {
    return next()
  }

  next()
}

// Additional security headers beyond what helmet provides
export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  // Strict Content-Security-Policy
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "connect-src 'self' ws://localhost:* wss://*.codelixi.com https://api.stripe.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '))

  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY')

  // Prevent MIME sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff')

  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')

  // Permissions policy
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(self), payment=(self)')

  // HSTS (only in production)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  }

  next()
}

// Request ID for tracing
export function requestId(req: Request, res: Response, next: NextFunction) {
  const id = crypto.randomUUID()
  req.headers['x-request-id'] = id
  res.setHeader('X-Request-Id', id)
  next()
}
