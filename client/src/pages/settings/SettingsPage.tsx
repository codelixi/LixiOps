import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  User, Building, Bell, Shield, Globe, CreditCard, Plug,
  Moon, Sun, Lock, Mail, Smartphone, Zap, FileText, Check, Copy, Eye, EyeOff, Loader2, AlertTriangle, CheckCircle2,
} from 'lucide-react'
import { Card, Button, Badge, Avatar } from '@/components/ui'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { useAuthStore } from '@/stores/useAuthStore'
import { api } from '@/lib/api'

type Tab = 'profile' | 'company' | 'payments' | 'templates' | 'notifications' | 'security' | 'billing' | 'integrations'

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'profile', label: 'Profile', icon: <User className="h-4 w-4" /> },
  { id: 'company', label: 'Company', icon: <Building className="h-4 w-4" /> },
  { id: 'payments', label: 'Payments', icon: <Zap className="h-4 w-4" /> },
  { id: 'templates', label: 'Email Templates', icon: <FileText className="h-4 w-4" /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell className="h-4 w-4" /> },
  { id: 'security', label: 'Security', icon: <Shield className="h-4 w-4" /> },
  { id: 'billing', label: 'Billing', icon: <CreditCard className="h-4 w-4" /> },
  { id: 'integrations', label: 'Integrations', icon: <Plug className="h-4 w-4" /> },
]

// ─── Email template catalog ────────────────────────────────────
// Token convention (simple substitution at send time):
//   {{client.company}} {{client.contactName}} {{invoice.number}} {{invoice.total}}
//   {{invoice.dueDate}} {{payLink}} {{companyName}}
type TemplateKey = 'invoice_sent' | 'invoice_reminder' | 'invoice_paid' | 'welcome'
const DEFAULT_TEMPLATES: Record<TemplateKey, { label: string; subject: string; body: string }> = {
  invoice_sent: {
    label: 'Invoice sent',
    subject: 'Invoice {{invoice.number}} from {{companyName}}',
    body: `Hi {{client.contactName}},

Please find invoice {{invoice.number}} for {{invoice.total}} attached. Payment is due by {{invoice.dueDate}}.

Pay securely: {{payLink}}

Thanks,
{{companyName}}`,
  },
  invoice_reminder: {
    label: 'Overdue reminder',
    subject: 'Reminder: invoice {{invoice.number}} is overdue',
    body: `Hi {{client.contactName}},

Just a gentle nudge — invoice {{invoice.number}} ({{invoice.total}}) was due {{invoice.dueDate}} and is now overdue.

If you've already paid, please disregard. Otherwise you can pay here: {{payLink}}

Thanks,
{{companyName}}`,
  },
  invoice_paid: {
    label: 'Payment received',
    subject: 'Receipt for invoice {{invoice.number}}',
    body: `Hi {{client.contactName}},

Thanks — we received your payment for invoice {{invoice.number}} ({{invoice.total}}). This email is your receipt.

Appreciate your partnership,
{{companyName}}`,
  },
  welcome: {
    label: 'New client welcome',
    subject: 'Welcome to {{companyName}}, {{client.contactName}}',
    body: `Hi {{client.contactName}},

Thrilled to have {{client.company}} on board. Over the next few days we'll kick off your project and share a shared workspace link.

Anything urgent? Reply here and I'll jump in.

{{companyName}}`,
  },
}

interface Integration {
  name: string
  description: string
  status: 'connected' | 'available' | 'coming-soon'
  icon: string
}

const integrations: Integration[] = [
  { name: 'Slack', description: 'Team notifications and alerts', status: 'connected', icon: 'S' },
  { name: 'GitHub', description: 'Code repositories and PRs', status: 'connected', icon: 'G' },
  { name: 'Stripe', description: 'Payment processing', status: 'available', icon: '$' },
  { name: 'Google Workspace', description: 'Calendar, Drive, and Gmail', status: 'available', icon: 'G' },
  { name: 'Figma', description: 'Design file sync', status: 'coming-soon', icon: 'F' },
  { name: 'Jira', description: 'Issue tracking sync', status: 'coming-soon', icon: 'J' },
]

function ToggleSwitch({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
        enabled ? 'bg-brand-500' : 'bg-neutral-200'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
          enabled ? 'translate-x-4.5' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

interface ServerMe {
  id: string
  name: string
  email: string
  role: string
  phone: string | null
  avatar: string | null
  department: { id: string; name: string } | null
}

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('profile')

  // ─── Live profile state ─────────────────────────────────
  const user = useAuthStore((s) => s.user)
  const updateAuthUser = useAuthStore((s) => s.updateUser)
  const [profileName, setProfileName] = useState(user?.name ?? '')
  const [profileEmail, setProfileEmail] = useState(user?.email ?? '')
  const [profilePhone, setProfilePhone] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileSaved, setProfileSaved] = useState(false)

  // Hydrate phone (and re-sync if user changes) from /users/me — the auth store
  // doesn't track phone, so we pull it once.
  useEffect(() => {
    if (!user) return
    setProfileName(user.name)
    setProfileEmail(user.email)
    let cancelled = false
    ;(async () => {
      try {
        const res = await api.get<{ user: ServerMe }>('/users/me')
        if (cancelled) return
        setProfilePhone(res.user.phone ?? '')
      } catch {
        // Non-fatal — leave phone blank if /me unreachable
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  const handleProfileSave = async () => {
    setProfileError(null)
    setProfileSaved(false)
    if (!profileName.trim()) {
      setProfileError('Name is required')
      return
    }
    setProfileSaving(true)
    try {
      const res = await api.patch<{ user: ServerMe }>('/users/me', {
        name: profileName.trim(),
        phone: profilePhone.trim() || null,
      })
      updateAuthUser({ name: res.user.name, avatar: res.user.avatar ?? undefined })
      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 2500)
    } catch (err: any) {
      setProfileError(err?.message ?? 'Failed to save profile')
    } finally {
      setProfileSaving(false)
    }
  }

  // ─── Change password state ─────────────────────────────
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwSaved, setPwSaved] = useState(false)
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)

  // Mirror the server-side regex from changePasswordSchema so the form
  // surfaces validation issues before round-tripping.
  function validatePassword(pw: string): string | null {
    if (pw.length < 8) return 'Must be at least 8 characters'
    if (!/[A-Z]/.test(pw)) return 'Must contain an uppercase letter'
    if (!/[a-z]/.test(pw)) return 'Must contain a lowercase letter'
    if (!/[0-9]/.test(pw)) return 'Must contain a number'
    return null
  }

  const handleChangePassword = async () => {
    setPwError(null)
    setPwSaved(false)
    if (!currentPassword) {
      setPwError('Enter your current password')
      return
    }
    const localError = validatePassword(newPassword)
    if (localError) {
      setPwError(localError)
      return
    }
    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match')
      return
    }
    if (currentPassword === newPassword) {
      setPwError('New password must be different from current')
      return
    }
    setPwSaving(true)
    try {
      await api.post<{ data: { message: string } }>('/auth/change-password', {
        currentPassword,
        newPassword,
      })
      setPwSaved(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPwSaved(false), 4000)
    } catch (err: any) {
      const msg = (err?.message ?? 'Failed to change password').replace(/^\[\d+\]\s*/, '')
      setPwError(msg)
    } finally {
      setPwSaving(false)
    }
  }

  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    slack: false,
    weeklyDigest: true,
    taskAssigned: true,
    invoicePaid: true,
    slaWarning: true,
    newLead: false,
  })
  const [twoFactor, setTwoFactor] = useState(true)
  const [darkMode, setDarkMode] = useState(false)

  // Payments (Stripe) config
  const [stripePubKey, setStripePubKey] = useState('pk_test_51Abc••••••••••••••••')
  const [stripeSecretKey, setStripeSecretKey] = useState('sk_test_51Abc••••••••••••••••')
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState('whsec_••••••••••••••••')
  const [showSecret, setShowSecret] = useState(false)
  const [stripeLive, setStripeLive] = useState(false)

  // Email templates state
  const [activeTemplate, setActiveTemplate] = useState<TemplateKey>('invoice_sent')
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES)
  const [copied, setCopied] = useState<string | null>(null)

  const updateTemplate = (key: TemplateKey, field: 'subject' | 'body', value: string) => {
    setTemplates((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }))
  }
  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token).catch(() => {})
    setCopied(token)
    setTimeout(() => setCopied(null), 1500)
  }

  const toggleNotif = (key: keyof typeof notifications) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Settings</h1>
        <p className="text-sm text-neutral-500 mt-1">Manage your account and preferences</p>
      </div>

      <div className="flex gap-8">
        {/* Sidebar Tabs */}
        <div className="w-52 flex-shrink-0 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Profile */}
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <Card>
                  <h2 className="text-sm font-semibold text-neutral-900 mb-6">Personal Information</h2>
                  <div className="flex items-center gap-4 mb-6">
                    <Avatar name={profileName || 'Guest'} size="lg" />
                    <div>
                      <Button variant="secondary" size="sm" disabled>Change Photo</Button>
                      <p className="text-2xs text-neutral-400 mt-1.5">Avatar upload coming soon.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 mb-1.5">Full Name</label>
                      <input
                        type="text"
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 mb-1.5">Email</label>
                      <input
                        type="email"
                        value={profileEmail}
                        disabled
                        className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-neutral-50 text-neutral-500"
                      />
                      <p className="text-2xs text-neutral-400 mt-1">Email is managed by your admin.</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 mb-1.5">Role</label>
                      <input
                        type="text"
                        value={user?.role ?? '—'}
                        disabled
                        className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-neutral-50 text-neutral-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 mb-1.5">Phone</label>
                      <input
                        type="tel"
                        value={profilePhone}
                        onChange={(e) => setProfilePhone(e.target.value)}
                        placeholder="+92 300 1234567"
                        className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 mb-1.5">Timezone</label>
                      <select className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500">
                        <option>Asia/Karachi (PKT, +05:00)</option>
                        <option>America/New_York (EST, -05:00)</option>
                        <option>Europe/London (GMT, +00:00)</option>
                      </select>
                      <p className="text-2xs text-neutral-400 mt-1">Local-only preference for now.</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 mb-1.5">Language</label>
                      <select className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500">
                        <option>English</option>
                        <option>Urdu</option>
                      </select>
                    </div>
                  </div>
                  {profileError && (
                    <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-danger-50 border border-danger-200 text-xs text-danger-700">
                      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                      {profileError}
                    </div>
                  )}
                  {profileSaved && (
                    <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-success-50 border border-success-200 text-xs text-success-700">
                      <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                      Profile saved
                    </div>
                  )}
                  <div className="mt-6 flex justify-end">
                    <Button
                      size="sm"
                      onClick={handleProfileSave}
                      disabled={profileSaving}
                      icon={profileSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : undefined}
                    >
                      {profileSaving ? 'Saving…' : 'Save Changes'}
                    </Button>
                  </div>
                </Card>

                {/* ─── Change Password ──────────────────────── */}
                <Card>
                  <div className="flex items-center gap-2 mb-1">
                    <Lock className="h-4 w-4 text-neutral-500" />
                    <h2 className="text-sm font-semibold text-neutral-900">Change Password</h2>
                  </div>
                  <p className="text-xs text-neutral-500 mb-5">
                    Use at least 8 characters with one uppercase, one lowercase, and one number.
                  </p>

                  <div className="space-y-4 max-w-md">
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 mb-1.5">Current password</label>
                      <div className="relative">
                        <input
                          type={showCurrent ? 'text' : 'password'}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          autoComplete="current-password"
                          className="w-full pr-10 px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrent((v) => !v)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center text-neutral-400 hover:text-neutral-700 cursor-pointer"
                          aria-label={showCurrent ? 'Hide password' : 'Show password'}
                        >
                          {showCurrent ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-neutral-500 mb-1.5">New password</label>
                      <div className="relative">
                        <input
                          type={showNew ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          autoComplete="new-password"
                          className="w-full pr-10 px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNew((v) => !v)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center text-neutral-400 hover:text-neutral-700 cursor-pointer"
                          aria-label={showNew ? 'Hide password' : 'Show password'}
                        >
                          {showNew ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                      {newPassword.length > 0 && (
                        <div className="mt-2 flex items-center gap-3 text-2xs text-neutral-500">
                          <span className={newPassword.length >= 8 ? 'text-success-600' : ''}>
                            {newPassword.length >= 8 ? '✓' : '○'} 8+ chars
                          </span>
                          <span className={/[A-Z]/.test(newPassword) ? 'text-success-600' : ''}>
                            {/[A-Z]/.test(newPassword) ? '✓' : '○'} uppercase
                          </span>
                          <span className={/[a-z]/.test(newPassword) ? 'text-success-600' : ''}>
                            {/[a-z]/.test(newPassword) ? '✓' : '○'} lowercase
                          </span>
                          <span className={/[0-9]/.test(newPassword) ? 'text-success-600' : ''}>
                            {/[0-9]/.test(newPassword) ? '✓' : '○'} number
                          </span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-neutral-500 mb-1.5">Confirm new password</label>
                      <input
                        type={showNew ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                        className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                      />
                      {confirmPassword.length > 0 && confirmPassword !== newPassword && (
                        <p className="mt-1 text-2xs text-danger-600">Passwords don't match</p>
                      )}
                    </div>
                  </div>

                  {pwError && (
                    <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-danger-50 border border-danger-200 text-xs text-danger-700 max-w-md">
                      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                      {pwError}
                    </div>
                  )}
                  {pwSaved && (
                    <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-success-50 border border-success-200 text-xs text-success-700 max-w-md">
                      <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                      Password updated. Use it on your next login.
                    </div>
                  )}

                  <div className="mt-6 flex justify-end max-w-md">
                    <Button
                      size="sm"
                      onClick={handleChangePassword}
                      disabled={pwSaving}
                      icon={pwSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : undefined}
                    >
                      {pwSaving ? 'Updating…' : 'Update password'}
                    </Button>
                  </div>
                </Card>

                <Card>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {darkMode ? <Moon className="h-4 w-4 text-neutral-600" /> : <Sun className="h-4 w-4 text-neutral-600" />}
                      <div>
                        <p className="text-sm font-medium text-neutral-900">Appearance</p>
                        <p className="text-xs text-neutral-500">Toggle dark mode</p>
                      </div>
                    </div>
                    <ToggleSwitch enabled={darkMode} onChange={() => setDarkMode(!darkMode)} />
                  </div>
                </Card>
              </div>
            )}

            {/* Company */}
            {activeTab === 'company' && (
              <Card>
                <h2 className="text-sm font-semibold text-neutral-900 mb-6">Company Details</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-1.5">Company Name</label>
                    <input type="text" defaultValue="CodeLixi" className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-1.5">Industry</label>
                    <input type="text" defaultValue="Software Development Agency" className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-1.5">Website</label>
                    <input type="url" defaultValue="https://codelixi.com" className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-1.5">Tax ID</label>
                    <input type="text" defaultValue="PK-NTN-1234567" className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-neutral-500 mb-1.5">Address</label>
                    <textarea defaultValue="Blue Area, Islamabad, Pakistan" rows={2} className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-1.5">Default Currency</label>
                    <select className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500">
                      <option>USD ($)</option>
                      <option>PKR (Rs)</option>
                      <option>EUR (&euro;)</option>
                      <option>GBP (&pound;)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-1.5">Fiscal Year Start</label>
                    <select className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500">
                      <option>January</option>
                      <option>July</option>
                    </select>
                  </div>
                </div>
                <div className="mt-6 flex justify-end">
                  <Button size="sm">Save Changes</Button>
                </div>
              </Card>
            )}

            {/* Payments (Stripe) */}
            {activeTab === 'payments' && (
              <div className="space-y-6">
                <Card>
                  <div className="flex items-start justify-between mb-5">
                    <div>
                      <h2 className="text-sm font-semibold text-neutral-900">Stripe configuration</h2>
                      <p className="text-xs text-neutral-500 mt-0.5">Powers the public pay link on every invoice.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={stripeLive ? 'success' : 'warning'} dot>
                        {stripeLive ? 'Live mode' : 'Test mode'}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 mb-1.5">Publishable key</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={stripePubKey}
                          onChange={(e) => setStripePubKey(e.target.value)}
                          className="flex-1 px-3 py-2 text-sm font-mono border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                        />
                      </div>
                      <p className="text-[11px] text-neutral-400 mt-1">Safe to ship to clients. Starts with <code>pk_</code>.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-neutral-500 mb-1.5">Secret key</label>
                      <div className="flex gap-2">
                        <input
                          type={showSecret ? 'text' : 'password'}
                          value={stripeSecretKey}
                          onChange={(e) => setStripeSecretKey(e.target.value)}
                          className="flex-1 px-3 py-2 text-sm font-mono border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSecret((v) => !v)}
                          className="px-3 py-2 rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-50 cursor-pointer"
                          title={showSecret ? 'Hide' : 'Reveal'}
                        >
                          {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <p className="text-[11px] text-neutral-400 mt-1">Server-only. Never share. Stored encrypted.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-neutral-500 mb-1.5">Webhook signing secret</label>
                      <input
                        type={showSecret ? 'text' : 'password'}
                        value={stripeWebhookSecret}
                        onChange={(e) => setStripeWebhookSecret(e.target.value)}
                        className="w-full px-3 py-2 text-sm font-mono border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                      />
                      <p className="text-[11px] text-neutral-400 mt-1">
                        Endpoint: <code>POST /api/v1/webhooks/stripe</code>. Configure in Stripe dashboard for events <code>checkout.session.completed</code> and <code>payment_intent.succeeded</code>.
                      </p>
                    </div>

                    <div className="flex items-center justify-between py-2 border-t border-neutral-100 mt-2 pt-4">
                      <div>
                        <p className="text-sm font-medium text-neutral-900">Go live</p>
                        <p className="text-xs text-neutral-500">Switch from test keys to production keys.</p>
                      </div>
                      <ToggleSwitch enabled={stripeLive} onChange={() => setStripeLive((v) => !v)} />
                    </div>
                  </div>

                  <div className="mt-6 flex items-center justify-between">
                    <a
                      href="https://dashboard.stripe.com/apikeys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-brand-500 hover:text-brand-600 font-medium"
                    >
                      Open Stripe dashboard →
                    </a>
                    <Button size="sm">Save keys</Button>
                  </div>
                </Card>

                <Card>
                  <h2 className="text-sm font-semibold text-neutral-900 mb-4">Payment options on invoices</h2>
                  <div className="space-y-3">
                    {[
                      { label: 'Card (Visa / MC / Amex)', enabled: true },
                      { label: 'Apple Pay', enabled: true },
                      { label: 'Google Pay', enabled: true },
                      { label: 'ACH bank debit (US)', enabled: false },
                      { label: 'Bank transfer instructions', enabled: true },
                    ].map((row, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-neutral-700">{row.label}</span>
                        <ToggleSwitch enabled={row.enabled} onChange={() => {}} />
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {/* Email Templates */}
            {activeTab === 'templates' && (
              <div className="space-y-6">
                <Card>
                  <h2 className="text-sm font-semibold text-neutral-900 mb-1">Email templates</h2>
                  <p className="text-xs text-neutral-500 mb-5">
                    Edit the copy CodeLixi sends on your behalf. Tokens below get replaced per send.
                  </p>

                  {/* Template selector */}
                  <div className="flex items-center gap-2 mb-5 flex-wrap">
                    {(Object.keys(templates) as TemplateKey[]).map((k) => (
                      <button
                        key={k}
                        onClick={() => setActiveTemplate(k)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                          activeTemplate === k
                            ? 'bg-neutral-900 text-white'
                            : 'text-neutral-600 hover:bg-neutral-100'
                        }`}
                      >
                        {templates[k].label}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 mb-1.5">Subject</label>
                      <input
                        type="text"
                        value={templates[activeTemplate].subject}
                        onChange={(e) => updateTemplate(activeTemplate, 'subject', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 mb-1.5">Body</label>
                      <textarea
                        value={templates[activeTemplate].body}
                        onChange={(e) => updateTemplate(activeTemplate, 'body', e.target.value)}
                        rows={12}
                        className="w-full px-3 py-2 text-sm font-mono border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-y"
                      />
                    </div>
                  </div>

                  <div className="mt-5 flex justify-end gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        setTemplates((prev) => ({
                          ...prev,
                          [activeTemplate]: DEFAULT_TEMPLATES[activeTemplate],
                        }))
                      }
                    >
                      Reset to default
                    </Button>
                    <Button size="sm">Save template</Button>
                  </div>
                </Card>

                <Card>
                  <h2 className="text-sm font-semibold text-neutral-900 mb-1">Available tokens</h2>
                  <p className="text-xs text-neutral-500 mb-4">Click a token to copy it.</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      '{{client.company}}',
                      '{{client.contactName}}',
                      '{{client.email}}',
                      '{{invoice.number}}',
                      '{{invoice.total}}',
                      '{{invoice.dueDate}}',
                      '{{payLink}}',
                      '{{companyName}}',
                    ].map((tok) => (
                      <button
                        key={tok}
                        onClick={() => copyToken(tok)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-neutral-100 hover:bg-neutral-200 transition-colors text-[11px] font-mono text-neutral-700 cursor-pointer"
                      >
                        {copied === tok ? <Check className="h-3 w-3 text-success-500" /> : <Copy className="h-3 w-3 text-neutral-400" />}
                        {tok}
                      </button>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {/* Notifications */}
            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <Card>
                  <h2 className="text-sm font-semibold text-neutral-900 mb-6">Delivery Channels</h2>
                  <div className="space-y-4">
                    {[
                      { key: 'email' as const, label: 'Email Notifications', desc: 'Receive updates via email', icon: <Mail className="h-4 w-4" /> },
                      { key: 'push' as const, label: 'Push Notifications', desc: 'Browser push notifications', icon: <Smartphone className="h-4 w-4" /> },
                      { key: 'slack' as const, label: 'Slack Notifications', desc: 'Send alerts to Slack', icon: <Globe className="h-4 w-4" /> },
                      { key: 'weeklyDigest' as const, label: 'Weekly Digest', desc: 'Summary email every Monday', icon: <Mail className="h-4 w-4" /> },
                    ].map((item) => (
                      <div key={item.key} className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-3">
                          <span className="text-neutral-400">{item.icon}</span>
                          <div>
                            <p className="text-sm font-medium text-neutral-900">{item.label}</p>
                            <p className="text-xs text-neutral-500">{item.desc}</p>
                          </div>
                        </div>
                        <ToggleSwitch enabled={notifications[item.key]} onChange={() => toggleNotif(item.key)} />
                      </div>
                    ))}
                  </div>
                </Card>

                <Card>
                  <h2 className="text-sm font-semibold text-neutral-900 mb-6">Event Triggers</h2>
                  <div className="space-y-4">
                    {[
                      { key: 'taskAssigned' as const, label: 'Task Assigned', desc: 'When a task is assigned to you' },
                      { key: 'invoicePaid' as const, label: 'Invoice Paid', desc: 'When a client pays an invoice' },
                      { key: 'slaWarning' as const, label: 'SLA Warning', desc: 'When an SLA threshold is approaching' },
                      { key: 'newLead' as const, label: 'New Lead', desc: 'When a new lead enters the pipeline' },
                    ].map((item) => (
                      <div key={item.key} className="flex items-center justify-between py-2">
                        <div>
                          <p className="text-sm font-medium text-neutral-900">{item.label}</p>
                          <p className="text-xs text-neutral-500">{item.desc}</p>
                        </div>
                        <ToggleSwitch enabled={notifications[item.key]} onChange={() => toggleNotif(item.key)} />
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {/* Security */}
            {activeTab === 'security' && (
              <div className="space-y-6">
                <Card>
                  <h2 className="text-sm font-semibold text-neutral-900 mb-6">Authentication</h2>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-3">
                        <Lock className="h-4 w-4 text-neutral-400" />
                        <div>
                          <p className="text-sm font-medium text-neutral-900">Two-Factor Authentication</p>
                          <p className="text-xs text-neutral-500">Add an extra layer of security via email OTP</p>
                        </div>
                      </div>
                      <ToggleSwitch enabled={twoFactor} onChange={() => setTwoFactor(!twoFactor)} />
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <div>
                        <p className="text-sm font-medium text-neutral-900">Change Password</p>
                        <p className="text-xs text-neutral-500">Last changed 30 days ago</p>
                      </div>
                      <Button variant="secondary" size="sm">Update</Button>
                    </div>
                  </div>
                </Card>

                <Card>
                  <h2 className="text-sm font-semibold text-neutral-900 mb-6">Active Sessions</h2>
                  <div className="space-y-3">
                    {[
                      { device: 'Chrome on Windows', location: 'Islamabad, PK', lastActive: 'Now', current: true },
                      { device: 'Safari on iPhone', location: 'Islamabad, PK', lastActive: '2 hours ago', current: false },
                      { device: 'Firefox on MacOS', location: 'Lahore, PK', lastActive: '1 day ago', current: false },
                    ].map((session, i) => (
                      <div key={i} className="flex items-center justify-between py-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-neutral-900">{session.device}</p>
                            {session.current && <Badge variant="success" dot>Current</Badge>}
                          </div>
                          <p className="text-xs text-neutral-500">{session.location} · {session.lastActive}</p>
                        </div>
                        {!session.current && (
                          <Button variant="ghost" size="sm">Revoke</Button>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>

                <Card>
                  <h2 className="text-sm font-semibold text-neutral-900 mb-6">Audit Log</h2>
                  <div className="space-y-2">
                    {[
                      { action: 'Login successful', time: 'Today, 9:15 AM', ip: '203.99.xx.xx' },
                      { action: 'Password changed', time: 'Mar 10, 2026', ip: '203.99.xx.xx' },
                      { action: '2FA enabled', time: 'Mar 8, 2026', ip: '203.99.xx.xx' },
                      { action: 'Login from new device', time: 'Mar 5, 2026', ip: '182.176.xx.xx' },
                    ].map((log, i) => (
                      <div key={i} className="flex items-center justify-between py-2 text-xs">
                        <span className="font-medium text-neutral-700">{log.action}</span>
                        <div className="flex items-center gap-3 text-neutral-400">
                          <span>{log.ip}</span>
                          <span>{log.time}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {/* Billing */}
            {activeTab === 'billing' && (
              <div className="space-y-6">
                <Card>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-neutral-900">Current Plan</h2>
                    <Badge variant="brand">Business</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-neutral-500">Monthly Cost</p>
                      <p className="text-lg font-bold text-neutral-900">$299/mo</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500">Seats Used</p>
                      <p className="text-lg font-bold text-neutral-900">10/15</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500">Next Billing</p>
                      <p className="text-lg font-bold text-neutral-900">May 1, 2026</p>
                    </div>
                  </div>
                  <Button variant="secondary" size="sm">Upgrade Plan</Button>
                </Card>

                <Card>
                  <h2 className="text-sm font-semibold text-neutral-900 mb-4">Payment Method</h2>
                  <div className="flex items-center justify-between p-3 border border-neutral-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-12 bg-neutral-100 rounded flex items-center justify-center text-xs font-bold text-neutral-600">VISA</div>
                      <div>
                        <p className="text-sm font-medium text-neutral-900">**** **** **** 4242</p>
                        <p className="text-xs text-neutral-500">Expires 12/2027</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">Change</Button>
                  </div>
                </Card>

                <Card>
                  <h2 className="text-sm font-semibold text-neutral-900 mb-4">Recent Invoices</h2>
                  <div className="space-y-2">
                    {[
                      { id: 'LX-2026-004', date: 'Apr 1, 2026', amount: '$299.00', status: 'Paid' },
                      { id: 'LX-2026-003', date: 'Mar 1, 2026', amount: '$299.00', status: 'Paid' },
                      { id: 'LX-2026-002', date: 'Feb 1, 2026', amount: '$299.00', status: 'Paid' },
                    ].map((inv) => (
                      <div key={inv.id} className="flex items-center justify-between py-2 text-sm">
                        <div className="flex items-center gap-4">
                          <span className="font-medium text-neutral-900">{inv.id}</span>
                          <span className="text-neutral-500">{inv.date}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-neutral-900">{inv.amount}</span>
                          <Badge variant="success">{inv.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {/* Integrations */}
            {activeTab === 'integrations' && (
              <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-4">
                {integrations.map((int) => (
                  <motion.div key={int.name} variants={staggerItem}>
                    <Card>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-neutral-100 flex items-center justify-center text-sm font-bold text-neutral-600">
                            {int.icon}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-neutral-900">{int.name}</p>
                            <p className="text-xs text-neutral-500">{int.description}</p>
                          </div>
                        </div>
                        {int.status === 'connected' && (
                          <div className="flex items-center gap-2">
                            <Badge variant="success" dot>Connected</Badge>
                            <Button variant="ghost" size="sm">Configure</Button>
                          </div>
                        )}
                        {int.status === 'available' && (
                          <Button variant="secondary" size="sm">Connect</Button>
                        )}
                        {int.status === 'coming-soon' && (
                          <Badge variant="default">Coming Soon</Badge>
                        )}
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  )
}
