import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Download, Send, Printer, Clock, CheckCircle2, CreditCard, Building2, Loader2, Link as LinkIcon, Check } from 'lucide-react'
import { Button, Badge, Card } from '@/components/ui'
import { fadeInUp } from '@/lib/motion'
import { exportInvoicePdf } from '@/lib/exportInvoicePdf'
import { CommentsPanel } from '@/components/comments/CommentsPanel'
import { mockCurrentUser } from '@/lib/mockUsers'
import { api, ApiError } from '@/lib/api'
import { useAuthStore } from '@/stores/useAuthStore'
import { useComments } from '@/hooks/useComments'
import { useUsers } from '@/hooks/useUsers'

// The server invoice shape — wider than what the UI displays.
// We map into the existing `invoiceData` shape so we don't have
// to touch the PDF template or the sidebar.
interface ServerInvoice {
  id: string
  invoiceNumber: string
  status: string
  subtotal: number
  total: number
  paidAmount: number
  dueDate: string
  createdAt: string
  sentAt: string | null
  paidAt: string | null
  paymentPageUrl: string | null
  notes: string | null
  client: {
    id: string
    company: string
    contactName: string
    email: string
    phone?: string | null
  }
  lineItems: Array<{
    id: string
    description: string
    quantity: number
    unitPrice: number
    total: number
    scope?: string | null
  }>
  payments: Array<{
    id: string
    amount: number
    method: string
    createdAt: string
    stripePaymentId: string | null
  }>
}

function formatDateStr(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const invoiceData = {
  id: '1',
  number: 'INV-2026-001',
  client: {
    name: 'Bella Cucina',
    contactName: 'Marco Rossi',
    email: 'marco@bellacucina.com',
    address: '456 Oak Avenue, New York, NY 10001',
  },
  from: {
    name: 'CodeLixi',
    tagline: 'Innovation Today, Transforming Tomorrow',
    email: 'billing@codelixi.com',
    address: 'Blue Area, Islamabad, Pakistan',
  },
  issueDate: 'Apr 1, 2026',
  dueDate: 'Apr 15, 2026',
  paidDate: 'Apr 3, 2026',
  status: 'paid' as 'draft' | 'sent' | 'paid' | 'overdue' | 'partial',
  lineItems: [
    { description: 'Brand Identity Design — Logo & Variations', scope: 'Full', investment: 3500, total: 3500 },
    { description: 'Brand Guidelines Document (40 pages)', scope: 'Full', investment: 1500, total: 1500 },
    { description: 'Social Media Template Pack', scope: 'Full', investment: 1000, total: 1000 },
  ],
  subtotal: 6000,
  total: 6000,
  paidAmount: 6000,
  notes: 'Thank you for partnering with CodeLixi. We are committed to delivering innovative solutions that transform your business.',
  paymentInfo: {
    bank: 'Citibank',
    account: '70586990000693457',
    routing: '031100209',
  },
  stripePaymentLink: 'https://pay.stripe.com/inv_xxxxx',
  payments: [
    { date: 'Apr 3, 2026', method: 'Stripe', amount: 6000, reference: 'pi_3XXXXXXXXXXXXX' },
  ],
}

const statusMap = {
  draft: { label: 'Draft', variant: 'default' as const },
  sent: { label: 'Sent', variant: 'info' as const },
  paid: { label: 'Paid', variant: 'success' as const },
  overdue: { label: 'Overdue', variant: 'danger' as const },
  partial: { label: 'Partial', variant: 'warning' as const },
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n)
}

const spaceGrotesk = { fontFamily: 'Space Grotesk, sans-serif' }

type InvoiceShape = typeof invoiceData

function mapServerInvoice(si: ServerInvoice): InvoiceShape {
  return {
    id: si.id,
    number: si.invoiceNumber,
    client: {
      name: si.client.company,
      contactName: si.client.contactName,
      email: si.client.email,
      address: '—',
    },
    from: invoiceData.from,
    issueDate: formatDateStr(si.sentAt ?? si.createdAt),
    dueDate: formatDateStr(si.dueDate),
    paidDate: formatDateStr(si.paidAt),
    status: (['draft', 'sent', 'paid', 'overdue', 'partial'].includes(si.status.toLowerCase())
      ? si.status.toLowerCase()
      : 'sent') as InvoiceShape['status'],
    lineItems: si.lineItems.map((li) => ({
      description: li.description,
      scope: li.scope || 'Full',
      investment: li.unitPrice,
      total: li.total,
    })),
    subtotal: si.subtotal,
    total: si.total,
    paidAmount: si.paidAmount,
    notes: si.notes || invoiceData.notes,
    paymentInfo: invoiceData.paymentInfo,
    stripePaymentLink: si.paymentPageUrl || invoiceData.stripePaymentLink,
    payments: si.payments.map((p) => ({
      date: formatDateStr(p.createdAt),
      method: p.method,
      amount: p.amount,
      reference: p.stripePaymentId || '—',
    })),
  }
}

export function InvoiceDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [invoice, setInvoice] = useState<InvoiceShape>(invoiceData)
  const [usingFallback, setUsingFallback] = useState(false)
  const [activePage, setActivePage] = useState<'cover' | 'details'>('cover')
  const [exporting, setExporting] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const authUser = useAuthStore((s) => s.user)
  const commentsApi = useComments('INVOICE', invoice.id)
  const { users: mentionableUsers } = useUsers()

  useEffect(() => {
    if (!id) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await api.get<{ data: ServerInvoice }>(`/invoices/${id}`)
        if (cancelled) return
        setInvoice(mapServerInvoice(res.data))
        setUsingFallback(false)
      } catch (err) {
        if (!cancelled) setUsingFallback(err instanceof ApiError && err.status === 0)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  const handleExportPdf = async () => {
    setExporting(true)
    try {
      await exportInvoicePdf(invoice.number)
    } catch (err) {
      console.error('PDF export failed:', err)
    } finally {
      setExporting(false)
    }
  }

  const handleSendInvoice = async () => {
    if (!invoice.id) return
    setSending(true)
    setSendError(null)
    try {
      const res = await api.patch<{ data: ServerInvoice }>(`/invoices/${invoice.id}/status`, { status: 'sent' })
      setInvoice(mapServerInvoice(res.data))
    } catch (err: any) {
      setSendError(err?.message ?? 'Failed to send invoice')
    } finally {
      setSending(false)
    }
  }

  const handleCopyPortalLink = async () => {
    if (!invoice.id) return
    const url = `${window.location.origin}/pay/${invoice.id}`
    try {
      await navigator.clipboard.writeText(url)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    } catch {
      // Fallback if clipboard blocked
      window.prompt('Copy this link to share with your client:', url)
    }
  }

  return (
    <div className="space-y-8">
      {/* Back + Header */}
      <div>
        <button
          onClick={() => navigate('/invoicing')}
          className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 transition-colors mb-4 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Invoices
        </button>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">{invoice.number}</h1>
              <Badge variant={statusMap[invoice.status].variant} dot>
                {statusMap[invoice.status].label}
              </Badge>
              {usingFallback && (
                <span className="text-2xs uppercase tracking-wider text-warning-600 font-semibold">Offline — demo</span>
              )}
            </div>
            <p className="text-sm text-neutral-500">{invoice.client.name} · Issued {invoice.issueDate}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              onClick={handleExportPdf}
              disabled={exporting}
            >
              {exporting ? 'Exporting...' : 'PDF'}
            </Button>
            <Button variant="secondary" size="sm" icon={<Printer className="h-3.5 w-3.5" />}>Print</Button>
            {invoice.status !== 'draft' && (
              <Button
                variant="secondary"
                size="sm"
                icon={linkCopied ? <Check className="h-3.5 w-3.5" /> : <LinkIcon className="h-3.5 w-3.5" />}
                onClick={handleCopyPortalLink}
              >
                {linkCopied ? 'Copied' : 'Copy portal link'}
              </Button>
            )}
            {invoice.status === 'draft' && (
              <Button
                size="sm"
                icon={sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                onClick={handleSendInvoice}
                disabled={sending}
              >
                {sending ? 'Sending...' : 'Send Invoice'}
              </Button>
            )}
          </div>
        </div>
        {sendError && (
          <p className="mt-2 text-xs text-danger-600">{sendError}</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Invoice Body — 2-Page Template */}
        <motion.div className="lg:col-span-2 space-y-4" {...fadeInUp}>
          {/* Page Tabs */}
          <div className="flex items-center gap-1 bg-neutral-100 rounded-lg p-1 w-fit">
            <button
              onClick={() => setActivePage('cover')}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                activePage === 'cover' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              Page 1 — Cover
            </button>
            <button
              onClick={() => setActivePage('details')}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                activePage === 'details' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              Page 2 — Details
            </button>
          </div>

          {/* ═══ PAGE 1: COVER ═══ */}
          {activePage === 'cover' && (
            <div
              id="invoice-printable-cover"
              className="rounded-xl border border-neutral-200/60 shadow-xs overflow-hidden relative"
              style={{ backgroundColor: '#ffffff', color: '#000000', aspectRatio: '8.5/11' }}
            >
              {/* Vertical INVOICE text — left side, bottom-aligned with logo */}
              <div className="absolute left-6 bottom-12 top-8 flex items-stretch">
                <h1
                  className="font-black select-none whitespace-nowrap flex items-end"
                  style={{
                    ...spaceGrotesk,
                    fontSize: 'clamp(100px, 14vw, 160px)',
                    writingMode: 'vertical-lr',
                    transform: 'rotate(180deg)',
                    letterSpacing: '-3px',
                    lineHeight: 0.85,
                    color: '#000000',
                  }}
                >
                  INVOICE
                </h1>
              </div>

              {/* Bottom-right — Seal + Logo stacked */}
              <div className="absolute bottom-12 right-12 flex flex-col items-center gap-4">
                <img src="/invoice-assets/seal.png" alt="CodeLixi Authorized Seal" className="h-28 w-28" />
                <img src="/invoice-assets/logo.png" alt="CodeLixi" className="h-10" />
              </div>
            </div>
          )}

          {/* ═══ PAGE 2: DETAILS ═══ */}
          {activePage === 'details' && (
            <div
              id="invoice-printable-details"
              className="rounded-xl border border-neutral-200/60 shadow-xs overflow-hidden"
              style={{ backgroundColor: '#ffffff', color: '#000000' }}
            >
              {/* Orange top accent line */}
              <div style={{ height: '4px', backgroundColor: '#ff5b01' }} />

              {/* Header — Logo + Tagline */}
              <div className="px-8 pt-6 pb-4">
                <img src="/invoice-assets/logo.png" alt="CodeLixi" className="h-9" />
                <p className="text-[10px] italic mt-1" style={{ color: '#888' }}>{invoice.from.tagline}</p>
              </div>

              {/* Bill To + Invoice Meta — side by side */}
              <div className="px-8 pb-6">
                <div className="flex justify-between items-start gap-6">
                  {/* Left: Bill To */}
                  <div className="flex-1">
                    <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: '#aaa', ...spaceGrotesk }}>Bill To</p>
                    <div style={{ backgroundColor: '#000', borderRadius: '6px', padding: '12px 16px' }}>
                      <p className="text-[13px] font-semibold text-white">{invoice.client.name}</p>
                      <p className="text-[11px] mt-0.5" style={{ color: '#999' }}>{invoice.client.email}</p>
                      <p className="text-[11px]" style={{ color: '#999' }}>{invoice.client.address}</p>
                    </div>
                  </div>

                  {/* Right: Invoice meta */}
                  <div className="text-right shrink-0" style={spaceGrotesk}>
                    <div className="space-y-1">
                      <p className="text-[13px]">
                        <span className="font-bold" style={{ color: '#000' }}>Invoice # </span>
                        <span style={{ color: '#555' }}>{invoice.number.replace('INV-', '')}</span>
                      </p>
                      <p className="text-[13px]">
                        <span className="font-bold" style={{ color: '#000' }}>Issue Date: </span>
                        <span style={{ color: '#ff5b01', fontWeight: 600 }}>{invoice.issueDate}</span>
                      </p>
                    </div>
                    <div className="mt-3 inline-flex flex-col items-end">
                      <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: '#aaa' }}>Due Date:</p>
                      <span
                        className="inline-block px-4 py-1.5 rounded-md text-[12px] font-bold"
                        style={{ backgroundColor: '#ff5b01', color: '#fff' }}
                      >
                        {invoice.dueDate}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="px-8 pb-5">
                <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                  <thead>
                    <tr>
                      <th className="text-left text-[11px] font-bold text-white px-4 py-2.5" style={{ backgroundColor: '#ff5b01', borderTopLeftRadius: '6px', ...spaceGrotesk }}>
                        Solution Overview
                      </th>
                      <th className="text-center text-[11px] font-bold text-white px-3 py-2.5" style={{ backgroundColor: '#ff5b01', ...spaceGrotesk }}>
                        Scope
                      </th>
                      <th className="text-center text-[11px] font-bold text-white px-3 py-2.5" style={{ backgroundColor: '#ff5b01', ...spaceGrotesk }}>
                        Investment
                      </th>
                      <th className="text-center text-[11px] font-bold text-white px-3 py-2.5" style={{ backgroundColor: '#ff5b01', borderTopRightRadius: '6px', ...spaceGrotesk }}>
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.lineItems.map((item, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td className="px-4 py-3 text-[11px]" style={{ color: '#333' }}>{item.description}</td>
                        <td className="px-3 py-3 text-[11px] text-center" style={{ color: '#666' }}>{item.scope}</td>
                        <td className="px-3 py-3 text-[11px] text-center" style={{ color: '#666' }}>{formatCurrency(item.investment)}</td>
                        <td className="px-3 py-3 text-[11px] font-semibold text-center" style={{ color: '#000' }}>{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                    {Array.from({ length: Math.max(0, 5 - invoice.lineItems.length) }).map((_, i) => (
                      <tr key={`e-${i}`} style={{ borderBottom: '1px solid #f5f5f5' }}>
                        <td className="px-4 py-3">&nbsp;</td>
                        <td className="px-3 py-3" />
                        <td className="px-3 py-3" />
                        <td className="px-3 py-3" />
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Sub Total */}
                <div className="flex justify-between items-center px-4 py-2.5 mt-1" style={{ borderBottom: '1px solid #e0e0e0' }}>
                  <span className="text-[11px] font-bold" style={{ color: '#000', ...spaceGrotesk }}>Sub Total</span>
                  <span className="text-[11px] font-bold" style={{ color: '#000' }}>{formatCurrency(invoice.subtotal)}</span>
                </div>

                {/* Total Investment */}
                <div
                  className="flex justify-between items-center px-4 py-3.5 mt-1"
                  style={{ borderTop: '2px solid #000', borderBottom: '2px solid #000' }}
                >
                  <span className="text-base font-bold" style={{ color: '#ff5b01', ...spaceGrotesk }}>
                    TOTAL INVESTMENT
                  </span>
                  <span className="text-base font-bold" style={{ color: '#ff5b01', ...spaceGrotesk }}>
                    {formatCurrency(invoice.total)}
                  </span>
                </div>
              </div>

              {/* Payment Section — QR + Bank + Thank you */}
              <div className="px-8 pb-5">
                <div className="flex gap-6">
                  {/* QR Code */}
                  <div className="flex flex-col items-center shrink-0">
                    <img src="/invoice-assets/qr-code.png" alt="QR Code" className="h-[88px] w-[88px]" />
                    <p className="text-[9px] font-bold mt-1.5" style={{ color: '#000', ...spaceGrotesk }}>Scan to pay</p>
                  </div>

                  {/* Payment Info + Thank you */}
                  <div className="flex-1 min-w-0" style={spaceGrotesk}>
                    <p className="text-[12px] font-bold mb-1.5" style={{ color: '#000' }}>Payment Information</p>
                    <div className="space-y-0.5">
                      <p className="text-[10px]" style={{ color: '#555' }}>Bank: {invoice.paymentInfo.bank}</p>
                      <p className="text-[10px]" style={{ color: '#555' }}>Account: {invoice.paymentInfo.account}</p>
                      <p className="text-[10px]" style={{ color: '#555' }}>Routing: {invoice.paymentInfo.routing}</p>
                    </div>
                    <p className="text-[10px] leading-relaxed mt-3" style={{ color: '#666', maxWidth: '280px' }}>
                      Thank you for partnering with{' '}
                      <span className="font-semibold" style={{ color: '#ff5b01' }}>CodeLixi</span>.{' '}
                      {invoice.notes.replace('Thank you for partnering with CodeLixi. ', '')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-8 pb-3">
                <div style={{ borderTop: '1px solid #eee' }} className="pt-3">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-[9px]" style={{ color: '#aaa' }}>{invoice.from.name} LLC. All Rights Reserved.</p>
                      <p className="text-[9px] italic" style={{ color: '#ccc' }}>Confidential Note.</p>
                    </div>
                    <div className="text-right">
                      <img src="/invoice-assets/signature.png" alt="Signature" className="h-7 ml-auto mb-0.5" />
                      <p className="text-[11px]">
                        <span className="font-bold" style={{ color: '#000' }}>Noman Azam</span>
                        <span style={{ color: '#666' }}>, Founder & CEO</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Orange bottom bar */}
              <div style={{ height: '4px', backgroundColor: '#ff5b01' }} />
            </div>
          )}
        </motion.div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Payment Methods */}
          <Card>
            <h2 className="text-sm font-semibold text-neutral-900 mb-4">Pay This Invoice</h2>
            <div className="space-y-3">
              {/* Stripe */}
              <a
                href={invoice.stripePaymentLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-3 rounded-lg border border-neutral-200 hover:border-brand-500 hover:bg-brand-50/50 transition-all group cursor-pointer"
              >
                <div className="h-9 w-9 rounded-lg bg-[#635BFF] flex items-center justify-center flex-shrink-0">
                  <CreditCard className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-neutral-900 group-hover:text-brand-600">Pay with Stripe</p>
                  <p className="text-[10px] text-neutral-500">Card, Apple Pay, Google Pay</p>
                </div>
                <span className="text-xs font-medium text-neutral-400 group-hover:text-brand-500">→</span>
              </a>
              {/* Bank Transfer */}
              <div className="flex items-center gap-3 px-3 py-3 rounded-lg border border-neutral-200 bg-neutral-50/50">
                <div className="h-9 w-9 rounded-lg bg-neutral-800 flex items-center justify-center flex-shrink-0">
                  <Building2 className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-neutral-900">Bank Transfer</p>
                  <p className="text-[10px] text-neutral-500">
                    {invoice.paymentInfo.bank} · ****{invoice.paymentInfo.account.slice(-4)}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Payment Summary */}
          <Card>
            <h2 className="text-sm font-semibold text-neutral-900 mb-4">Payment Summary</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Total</span>
                <span className="font-medium text-neutral-900">{formatCurrency(invoice.total)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Paid</span>
                <span className="font-medium text-success-600">{formatCurrency(invoice.paidAmount)}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-neutral-100 pt-2">
                <span className="font-medium text-neutral-900">Balance</span>
                <span className="font-bold text-neutral-900">{formatCurrency(invoice.total - invoice.paidAmount)}</span>
              </div>
            </div>
          </Card>

          {/* Payment History */}
          <Card>
            <h2 className="text-sm font-semibold text-neutral-900 mb-4">Payment History</h2>
            <div className="space-y-3">
              {invoice.payments.map((payment, i) => (
                <div key={i} className="flex items-start gap-3">
                  <CheckCircle2 className="h-4 w-4 text-success-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-neutral-900">{formatCurrency(payment.amount)}</p>
                    <p className="text-xs text-neutral-500">{payment.method} · {payment.date}</p>
                    <p className="text-xs text-neutral-400">Ref: {payment.reference}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Timeline */}
          <Card>
            <h2 className="text-sm font-semibold text-neutral-900 mb-4">Timeline</h2>
            <div className="relative">
              <div className="absolute left-3 top-0 bottom-0 w-px bg-neutral-100" />
              <div className="space-y-4">
                {[
                  { label: 'Payment received via Stripe', date: 'Apr 3, 2026', icon: <CheckCircle2 className="h-3.5 w-3.5 text-success-500" /> },
                  { label: 'Invoice viewed by client', date: 'Apr 2, 2026', icon: <Clock className="h-3.5 w-3.5 text-info-500" /> },
                  { label: 'Invoice sent to client', date: 'Apr 1, 2026', icon: <Send className="h-3.5 w-3.5 text-brand-500" /> },
                  { label: 'Invoice created', date: 'Apr 1, 2026', icon: <Clock className="h-3.5 w-3.5 text-neutral-400" /> },
                ].map((event, i) => (
                  <div key={i} className="relative flex items-center gap-3 pl-8">
                    <div className="absolute left-1 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-white flex items-center justify-center">
                      {event.icon}
                    </div>
                    <div className="flex items-center justify-between flex-1">
                      <span className="text-xs text-neutral-700">{event.label}</span>
                      <span className="text-[10px] text-neutral-400">{event.date}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Contextual Comments — tied to this invoice */}
      <Card>
        <CommentsPanel
          entityType="INVOICE"
          entityId={invoice.id}
          currentUser={authUser ? { id: authUser.id, name: authUser.name, email: authUser.email, avatar: authUser.avatar, role: authUser.role } : mockCurrentUser}
          mentionableUsers={mentionableUsers}
          comments={commentsApi.comments}
          onCreate={commentsApi.create}
          onEdit={commentsApi.edit}
          onDelete={commentsApi.remove}
        />
      </Card>

      {/* ═══ Hidden PDF Render Targets ═══ */}
      <div className="fixed" style={{ left: '-9999px', top: 0, width: '794px' }}>
        {/* Cover Page for PDF */}
        <div
          id="invoice-pdf-cover"
          style={{ backgroundColor: '#ffffff', color: '#000000', width: '794px', height: '1123px', position: 'relative' }}
        >
          {/* Vertical INVOICE text — fills left side */}
          <div style={{ position: 'absolute', left: '24px', top: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <h1 style={{
              fontSize: '200px',
              fontWeight: 900,
              color: '#000',
              writingMode: 'vertical-lr',
              transform: 'rotate(180deg)',
              letterSpacing: '-5px',
              lineHeight: 0.85,
              whiteSpace: 'nowrap',
              ...spaceGrotesk,
            }}>
              INVOICE
            </h1>
          </div>
          {/* Bottom-right — Seal + Logo stacked */}
          <div style={{ position: 'absolute', bottom: '60px', right: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <img src="/invoice-assets/seal.png" alt="Seal" style={{ height: '140px', width: '140px' }} />
            <img src="/invoice-assets/logo.png" alt="CodeLixi" style={{ height: '48px' }} />
          </div>
        </div>

        {/* Details Page for PDF */}
        <div
          id="invoice-pdf-details"
          style={{ backgroundColor: '#ffffff', color: '#000000', width: '794px' }}
        >
          {/* Orange top accent line — matches on-screen */}
          <div style={{ height: '6px', backgroundColor: '#ff5b01' }} />

          {/* Header */}
          <div style={{ padding: '36px 40px 20px' }}>
            <img src="/invoice-assets/logo.png" alt="CodeLixi" style={{ height: '44px' }} />
            <p style={{ fontSize: '11px', fontStyle: 'italic', color: '#888', marginTop: '4px' }}>{invoice.from.tagline}</p>
          </div>

          {/* Bill To + Meta */}
          <div style={{ padding: '0 40px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#999', marginBottom: '8px' }}>Bill To</p>
              <div style={{ backgroundColor: '#000', color: '#fff', borderRadius: '6px', padding: '14px 20px' }}>
                <p style={{ fontSize: '14px', fontWeight: 600 }}>{invoice.client.name}</p>
                <p style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>{invoice.client.email}</p>
                <p style={{ fontSize: '11px', color: '#aaa' }}>{invoice.client.address}</p>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '13px' }}>
                <span style={{ fontWeight: 700, color: '#000' }}>Invoice # </span>
                <span style={{ color: '#555' }}>{invoice.number.replace('INV-', '')}</span>
              </p>
              <p style={{ fontSize: '13px', marginTop: '4px' }}>
                <span style={{ fontWeight: 700, color: '#000' }}>Issue Date: </span>
                <span style={{ color: '#ff5b01', fontWeight: 600 }}>{invoice.issueDate}</span>
              </p>
              <div style={{ marginTop: '8px' }}>
                <p style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#999', marginBottom: '4px' }}>Due Date:</p>
                <span style={{ backgroundColor: '#ff5b01', color: '#fff', padding: '4px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: 700 }}>
                  {invoice.dueDate}
                </span>
              </div>
            </div>
          </div>

          {/* Table */}
          <div style={{ padding: '0 40px 24px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#fff', padding: '10px 16px', backgroundColor: '#ff5b01', borderTopLeftRadius: '6px', ...spaceGrotesk }}>Solution Overview</th>
                  <th style={{ textAlign: 'center', fontSize: '12px', fontWeight: 700, color: '#fff', padding: '10px 12px', backgroundColor: '#ff5b01', ...spaceGrotesk }}>Scope</th>
                  <th style={{ textAlign: 'center', fontSize: '12px', fontWeight: 700, color: '#fff', padding: '10px 12px', backgroundColor: '#ff5b01', ...spaceGrotesk }}>Investment</th>
                  <th style={{ textAlign: 'center', fontSize: '12px', fontWeight: 700, color: '#fff', padding: '10px 12px', backgroundColor: '#ff5b01', borderTopRightRadius: '6px', ...spaceGrotesk }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lineItems.map((item, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '10px 16px', fontSize: '12px', color: '#333' }}>{item.description}</td>
                    <td style={{ padding: '10px 12px', fontSize: '12px', color: '#555', textAlign: 'center' }}>{item.scope}</td>
                    <td style={{ padding: '10px 12px', fontSize: '12px', color: '#555', textAlign: 'center' }}>{formatCurrency(item.investment)}</td>
                    <td style={{ padding: '10px 12px', fontSize: '12px', color: '#000', fontWeight: 500, textAlign: 'center' }}>{formatCurrency(item.total)}</td>
                  </tr>
                ))}
                {Array.from({ length: Math.max(0, 5 - invoice.lineItems.length) }).map((_, i) => (
                  <tr key={`e-${i}`} style={{ borderBottom: '1px solid #f5f5f5' }}>
                    <td style={{ padding: '10px 16px' }}>&nbsp;</td>
                    <td style={{ padding: '10px 12px' }} />
                    <td style={{ padding: '10px 12px' }} />
                    <td style={{ padding: '10px 12px' }} />
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Sub Total */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px', borderBottom: '1px solid #e0e0e0' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#000', ...spaceGrotesk }}>Sub Total</span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#000' }}>{formatCurrency(invoice.subtotal)}</span>
            </div>

            {/* Total */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 16px', marginTop: '4px', borderTop: '2px solid #000', borderBottom: '2px solid #000' }}>
              <span style={{ fontSize: '20px', fontWeight: 700, color: '#ff5b01', ...spaceGrotesk }}>TOTAL INVESTMENT</span>
              <span style={{ fontSize: '20px', fontWeight: 700, color: '#ff5b01', ...spaceGrotesk }}>{formatCurrency(invoice.total)}</span>
            </div>
          </div>

          {/* QR + Payment Info */}
          <div style={{ padding: '0 40px 24px', display: 'flex', gap: '32px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <img src="/invoice-assets/qr-code.png" alt="QR" style={{ height: '100px', width: '100px' }} />
              <p style={{ fontSize: '10px', fontWeight: 700, marginTop: '6px', color: '#000', ...spaceGrotesk }}>Scan to pay</p>
            </div>
            <div style={{ flex: 1, ...spaceGrotesk }}>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#000', marginBottom: '6px' }}>Payment Information</p>
              <p style={{ fontSize: '11px', color: '#555' }}>Bank: {invoice.paymentInfo.bank}</p>
              <p style={{ fontSize: '11px', color: '#555' }}>Account: {invoice.paymentInfo.account}</p>
              <p style={{ fontSize: '11px', color: '#555' }}>Routing: {invoice.paymentInfo.routing}</p>
              <p style={{ fontSize: '11px', color: '#666', lineHeight: 1.5, marginTop: '12px', maxWidth: '300px' }}>
                Thank you for partnering with <span style={{ fontWeight: 600, color: '#ff5b01' }}>CodeLixi</span>.{' '}
                {invoice.notes.replace('Thank you for partnering with CodeLixi. ', '')}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div style={{ padding: '0 40px 0', borderTop: '1px solid #eee' }}>
            <div style={{ padding: '16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div>
                <p style={{ fontSize: '10px', color: '#999' }}>{invoice.from.name} LLC. All Rights Reserved.</p>
                <p style={{ fontSize: '10px', color: '#bbb', fontStyle: 'italic' }}>Confidential Note.</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <img src="/invoice-assets/signature.png" alt="Signature" style={{ height: '36px', marginLeft: 'auto' }} />
                <p style={{ fontSize: '12px', marginTop: '4px' }}>
                  <span style={{ fontWeight: 700, color: '#000' }}>Noman Azam</span>
                  <span style={{ color: '#666' }}>, Founder & CEO</span>
                </p>
              </div>
            </div>
          </div>

          {/* Orange bottom bar — matches on-screen */}
          <div style={{ height: '6px', backgroundColor: '#ff5b01' }} />
        </div>
      </div>
    </div>
  )
}
