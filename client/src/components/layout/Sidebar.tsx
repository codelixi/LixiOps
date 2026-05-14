import { NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/cn'
import { useAppStore } from '@/stores/useAppStore'
import { useAuthStore } from '@/stores/useAuthStore'
import {
  LayoutDashboard,
  TrendingUp,
  Code2,
  Palette,
  Settings2,
  Users,
  Building2,
  FileText,
  Receipt,
  FolderKanban,
  BarChart3,
  Shield,
  Brain,
  UserCircle,
  ChevronLeft,
  Clock,
  Globe,
  BookOpen,
  Target,
  HeartPulse,
  PieChart,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'

interface NavItem {
  label: string
  path: string
  icon: LucideIcon
  ceoOnly?: boolean
}

interface NavGroup {
  title: string
  items: NavItem[]
}

const navigation: NavGroup[] = [
  {
    title: 'Command Centre',
    items: [
      { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
      { label: 'Activity Feed', path: '/activity', icon: BarChart3 },
      { label: 'Broadcasts', path: '/broadcasts', icon: Globe },
    ],
  },
  {
    title: 'Departments',
    items: [
      { label: 'Sales', path: '/sales', icon: TrendingUp },
      { label: 'Development', path: '/development', icon: Code2 },
      { label: 'Design', path: '/design', icon: Palette },
      { label: 'Operations', path: '/operations', icon: Settings2 },
      { label: 'Management', path: '/management', icon: Building2 },
    ],
  },
  {
    title: 'Business',
    items: [
      { label: 'Documents', path: '/documents', icon: FileText },
      { label: 'Invoicing', path: '/invoicing', icon: Receipt },
      { label: 'Projects', path: '/projects', icon: FolderKanban },
      { label: 'Clients', path: '/clients', icon: Users },
      { label: 'Reports', path: '/reports', icon: PieChart },
    ],
  },
  {
    title: 'People',
    items: [
      { label: 'Employees', path: '/employees', icon: UserCircle },
      { label: 'Departments', path: '/departments', icon: Building2 },
      { label: 'Attendance', path: '/attendance', icon: Clock },
      { label: 'OKRs', path: '/okrs', icon: Target },
    ],
  },
  {
    title: 'Intelligence',
    items: [
      { label: 'AI Engine', path: '/ai-engine', icon: Brain },
      { label: 'Client Health', path: '/client-health', icon: HeartPulse },
      { label: 'Knowledge Base', path: '/knowledge-base', icon: BookOpen },
      { label: 'Risk Register', path: '/risks', icon: Shield },
      { label: 'Audit Log', path: '/audit', icon: ShieldCheck, ceoOnly: true },
    ],
  },
]

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useAppStore()
  const location = useLocation()
  const role = useAuthStore((s) => s.user?.role)
  const isCEO = role === 'CEO'

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarCollapsed ? 72 : 260 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="fixed left-0 top-0 bottom-0 z-40 flex flex-col bg-white border-r border-neutral-200/60"
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-5 border-b border-neutral-100 shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="h-8 w-8 rounded-lg bg-brand-500 flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm">L</span>
          </div>
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden whitespace-nowrap"
              >
                <h1 className="text-base font-bold text-neutral-900 tracking-tight">LixiOps</h1>
                <p className="text-2xs text-neutral-400 -mt-0.5">Business OS</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {navigation.map((group) => (
          <div key={group.title}>
            <AnimatePresence>
              {!sidebarCollapsed && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-2xs font-semibold text-neutral-400 uppercase tracking-widest px-2 mb-2"
                >
                  {group.title}
                </motion.p>
              )}
            </AnimatePresence>
            <div className="space-y-0.5">
              {group.items.filter((item) => !item.ceoOnly || isCEO).map((item) => {
                const isActive = location.pathname.startsWith(item.path)
                return (
                  <NavLink key={item.path} to={item.path}>
                    <motion.div
                      whileTap={{ scale: 0.98 }}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium',
                        'transition-all duration-150',
                        sidebarCollapsed && 'justify-center px-0',
                        isActive
                          ? 'bg-brand-50 text-brand-500'
                          : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900',
                      )}
                    >
                      <item.icon className={cn('h-[18px] w-[18px] shrink-0', isActive && 'text-brand-500')} />
                      <AnimatePresence>
                        {!sidebarCollapsed && (
                          <motion.span
                            initial={{ opacity: 0, width: 0 }}
                            animate={{ opacity: 1, width: 'auto' }}
                            exit={{ opacity: 0, width: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden whitespace-nowrap"
                          >
                            {item.label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  </NavLink>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="shrink-0 border-t border-neutral-100 p-3">
        <button
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center gap-2 rounded-lg px-2.5 py-2 text-sm text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700 transition-colors cursor-pointer"
        >
          <motion.div
            animate={{ rotate: sidebarCollapsed ? 180 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <ChevronLeft className="h-4 w-4" />
          </motion.div>
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-xs"
              >
                Collapse
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.aside>
  )
}
