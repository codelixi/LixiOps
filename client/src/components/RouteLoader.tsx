import { Loader2 } from 'lucide-react'

// ───────────────────────────────────────────
// Suspense fallback used by every lazy route in App.tsx.
// Intentionally minimal — a centered spinner over the content area
// so it doesn't jump the layout when the chunk arrives.
// ───────────────────────────────────────────

export function RouteLoader() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center text-neutral-400">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  )
}
