import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, Lock, ArrowRight } from 'lucide-react'
import { Button, Input } from '@/components/ui'
import { api } from '@/lib/api'

// Stash email between Login → OTP so the verify step knows which
// account we're OTP'ing. sessionStorage (not local) so closing the
// tab forces a fresh login.
const PENDING_EMAIL_KEY = 'pending_login_email'

export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await api.post<{ data: { message: string } }>('/auth/login', {
        email: email.trim().toLowerCase(),
        password,
      })
      sessionStorage.setItem(PENDING_EMAIL_KEY, email.trim().toLowerCase())
      navigate('/auth/verify')
    } catch (err: any) {
      const msg = err?.message || 'Sign in failed'
      // Strip the [401] prefix our api wrapper adds
      setError(msg.replace(/^\[\d+\]\s*/, ''))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Mobile logo */}
      <div className="flex items-center gap-3 mb-10 lg:hidden">
        <div className="h-10 w-10 rounded-xl bg-brand-500 flex items-center justify-center">
          <span className="text-white font-bold text-lg">L</span>
        </div>
        <div>
          <h1 className="text-xl font-bold text-neutral-900">LixiOps</h1>
          <p className="text-xs text-neutral-500">Business Operating System</p>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-2xl font-bold text-neutral-900 tracking-tight mb-2">
          Welcome back
        </h2>
        <p className="text-sm text-neutral-500">
          Sign in to your account to continue
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          id="email"
          label="Email address"
          type="email"
          placeholder="you@codelixi.com"
          icon={<Mail />}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error}
          autoComplete="email"
          required
        />

        <Input
          id="password"
          label="Password"
          type="password"
          placeholder="Enter your password"
          icon={<Lock />}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />

        <div className="flex items-center justify-end">
          <button type="button" className="text-xs text-brand-500 hover:text-brand-600 font-medium transition-colors cursor-pointer">
            Forgot password?
          </button>
        </div>

        <Button
          type="submit"
          className="w-full"
          size="lg"
          loading={loading}
          iconRight={!loading ? <ArrowRight /> : undefined}
        >
          Continue
        </Button>
      </form>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mt-8 text-center text-xs text-neutral-400"
      >
        Accounts are created by your administrator.
        <br />No self-registration available.
      </motion.p>
    </div>
  )
}
