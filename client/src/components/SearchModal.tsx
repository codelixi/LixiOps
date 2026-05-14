import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Search, LayoutDashboard, Users, Briefcase, FileText, DollarSign,
  Brain, Heart, BookOpen, ShieldAlert, Megaphone, Settings,
  BarChart3, Paintbrush, Target, Clock, UserCheck, PieChart
} from 'lucide-react'

interface SearchItem {
  label: string
  path: string
  category: string
  icon: React.ReactNode
}

const searchItems: SearchItem[] = [
  { label: 'Dashboard', path: '/dashboard', category: 'Navigation', icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: 'Activity Feed', path: '/activity', category: 'Navigation', icon: <Clock className="h-4 w-4" /> },
  { label: 'Sales Pipeline', path: '/sales', category: 'Departments', icon: <BarChart3 className="h-4 w-4" /> },
  { label: 'Sprint Board', path: '/development', category: 'Departments', icon: <Briefcase className="h-4 w-4" /> },
  { label: 'Design Briefs', path: '/design', category: 'Departments', icon: <Paintbrush className="h-4 w-4" /> },
  { label: 'Operations', path: '/operations', category: 'Departments', icon: <Briefcase className="h-4 w-4" /> },
  { label: 'Management', path: '/management', category: 'Departments', icon: <BarChart3 className="h-4 w-4" /> },
  { label: 'Documents', path: '/documents', category: 'Business', icon: <FileText className="h-4 w-4" /> },
  { label: 'Invoicing', path: '/invoicing', category: 'Business', icon: <DollarSign className="h-4 w-4" /> },
  { label: 'Projects', path: '/projects', category: 'Business', icon: <Briefcase className="h-4 w-4" /> },
  { label: 'Clients', path: '/clients', category: 'Business', icon: <Users className="h-4 w-4" /> },
  { label: 'Reports', path: '/reports', category: 'Business', icon: <PieChart className="h-4 w-4" /> },
  { label: 'Team Directory', path: '/employees', category: 'People', icon: <UserCheck className="h-4 w-4" /> },
  { label: 'Departments', path: '/departments', category: 'People', icon: <Users className="h-4 w-4" /> },
  { label: 'Attendance', path: '/attendance', category: 'People', icon: <Clock className="h-4 w-4" /> },
  { label: 'OKRs', path: '/okrs', category: 'People', icon: <Target className="h-4 w-4" /> },
  { label: 'AI Engine', path: '/ai-engine', category: 'Intelligence', icon: <Brain className="h-4 w-4" /> },
  { label: 'Client Health', path: '/client-health', category: 'Intelligence', icon: <Heart className="h-4 w-4" /> },
  { label: 'Knowledge Base', path: '/knowledge-base', category: 'Intelligence', icon: <BookOpen className="h-4 w-4" /> },
  { label: 'Risk Register', path: '/risks', category: 'Intelligence', icon: <ShieldAlert className="h-4 w-4" /> },
  { label: 'Broadcasts', path: '/broadcasts', category: 'Misc', icon: <Megaphone className="h-4 w-4" /> },
  { label: 'Settings', path: '/settings', category: 'Misc', icon: <Settings className="h-4 w-4" /> },
]

export function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const filtered = query.length === 0
    ? searchItems
    : searchItems.filter((item) =>
        item.label.toLowerCase().includes(query.toLowerCase()) ||
        item.category.toLowerCase().includes(query.toLowerCase())
      )

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      navigate(filtered[selectedIndex].path)
      onClose()
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  const handleSelect = (path: string) => {
    navigate(path)
    onClose()
  }

  // Group by category
  const grouped = filtered.reduce<Record<string, SearchItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push(item)
    return acc
  }, {})

  let flatIndex = -1

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-[15%] left-1/2 -translate-x-1/2 z-50 w-full max-w-lg"
          >
            <div className="bg-white rounded-xl shadow-2xl border border-neutral-200/60 overflow-hidden">
              {/* Search Input */}
              <div className="flex items-center gap-3 px-4 border-b border-neutral-100">
                <Search className="h-4 w-4 text-neutral-400 flex-shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search pages, modules..."
                  className="flex-1 h-12 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none bg-transparent"
                />
                <kbd className="hidden sm:inline-flex items-center rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-2xs text-neutral-400 font-mono">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div className="max-h-80 overflow-y-auto py-2">
                {filtered.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <p className="text-sm text-neutral-500">No results found</p>
                  </div>
                ) : (
                  Object.entries(grouped).map(([category, items]) => (
                    <div key={category}>
                      <p className="px-4 py-1.5 text-[10px] font-medium text-neutral-400 uppercase tracking-wider">{category}</p>
                      {items.map((item) => {
                        flatIndex++
                        const idx = flatIndex
                        return (
                          <button
                            key={item.path}
                            onClick={() => handleSelect(item.path)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors cursor-pointer ${
                              idx === selectedIndex
                                ? 'bg-brand-50 text-brand-600'
                                : 'text-neutral-700 hover:bg-neutral-50'
                            }`}
                          >
                            <span className={idx === selectedIndex ? 'text-brand-500' : 'text-neutral-400'}>{item.icon}</span>
                            <span className="font-medium">{item.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-neutral-100 px-4 py-2 flex items-center gap-4 text-[10px] text-neutral-400">
                <span><kbd className="font-mono">↑↓</kbd> Navigate</span>
                <span><kbd className="font-mono">↵</kbd> Open</span>
                <span><kbd className="font-mono">ESC</kbd> Close</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
