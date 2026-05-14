import Stripe from 'stripe'
import { env } from './env.js'

let stripe: InstanceType<typeof Stripe> | null = null

export function getStripe(): InstanceType<typeof Stripe> {
  if (!stripe) {
    if (!env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not configured')
    }
    stripe = new Stripe(env.STRIPE_SECRET_KEY)
  }
  return stripe
}

export function isStripeConfigured(): boolean {
  return !!env.STRIPE_SECRET_KEY
}
