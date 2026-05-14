import type { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  // Log all errors
  const requestId = req.headers['x-request-id'] || 'unknown'
  console.error(`[ERROR] [${requestId}] ${req.method} ${req.path} — ${err.message}`)

  // Zod validation errors
  if (err instanceof ZodError) {
    const messages = err.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
    res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      status: 400,
      details: messages,
    })
    return
  }

  // Known application errors
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      status: err.statusCode,
    })
    return
  }

  // Unknown errors — never expose internals
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack)
  }

  res.status(500).json({
    error: 'An unexpected error occurred',
    code: 'INTERNAL_ERROR',
    status: 500,
  })
}
