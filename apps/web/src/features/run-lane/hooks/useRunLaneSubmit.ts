import { useCallback } from 'react'
import { useRunLaneActions, useRunLaneStoreApi } from '@/features/run-lane/store/runLaneStoreContext'
import { submitLaneFlow } from '@/lib/api/laneFlow'
import { cancelSession, confirmPass, getSessionDetail } from '@/lib/api/sessions'

function rid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function findPrimaryCamera(devices: any[], laneCode: string) {
  return devices.find((device) => device.laneCode === laneCode && device.deviceRole === 'CAMERA')
    ?? devices.find((device) => device.laneCode === laneCode && String(device.deviceType ?? '').toUpperCase().includes('CAMERA'))
    ?? null
}

function findLoopSensor(devices: any[], laneCode: string) {
  return devices.find((device) => device.laneCode === laneCode && device.deviceRole === 'LOOP_SENSOR')
    ?? devices.find((device) => device.laneCode === laneCode && String(device.deviceType ?? '').toUpperCase().includes('SENSOR'))
    ?? null
}

export function useRunLaneSubmit() {
  const store = useRunLaneStoreApi()
  const actions = useRunLaneActions()

  const submitCurrentLaneFlow = useCallback(async () => {
    const state = store.getState()
    const selectedLane = state.topology.lanes.find((lane) => lane.laneCode === state.topology.laneCode) ?? null
    const primaryCamera = findPrimaryCamera(state.topology.devices as any[], state.topology.laneCode)
    const loopSensor = findLoopSensor(state.topology.devices as any[], state.topology.laneCode)

    if (!state.topology.siteCode || !state.topology.laneCode || !selectedLane) {
      actions.setSubmitError('Chưa đủ lane context để submit.')
      return null
    }

    if (!primaryCamera?.deviceCode) {
      actions.setSubmitError('Không resolve được camera chính của lane hiện tại.')
      return null
    }

    if (!state.preview.imageUrl) {
      actions.setSubmitError('Chưa có imageUrl authoritative từ bước upload/preview.')
      return null
    }

    actions.setSubmitRunning('Đang submit lane flow authoritative...')

    try {
      const response = await submitLaneFlow({
        requestId: rid('run_lane_submit'),
        idempotencyKey: rid('run_lane_submit_idem'),
        siteCode: state.topology.siteCode,
        laneCode: state.topology.laneCode,
        direction: selectedLane.direction,
        deviceCode: primaryCamera.deviceCode,
        sensorDeviceCode: loopSensor?.deviceCode || undefined,
        imageUrl: state.preview.imageUrl,
        plateConfirmed: state.override.value.trim() || undefined,
        previewSnapshot: state.preview.result
          ? {
              recognizedPlate: state.preview.result.recognizedPlate,
              confidence: state.preview.result.confidence,
              previewStatus: state.preview.result.previewStatus,
              raw: state.preview.result.raw,
              winner: state.preview.result.winner,
            }
          : undefined,
        rawPayload: {
          sourceMode: state.override.sourceMode,
          fileName: state.capture.fileName,
          localPreviewUrl: state.capture.localPreviewUrl,
        },
      })

      const sessionId =
        response.resolved.session?.sessionId
          ? String(response.resolved.session.sessionId)
          : response.open.session?.sessionId
            ? String(response.open.session.sessionId)
            : ''

      let sessionDetail = null
      let message = 'Submit thành công. Result surface đã hydrate decision, session và gate event.'

      if (sessionId) {
        try {
          sessionDetail = await getSessionDetail(sessionId)
        } catch (detailError) {
          message = `Submit đã thành công nhưng chưa hydrate được session detail mới nhất: ${errorMessage(detailError)}`
        }
      }

      actions.setSubmitSuccess({
        response,
        sessionDetail,
        message,
      })

      return response
    } catch (error) {
      actions.setSubmitError(errorMessage(error))
      return null
    }
  }, [actions, store])

  const confirmCurrentSessionPass = useCallback(async () => {
    const state = store.getState()
    const sessionId = state.submit.currentSessionId
    if (!sessionId) {
      actions.setSubmitActionError('confirm_pass', 'Chưa có session hiện tại để confirm-pass.')
      return null
    }

    actions.setSubmitActionRunning('confirm_pass', 'Đang confirm-pass session hiện tại...')

    try {
      const mutated = await confirmPass(sessionId, {
        requestId: rid('run_lane_confirm_pass'),
        idempotencyKey: rid('run_lane_confirm_pass_idem'),
        occurredAt: new Date().toISOString(),
        reasonCode: 'RUN_LANE_OPERATOR_CONFIRM_PASS',
        rawPayload: {
          source: 'run-lane',
        },
      })

      let detail = null
      let message = 'Confirm-pass thành công. UI đã được refresh theo session mới nhất.'

      try {
        detail = await getSessionDetail(sessionId)
      } catch (detailError) {
        message = `Confirm-pass đã thành công nhưng chưa hydrate được session detail mới nhất: ${errorMessage(detailError)}`
      }

      actions.setSubmitActionSuccess({
        kind: 'confirm_pass',
        session: mutated.session,
        sessionDetail: detail,
        message,
      })

      return mutated
    } catch (error) {
      actions.setSubmitActionError('confirm_pass', errorMessage(error))
      return null
    }
  }, [actions, store])

  const cancelCurrentSession = useCallback(async () => {
    const state = store.getState()
    const sessionId = state.submit.currentSessionId
    if (!sessionId) {
      actions.setSubmitActionError('cancel_session', 'Chưa có session hiện tại để cancel.')
      return null
    }

    actions.setSubmitActionRunning('cancel_session', 'Đang cancel session hiện tại...')

    try {
      const mutated = await cancelSession(sessionId, {
        requestId: rid('run_lane_cancel_session'),
        idempotencyKey: rid('run_lane_cancel_session_idem'),
        occurredAt: new Date().toISOString(),
        reasonCode: 'RUN_LANE_OPERATOR_CANCELLED',
        note: 'Cancelled from run-lane result surface',
        rawPayload: {
          source: 'run-lane',
        },
      })

      let detail = null
      let message = 'Cancel session thành công. UI đã được refresh theo session mới nhất.'

      try {
        detail = await getSessionDetail(sessionId)
      } catch (detailError) {
        message = `Cancel đã thành công nhưng chưa hydrate được session detail mới nhất: ${errorMessage(detailError)}`
      }

      actions.setSubmitActionSuccess({
        kind: 'cancel_session',
        session: mutated.session,
        sessionDetail: detail,
        message,
      })

      return mutated
    } catch (error) {
      actions.setSubmitActionError('cancel_session', errorMessage(error))
      return null
    }
  }, [actions, store])

  const openSessionDetail = useCallback(async () => {
    const state = store.getState()
    const sessionId = state.submit.currentSessionId
    if (!sessionId) {
      actions.setSubmitActionError('open_session_detail', 'Chưa có session hiện tại để đọc detail.')
      return null
    }

    actions.setSubmitActionRunning('open_session_detail', 'Đang hydrate lại session detail...')

    try {
      const detail = await getSessionDetail(sessionId)
      actions.setSubmitActionSuccess({
        kind: 'open_session_detail',
        session: detail.session,
        sessionDetail: detail,
        message: 'Đã hydrate lại session detail mới nhất ngay trên result surface.',
      })
      return detail
    } catch (error) {
      actions.setSubmitActionError('open_session_detail', errorMessage(error))
      return null
    }
  }, [actions, store])

  return {
    submitCurrentLaneFlow,
    confirmCurrentSessionPass,
    cancelCurrentSession,
    openSessionDetail,
    resetSubmitResult: actions.resetSubmitResult,
  }
}
