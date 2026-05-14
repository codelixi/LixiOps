import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { AlertTriangle } from 'lucide-react'

// ───────────────────────────────────────────
// App-root error boundary.
// Catches render-time exceptions in lazy chunks + downstream pages
// and renders a recoverable fallback instead of a white screen.
// Wraps every lazy import in App.tsx via <ErrorBoundary>.
// ───────────────────────────────────────────

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: (error: Error, reset: () => void) => ReactNode
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // In production this would ship to Sentry / Datadog / etc.
    console.error('[ErrorBoundary]', error, info)
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.state.error, this.reset)
      return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-6">
          <div className="max-w-md w-full bg-white border border-neutral-200/60 rounded-2xl shadow-sm p-6">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-danger-50 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-danger-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-base font-semibold text-neutral-900">Something went wrong</h1>
                <p className="text-sm text-neutral-500 mt-1">
                  This page crashed unexpectedly. The team has been notified.
                </p>
                <p className="text-xs text-neutral-400 mt-3 font-mono break-words">
                  {this.state.error.message}
                </p>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={this.reset}
                    className="px-3 py-1.5 text-xs font-medium rounded-md bg-neutral-900 text-white hover:bg-neutral-800 cursor-pointer"
                  >
                    Try again
                  </button>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-3 py-1.5 text-xs font-medium rounded-md border border-neutral-200 text-neutral-700 hover:bg-neutral-50 cursor-pointer"
                  >
                    Reload page
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
