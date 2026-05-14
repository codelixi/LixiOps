// Minimal fetch wrapper. Handles:
//   • Bearer token attached from localStorage (shared with useAuthStore)
//   • 401/403 responses clear the session (prevents stuck-screen after expiry)
//   • Consistent error shape — callers can inspect err.status / err.code
//
// Response envelope: most of our routes wrap payloads in `{ data: ... }`.
// Callers can either ask for the whole envelope or for `.data` via `.get<T>`.

const BASE = (import.meta as any).env?.VITE_API_URL || '/api/v1'

export class ApiError extends Error {
  status: number
  code?: string
  payload?: unknown
  constructor(status: number, message: string, code?: string, payload?: unknown) {
    super(message)
    this.status = status
    this.code = code
    this.payload = payload
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  }
  if (token) headers.Authorization = `Bearer ${token}`

  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers, credentials: 'include' })
  } catch (e: any) {
    // Network error — backend unreachable. Let caller decide on fallback.
    throw new ApiError(0, e?.message || 'Network error', 'NETWORK')
  }

  if (!res.ok) {
    let body: any = null
    try {
      body = await res.json()
    } catch {
      // ignore
    }
    const msg = body?.error?.message || body?.message || res.statusText
    const code = body?.error?.code

    // Auto-invalidate session on unauthorized. Don't do it for /auth/*
    // since failed login also returns 401 and shouldn't nuke an existing session.
    if ((res.status === 401 || res.status === 403) && !path.startsWith('/auth/')) {
      localStorage.removeItem('token')
      localStorage.removeItem('auth_user')
      // Only redirect if we're inside the app — avoid loops on /auth pages.
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth')) {
        window.location.href = '/auth/login'
      }
    }

    throw new ApiError(res.status, `[${res.status}] ${msg}`, code, body)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
