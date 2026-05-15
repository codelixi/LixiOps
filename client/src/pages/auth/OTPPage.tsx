import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui'
import { useAuthStore } from '@/stores/useAuthStore'
import { api } from '@/lib/api'

const PENDING_EMAIL_KEY = 'pending_login_email'

interface VerifyResponse {
  data: {
    accessToken: string
    refreshToken: string
    user: { id: string; email: string; name: string; role: string }
  }
}

export function OTPPage() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(120)
  const [error, setError] = useState('')
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const pendingEmail = typeof window !== 'undefined' ? sessionStorage.getItem(PENDING_EMAIL_KEY) : null
  // Ref (not state) so it updates synchronously without triggering a re-render.
  // Without this guard, the verify flow has a race: we clear pendingEmail in
  // sessionStorage as part of handleSubmit, then call navigate('/dashboard').
  // React re-renders the OTPPage one more time before unmount; pendingEmail is
  // re-read from sessionStorage (now null), the guard useEffect below fires
  // navigate('/auth/login') AFTER our /dashboard navigation, and the user
  // lands back at login. Setting this ref before clearing skips that effect.
  const submittedRef = useRef(false)

  useEffect(() => {
    // Skip the guard if we just verified successfully — the missing
    // pendingEmail is intentional and we're already navigating to /dashboard.
    if (submittedRef.current) return
    // Otherwise: if someone lands here without a pending email, bounce back.
    if (!pendingEmail) {
      navigate('/auth/login', { replace: true })
      return
    }
    inputRefs.current[0]?.focus()
  }, [pendingEmail, navigate])

  useEffect(() => {
    if (countdown <= 0) return
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000)
    return () => clearInterval(timer)
  }, [countdown])

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    const newOtp = [...otp]
    newOtp[index] = value.slice(-1)
    setOtp(newOtp)
    setError('')

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const data = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    const newOtp = [...otp]
    data.split('').forEach((char, i) => { newOtp[i] = char })
    setOtp(newOtp)
    inputRefs.current[Math.min(data.length, 5)]?.focus()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = otp.join('')
    if (code.length !== 6) {
      setError('Please enter all 6 digits')
      return
    }

    if (!pendingEmail) {
      setError('Session expired. Please sign in again.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const res = await api.post<VerifyResponse>('/auth/verify-otp', {
        email: pendingEmail,
        otp: code,
      })
      // Mark success BEFORE clearing sessionStorage so the bounce-back
      // useEffect skips during the re-render that follows.
      submittedRef.current = true
      sessionStorage.removeItem(PENDING_EMAIL_KEY)
      login(
        {
          id: res.data.user.id,
          email: res.data.user.email,
          name: res.data.user.name,
          role: res.data.user.role.toLowerCase() as any,
        },
        res.data.accessToken,
      )
      // replace:true drops this page from history so back-button doesn't
      // land the user on a now-meaningless verify screen.
      navigate('/dashboard', { replace: true })
    } catch (err: any) {
      setError((err?.message || 'Verification failed').replace(/^\[\d+\]\s*/, ''))
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (!pendingEmail) return
    // Re-trigger login which issues a fresh OTP. We don't have the password
    // cached (never store it), so redirect back to login.
    navigate('/auth/login', { replace: true })
  }

  const minutes = Math.floor(countdown / 60)
  const seconds = countdown % 60

  return (
    <div>
      <button
        onClick={() => navigate('/auth/login')}
        className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-700 mb-8 transition-colors cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to login
      </button>

      <div className="mb-8">
        <div className="h-12 w-12 rounded-xl bg-brand-50 flex items-center justify-center mb-5">
          <ShieldCheck className="h-6 w-6 text-brand-500" />
        </div>
        <h2 className="text-2xl font-bold text-neutral-900 tracking-tight mb-2">
          Verify your identity
        </h2>
        <p className="text-sm text-neutral-500">
          We sent a 6-digit code to your email.
          <br />Enter it below to continue.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex gap-3 justify-center" onPaste={handlePaste}>
          {otp.map((digit, index) => (
            <motion.input
              key={index}
              ref={(el) => { inputRefs.current[index] = el }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`
                w-12 h-14 text-center text-xl font-semibold rounded-xl border-2
                transition-all duration-150
                focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10
                ${error ? 'border-danger-300 bg-danger-50' : digit ? 'border-brand-300 bg-brand-50/30' : 'border-neutral-200 bg-white'}
              `}
            />
          ))}
        </div>

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs text-danger-600 text-center"
          >
            {error}
          </motion.p>
        )}

        <Button type="submit" className="w-full" size="lg" loading={loading}>
          Verify & Sign In
        </Button>

        <div className="text-center">
          {countdown > 0 ? (
            <p className="text-xs text-neutral-400">
              Resend code in{' '}
              <span className="font-mono text-neutral-600">
                {minutes}:{seconds.toString().padStart(2, '0')}
              </span>
            </p>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              className="text-xs text-brand-500 hover:text-brand-600 font-medium transition-colors cursor-pointer"
            >
              Resend verification code
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
