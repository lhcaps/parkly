export type SessionNoticeTone = 'warning' | 'info' | 'error'
export type SessionNoticeCode = 'expired' | 'forbidden' | 'logout' | 'bootstrap-failure'

export type SessionNotice = {
  code: SessionNoticeCode
  tone: SessionNoticeTone
  title: string
  message: string
}

function withRequestId(message: string, requestId?: string) {
  return requestId ? `${message} Request ID: ${requestId}.` : message
}

export function createExpiredNotice(args?: { requestId?: string }) : SessionNotice {
  return {
    code: 'expired',
    tone: 'warning',
    title: 'Session expired',
    message: withRequestId('Your access token is no longer valid. Sign in again to reopen the console.', args?.requestId),
  }
}

export function createForbiddenNotice(args?: { routeLabel?: string }) : SessionNotice {
  const routeLabel = String(args?.routeLabel ?? '').trim()
  return {
    code: 'forbidden',
    tone: 'warning',
    title: 'Route not available for this role',
    message: routeLabel
      ? `The current session does not have access to ${routeLabel}. Redirect to an allowed workspace and retry from there.`
      : 'The current session is valid, but this role is not allowed to open the requested workspace.',
  }
}

export function createLogoutNotice() : SessionNotice {
  return {
    code: 'logout',
    tone: 'info',
    title: 'Signed out',
    message: 'The active console session was cleared. Sign in again to continue.',
  }
}

export function createBootstrapFailureNotice(args?: { detail?: string }) : SessionNotice {
  const detail = String(args?.detail ?? '').trim()
  return {
    code: 'bootstrap-failure',
    tone: 'error',
    title: 'Session bootstrap failed',
    message: detail
      ? `The app could not restore the authenticated session. ${detail}`
      : 'The app could not restore the authenticated session. Check API availability and retry.',
  }
}
