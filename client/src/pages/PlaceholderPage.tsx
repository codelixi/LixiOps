import { motion } from 'framer-motion'
import { Construction } from 'lucide-react'
import { useLocation } from 'react-router-dom'

export function PlaceholderPage() {
  const location = useLocation()
  const name = location.pathname.split('/').filter(Boolean).map(
    s => s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ')
  ).join(' > ')

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-32 text-center"
    >
      <div className="h-16 w-16 rounded-2xl bg-neutral-100 flex items-center justify-center mb-6">
        <Construction className="h-8 w-8 text-neutral-400" />
      </div>
      <h2 className="text-xl font-bold text-neutral-800 mb-2">{name}</h2>
      <p className="text-sm text-neutral-500 max-w-sm">
        This module is coming soon. The full implementation will include all screens and functionality defined in the SRD.
      </p>
    </motion.div>
  )
}
