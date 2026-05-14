import { useEffect, useState } from 'react'
import { api, ApiError } from '@/lib/api'

// ───────────────────────────────────────────
// Invoice list hook — normalizes the server payload into the
// flat shape the list/table UI expects. Overdue is computed
// client-side (server stores raw status; due-date comparison).
// ───────────────────────────────────────────

export interface InvoiceListItem {
  id: string
  number: string
  client: string
  amount: number
  dueDate: string
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'partial'
  paidAmount: number
}

interface ServerInvoice {
  id: string
  invoiceNumber: string
  total: number
  paidAmount: number
  dueDate: string
  status: string
  client: { company: string }
}

const FALLBACK: InvoiceListItem[] = [
  { id: '1', number: 'INV-2026-001', client: 'Bella Cucina', amount: 6000, dueDate: '2026-04-15', status: 'paid', paidAmount: 6000 },
  { id: '2', number: 'INV-2026-002', client: 'CareFirst Health', amount: 8000, dueDate: '2026-04-20', status: 'sent', paidAmount: 0 },
  { id: '3', number: 'INV-2026-003', client: 'Urban Threads', amount: 4500, dueDate: '2026-04-10', status: 'overdue', paidAmount: 0 },
  { id: '4', number: 'INV-2026-004', client: 'DataFlow Inc', amount: 12000, dueDate: '2026-04-30', status: 'partial', paidAmount: 4000 },
  { id: '5', number: 'INV-2026-005', client: 'FitTrack', amount: 5500, dueDate: '2026-05-01', status: 'draft', paidAmount: 0 },
  { id: '6', number: 'INV-2026-006', client: 'Swift Logistics', amount: 9200, dueDate: '2026-04-25', status: 'sent', paidAmount: 0 },
  { id: '7', number: 'INV-2026-007', client: 'Bella Cucina', amount: 3000, dueDate: '2026-05-05', status: 'draft', paidAmount: 0 },
]

function normalizeStatus(raw: string, dueDate: string, paidAmount: number, total: number): InvoiceListItem['status'] {
  const lower = raw.toLowerCase()
  if (lower === 'paid' || paidAmount >= total) return 'paid'
  if (lower === 'partial') return 'partial'
  if (lower === 'draft') return 'draft'
  // Promote "sent" to "overdue" if past due
  if (new Date(dueDate).getTime() < Date.now()) return 'overdue'
  return 'sent'
}

function mapInvoice(i: ServerInvoice): InvoiceListItem {
  return {
    id: i.id,
    number: i.invoiceNumber,
    client: i.client?.company || '—',
    amount: i.total,
    dueDate: i.dueDate,
    status: normalizeStatus(i.status, i.dueDate, i.paidAmount, i.total),
    paidAmount: i.paidAmount,
  }
}

export function useInvoices() {
  const [invoices, setInvoices] = useState<InvoiceListItem[]>(FALLBACK)
  const [loading, setLoading] = useState(true)
  const [usingFallback, setUsingFallback] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await api.get<{ data: ServerInvoice[] }>('/invoices')
        if (cancelled) return
        setInvoices(res.data.map(mapInvoice))
        setUsingFallback(false)
      } catch (err) {
        if (!cancelled) setUsingFallback(err instanceof ApiError && err.status === 0)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return { invoices, loading, usingFallback }
}
