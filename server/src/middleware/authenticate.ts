import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../lib/env.js'
import { AppError } from './errorHandler.js'

export interface AuthPayload {
  userId: string
  email: string
  role: string
}

declare module 'express' {
  interface Request {
    user?: AuthPayload
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization

  if (!header?.startsWith('Bearer ')) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Missing or invalid authorization header'))
  }

  const token = header.slice(7)

  try {
    const payload = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ['HS256'],
      maxAge: `${env.SESSION_TIMEOUT_HOURS}h`,
    }) as AuthPayload

    req.user = payload
    next()
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return next(new AppError(401, 'TOKEN_EXPIRED', 'Session expired. Please login again.'))
    }
    if (err instanceof jwt.JsonWebTokenError) {
      return next(new AppError(401, 'TOKEN_INVALID', 'Invalid token.'))
    }
    next(new AppError(401, 'UNAUTHORIZED', 'Authentication failed.'))
  }
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: `${env.SESSION_TIMEOUT_HOURS}h`,
    issuer: 'lixiops',
    audience: 'lixiops-client',
  })
}

export function signRefreshToken(payload: AuthPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    algorithm: 'HS256',
    expiresIn: '7d',
    issuer: 'lixiops',
    audience: 'lixiops-client',
  })
}

// Role-based access control middleware
export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(401, 'UNAUTHORIZED', 'Authentication required'))
    }
    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, 'FORBIDDEN', 'Insufficient permissions'))
    }
    next()
  }
}

// CEO-only shorthand
export const requireCEO = requireRole('CEO')
export const requireManager = requireRole('CEO', 'MANAGER')
