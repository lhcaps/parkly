import { useCallback, useEffect, useRef, useState } from 'react'
import { useRunLaneActions } from '@/features/run-lane/store/runLaneStoreContext'
import { alprPreview, uploadImage } from '@/lib/api/alpr'

const MAX_FILE_SIZE_MB = 10
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
const MIN_UPLOAD_INTERVAL_MS = 1500
const UPLOAD_TIMEOUT_MS = 45_000
const ALPR_PREVIEW_TIMEOUT_MS = 90_000

function classifyError(error: unknown, controller: AbortController): {
  kind: 'aborted' | 'timeout' | 'rate_limit' | 'network' | 'server' | 'unknown'
  message: string
} {
  const errorMessage = error instanceof Error ? error.message : String(error)
  const errorCode = error instanceof Error && 'code' in error ? String(error.code) : ''

  if (controller.signal.aborted || errorMessage.includes('aborted') || errorCode === 'REQUEST_ABORTED') {
    return { kind: 'aborted', message: errorMessage }
  }
  if (errorMessage.includes('timeout') || errorMessage.includes('Timeout') || errorCode === 'TIMEOUT') {
    return { kind: 'timeout', message: errorMessage }
  }
  if (
    errorMessage.includes('429') ||
    errorMessage.includes('Too Many Requests') ||
    errorCode === 'RATE_LIMITED'
  ) {
    return { kind: 'rate_limit', message: 'Quá nhiều yêu cầu. Vui lòng đợi vài giây rồi thử lại.' }
  }
  if (
    errorMessage.includes('Network') ||
    errorMessage.includes('ECONNREFUSED') ||
    errorMessage.includes('Failed to fetch') ||
    errorMessage.includes('fetch') ||
    errorCode === 'NETWORK_ERROR'
  ) {
    return {
      kind: 'network',
      message: `Lỗi kết nối. Kiểm tra mạng và đảm bảo ALPR service đang chạy (http://localhost:8765/health). Chi tiết: ${errorMessage}`,
    }
  }
  if (errorMessage.includes('500') || errorMessage.includes('502') || errorMessage.includes('503') || errorMessage.includes('Internal Server Error')) {
    return { kind: 'server', message: `Lỗi server: ${errorMessage}` }
  }
  return { kind: 'unknown', message: errorMessage.length > 200 ? errorMessage.substring(0, 200) + '…' : errorMessage }
}

export interface RunLanePreviewProgress {
  stage: 'idle' | 'validating' | 'uploading' | 'recognizing' | 'ready' | 'error'
  uploadProgress: number
  message: string
  errorMessage?: string
}

export function useRunLanePreview() {
  const actions = useRunLaneActions()

  const currentControllerRef = useRef<AbortController | null>(null)
  const lastUploadTimeRef = useRef(0)
  const uploadInFlightRef = useRef(false)
  const mountedRef = useRef(true)
  const [progress, setProgress] = useState<RunLanePreviewProgress>({
    stage: 'idle',
    uploadProgress: 0,
    message: '',
  })

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      currentControllerRef.current?.abort()
    }
  }, [])

  const validateFile = useCallback((file: File): string | null => {
    if (!file) return 'Không có file được chọn.'
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return `Loại file không được hỗ trợ. Chỉ chấp nhận: ${ALLOWED_IMAGE_TYPES.map((t) => t.replace('image/', '').toUpperCase()).join(', ')}`
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return `File quá lớn (${Math.round(file.size / 1024 / 1024)}MB). Tối đa: ${MAX_FILE_SIZE_MB}MB`
    }
    if (file.size === 0) return 'File rỗng.'
    return null
  }, [])

  const cancelCurrent = useCallback(() => {
    currentControllerRef.current?.abort()
    currentControllerRef.current = null
    uploadInFlightRef.current = false
    setProgress({ stage: 'idle', uploadProgress: 0, message: '' })
  }, [])

  const runPreview = useCallback(
    async (file: File | null | undefined): Promise<void> => {
      if (!mountedRef.current) return

      if (!file) {
        actions.setPreviewError('Không có file được chọn để chạy preview.')
        setProgress({
          stage: 'error',
          uploadProgress: 0,
          message: '',
          errorMessage: 'Không có file được chọn.',
        })
        return
      }

      const validationError = validateFile(file)
      if (validationError) {
        actions.setPreviewError(validationError)
        setProgress({
          stage: 'error',
          uploadProgress: 0,
          message: '',
          errorMessage: validationError,
        })
        return
      }

      const now = Date.now()
      if (uploadInFlightRef.current) {
        actions.setPreviewError('Đang xử lý upload trước đó. Vui lòng đợi…')
        return
      }

      const timeSinceLastUpload = now - lastUploadTimeRef.current
      if (timeSinceLastUpload < MIN_UPLOAD_INTERVAL_MS) {
        const waitSec = Math.ceil((MIN_UPLOAD_INTERVAL_MS - timeSinceLastUpload) / 1000)
        actions.setPreviewError(`Vui lòng đợi ${waitSec} giây trước khi upload lại.`)
        return
      }

      const controller = new AbortController()
      currentControllerRef.current = controller
      uploadInFlightRef.current = true
      lastUploadTimeRef.current = now

      setProgress({
        stage: 'validating',
        uploadProgress: 0,
        message: `Đang chuẩn bị ${file.name}…`,
      })

      try {
        actions.setPreviewUploading(`Đang tải lên ${file.name} (0%)…`)

        let uploadResult: Awaited<ReturnType<typeof uploadImage>> | null = null

        setProgress({
          stage: 'uploading',
          uploadProgress: 0,
          message: `Đang tải lên ${file.name}…`,
        })

        try {
          uploadResult = await uploadImage(file, { signal: controller.signal })
        } catch (uploadErr) {
          if (controller.signal.aborted) return

          const classified = classifyError(uploadErr, controller)

          if (classified.kind === 'aborted') return

          if (classified.kind === 'timeout') {
            actions.setPreviewError(`Upload timeout — ảnh quá lớn hoặc mạng chậm. Thử ảnh nhỏ hơn hoặc đợi mạng ổn định hơn.`)
            setProgress({ stage: 'error', uploadProgress: 0, message: '', errorMessage: classified.message })
          } else if (classified.kind === 'rate_limit') {
            actions.setPreviewError(classified.message)
            setProgress({ stage: 'error', uploadProgress: 0, message: '', errorMessage: classified.message })
          } else if (classified.kind === 'network') {
            actions.setPreviewError(classified.message)
            setProgress({ stage: 'error', uploadProgress: 0, message: '', errorMessage: classified.message })
          } else {
            actions.setPreviewError(`Upload thất bại: ${classified.message}`)
            setProgress({ stage: 'error', uploadProgress: 0, message: '', errorMessage: classified.message })
          }
          return
        }

        if (controller.signal.aborted) return

        const uploadedImageUrl = uploadResult.imageUrl
        const uploadedFilename = uploadResult.filename || file.name

        actions.setPreviewLoading({
          imageUrl: uploadedImageUrl,
          message: `Đã tải lên ${uploadedFilename}. Đang chạy nhận diện biển số (CPU mode — có thể mất 30-90 giây)…`,
        })

        setProgress({
          stage: 'recognizing',
          uploadProgress: 100,
          message: `Đã upload xong. Nhận diện biển số cho ${uploadedFilename}…`,
        })

        let previewResult: Awaited<ReturnType<typeof alprPreview>> | null = null

        try {
          previewResult = await alprPreview(uploadedImageUrl, undefined, { signal: controller.signal })
        } catch (previewErr) {
          if (controller.signal.aborted) return

          const classified = classifyError(previewErr, controller)

          if (classified.kind === 'aborted') return

          if (classified.kind === 'timeout') {
            actions.setPreviewError(
              `ALPR timeout — nhận diện mất quá lâu (>90s). Thử ảnh chất lượng tốt hơn, rõ nét hơn, hoặc kiểm tra ALPR service.`,
            )
            setProgress({ stage: 'error', uploadProgress: 100, message: '', errorMessage: classified.message })
          } else if (classified.kind === 'network') {
            actions.setPreviewError(classified.message)
            setProgress({ stage: 'error', uploadProgress: 100, message: '', errorMessage: classified.message })
          } else if (classified.kind === 'server') {
            actions.setPreviewError(`ALPR service lỗi: ${classified.message}`)
            setProgress({ stage: 'error', uploadProgress: 100, message: '', errorMessage: classified.message })
          } else {
            actions.setPreviewError(`Nhận diện thất bại: ${classified.message}`)
            setProgress({ stage: 'error', uploadProgress: 100, message: '', errorMessage: classified.message })
          }
          return
        }

        if (controller.signal.aborted) return

        actions.setPreviewSuccess({ imageUrl: uploadedImageUrl, result: previewResult })
        setProgress({
          stage: 'ready',
          uploadProgress: 100,
          message: `Nhận diện xong cho ${uploadedFilename}.`,
        })
      } finally {
        if (mountedRef.current) {
          uploadInFlightRef.current = false
        }
      }
    },
    [actions, validateFile],
  )

  return {
    runPreview,
    cancelPreview: cancelCurrent,
    progress,
  }
}
