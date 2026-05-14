import { useState } from 'react'
import { Building2, User, Mail, Phone, Globe, MapPin } from 'lucide-react'
import { Button, SlideOver } from '@/components/ui'

interface CreateClientSlideOverProps {
  open: boolean
  onClose: () => void
}

const industries = [
  'Restaurant & Hospitality',
  'Healthcare',
  'Fashion & Retail',
  'SaaS & Technology',
  'Health & Fitness',
  'Supply Chain',
  'Agriculture',
  'Creative Agency',
  'Finance & Banking',
  'Education',
  'Real Estate',
  'E-Commerce',
  'Other',
]

const statuses = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'active', label: 'Active' },
]

const inputClass = 'w-full h-10 px-3.5 text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 hover:border-neutral-300 transition-all placeholder:text-neutral-400'
const labelClass = 'block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1.5'
const iconInputWrap = 'relative'
const iconClass = 'absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400'

export function CreateClientSlideOver({ open, onClose }: CreateClientSlideOverProps) {
  const [form, setForm] = useState({
    name: '',
    industry: '',
    status: 'prospect',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    website: '',
    address: '',
    notes: '',
  })

  const update = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }))

  const handleSave = () => {
    // TODO: wire to backend
    onClose()
    setForm({ name: '', industry: '', status: 'prospect', contactName: '', contactEmail: '', contactPhone: '', website: '', address: '', notes: '' })
  }

  return (
    <SlideOver open={open} onClose={onClose} title="Add Client" subtitle="Create a new client record" width="md">
      <div className="space-y-6">
        {/* Company Info */}
        <div>
          <h3 className="text-sm font-semibold text-neutral-900 mb-3">Company Information</h3>
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Company Name *</label>
              <div className={iconInputWrap}>
                <Building2 className={iconClass} />
                <input
                  type="text"
                  placeholder="e.g. Acme Corporation"
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                  className={`${inputClass} pl-10`}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Industry</label>
                <select
                  value={form.industry}
                  onChange={(e) => update('industry', e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select industry...</option>
                  {industries.map((i) => (
                    <option key={i} value={i}>{i}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Status</label>
                <select
                  value={form.status}
                  onChange={(e) => update('status', e.target.value)}
                  className={inputClass}
                >
                  {statuses.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={labelClass}>Website</label>
              <div className={iconInputWrap}>
                <Globe className={iconClass} />
                <input
                  type="url"
                  placeholder="https://example.com"
                  value={form.website}
                  onChange={(e) => update('website', e.target.value)}
                  className={`${inputClass} pl-10`}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Address</label>
              <div className={iconInputWrap}>
                <MapPin className={iconClass} />
                <input
                  type="text"
                  placeholder="123 Main St, City, State, ZIP"
                  value={form.address}
                  onChange={(e) => update('address', e.target.value)}
                  className={`${inputClass} pl-10`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Primary Contact */}
        <div className="border-t border-neutral-100 pt-6">
          <h3 className="text-sm font-semibold text-neutral-900 mb-3">Primary Contact</h3>
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Full Name *</label>
              <div className={iconInputWrap}>
                <User className={iconClass} />
                <input
                  type="text"
                  placeholder="e.g. John Smith"
                  value={form.contactName}
                  onChange={(e) => update('contactName', e.target.value)}
                  className={`${inputClass} pl-10`}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Email *</label>
                <div className={iconInputWrap}>
                  <Mail className={iconClass} />
                  <input
                    type="email"
                    placeholder="john@company.com"
                    value={form.contactEmail}
                    onChange={(e) => update('contactEmail', e.target.value)}
                    className={`${inputClass} pl-10`}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Phone</label>
                <div className={iconInputWrap}>
                  <Phone className={iconClass} />
                  <input
                    type="tel"
                    placeholder="+1 555-0100"
                    value={form.contactPhone}
                    onChange={(e) => update('contactPhone', e.target.value)}
                    className={`${inputClass} pl-10`}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="border-t border-neutral-100 pt-6">
          <h3 className="text-sm font-semibold text-neutral-900 mb-3">Notes</h3>
          <textarea
            placeholder="Any additional notes about this client..."
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
            rows={3}
            className={`${inputClass} h-auto py-2.5 resize-none`}
          />
        </div>

        {/* Actions */}
        <div className="border-t border-neutral-100 pt-6 flex items-center justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!form.name.trim() || !form.contactName.trim() || !form.contactEmail.trim()}
          >
            Add Client
          </Button>
        </div>
      </div>
    </SlideOver>
  )
}
