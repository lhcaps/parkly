import { createContext, useContext, useRef, useSyncExternalStore, type PropsWithChildren } from 'react'
import { createRunLaneStore } from '@/features/run-lane/store/createRunLaneStore'
import type { RunLaneStoreApi, RunLaneStoreState } from '@/features/run-lane/store/runLaneTypes'

const RunLaneStoreContext = createContext<RunLaneStoreApi | null>(null)

type SelectorCacheEntry<Selected> = {
  state: RunLaneStoreState
  selected: Selected
}

const EMPTY_SERVER_SNAPSHOT = 'RunLaneStoreProvider server snapshot is not available in client-only mode.'

export function RunLaneStoreProvider({ children }: PropsWithChildren) {
  const storeRef = useRef<RunLaneStoreApi | null>(null)

  if (!storeRef.current) {
    storeRef.current = createRunLaneStore()
  }

  return <RunLaneStoreContext.Provider value={storeRef.current}>{children}</RunLaneStoreContext.Provider>
}

export function useRunLaneStoreApi() {
  const store = useContext(RunLaneStoreContext)
  if (!store) {
    throw new Error('RunLaneStoreProvider chưa được mount.')
  }
  return store
}

export function useRunLaneStore<Selected>(selector: (state: RunLaneStoreState) => Selected) {
  const store = useRunLaneStoreApi()
  const cacheRef = useRef<SelectorCacheEntry<Selected> | null>(null)

  const getSnapshot = () => {
    const currentState = store.getState()
    const cached = cacheRef.current

    if (cached && cached.state === currentState) {
      return cached.selected
    }

    const nextSelected = selector(currentState)

    if (cached && Object.is(cached.selected, nextSelected)) {
      const reused = {
        state: currentState,
        selected: cached.selected,
      }
      cacheRef.current = reused
      return reused.selected
    }

    const nextCache = {
      state: currentState,
      selected: nextSelected,
    }

    cacheRef.current = nextCache
    return nextCache.selected
  }

  return useSyncExternalStore(
    store.subscribe,
    getSnapshot,
    () => {
      throw new Error(EMPTY_SERVER_SNAPSHOT)
    },
  )
}

export function useRunLaneActions() {
  return useRunLaneStoreApi().getState().actions
}
