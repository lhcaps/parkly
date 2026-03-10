import type {
  RunLaneCaptureSlice,
  RunLaneMetaSlice,
  RunLaneOverrideSlice,
  RunLaneStoreActions,
  RunLaneStoreApi,
  RunLaneStoreState,
  RunLaneSubmitResult,
  RunLaneSubmitSlice,
  RunLaneTopologySlice,
  RunLanePreviewSlice,
} from '@/features/run-lane/store/runLaneTypes'
import type { AlprRecognizeRes } from '@/lib/contracts/alpr'
import type { LaneFlowSubmitRes } from '@/lib/contracts/laneFlow'
import type { SessionDetail, SessionSummary } from '@/lib/contracts/sessions'

const DEFAULT_PREVIEW_MESSAGE = 'Chưa có backend preview. Chọn ảnh để upload và chạy preview song song với override thủ công.'
const DEFAULT_SUBMIT_MESSAGE = 'Chưa submit lane flow. Sau khi submit, panel phải sẽ hiển thị decision, session, gate event và các post-submit actions.'

function createScopeId() {
  return `run_lane_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`
}

function resolveSuggestedPlate(result: AlprRecognizeRes | null) {
  if (!result) return ''
  return result.plateDisplay || result.plateRaw || result.recognizedPlate || ''
}

function normalizePlateInput(value: string) {
  return value.toUpperCase()
}

function createInitialMetaSlice(): RunLaneMetaSlice {
  return {
    scopeId: createScopeId(),
    createdAt: new Date().toISOString(),
  }
}

function createInitialTopologySlice(): RunLaneTopologySlice {
  return {
    loadStatus: 'idle',
    error: null,
    sites: [],
    gates: [],
    lanes: [],
    devices: [],
    siteCode: '',
    gateCode: '',
    laneCode: '',
  }
}

function createInitialCaptureSlice(): RunLaneCaptureSlice {
  return {
    status: 'idle',
    fileName: '',
    fileSizeBytes: null,
    localPreviewUrl: '',
    updatedAt: null,
  }
}

function createInitialPreviewSlice(): RunLanePreviewSlice {
  return {
    stage: 'idle',
    error: null,
    message: DEFAULT_PREVIEW_MESSAGE,
    imageUrl: '',
    suggestedPlate: '',
    result: null,
    requestedAt: null,
    completedAt: null,
  }
}

function createInitialOverrideSlice(): RunLaneOverrideSlice {
  return {
    value: '',
    touched: false,
    sourceMode: 'empty',
    updatedAt: null,
    lastAppliedPreviewPlate: '',
  }
}

function createInitialSubmitSlice(message?: string): RunLaneSubmitSlice {
  return {
    stage: 'idle',
    actionStage: 'idle',
    message: message || DEFAULT_SUBMIT_MESSAGE,
    error: null,
    result: null,
    currentSessionId: '',
    lastSubmittedAt: null,
    lastActionAt: null,
    lastAction: null,
  }
}

function resolveNextGateCode(topology: RunLaneTopologySlice) {
  if (!topology.gateCode) return topology.gates[0]?.gateCode ?? ''
  return topology.gates.some((gate) => gate.gateCode === topology.gateCode)
    ? topology.gateCode
    : topology.gates[0]?.gateCode ?? ''
}

function resolveNextLaneCode(topology: RunLaneTopologySlice, gateCode: string) {
  const gateLanes = topology.lanes.filter((lane) => lane.gateCode === gateCode)
  if (!gateCode || gateLanes.length === 0) return ''

  return gateLanes.some((lane) => lane.laneCode === topology.laneCode)
    ? topology.laneCode
    : gateLanes[0]?.laneCode ?? ''
}

function resolveSessionSummary(response: LaneFlowSubmitRes, sessionDetail?: SessionDetail | null): SessionSummary | null {
  return sessionDetail?.session ?? response.resolved.session ?? response.open.session ?? null
}

function buildSubmitResult(response: LaneFlowSubmitRes, sessionDetail?: SessionDetail | null): RunLaneSubmitResult {
  return {
    response,
    session: resolveSessionSummary(response, sessionDetail),
    decision: response.resolved.decision ?? null,
    event: response.event ?? null,
    sessionDetail: sessionDetail ?? null,
  }
}

function resolveSessionId(result: RunLaneSubmitResult | null) {
  return result?.session?.sessionId ? String(result.session.sessionId) : ''
}

export function createRunLaneStore(initialState?: Partial<RunLaneStoreState>): RunLaneStoreApi {
  const listeners = new Set<() => void>()

  let state = {} as RunLaneStoreState

  const setState: RunLaneStoreApi['setState'] = (updater) => {
    const partial = typeof updater === 'function' ? updater(state) : updater
    if (!partial || Object.keys(partial).length === 0) return

    state = {
      ...state,
      ...partial,
    }

    listeners.forEach((listener) => listener())
  }

  const actions: RunLaneStoreActions = {
    setTopologyLoading() {
      setState((current) => ({
        topology: {
          ...current.topology,
          loadStatus: 'loading',
          error: null,
        },
      }))
    },

    setTopologyError(message) {
      setState((current) => ({
        topology: {
          ...current.topology,
          loadStatus: 'error',
          error: message,
        },
      }))
    },

    hydrateSites(sites) {
      setState((current) => {
        const nextSiteCode = current.topology.siteCode && sites.some((site) => site.siteCode === current.topology.siteCode)
          ? current.topology.siteCode
          : sites[0]?.siteCode ?? ''

        return {
          topology: {
            ...current.topology,
            sites,
            siteCode: nextSiteCode,
            loadStatus: sites.length > 0 ? current.topology.loadStatus : 'idle',
            error: null,
          },
        }
      })
    },

    hydrateSiteTopology(payload) {
      setState((current) => {
        const nextTopology: RunLaneTopologySlice = {
          ...current.topology,
          loadStatus: 'ready',
          error: null,
          siteCode: payload.siteCode,
          gates: payload.gates,
          lanes: payload.lanes,
          devices: payload.devices,
        }

        const nextGateCode = resolveNextGateCode(nextTopology)
        const nextLaneCode = resolveNextLaneCode(nextTopology, nextGateCode)

        return {
          topology: {
            ...nextTopology,
            gateCode: nextGateCode,
            laneCode: nextLaneCode,
          },
        }
      })
    },

    setSiteCode(siteCode) {
      setState((current) => ({
        topology: {
          ...current.topology,
          siteCode,
          gateCode: '',
          laneCode: '',
          gates: [],
          lanes: [],
          devices: [],
          loadStatus: siteCode ? 'loading' : 'idle',
          error: null,
        },
        submit: createInitialSubmitSlice('Đã đổi site. Result cũ đã được reset để tránh nhầm lane context.'),
      }))
    },

    setGateCode(gateCode) {
      setState((current) => ({
        topology: {
          ...current.topology,
          gateCode,
          laneCode: resolveNextLaneCode(current.topology, gateCode),
        },
        submit: createInitialSubmitSlice('Đã đổi gate. Result cũ đã được reset để tránh submit nhầm ngữ cảnh.'),
      }))
    },

    setLaneCode(laneCode) {
      setState((current) => ({
        topology: {
          ...current.topology,
          laneCode,
        },
        submit: createInitialSubmitSlice('Đã đổi lane. Result cũ đã được reset để tránh operator đọc nhầm session/event của lane trước.'),
      }))
    },

    setCaptureDraft(draft) {
      setState({
        capture: {
          status: 'selected',
          fileName: draft.fileName,
          fileSizeBytes: draft.fileSizeBytes,
          localPreviewUrl: draft.localPreviewUrl,
          updatedAt: new Date().toISOString(),
        },
        preview: {
          ...createInitialPreviewSlice(),
          message: draft.fileName
            ? `Đã mount local preview cho ${draft.fileName}. Đang chờ backend preview.`
            : DEFAULT_PREVIEW_MESSAGE,
        },
        override: createInitialOverrideSlice(),
        submit: createInitialSubmitSlice('Ảnh mới đã được chọn. Result lượt trước đã được reset.'),
      })
    },

    clearCaptureDraft() {
      setState({
        capture: createInitialCaptureSlice(),
        preview: createInitialPreviewSlice(),
        override: createInitialOverrideSlice(),
        submit: createInitialSubmitSlice('Capture đã được clear. Result cũ cũng được xóa để tránh stale state.'),
      })
    },

    setPreviewUploading(message) {
      setState((current) => ({
        preview: {
          ...current.preview,
          stage: 'uploading',
          error: null,
          message: message || 'Đang upload ảnh lên backend preview...',
          requestedAt: new Date().toISOString(),
        },
      }))
    },

    setPreviewLoading(payload) {
      setState((current) => ({
        preview: {
          ...current.preview,
          stage: 'loading',
          error: null,
          imageUrl: payload?.imageUrl ?? current.preview.imageUrl,
          message: payload?.message || 'Ảnh đã upload. Đang chạy backend preview...',
          requestedAt: current.preview.requestedAt ?? new Date().toISOString(),
        },
      }))
    },

    setPreviewSuccess(payload) {
      setState((current) => {
        const suggestedPlate = resolveSuggestedPlate(payload.result)
        const shouldAutoFill = !current.override.touched

        return {
          preview: {
            stage: 'ready',
            error: null,
            message: payload.result.needsConfirm
              ? `Preview ${payload.result.previewStatus} · cần operator xác nhận trước khi submit.`
              : `Preview ${payload.result.previewStatus} · có thể dùng backend preview ngay nếu operator không override.`,
            imageUrl: payload.imageUrl ?? current.preview.imageUrl,
            suggestedPlate,
            result: payload.result,
            requestedAt: current.preview.requestedAt,
            completedAt: new Date().toISOString(),
          },
          override: shouldAutoFill
            ? {
                value: suggestedPlate,
                touched: false,
                sourceMode: suggestedPlate ? 'backend_preview' : 'empty',
                updatedAt: new Date().toISOString(),
                lastAppliedPreviewPlate: suggestedPlate,
              }
            : {
                ...current.override,
                lastAppliedPreviewPlate: suggestedPlate,
              },
        }
      })
    },

    setPreviewError(message) {
      setState((current) => ({
        preview: {
          ...current.preview,
          stage: 'error',
          error: message,
          message,
          completedAt: new Date().toISOString(),
        },
      }))
    },

    clearPreview() {
      setState((current) => ({
        preview: createInitialPreviewSlice(),
        override: current.override.sourceMode === 'backend_preview' ? createInitialOverrideSlice() : current.override,
      }))
    },

    setOverrideValue(value) {
      const nextValue = normalizePlateInput(value)

      setState((current) => ({
        override: {
          value: nextValue,
          touched: true,
          sourceMode: nextValue.trim() ? 'manual_override' : 'empty',
          updatedAt: new Date().toISOString(),
          lastAppliedPreviewPlate: current.preview.suggestedPlate,
        },
      }))
    },

    applyBackendPreviewToOverride() {
      setState((current) => ({
        override: {
          value: current.preview.suggestedPlate,
          touched: false,
          sourceMode: current.preview.suggestedPlate ? 'backend_preview' : 'empty',
          updatedAt: new Date().toISOString(),
          lastAppliedPreviewPlate: current.preview.suggestedPlate,
        },
      }))
    },

    applyCandidateToOverride(plate) {
      const nextValue = normalizePlateInput(plate)

      setState({
        override: {
          value: nextValue,
          touched: true,
          sourceMode: nextValue.trim() ? 'manual_override' : 'empty',
          updatedAt: new Date().toISOString(),
          lastAppliedPreviewPlate: nextValue,
        },
      })
    },

    clearOverride() {
      setState((current) => ({
        override: {
          value: current.preview.suggestedPlate,
          touched: false,
          sourceMode: current.preview.suggestedPlate ? 'backend_preview' : 'empty',
          updatedAt: new Date().toISOString(),
          lastAppliedPreviewPlate: current.preview.suggestedPlate,
        },
      }))
    },

    setSubmitRunning(message) {
      setState((current) => ({
        submit: {
          ...current.submit,
          stage: 'submitting',
          actionStage: 'idle',
          message: message || 'Đang submit lane flow authoritative...',
          error: null,
          lastAction: null,
        },
      }))
    },

    setSubmitSuccess(payload) {
      setState(() => {
        const result = buildSubmitResult(payload.response, payload.sessionDetail)
        return {
          submit: {
            stage: 'success',
            actionStage: 'idle',
            message: payload.message || 'Submit thành công. Decision, session và gate event đã được hydrate lên result surface.',
            error: null,
            result,
            currentSessionId: resolveSessionId(result),
            lastSubmittedAt: new Date().toISOString(),
            lastActionAt: null,
            lastAction: null,
          },
        }
      })
    },

    setSubmitError(message) {
      setState((current) => ({
        submit: {
          ...current.submit,
          stage: 'error',
          actionStage: 'idle',
          message,
          error: message,
        },
      }))
    },

    setSubmitActionRunning(kind, message) {
      setState((current) => ({
        submit: {
          ...current.submit,
          actionStage: 'running',
          message: message || current.submit.message,
          error: null,
          lastAction: kind,
        },
      }))
    },

    setSubmitActionSuccess(payload) {
      setState((current) => {
        const currentResult = current.submit.result
        const nextSession = payload.sessionDetail?.session ?? payload.session ?? currentResult?.session ?? null
        const nextResult = currentResult
          ? {
              ...currentResult,
              session: nextSession,
              sessionDetail: payload.sessionDetail ?? currentResult.sessionDetail,
            }
          : null

        return {
          submit: {
            ...current.submit,
            stage: nextResult ? 'success' : current.submit.stage,
            actionStage: 'success',
            message: payload.message || current.submit.message,
            error: null,
            result: nextResult,
            currentSessionId: nextSession?.sessionId ? String(nextSession.sessionId) : current.submit.currentSessionId,
            lastActionAt: new Date().toISOString(),
            lastAction: payload.kind,
          },
        }
      })
    },

    setSubmitActionError(kind, message) {
      setState((current) => ({
        submit: {
          ...current.submit,
          actionStage: 'error',
          message,
          error: message,
          lastActionAt: new Date().toISOString(),
          lastAction: kind,
        },
      }))
    },

    resetSubmitResult(message) {
      setState({
        submit: createInitialSubmitSlice(message),
      })
    },

    resetRunLane() {
      setState((current) => ({
        meta: createInitialMetaSlice(),
        topology: {
          ...createInitialTopologySlice(),
          sites: current.topology.sites,
          siteCode: current.topology.sites[0]?.siteCode ?? '',
        },
        capture: createInitialCaptureSlice(),
        preview: createInitialPreviewSlice(),
        override: createInitialOverrideSlice(),
        submit: createInitialSubmitSlice(),
      }))
    },
  }

  state = {
    meta: createInitialMetaSlice(),
    topology: createInitialTopologySlice(),
    capture: createInitialCaptureSlice(),
    preview: createInitialPreviewSlice(),
    override: createInitialOverrideSlice(),
    submit: createInitialSubmitSlice(),
    actions,
    ...initialState,
  }

  return {
    getState: () => state,
    setState,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
