import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { getStripe, isStripeConfigured } from '../lib/stripe.js'
import { env } from '../lib/env.js'

const prisma = new PrismaClient()
const router = Router()

// ═══════════════════════════════════════════
// POST /webhooks/stripe — Stripe webhook handler
// NOTE: This route must receive raw body (not JSON parsed)
// ═══════════════════════════════════════════
router.post('/stripe', async (req: Request, res: Response) => {
  if (!isStripeConfigured() || !env.STRIPE_WEBHOOK_SECRET) {
    res.status(503).json({ error: 'Stripe webhooks not configured' })
    return
  }

  const stripe = getStripe()
  const sig = req.headers['stripe-signature'] as string

  let event
  try {
    event = stripe.webhooks.constructEvent(
      (req as any).rawBody,
      sig,
      env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err: any) {
    console.error(`[Webhook] Signature verification failed: ${err.message}`)
    res.status(400).json({ error: 'Webhook signature verification failed' })
    return
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object
      const invoiceId = session.metadata?.invoiceId

      if (!invoiceId) {
        console.warn('[Webhook] No invoiceId in session metadata')
        break
      }

      const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } })
      if (!invoice) {
        console.warn(`[Webhook] Invoice ${invoiceId} not found`)
        break
      }

      const amountPaid = (session.amount_total ?? 0) / 100

      // Record payment
      await prisma.payment.create({
        data: {
          invoiceId: invoice.id,
          amount: amountPaid,
          method: 'stripe',
          stripePaymentId: session.payment_intent as string,
          status: 'completed',
        },
      })

      // Update invoice
      const newPaidAmount = invoice.paidAmount + amountPaid
      const newStatus = newPaidAmount >= invoice.total ? 'paid' : 'partial'

      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount: newPaidAmount,
          status: newStatus,
          stripePaymentIntentId: session.payment_intent as string,
          ...(newStatus === 'paid' ? { paidAt: new Date() } : {}),
        },
      })

      console.log(`[Webhook] Invoice ${invoice.invoiceNumber} payment recorded: $${amountPaid} (${newStatus})`)
      break
    }

    case 'checkout.session.expired': {
      const session = event.data.object
      const invoiceId = session.metadata?.invoiceId
      if (invoiceId) {
        console.log(`[Webhook] Payment session expired for invoice ${invoiceId}`)
      }
      break
    }

    default:
      // Unhandled event type
      break
  }

  res.json({ received: true })
})

export { router as webhookRouter }
