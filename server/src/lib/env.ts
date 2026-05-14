import { z } from 'zod'
import 'dotenv/config'

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1),

  // JWT — must be at least 32 chars in production
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),

  // Encryption
  ENCRYPTION_KEY: z.string().length(32),

  // Server
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // Session
  SESSION_TIMEOUT_HOURS: z.coerce.number().default(8),

  // Redis
  REDIS_URL: z.string().optional(),

  // Stripe
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // OpenAI
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o'),

  // Resend
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().default('noreply@codelixi.com'),

  // File Upload
  MAX_UPLOAD_SIZE_MB: z.coerce.number().default(10),

  // Biometric
  BIOMETRIC_ENCRYPTION_KEY: z.string().length(32).optional(),
})

function loadEnv() {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    console.error('[ENV] Invalid environment variables:')
    for (const issue of result.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`)
    }
    process.exit(1)
  }

  // Block insecure defaults in production
  if (result.data.NODE_ENV === 'production') {
    if (result.data.JWT_SECRET.startsWith('dev-only')) {
      console.error('[ENV] FATAL: Using dev JWT_SECRET in production!')
      process.exit(1)
    }
    if (result.data.CORS_ORIGIN === 'http://localhost:5173') {
      console.error('[ENV] FATAL: Using localhost CORS origin in production!')
      process.exit(1)
    }
  }

  return result.data
}

export const env = loadEnv()
export type Env = z.infer<typeof envSchema>
