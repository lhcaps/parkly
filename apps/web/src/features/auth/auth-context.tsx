import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { classifyApiError, formatInlineApiError } from '@/lib/http/errors'
import {
  clearAuthTokens,
  getAuthChangedEventName,
  getAuthExpiredEventName,
  getRefreshToken,
  getToken,
  storeAuthTokens,
} from '@/lib/http/client'
import { getAuthMe, loginWithPassword, logoutAuthSession } from '@/lib/api/auth'
import type { AuthPrincipal, AuthRole } from '@/lib/contracts/auth'

export type AuthStatus = 'booting' | 'authenticated' | 'expired' | 'forbidden' | 'anonymous'

type SessionNotice = {
  tone: 'warning' | 'info' | 'error'
  title: string
  message: string
}

type AuthContextValue = {
  status: AuthStatus
  principal: AuthPrincipal | null
  isAuthenticated: boolean
  isBusy: boolean
  isLoggingOut: boolean
  bootstrapError: string
  sessionNotice: SessionNotice | null
  login: (input: { username: string; password: string; role?: AuthRole | null }) => Promise<AuthPrincipal>
  logout: (reason?: string) => Promise<void>
  reloadSession: () => Promise<AuthPrincipal | null>
  clearSessionNotice: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function createExpiredNotice(): SessionNotice {
  return {
    tone: 'warning',
    title: 'Phiên đăng nhập đã hết hạn',
    message: 'Vui lòng đăng nhập lại để tiếp tục sử dụng hệ thống.',
  }
}

function createForbiddenNotice(): SessionNotice {
  return {
    tone: 'warning',
    title: 'Không đủ quyền truy cập',
    message: 'Phiên đăng nhập còn hiệu lực nhưng vai trò hiện tại không được phép. Hệ thống sẽ chuyển sang trang phù hợp.',
  }
}

function createLogoutNotice(): SessionNotice {
  return {
    tone: 'info',
    title: 'Đã đăng xuất',
    message: 'Toàn bộ phiên, token và kết nối realtime đã được dọn sạch.',
  }
}

function hasStoredTokens() {
  return Boolean(getToken() || getRefreshToken())
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('booting')
  const [principal, setPrincipal] = useState<AuthPrincipal | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [bootstrapError, setBootstrapError] = useState('')
  const [sessionNotice, setSessionNotice] = useState<SessionNotice | null>(null)

  const applyAnonymous = useCallback((notice?: SessionNotice | null) => {
    setPrincipal(null)
    setStatus('anonymous')
    setBootstrapError('')
    setSessionNotice(notice ?? null)
  }, [])

  const applyExpired = useCallback((notice?: SessionNotice | null) => {
    setPrincipal(null)
    setStatus('expired')
    setBootstrapError('')
    setSessionNotice(notice ?? createExpiredNotice())
  }, [])

  const applyForbidden = useCallback((notice?: SessionNotice | null) => {
    setPrincipal(null)
    setStatus('forbidden')
    setBootstrapError('')
    setSessionNotice(notice ?? createForbiddenNotice())
  }, [])

  const applyAuthenticated = useCallback((nextPrincipal: AuthPrincipal) => {
    setPrincipal(nextPrincipal)
    setStatus('authenticated')
    setBootstrapError('')
    setSessionNotice(null)
  }, [])

  const reloadSession = useCallback(async () => {
    if (!hasStoredTokens()) {
      applyAnonymous(null)
      return null
    }

    setStatus('booting')
    setBootstrapError('')

    try {
      const nextPrincipal = await getAuthMe()
      applyAuthenticated(nextPrincipal)
      return nextPrincipal
    } catch (error) {
      const kind = classifyApiError(error)
      if (kind === 'auth') {
        clearAuthTokens('bootstrap-auth-failed')
        applyExpired(createExpiredNotice())
        return null
      }

      if (kind === 'forbidden') {
        applyForbidden(createForbiddenNotice())
        return null
      }

      setPrincipal(null)
      setStatus('anonymous')
      setBootstrapError(formatInlineApiError(error, 'Could not initialise session'))
      return null
    }
  }, [applyAnonymous, applyAuthenticated, applyExpired, applyForbidden])

  useEffect(() => {
    void reloadSession()
  }, [reloadSession])

  useEffect(() => {
    function onExpired() {
      applyExpired(createExpiredNotice())
    }

    function onChanged(event: Event) {
      const detail = event instanceof CustomEvent ? (event.detail as { status?: string; reason?: string } | undefined) : undefined
      const reason = String(detail?.reason ?? '')

      if (detail?.status === 'updated') {
        if (reason === 'manual-token' || reason === 'manual-refresh') {
          void reloadSession()
        }
        return
      }

      if (detail?.status === 'cleared') {
        if (reason === 'user-logout') {
          applyAnonymous(createLogoutNotice())
          return
        }

        if (reason === 'refresh-failed' || reason === 'http-401' || reason === 'bootstrap-auth-failed' || reason === 'sse-401') {
          applyExpired(createExpiredNotice())
          return
        }

        applyAnonymous(null)
      }
    }

    function onStorage(event: StorageEvent) {
      if (event.storageArea !== window.localStorage) return
      if (event.key && event.key !== 'parkly_token' && event.key !== 'parkly_refresh_token') return
      void reloadSession()
    }

    window.addEventListener(getAuthExpiredEventName(), onExpired)
    window.addEventListener(getAuthChangedEventName(), onChanged)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(getAuthExpiredEventName(), onExpired)
      window.removeEventListener(getAuthChangedEventName(), onChanged)
      window.removeEventListener('storage', onStorage)
    }
  }, [applyAnonymous, applyExpired, reloadSession])

  const login = useCallback(async (input: { username: string; password: string; role?: AuthRole | null }) => {
    setIsBusy(true)
    setBootstrapError('')
    try {
      const result = await loginWithPassword(input)
      storeAuthTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken }, 'login-success')
      applyAuthenticated(result.principal)
      return result.principal
    } finally {
      setIsBusy(false)
    }
  }, [applyAuthenticated])

  const logout = useCallback(async (reason = 'user-logout') => {
    setIsBusy(true)
    setIsLoggingOut(true)
    try {
      const refreshToken = getRefreshToken()
      if (getToken() || refreshToken) {
        await logoutAuthSession(refreshToken || undefined).catch(() => undefined)
      }
    } finally {
      clearAuthTokens(reason)
      setIsBusy(false)
      setIsLoggingOut(false)
    }
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    status,
    principal,
    isAuthenticated: status === 'authenticated' && principal != null,
    isBusy,
    isLoggingOut,
    bootstrapError,
    sessionNotice,
    login,
    logout,
    reloadSession,
    clearSessionNotice: () => setSessionNotice(null),
  }), [bootstrapError, isBusy, isLoggingOut, login, logout, principal, reloadSession, sessionNotice, status])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error('useAuth must be used inside <AuthProvider>')
  }
  return value
}
