import { Outlet, Navigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { useAppStore } from '@/stores/useAppStore'
import { useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/useAuthStore'

export function AppLayout() {
  const { sidebarCollapsed } = useAppStore()
  const location = useLocation()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  // Route guard — block the whole authenticated shell if we have no token.
  // Public routes (/pay/:token, /auth/*) are mounted outside AppLayout, so
  // this never traps the portal or login pages.
  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace state={{ from: location.pathname }} />
  }

  return (
    <div className="min-h-screen bg-neutral-25">
      <Sidebar />
      <Topbar />

      <motion.main
        initial={false}
        animate={{ marginLeft: sidebarCollapsed ? 72 : 260 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="min-h-[calc(100vh-4rem)]"
      >
        <div className="p-8 max-w-[1440px] mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.main>
    </div>
  )
}
