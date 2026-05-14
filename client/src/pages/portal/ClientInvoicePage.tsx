import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle2, CreditCard, Loader2, AlertTriangle, Building2, Shield } from 'lucide-react'
import { api } from '@/lib/api'

interface PortalInvoice {
  id: string
  invoiceNumber: string
  subtotal: number
  taxAmount: number
  total: number
  paidAmount: number
  dueDate: string
  status: string
  sentAt: string | null
  client: { company: string; contactName: string; email: string }
  lineItems: Array<{ description: string; quantity: number; unitPrice: number; total: number }>
  payments: Array<{ amount: number; method: string; createdAt: string; reference: string | null }>
}

// Offline demo fallback so the portal page is reviewable without the server.
const DEMO_INVOICE: PortalInvoice = {
  id: 'demo',
  invoiceNumber: 'INV-2026-001',
  subtotal: 6000,
  taxAmount: 0,
  total: 6000,
  paidAmount: 0,
  dueDate: new Date(Date.now() + 14 * 86_400_000).toISOString(),
  status: 'sent',
  sentAt: new Date().toISOString(),
  client: { company: 'Bella Cucina', contactName: 'Marco Rossi', email: 'marco@bellacucina.com' },
  lineItems: [
    { description: 'Brand Identity Design', quantity: 1, unitPrice: 3500, total: 3500 },
    { description: 'Brand Guidelines Document', quantity: 1, unitPrice: 1500, total: 1500 },
    { description: 'Social Media Template Pack', quantity: 1, unitPrice: 1000, total: 1000 },
  ],
  payments: [],
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n)
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function ClientInvoicePage() {
  const { token } = useParams<{ token: string }>()
  const [search] = useSearchParams()
  const paymentStatus = search.get('status') // 'success' | 'cancelled' | null

  const [invoice, setInvoice] = useState<PortalInvoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)
  const [demo, setDemo] = useState(false)

  useEffect(() => {
    let alive = true
    async function load() {
      if (!token) return
      try {
        const res = await api.get<{ invoice: PortalInvoice; stripeEnabled: boolean }>(
          `/portal/invoice/${token}`,
        )
        if (!alive) return
        setInvoice(res.invoice)
      } catch (e: any) {
        if (!alive) return
        // Fallback to demo so the page is reviewable without backend.
        setInvoice(DEMO_INVOICE)
        setDemo(true)
        setError(e?.message ?? 'Unable to load invoice')
      } finally {
        if (alive) setLoading(false)
      }
    }
    void load()
    return () => {
      alive = false
    }
  }, [token])

  const balance = useMemo(() => (invoice ? invoice.total - invoice.paidAmount : 0), [invoice])
  const paid = invoice?.status === 'paid' || balance <= 0

  async function handlePay() {
    if (!token || demo) {
      setPayError('Pay button is disabled in demo mode')
      return
    }
    setPaying(true)
    setPayError(null)
    try {
      const res = await api.post<{ url: string }>(`/portal/invoice/${token}/pay`)
      if (res.url) window.location.href = res.url
    } catch (e: any) {
      setPayError(e?.message ?? 'Could not start checkout')
    } finally {
      setPaying(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <Loader2 className="h-6 w-6 text-brand-500 animate-spin" />
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-6">
        <div className="max-w-md text-center">
          <AlertTriangle className="h-8 w-8 text-danger-500 mx-auto mb-3" />
          <h1 className="text-lg font-bold text-neutral-900 mb-1">Invoice not found</h1>
          <p className="text-sm text-neutral-500">{error ?? 'This link may have expired.'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Top ribbon */}
      <div className="bg-neutral-900 text-white">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/invoice-assets/logo.png" alt="CodeLixi" className="h-6 brightness-0 invert" />
            <span className="text-[10px] text-neutral-400 italic hidden sm:inline">
              Innovation Today, Transforming Tomorrow
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-neutral-400">
            <Shield className="h-3 w-3" />
            Secure payment portal
          </div>
        </div>
      </div>

      {/* Status banners */}
      {paymentStatus === 'success' && (
        <div className="bg-success-50 border-b border-success-200">
          <div className="max-w-4xl mx-auto px-6 py-3 flex items-center gap-2 text-sm text-success-800">
            <CheckCircle2 className="h-4 w-4" />
            Payment received. A receipt has been emailed to {invoice.client.email}.
          </div>
        </div>
      )}
      {paymentStatus === 'cancelled' && (
        <div className="bg-warning-50 border-b border-warning-200">
          <div className="max-w-4xl mx-auto px-6 py-3 flex items-center gap-2 text-sm text-warning-800">
            <AlertTriangle className="h-4 w-4" />
            Payment was cancelled. You can try again below.
          </div>
        </div>
      )}
      {demo && (
        <div className="bg-brand-50 border-b border-brand-100">
          <div className="max-w-4xl mx-auto px-6 py-2 text-[11px] text-brand-700">
            Demo mode — backend unreachable, showing sample invoice.
          </div>
        </div>
      )}

      {/* Main */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto px-6 py-10"
      >
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          {/* Invoice body — 3 cols */}
          <div className="md:col-span-3 space-y-5">
            <div className="rounded-xl bg-white border border-neutral-200/60 overflow-hidden shadow-xs">
              <div className="h-1.5 bg-brand-500" />
              <div className="p-6">
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1">Invoice</p>
                    <h1 className="text-2xl font-bold text-neutral-900">{invoice.invoiceNumber}</h1>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1">Due</p>
                    <p className="text-sm font-semibold text-neutral-900">{formatDate(invoice.dueDate)}</p>
                  </div>
                </div>

                {/* Bill To */}
                <div className="mb-6 pb-5 border-b border-neutral-100">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1.5">Billed to</p>
                  <p className="text-sm font-semibold text-neutral-900">{invoice.client.company}</p>
                  <p className="text-xs text-neutral-500">{invoice.client.contactName}</p>
                  <p className="text-xs text-neutral-500">{invoice.client.email}</p>
                </div>

                {/* Line items */}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 border-b border-neutral-100">
                      <th className="text-left pb-2 font-bold">Description</th>
                      <th className="text-right pb-2 font-bold w-20">Qty</th>
                      <th className="text-right pb-2 font-bold w-24">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.lineItems.map((li, i) => (
                      <tr key={i} className="border-b border-neutral-50">
                        <td className="py-3 text-neutral-700">{li.description}</td>
                        <td className="py-3 text-right text-neutral-500">{li.quantity}</td>
                        <td className="py-3 text-right font-medium text-neutral-900">{formatCurrency(li.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Totals */}
                <div className="mt-4 space-y-1.5 text-sm">
                  <div className="flex justify-between text-neutral-500">
                    <span>Subtotal</span>
                    <span>{formatCurrency(invoice.subtotal)}</span>
                  </div>
                  {invoice.taxAmount > 0 && (
                    <div className="flex justify-between text-neutral-500">
                      <span>Tax</span>
                      <span>{formatCurrency(invoice.taxAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-neutral-100 text-base font-bold text-neutral-900">
                    <span>Total</span>
                    <span>{formatCurrency(invoice.total)}</span>
                  </div>
                  {invoice.paidAmount > 0 && (
                    <div className="flex justify-between text-success-600 font-medium">
                      <span>Paid</span>
                      <span>− {formatCurrency(invoice.paidAmount)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Payment history */}
            {invoice.payments.length > 0 && (
              <div className="rounded-xl bg-white border border-neutral-200/60 p-5">
                <h2 className="text-sm font-semibold text-neutral-900 mb-3">Payment history</h2>
                <div className="space-y-2">
                  {invoice.payments.map((p, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-success-500" />
                        <span className="text-neutral-700">{formatCurrency(p.amount)}</span>
                        <span className="text-neutral-400">·</span>
                        <span className="text-neutral-500">{p.method}</span>
                      </div>
                      <span className="text-xs text-neutral-400">{formatDate(p.createdAt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Pay sidebar — 2 cols */}
          <div className="md:col-span-2 space-y-4">
            <div className="rounded-xl bg-white border border-neutral-200/60 p-5 sticky top-6">
              <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-2">Amount due</p>
              <p className="text-3xl font-bold text-neutral-900 mb-4">{formatCurrency(balance)}</p>

              {paid ? (
                <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-success-50 text-success-700 text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4" />
                  Paid in full — thank you.
                </div>
              ) : (
                <>
                  <button
                    onClick={handlePay}
                    disabled={paying}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-brand-500 text-white font-semibold hover:bg-brand-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                    {paying ? 'Redirecting…' : 'Pay with card'}
                  </button>
                  {payError && (
                    <p className="mt-2 text-[11px] text-danger-600">{payError}</p>
                  )}
                  <p className="mt-3 text-[11px] text-neutral-500 leading-relaxed">
                    You'll be redirected to Stripe's secure checkout. We never see your card details.
                  </p>
                </>
              )}

              <div className="mt-5 pt-5 border-t border-neutral-100 text-xs text-neutral-500 space-y-2">
                <div className="flex items-start gap-2">
                  <Building2 className="h-3.5 w-3.5 text-neutral-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-neutral-700">Prefer bank transfer?</p>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      Contact billing@codelixi.com and we'll share wire details.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-neutral-400 text-center">
              Questions? Reply to the email you received, or contact billing@codelixi.com.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
