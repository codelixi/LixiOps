// ═══════════════════════════════════════════════════════════════
// Client Portal — PUBLIC (no auth) invoice view + Stripe pay
// ═══════════════════════════════════════════════════════════════
// For MVP, the "token" is the raw invoice id. In production, swap for
// a signed token with TTL (e.g. HMAC of invoiceId + timestamp) so links
// aren't guessable. All endpoints here are read-only or payment-init
// only — no mutation of the invoice itself except status on webhook.

import { Router, Request, Response, NextFunction } from 'express'
import { PrismaClient } from '@prisma/client'
import { AppError } from '../middleware/errorHandler.js'
import { env } from '../lib/env.js'
import { getStripe, isStripeConfigured } from '../lib/stripe.js'

const prisma = new PrismaClient()
const router = Router()

// ═══════════════════════════════════════════
// GET /portal/invoice/:token — public invoice view
// ═══════════════════════════════════════════
router.get('/invoice/:token', async (req: Request, res: Response, next: NextFunction) => {
  const id = String(req.params.token)
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      client: true,
      lineItems: true,
      payments: true,
    },
  })
  if (!invoice) return next(new AppError(404, 'NOT_FOUND', 'Invoice not found'))

  // Strip sensitive fields — only send what a paying client needs.
  res.json({
    invoice: {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      subtotal: invoice.subtotal,
      taxAmount: invoice.taxAmount,
      total: invoice.total,
      paidAmount: invoice.paidAmount,
      dueDate: invoice.dueDate,
      status: invoice.status,
      sentAt: invoice.sentAt,
      client: {
        company: invoice.client.company,
        contactName: invoice.client.contactName,
        email: invoice.client.email,
      },
      lineItems: invoice.lineItems.map((li) => ({
        description: li.description,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        total: li.total,
      })),
      payments: invoice.payments.map((p) => ({
        amount: p.amount,
        method: p.method,
        createdAt: p.createdAt,
        reference: p.stripePaymentId ?? null,
      })),
    },
    stripeEnabled: isStripeConfigured(),
  })
})

// ═══════════════════════════════════════════
// POST /portal/invoice/:token/pay — create Stripe Checkout session
// ═══════════════════════════════════════════
router.post('/invoice/:token/pay', async (req: Request, res: Response, next: NextFunction) => {
  if (!isStripeConfigured()) {
    return next(new AppError(503, 'STRIPE_UNCONFIGURED', 'Payment is not configured'))
  }
  const id = String(req.params.token)
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { client: true },
  })
  if (!invoice) return next(new AppError(404, 'NOT_FOUND', 'Invoice not found'))
  if (invoice.status === 'paid') {
    return next(new AppError(409, 'ALREADY_PAID', 'Invoice is already paid'))
  }

  const balance = invoice.total - invoice.paidAmount
  if (balance <= 0) {
    return next(new AppError(409, 'NO_BALANCE', 'Nothing to pay'))
  }

  const stripe = getStripe()
  const successUrl = `${env.CORS_ORIGIN}/pay/${invoice.id}?status=success`
  const cancelUrl = `${env.CORS_ORIGIN}/pay/${invoice.id}?status=cancelled`

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: invoice.client.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(balance * 100),
            product_data: {
              name: `Invoice ${invoice.invoiceNumber}`,
              description: `${invoice.client.company}`,
            },
          },
        },
      ],
      metadata: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    })

    res.json({ url: session.url, sessionId: session.id })
  } catch (err: any) {
    return next(new AppError(502, 'STRIPE_ERROR', err?.message ?? 'Stripe checkout failed'))
  }
})

export { router as portalRouter }
