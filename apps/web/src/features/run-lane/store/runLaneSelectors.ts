import type { AlprPreviewCandidate } from '@/lib/contracts/alpr'
import type { RunLaneEffectivePlateSource, RunLaneStoreState } from '@/features/run-lane/store/runLaneTypes'
import type { SessionAllowedAction } from '@/lib/contracts/sessions'

const EMPTY_PREVIEW_CANDIDATES: AlprPreviewCandidate[] = []
const EMPTY_ALLOWED_ACTIONS: SessionAllowedAction[] = []

export const selectRunLaneMeta = (state: RunLaneStoreState) => state.meta
export const selectRunLaneScopeId = (state: RunLaneStoreState) => state.meta.scopeId

export const selectRunLaneTopology = (state: RunLaneStoreState) => state.topology
export const selectRunLaneTopologyStatus = (state: RunLaneStoreState) => state.topology.loadStatus
export const selectRunLaneSiteCode = (state: RunLaneStoreState) => state.topology.siteCode
export const selectRunLaneGateCode = (state: RunLaneStoreState) => state.topology.gateCode
export const selectRunLaneLaneCode = (state: RunLaneStoreState) => state.topology.laneCode

export const selectRunLaneCapture = (state: RunLaneStoreState) => state.capture
export const selectRunLanePreview = (state: RunLaneStoreState) => state.preview
export const selectRunLaneOverride = (state: RunLaneStoreState) => state.override
export const selectRunLaneSubmit = (state: RunLaneStoreState) => state.submit
export const selectRunLaneSubmitResult = (state: RunLaneStoreState) => state.submit.result
export const selectRunLaneSubmitSession = (state: RunLaneStoreState) => state.submit.result?.session ?? null
export const selectRunLaneSubmitDecision = (state: RunLaneStoreState) => state.submit.result?.decision ?? null
export const selectRunLaneSubmitEvent = (state: RunLaneStoreState) => state.submit.result?.event ?? null
export const selectRunLaneSubmitSessionDetail = (state: RunLaneStoreState) => state.submit.result?.sessionDetail ?? null
export const selectRunLaneCurrentSessionId = (state: RunLaneStoreState) => state.submit.currentSessionId
export const selectRunLaneSessionAllowedActions = (state: RunLaneStoreState) => state.submit.result?.session?.allowedActions ?? EMPTY_ALLOWED_ACTIONS

export const selectRunLaneBackendSuggestedPlate = (state: RunLaneStoreState) => state.preview.suggestedPlate
export const selectRunLanePreviewResult = (state: RunLaneStoreState) => state.preview.result
export const selectRunLanePreviewCandidates = (state: RunLaneStoreState) => state.preview.result?.candidates ?? EMPTY_PREVIEW_CANDIDATES

export const selectRunLaneEffectivePlateForSubmit = (state: RunLaneStoreState) => {
  const value = state.override.value.trim()
  if (!value) return ''
  return value
}

export const selectRunLaneEffectivePlateSource = (state: RunLaneStoreState): RunLaneEffectivePlateSource => {
  const value = state.override.value.trim()
  if (!value) return 'none'
  if (state.override.sourceMode === 'manual_override') return 'manual_override'
  if (state.override.sourceMode === 'backend_preview') return 'backend_preview'
  return 'none'
}

export const selectRunLaneCanSubmit = (state: RunLaneStoreState) => {
  return Boolean(
    state.topology.siteCode &&
    state.topology.laneCode &&
    state.capture.localPreviewUrl &&
    state.preview.imageUrl
  )
}

export const selectRunLaneCanResubmit = (state: RunLaneStoreState) => {
  // Resubmit is allowed only after a successful submission with an active session.
  // Guard against cases where result is set but no session was created.
  const result = state.submit.result
  const currentSessionId = state.submit.currentSessionId
  if (!result || !currentSessionId) return false
  const stage = state.submit.stage
  const actionStage = state.submit.actionStage
  const isIdle = stage === 'idle' || stage === 'success'
  const notInFlight = actionStage === 'idle' || actionStage === 'success'
  return isIdle && notInFlight
}

export const selectRunLaneDevicePressureLabel = (state: RunLaneStoreState) => {
  const sessionDetail = state.submit.result?.sessionDetail?.session as {
    onlineDeviceCount?: number
    degradedDeviceCount?: number
    offlineDeviceCount?: number
  } | null
  if (!sessionDetail) return null
  const { onlineDeviceCount = 0, degradedDeviceCount = 0, offlineDeviceCount = 0 } = sessionDetail
  return `${onlineDeviceCount} online · ${degradedDeviceCount} degraded · ${offlineDeviceCount} offline`
}
