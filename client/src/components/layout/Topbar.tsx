import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Search, Settings, Moon, Sun, LogOut, User as UserIcon } from 'lucide-react'
import { Avatar } from '@/components/ui'
import { useAppStore } from '@/stores/useAppStore'
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { SearchModal } from '@/components/SearchModal'
import { NotificationPanel } from '@/components/NotificationPanel'
import { useNotifications } from '@/hooks/useNotifications'
import { useAuthStore } from '@/stores/useAuthStore'

const ROLE_LABELS: Record<string, string> = {
  ceo: 'CEO',
  manager: 'Manager',
  employee: 'Employee',
  client: 'Client',
}

export function Topbar() {
  const { sidebarCollapsed, darkMode, toggleDarkMode } = useAppStore()
  const [searchOpen, setSearchOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { unreadCount } = useNotifications()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  const displayName = user?.name ?? 'Guest'
  const displayRole = user?.role ? (ROLE_LABELS[user.role] ?? user.role) : '—'

  // Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Close user menu on outside click
  useEffect(() => {
    if (!userOpen) return
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserOpen(false)
      }
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [userOpen])

  const handleLogout = () => {
    setUserOpen(false)
    logout()
    navigate('/auth/login')
  }

  return (
    <>
      <motion.header
        initial={false}
        animate={{ marginLeft: sidebarCollapsed ? 72 : 260 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="sticky top-0 z-30 h-16 bg-white/80 backdrop-blur-xl border-b border-neutral-200/60"
      >
        <div className="flex items-center justify-between h-full px-6">
          {/* Search */}
          <button
            onClick={() => setSearchOpen(true)}
            className="relative w-80 h-9 rounded-lg bg-neutral-50 border border-neutral-200/60 pl-10 pr-4 text-sm text-neutral-400 text-left cursor-pointer hover:bg-neutral-100 transition-colors"
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            Search anything...
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-0.5 rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-2xs text-neutral-400 font-mono">
              Ctrl K
            </kbd>
          </button>

          {/* Right side */}
          <div className="flex items-center gap-1">
            {/* Dark mode toggle */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={toggleDarkMode}
              className="h-9 w-9 rounded-lg flex items-center justify-center text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700 transition-colors cursor-pointer"
            >
              {darkMode ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
            </motion.button>

            {/* Notifications */}
            <div className="relative">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative h-9 w-9 rounded-lg flex items-center justify-center text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700 transition-colors cursor-pointer"
              >
                <Bell className="h-[18px] w-[18px]" />
                {unreadCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-danger-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </motion.button>
              <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
            </div>

            {/* Settings */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate('/settings')}
              className="h-9 w-9 rounded-lg flex items-center justify-center text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700 transition-colors cursor-pointer"
            >
              <Settings className="h-[18px] w-[18px]" />
            </motion.button>

            {/* Divider */}
            <div className="h-6 w-px bg-neutral-200 mx-2" />

            {/* User */}
            <div ref={userMenuRef} className="relative">
              <button
                onClick={() => setUserOpen((v) => !v)}
                className="flex items-center gap-3 cursor-pointer hover:bg-neutral-50 rounded-lg px-2 py-1.5 transition-colors"
              >
                <Avatar name={displayName} size="sm" status="online" />
                <div className="hidden md:block text-left">
                  <p className="text-sm font-medium text-neutral-800 leading-tight">{displayName}</p>
                  <p className="text-2xs text-neutral-500">{displayRole}</p>
                </div>
              </button>

              <AnimatePresence>
                {userOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-60 bg-white border border-neutral-200/60 rounded-xl shadow-lg overflow-hidden z-50"
                  >
                    <div className="px-4 py-3 border-b border-neutral-100">
                      <p className="text-sm font-semibold text-neutral-900 leading-tight">{displayName}</p>
                      <p className="text-xs text-neutral-500 mt-0.5 truncate">{user?.email ?? 'Not signed in'}</p>
                      <p className="text-2xs uppercase tracking-wider text-brand-500 font-semibold mt-1">{displayRole}</p>
                    </div>
                    <button
                      onClick={() => {
                        setUserOpen(false)
                        navigate('/settings')
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors text-left"
                    >
                      <UserIcon className="h-4 w-4 text-neutral-400" />
                      Profile & Settings
                    </button>
                    <div className="h-px bg-neutral-100" />
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-danger-600 hover:bg-danger-50 transition-colors text-left"
                    >
                      <LogOut className="h-4 w-4" />
                      Log out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Global Search Modal */}
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}
