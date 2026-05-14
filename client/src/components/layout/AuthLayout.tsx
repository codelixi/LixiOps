import { Outlet } from 'react-router-dom'
import { motion } from 'framer-motion'

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-white flex">
      {/* Left: Branding panel — black with orange accent */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[560px] bg-neutral-900 flex-col justify-between p-12 relative overflow-hidden">
        {/* Subtle glow */}
        <div className="absolute inset-0">
          <div className="absolute top-20 -left-20 h-64 w-64 rounded-full bg-brand-500/10 blur-3xl" />
          <div className="absolute bottom-32 right-10 h-48 w-48 rounded-full bg-brand-500/5 blur-2xl" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="h-10 w-10 rounded-xl bg-brand-500 flex items-center justify-center">
              <span className="text-white font-bold text-lg">L</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">LixiOps</h1>
              <p className="text-xs text-neutral-500">Business Operating System</p>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <h2 className="text-3xl font-bold text-white leading-tight mb-4">
              Run your entire<br />agency from one place.
            </h2>
            <p className="text-sm text-neutral-400 leading-relaxed max-w-sm">
              Projects, invoicing, team management, client portal, and AI-powered intelligence — all unified.
            </p>
          </motion.div>
        </div>

        <div className="relative z-10">
          <p className="text-xs text-neutral-600">
            CodeLixi &middot; Round Rock, Texas
          </p>
        </div>
      </div>

      {/* Right: Auth form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[400px]"
        >
          <Outlet />
        </motion.div>
      </div>
    </div>
  )
}
