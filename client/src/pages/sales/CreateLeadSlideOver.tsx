import { useState } from 'react'
import { AlertCircle, Building2, User, Mail, Phone, Briefcase, Target, DollarSign } from 'lucide-react'
import { SlideOver, Button } from '@/components/ui'
import { api } from '@/lib/api'

interface CreateLeadSlideOverProps {
  open: boolean
  onClose: () => void
  onCreated?: () => void
}

const verticals = ['SaaS', 'E-commerce', 'Healthcare', 'Finance', 'Education', 'Real Estate', 'Hospitality', 'Manufacturing', 'Legal', 'Other']
const sources = ['LinkedIn', 'Referral', 'Website', 'Cold Outreach', 'Event', 'Partner', 'Other']

export function CreateLeadSlideOver({ open, onClose, onCreated }: CreateLeadSlideOverProps) {
  const [form, setForm] = useState({
    company: '',
    contactName: '',
    email: '',
    phone: '',
    vertical: '',
    source: '',
    value: '',
    researchNotes: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setField = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const canSubmit = form.company.trim() && form.contactName.trim()

  const resetAndClose = () => {
    setForm({ company: '', contactName: '', email: '', phone: '', vertical: '', source: '', value: '', researchNotes: '' })
    setError(null)
    onClose()
  }

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      await api.post('/leads', {
        company: form.company.trim(),
        contactName: form.contactName.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        vertical: form.vertical || null,
        source: form.source || null,
        value: Number(form.value) || 0,
        researchNotes: form.researchNotes.trim() || null,
      })
      onCreated?.()
      resetAndClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create lead')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SlideOver open={open} onClose={onClose} title="Add New Lead" subtitle="Capture the opportunity" width="md">
      <div className="space-y-5">
        {/* Company & Contact */}
        <FieldGroup label="Company Name" icon={<Building2 className="h-3.5 w-3.5" />} required>
          <input
            type="text"
            value={form.company}
            onChange={(e) => setField('company', e.target.value)}
            placeholder="Acme Inc."
            className="w-full px-3 py-2 rounded-lg border border-neutral-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-sm outline-none transition"
          />
        </FieldGroup>

        <FieldGroup label="Contact Name" icon={<User className="h-3.5 w-3.5" />} required>
          <input
            type="text"
            value={form.contactName}
            onChange={(e) => setField('contactName', e.target.value)}
            placeholder="John Miller"
            className="w-full px-3 py-2 rounded-lg border border-neutral-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-sm outline-none transition"
          />
        </FieldGroup>

        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="Email" icon={<Mail className="h-3.5 w-3.5" />}>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setField('email', e.target.value)}
              placeholder="contact@acme.com"
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-sm outline-none transition"
            />
          </FieldGroup>
          <FieldGroup label="Phone" icon={<Phone className="h-3.5 w-3.5" />}>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setField('phone', e.target.value)}
              placeholder="+1 555 0199"
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-sm outline-none transition"
            />
          </FieldGroup>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="Vertical" icon={<Briefcase className="h-3.5 w-3.5" />}>
            <select
              value={form.vertical}
              onChange={(e) => setField('vertical', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-sm outline-none transition bg-white"
            >
              <option value="">Select</option>
              {verticals.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </FieldGroup>
          <FieldGroup label="Source" icon={<Target className="h-3.5 w-3.5" />}>
            <select
              value={form.source}
              onChange={(e) => setField('source', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-sm outline-none transition bg-white"
            >
              <option value="">Select</option>
              {sources.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FieldGroup>
        </div>

        <FieldGroup label="Estimated Value (USD)" icon={<DollarSign className="h-3.5 w-3.5" />}>
          <input
            type="number"
            value={form.value}
            onChange={(e) => setField('value', e.target.value)}
            placeholder="25000"
            min="0"
            className="w-full px-3 py-2 rounded-lg border border-neutral-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-sm outline-none transition"
          />
        </FieldGroup>

        <FieldGroup label="Research Notes">
          <textarea
            value={form.researchNotes}
            onChange={(e) => setField('researchNotes', e.target.value)}
            rows={4}
            placeholder="Background, pain points, referral context..."
            className="w-full px-3 py-2 rounded-lg border border-neutral-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-sm outline-none transition resize-none"
          />
        </FieldGroup>

        {error && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-danger-50/50 border border-danger-100">
            <AlertCircle className="h-3.5 w-3.5 text-danger-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-danger-800 leading-relaxed">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
          <Button variant="secondary" size="sm" onClick={resetAndClose} disabled={submitting}>Cancel</Button>
          <Button size="sm" onClick={handleSubmit} disabled={!canSubmit || submitting}>
            {submitting ? 'Adding...' : 'Add Lead'}
          </Button>
        </div>
      </div>
    </SlideOver>
  )
}

function FieldGroup({
  label,
  icon,
  required,
  children,
}: {
  label: string
  icon?: React.ReactNode
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700 mb-1.5">
        {icon && <span className="text-neutral-400">{icon}</span>}
        {label}
        {required && <span className="text-brand-500">*</span>}
      </label>
      {children}
    </div>
  )
}
