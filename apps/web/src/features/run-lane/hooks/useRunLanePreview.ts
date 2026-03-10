import { useCallback, useEffect, useRef } from 'react'
import { useRunLaneActions } from '@/features/run-lane/store/runLaneStoreContext'
import { alprPreview, uploadImage } from '@/lib/api/alpr'

export function useRunLanePreview() {
  const actions = useRunLaneActions()
  const requestRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const runPreview = useCallback(async (file: File | null | undefined) => {
    if (!file) {
      actions.setPreviewError('Chưa có file để chạy backend preview.')
      return null
    }

    const requestId = ++requestRef.current
    abortRef.current?.abort()

    const controller = new AbortController()
    abortRef.current = controller

    try {
      actions.setPreviewUploading(`Đang upload ${file.name} lên backend preview...`)
      const uploaded = await uploadImage(file, { signal: controller.signal })
      if (requestRef.current !== requestId) return null

      actions.setPreviewLoading({
        imageUrl: uploaded.imageUrl,
        message: `Đã upload ${uploaded.filename}. Đang chạy ALPR preview song song với override thủ công...`,
      })

      const preview = await alprPreview(uploaded.imageUrl, undefined, { signal: controller.signal })
      if (requestRef.current !== requestId) return null

      actions.setPreviewSuccess({ imageUrl: uploaded.imageUrl, result: preview })
      return preview
    } catch (error) {
      if (controller.signal.aborted) return null
      actions.setPreviewError(error instanceof Error ? error.message : String(error))
      return null
    }
  }, [actions])

  return {
    runPreview,
    cancelPreview: () => abortRef.current?.abort(),
  }
}
