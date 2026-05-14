import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import { getStripe, isStripeConfigured } from '../lib/stripe.js'
import { generateQRDataUrl } from '../lib/qr.js'

const prisma = new PrismaClient()
const router = Router()

// ═══════════════════════════════════════════
// Validation Schemas
// ═══════════════════════════════════════════

const lineItemSchema = z.object({
  description: z.string().min(1).max(500),
  scope: z.string().max(100).default('Full'),
  quantity: z.number().positive().default(1),
  unitPrice: z.number().min(0),
})

const createInvoiceSchema = z.object({
  projectId: z.string().min(1, 'projectId is required — invoices must be linked to a Project'),
  dueDate: z.string().refine((d) => !isNaN(Date.parse(d)), 'Invalid date'),
  lineItems: z.array(lineItemSchema).min(1),
  milestoneId: z.string().optional(),
  notes: z.string().max(1000).optional(),
  taxRate: z.number().min(0).max(100).default(0),
})

const updateStatusSchema = z.object({
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'partial']),
})

// ═══════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════

async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const count = await prisma.invoice.count({
    where: { invoiceNumber: { startsWith: `INV-${year}` } },
  })
  return `INV-${year}-${String(count + 1).padStart(3, '0')}`
}

// ═══════════════════════════════════════════
// GET /invoices — List all invoices
// ═══════════════════════════════════════════
router.get('/', async (_req: Request, res: Response) => {
  const invoices = await prisma.invoice.findMany({
    include: {
      client: { select: { id: true, company: true, email: true } },
      lineItems: true,
      _count: { select: { payments: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  res.json({ data: invoices })
})

// ═══════════════════════════════════════════
// GET /invoices/:id — Get invoice detail
// ═══════════════════════════════════════════
router.get('/:id', async (req: Request, res: Response) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: String(req.params.id) },
    include: {
      client: true,
      createdBy: { select: { id: true, name: true, email: true } },
      lineItems: true,
      payments: { orderBy: { createdAt: 'desc' } },
    },
  })

  if (!invoice) {
    res.status(404).json({ error: 'Invoice not found' })
    return
  }

  res.json({ data: invoice })
})

// ═══════════════════════════════════════════
// POST /invoices — Create invoice
// ═══════════════════════════════════════════
router.post('/', async (req: Request, res: Response) => {
  const parsed = createInvoiceSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
    return
  }

  const { projectId, dueDate, lineItems, milestoneId, taxRate } = parsed.data

  // RULE: invoice must attach to a valid project (which in turn requires a closed-won deal)
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { client: true },
  })
  if (!project) {
    res.status(404).json({ error: 'Project not found' })
    return
  }
  const clientId = project.clientId

  // Calculate totals
  const computedLineItems = lineItems.map((item) => ({
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    total: item.quantity * item.unitPrice,
  }))

  const subtotal = computedLineItems.reduce((sum, item) => sum + item.total, 0)
  const taxAmount = subtotal * (taxRate / 100)
  const total = subtotal + taxAmount

  const invoiceNumber = await generateInvoiceNumber()

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      clientId,
      projectId,
      milestoneId: milestoneId ?? null,
      createdById: (req as any).user?.userId ?? null,
      subtotal,
      taxRate,
      taxAmount,
      total,
      dueDate: new Date(dueDate),
      status: 'draft',
      lineItems: {
        create: computedLineItems,
      },
    },
    include: {
      client: true,
      project: { select: { id: true, name: true } },
      lineItems: true,
    },
  })

  res.status(201).json({ data: invoice })
})

// ═══════════════════════════════════════════
// PATCH /invoices/:id/status — Update status
// ═══════════════════════════════════════════
router.patch('/:id/status', async (req: Request, res: Response) => {
  const parsed = updateStatusSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid status' })
    return
  }

  const invoice = await prisma.invoice.findUnique({ where: { id: String(req.params.id) } })
  if (!invoice) {
    res.status(404).json({ error: 'Invoice not found' })
    return
  }

  const updateData: Record<string, any> = { status: parsed.data.status }

  if (parsed.data.status === 'sent' && !invoice.sentAt) {
    updateData.sentAt = new Date()
  }
  if (parsed.data.status === 'paid') {
    updateData.paidAt = new Date()
    updateData.paidAmount = invoice.total
  }

  const updated = await prisma.invoice.update({
    where: { id: String(req.params.id) },
    data: updateData,
    include: { client: true, lineItems: true, payments: true },
  })

  res.json({ data: updated })
})

// ═══════════════════════════════════════════
// POST /invoices/:id/payment-link — Generate Stripe Payment Link + QR
// ═══════════════════════════════════════════
router.post('/:id/payment-link', async (req: Request, res: Response) => {
  if (!isStripeConfigured()) {
    res.status(503).json({ error: 'Stripe is not configured. Add STRIPE_SECRET_KEY to .env' })
    return
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: String(req.params.id) },
    include: { client: true, lineItems: true },
  })

  if (!invoice) {
    res.status(404).json({ error: 'Invoice not found' })
    return
  }

  if (invoice.status === 'paid') {
    res.status(400).json({ error: 'Invoice is already paid' })
    return
  }

  const stripe = getStripe()
  const amountDue = Math.round((invoice.total - invoice.paidAmount) * 100) // cents

  // Create Stripe Payment Link via checkout session
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: invoice.client.email,
    line_items: invoice.lineItems.map((item: { description: string; total: number }) => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.description,
        },
        unit_amount: Math.round(item.total * 100),
      },
      quantity: 1,
    })),
    metadata: {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
    },
    success_url: `${req.headers.origin || 'http://localhost:5173'}/invoicing/${invoice.id}?payment=success`,
    cancel_url: `${req.headers.origin || 'http://localhost:5173'}/invoicing/${invoice.id}?payment=cancelled`,
  })

  // Generate QR code for the payment URL
  const qrDataUrl = await generateQRDataUrl(session.url!)

  // Save to invoice
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      paymentPageUrl: session.url,
      qrCodeUrl: qrDataUrl,
      stripePaymentIntentId: session.payment_intent as string,
    },
  })

  res.json({
    data: {
      paymentUrl: session.url,
      qrCodeDataUrl: qrDataUrl,
      sessionId: session.id,
    },
  })
})

// ═══════════════════════════════════════════
// POST /invoices/:id/record-payment — Manual bank payment
// ═══════════════════════════════════════════
router.post('/:id/record-payment', async (req: Request, res: Response) => {
  const schema = z.object({
    amount: z.number().positive(),
    method: z.string().min(1).max(50),
    reference: z.string().max(200).optional(),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
    return
  }

  const invoice = await prisma.invoice.findUnique({ where: { id: String(req.params.id) } })
  if (!invoice) {
    res.status(404).json({ error: 'Invoice not found' })
    return
  }

  const { amount, method, reference } = parsed.data
  const newPaidAmount = invoice.paidAmount + amount

  // Create payment record
  const payment = await prisma.payment.create({
    data: {
      invoiceId: invoice.id,
      amount,
      method,
      stripePaymentId: reference ?? null,
      status: 'completed',
    },
  })

  // Update invoice paid amount and status
  const newStatus = newPaidAmount >= invoice.total ? 'paid' : 'partial'
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      paidAmount: newPaidAmount,
      status: newStatus,
      ...(newStatus === 'paid' ? { paidAt: new Date() } : {}),
    },
  })

  res.json({ data: payment })
})

// ═══════════════════════════════════════════
// DELETE /invoices/:id — Delete draft invoice
// ═══════════════════════════════════════════
router.delete('/:id', async (req: Request, res: Response) => {
  const invoice = await prisma.invoice.findUnique({ where: { id: String(req.params.id) } })
  if (!invoice) {
    res.status(404).json({ error: 'Invoice not found' })
    return
  }

  if (invoice.status !== 'draft') {
    res.status(400).json({ error: 'Only draft invoices can be deleted' })
    return
  }

  await prisma.invoice.delete({ where: { id: String(req.params.id) } })
  res.json({ message: 'Invoice deleted' })
})

export { router as invoiceRouter }
