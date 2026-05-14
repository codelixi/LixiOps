import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, Download, QrCode, Send, Eye } from 'lucide-react'
import { Button, Badge, Card } from '@/components/ui'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { useInvoices } from '@/hooks/useInvoices'

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

function formatDueDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function InvoiceListPage() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<string>('all')
  const { invoices, usingFallback } = useInvoices()

  const filtered = filter === 'all' ? invoices : invoices.filter((i) => i.status === filter)
  const totalOutstanding = invoices.filter((i) => i.status !== 'paid').reduce((s, i) => s + i.amount - i.paidAmount, 0)
  const totalCollected = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.paidAmount, 0)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Invoicing</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Manage invoices and track payments
            {usingFallback && (
              <span className="ml-2 text-2xs uppercase tracking-wider text-warning-600 font-semibold">Offline — demo data</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" icon={<Download className="h-3.5 w-3.5" />}>
            Export CSV
          </Button>
          <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => navigate('/invoicing/new')}>
            New Invoice
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Total Outstanding</p>
          <p className="text-2xl font-bold text-neutral-900">{formatCurrency(totalOutstanding)}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Collected This Month</p>
          <p className="text-2xl font-bold text-success-600">{formatCurrency(totalCollected)}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Overdue</p>
          <p className="text-2xl font-bold text-danger-600">{formatCurrency(invoices.filter((i) => i.status === 'overdue').reduce((s, i) => s + i.amount, 0))}</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        {['all', 'draft', 'sent', 'paid', 'overdue', 'partial'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all cursor-pointer ${
              filter === f
                ? 'bg-neutral-900 text-white'
                : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            {f === 'all' ? 'All' : f}
          </button>
        ))}
      </div>

      {/* Invoice Table */}
      <Card padding="none">
        <table className="w-full">
          <thead>
            <tr className="border-b border-neutral-100">
              <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-6 py-3">Invoice</th>
              <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-6 py-3">Client</th>
              <th className="text-right text-xs font-medium text-neutral-500 uppercase tracking-wider px-6 py-3">Amount</th>
              <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-6 py-3">Due Date</th>
              <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-6 py-3">Status</th>
              <th className="text-right text-xs font-medium text-neutral-500 uppercase tracking-wider px-6 py-3">Actions</th>
            </tr>
          </thead>
          <motion.tbody variants={staggerContainer} initial="initial" animate="animate" className="divide-y divide-neutral-100">
            {filtered.map((inv) => (
              <motion.tr
                key={inv.id}
                variants={staggerItem}
                className="hover:bg-neutral-25 transition-colors cursor-pointer"
                onClick={() => navigate(`/invoicing/${inv.id}`)}
              >
                <td className="px-6 py-4">
                  <p className="text-sm font-semibold text-neutral-900">{inv.number}</p>
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm text-neutral-700">{inv.client}</p>
                </td>
                <td className="px-6 py-4 text-right">
                  <p className="text-sm font-semibold text-neutral-900">{formatCurrency(inv.amount)}</p>
                  {inv.status === 'partial' && (
                    <p className="text-xs text-neutral-500">Paid {formatCurrency(inv.paidAmount)}</p>
                  )}
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm text-neutral-600">{formatDueDate(inv.dueDate)}</p>
                </td>
                <td className="px-6 py-4">
                  <Badge variant={statusMap[inv.status].variant} dot>
                    {statusMap[inv.status].label}
                  </Badge>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={(e) => { e.stopPropagation(); navigate(`/invoicing/${inv.id}`) }} className="h-8 w-8 rounded-md flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer" title="View">
                      <Eye className="h-4 w-4" />
                    </button>
                    <button className="h-8 w-8 rounded-md flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer" title="QR Code">
                      <QrCode className="h-4 w-4" />
                    </button>
                    {inv.status === 'draft' && (
                      <button className="h-8 w-8 rounded-md flex items-center justify-center text-neutral-400 hover:text-brand-500 hover:bg-brand-50 transition-colors cursor-pointer" title="Send">
                        <Send className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </motion.tr>
            ))}
          </motion.tbody>
        </table>
      </Card>
    </div>
  )
}
