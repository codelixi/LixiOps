import { create } from 'zustand'

interface AppState {
  sidebarCollapsed: boolean
  sidebarMobileOpen: boolean
  darkMode: boolean
  toggleSidebar: () => void
  setSidebarMobileOpen: (open: boolean) => void
  toggleDarkMode: () => void
}

function applyDarkMode(dark: boolean) {
  if (dark) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
  localStorage.setItem('lixiops-dark-mode', dark ? '1' : '0')
}

const savedDark = localStorage.getItem('lixiops-dark-mode') === '1'
applyDarkMode(savedDark)

export const useAppStore = create<AppState>((set) => ({
  sidebarCollapsed: false,
  sidebarMobileOpen: false,
  darkMode: savedDark,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarMobileOpen: (open) => set({ sidebarMobileOpen: open }),
  toggleDarkMode: () =>
    set((s) => {
      const next = !s.darkMode
      applyDarkMode(next)
      return { darkMode: next }
    }),
}))
