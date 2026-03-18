import { useCallback } from 'react'
import { useRunLaneActions, useRunLaneStoreApi } from '@/features/run-lane/store/runLaneStoreContext'
import { submitLaneFlow } from '@/lib/api/laneFlow'
import { cancelSession, confirmPass, getSessionDetail } from '@/lib/api/sessions'
import type { DeviceRow } from '@/lib/contracts/devices'

function rid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function findPrimaryCamera(devices: DeviceRow[], laneCode: string) {
  return devices.find((device) => device.laneCode === laneCode && device.deviceRole === 'CAMERA')
    ?? devices.find((device) => device.laneCode === laneCode && String(device.deviceType ?? '').toUpperCase().includes('CAMERA'))
    ?? null
}

function findLoopSensor(devices: DeviceRow[], laneCode: string) {
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
    const primaryCamera = findPrimaryCamera(state.topology.devices, state.topology.laneCode)
    const loopSensor = findLoopSensor(state.topology.devices, state.topology.laneCode)

    if (!state.topology.siteCode || !state.topology.laneCode || !selectedLane) {
      actions.setSubmitError('Insufficient lane context to submit.')
      return null
    }

    if (!primaryCamera?.deviceCode) {
      actions.setSubmitError('Could not resolve the primary camera for the current lane.')
      return null
    }

    if (!state.preview.imageUrl) {
      actions.setSubmitError('No authoritative image URL from the upload/preview step.')
      return null
    }

    actions.setSubmitRunning('Submitting lane flow…')

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
      let message = 'Submit successful. Result surface loaded decision, session, and gate event.'

      if (sessionId) {
        try {
          sessionDetail = await getSessionDetail(sessionId)
        } catch (detailError) {
          message = `Submit succeeded but could not load the latest session detail: ${errorMessage(detailError)}`
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
      actions.setSubmitActionError('confirm_pass', 'No current session to confirm-pass.')
      return null
    }

    actions.setSubmitActionRunning('confirm_pass', 'Running confirm-pass…')

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
      let message = 'Confirm-pass successful. UI refreshed with the latest session.'

      try {
        detail = await getSessionDetail(sessionId)
      } catch (detailError) {
        message = `Confirm-pass succeeded but could not load the latest session detail: ${errorMessage(detailError)}`
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
      actions.setSubmitActionError('cancel_session', 'No current session to cancel.')
      return null
    }

    actions.setSubmitActionRunning('cancel_session', 'Cancelling session…')

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
      let message = 'Session cancelled. UI refreshed with the latest session.'

      try {
        detail = await getSessionDetail(sessionId)
      } catch (detailError) {
        message = `Cancel succeeded but could not load the latest session detail: ${errorMessage(detailError)}`
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
      actions.setSubmitActionError('open_session_detail', 'No current session to read detail.')
      return null
    }

    actions.setSubmitActionRunning('open_session_detail', 'Refreshing session detail…')

    try {
      const detail = await getSessionDetail(sessionId)
      actions.setSubmitActionSuccess({
        kind: 'open_session_detail',
        session: detail.session,
        sessionDetail: detail,
        message: 'Latest session detail loaded on the result surface.',
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
