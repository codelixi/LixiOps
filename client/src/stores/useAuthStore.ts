import { create } from 'zustand'

// ───────────────────────────────────────────
// Auth store — JWT lives in localStorage so
// api.ts can attach it to every request. Hydrates
// on boot from localStorage so refresh doesn't drop
// the session (user payload re-derived from token).
// ───────────────────────────────────────────

export interface User {
  id: string
  email: string
  name: string
  role: 'ceo' | 'manager' | 'employee' | 'client' | string
  avatar?: string
  department?: string
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (user: User, token: string) => void
  logout: () => void
  hydrate: () => void
  updateUser: (patch: Partial<User>) => void
}

const USER_KEY = 'auth_user'
const TOKEN_KEY = 'token'

function loadInitial(): Pick<AuthState, 'user' | 'token' | 'isAuthenticated'> {
  try {
    const token = localStorage.getItem(TOKEN_KEY)
    const raw = localStorage.getItem(USER_KEY)
    if (token && raw) {
      const user = JSON.parse(raw) as User
      return { user, token, isAuthenticated: true }
    }
  } catch {
    // ignore parse errors — treat as logged out
  }
  return { user: null, token: null, isAuthenticated: false }
}

export const useAuthStore = create<AuthState>((set) => ({
  ...loadInitial(),
  login: (user, token) => {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    set({ user, token, isAuthenticated: true })
  },
  logout: () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    set({ user: null, token: null, isAuthenticated: false })
  },
  hydrate: () => set(loadInitial()),
  updateUser: (patch) =>
    set((state) => {
      if (!state.user) return state
      const next = { ...state.user, ...patch } as User
      localStorage.setItem(USER_KEY, JSON.stringify(next))
      return { ...state, user: next }
    }),
}))
