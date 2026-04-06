const SESSION_SCOPED_STORAGE_KEYS = [
  'parkly.mobilePairs.v1',
] as const

const SESSION_SCOPED_STORAGE_PREFIXES = [
  'parkly.mobileCaptureJournal.v1:',
] as const

const authAbortControllers = new Set<AbortController>()
const sessionResetHandlers = new Set<(reason: string) => void>()

function isSessionScopedStorageKey(key: string) {
  if (SESSION_SCOPED_STORAGE_KEYS.includes(key as (typeof SESSION_SCOPED_STORAGE_KEYS)[number])) return true
  return SESSION_SCOPED_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))
}

export function clearSessionScopedBrowserState() {
  if (typeof window === 'undefined') return

  const keysToDelete: string[] = []
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)
    if (!key || !isSessionScopedStorageKey(key)) continue
    keysToDelete.push(key)
  }

  for (const key of keysToDelete) {
    window.localStorage.removeItem(key)
  }
}

export function registerAuthAbortController(controller: AbortController) {
  authAbortControllers.add(controller)
  return () => {
    authAbortControllers.delete(controller)
  }
}

export function registerSessionResetHandler(handler: (reason: string) => void) {
  sessionResetHandlers.add(handler)
  return () => {
    sessionResetHandlers.delete(handler)
  }
}

export function resetSessionRuntime(reason: string) {
  for (const controller of Array.from(authAbortControllers)) {
    try {
      controller.abort(reason)
    } catch {
      // ignore abort failures during forced session reset
    }
  }
  authAbortControllers.clear()

  clearSessionScopedBrowserState()

  for (const handler of Array.from(sessionResetHandlers)) {
    try {
      handler(reason)
    } catch {
      // session cleanup handlers must not block auth invalidation
    }
  }
}

export function createAuthAwareAbortSignal(signal?: AbortSignal | null) {
  const controller = new AbortController()
  const unregister = registerAuthAbortController(controller)

  function cleanup() {
    unregister()
    if (signal) {
      signal.removeEventListener('abort', onAbort)
    }
  }

  function onAbort() {
    try {
      controller.abort(signal?.reason)
    } finally {
      cleanup()
    }
  }

  if (signal?.aborted) {
    controller.abort(signal.reason)
    cleanup()
  } else if (signal) {
    signal.addEventListener('abort', onAbort, { once: true })
  }

  return {
    signal: controller.signal,
    cleanup,
    controller,
  }
}
