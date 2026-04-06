import type { DeviceRow } from '@/lib/contracts/devices'
import type { AlprRecognizeRes } from '@/lib/contracts/alpr'
import type { LaneFlowSubmitRes } from '@/lib/contracts/laneFlow'
import type { ResolveSessionRes, SessionDetail, SessionSummary } from '@/lib/contracts/sessions'
import type { GateRow, LaneRow, SiteRow } from '@/lib/contracts/topology'

export type RunLaneTopologyLoadStatus = 'idle' | 'loading' | 'ready' | 'error'
export type RunLaneCaptureStatus = 'idle' | 'selected'
export type RunLanePreviewStage = 'idle' | 'uploading' | 'loading' | 'ready' | 'error'
export type RunLaneSubmitStage = 'idle' | 'submitting' | 'success' | 'error'
export type RunLaneSubmitActionStage = 'idle' | 'running' | 'success' | 'error'
export type RunLaneSubmitActionKind = 'confirm_pass' | 'cancel_session' | 'open_session_detail'
export type RunLaneOverrideSourceMode = 'empty' | 'backend_preview' | 'manual_override'
export type RunLaneEffectivePlateSource = 'none' | 'backend_preview' | 'manual_override'

export type RunLaneMetaSlice = {
  scopeId: string
  createdAt: string
}

export type RunLaneTopologySlice = {
  loadStatus: RunLaneTopologyLoadStatus
  error: string | null
  sites: SiteRow[]
  gates: GateRow[]
  lanes: LaneRow[]
  devices: DeviceRow[]
  siteCode: string
  gateCode: string
  laneCode: string
}

export type RunLaneCaptureSlice = {
  status: RunLaneCaptureStatus
  fileName: string
  fileSizeBytes: number | null
  localPreviewUrl: string
  updatedAt: string | null
}

export type RunLanePreviewSlice = {
  stage: RunLanePreviewStage
  error: string | null
  message: string
  imageUrl: string
  suggestedPlate: string
  result: AlprRecognizeRes | null
  requestedAt: string | null
  completedAt: string | null
}

export type RunLaneOverrideSlice = {
  value: string
  touched: boolean
  sourceMode: RunLaneOverrideSourceMode
  updatedAt: string | null
  lastAppliedPreviewPlate: string
}

export type RunLaneSubmitResult = {
  response: LaneFlowSubmitRes
  session: SessionSummary | null
  decision: ResolveSessionRes['decision']
  event: LaneFlowSubmitRes['event'] | null
  sessionDetail: SessionDetail | null
}

export type RunLaneSubmitSlice = {
  stage: RunLaneSubmitStage
  actionStage: RunLaneSubmitActionStage
  message: string
  error: string | null
  result: RunLaneSubmitResult | null
  currentSessionId: string
  lastSubmittedAt: string | null
  lastActionAt: string | null
  lastAction: RunLaneSubmitActionKind | null
}

export type RunLaneCaptureDraft = {
  fileName: string
  fileSizeBytes: number | null
  localPreviewUrl: string
}

export type RunLaneStoreActions = {
  setTopologyLoading: () => void
  setTopologyError: (message: string) => void
  hydrateSites: (sites: SiteRow[], preferredSiteCode?: string) => void
  hydrateSiteTopology: (
    payload: {
      siteCode: string
      gates: GateRow[]
      lanes: LaneRow[]
      devices: DeviceRow[]
    },
    preserveSelection?: { gateCode?: string; laneCode?: string },
  ) => void
  setSiteCode: (siteCode: string) => void
  setGateCode: (gateCode: string) => void
  setLaneCode: (laneCode: string) => void
  setCaptureDraft: (draft: RunLaneCaptureDraft) => void
  clearCaptureDraft: () => void
  setPreviewUploading: (message?: string) => void
  setPreviewLoading: (payload?: { imageUrl?: string; message?: string }) => void
  setPreviewSuccess: (payload: { imageUrl?: string; result: AlprRecognizeRes }) => void
  setPreviewError: (message: string) => void
  clearPreview: () => void
  setOverrideValue: (value: string) => void
  applyBackendPreviewToOverride: () => void
  applyCandidateToOverride: (plate: string) => void
  clearOverride: () => void
  setSubmitRunning: (message?: string) => void
  setSubmitSuccess: (payload: { response: LaneFlowSubmitRes; sessionDetail?: SessionDetail | null; message?: string }) => void
  setSubmitError: (message: string) => void
  setSubmitActionRunning: (kind: RunLaneSubmitActionKind, message?: string) => void
  setSubmitActionSuccess: (payload: {
    kind: RunLaneSubmitActionKind
    session?: SessionSummary | null
    sessionDetail?: SessionDetail | null
    message?: string
  }) => void
  setSubmitActionError: (kind: RunLaneSubmitActionKind, message: string) => void
  resetSubmitResult: (message?: string) => void
  resetRunLane: () => void
}

export type RunLaneStoreState = {
  meta: RunLaneMetaSlice
  topology: RunLaneTopologySlice
  capture: RunLaneCaptureSlice
  preview: RunLanePreviewSlice
  override: RunLaneOverrideSlice
  submit: RunLaneSubmitSlice
  actions: RunLaneStoreActions
}

export type RunLaneStoreApi = {
  getState: () => RunLaneStoreState
  setState: (updater: Partial<RunLaneStoreState> | ((state: RunLaneStoreState) => Partial<RunLaneStoreState>)) => void
  subscribe: (listener: () => void) => () => void
}
