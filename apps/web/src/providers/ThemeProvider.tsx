import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export const THEME_STORAGE_KEY = 'parkly-theme'

export type ThemeChoice = 'light' | 'dark' | 'system'

type ThemeContextValue = {
  theme: ThemeChoice
  setTheme: (next: ThemeChoice) => void
  /** Resolved after applying system preference */
  resolved: 'light' | 'dark'
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readStoredTheme(): ThemeChoice {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY)?.trim().toLowerCase()
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw
  } catch {
    /* ignore */
  }
  return 'dark'
}

function systemPrefersDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? true
}

function resolveTheme(choice: ThemeChoice): 'light' | 'dark' {
  if (choice === 'system') return systemPrefersDark() ? 'dark' : 'light'
  return choice
}

function applyDomTheme(choice: ThemeChoice) {
  const dark = resolveTheme(choice) === 'dark'
  document.documentElement.classList.toggle('dark', dark)
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeChoice>(() =>
    typeof window === 'undefined' ? 'dark' : readStoredTheme(),
  )

  const resolved = useMemo(() => resolveTheme(theme), [theme])

  const setTheme = useCallback((next: ThemeChoice) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
    setThemeState(next)
    applyDomTheme(next)
  }, [])

  useEffect(() => {
    applyDomTheme(theme)
  }, [theme])

  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyDomTheme('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, resolved }),
    [theme, setTheme, resolved],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
