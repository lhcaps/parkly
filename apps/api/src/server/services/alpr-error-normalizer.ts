import { ApiError } from '../http'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function extractReason(details: unknown) {
  if (!isRecord(details)) return null

  const reason = String(details.reason ?? details.failureReason ?? '').trim()
  return reason || null
}

function withReason(details: Record<string, unknown> | undefined, reason: string, extra?: Record<string, unknown>) {
  return {
    ...(details ?? {}),
    ...(extra ?? {}),
    reason,
    failureReason: String((extra ?? {}).failureReason ?? details?.failureReason ?? reason),
  }
}

export function normalizeAlprError(error: unknown, details?: Record<string, unknown>) {
  if (error instanceof ApiError) {
    const existingDetails = isRecord(error.details) ? error.details : undefined
    const reason = extractReason(existingDetails)

    return new ApiError({
      code: error.code,
      statusCode: error.statusCode,
      message: error.message,
      details: reason
        ? withReason(existingDetails, reason, details)
        : {
            ...(existingDetails ?? {}),
            ...(details ?? {}),
          },
    })
  }

  const record = isRecord(error) ? error : null
  const code = String(record?.code ?? '')
  const message = String(record?.message ?? '')
  const lowered = message.toLowerCase()

  if (code === 'ENOENT' && /tesseract/i.test(message)) {
    return new ApiError({
      code: 'SERVICE_UNAVAILABLE',
      message: 'OCR engine không khả dụng trên backend hiện tại.',
      details: withReason(undefined, 'TESSERACT_BINARY_NOT_FOUND', {
        ...(details ?? {}),
      }),
    })
  }

  if (code === 'ENOENT') {
    return new ApiError({
      code: 'UNPROCESSABLE_ENTITY',
      message: 'Ảnh đầu vào không tồn tại hoặc backend không đọc được file preview.',
      details: withReason(undefined, 'IMAGE_NOT_READABLE', {
        originalError: message || 'ENOENT',
        ...(details ?? {}),
      }),
    })
  }

  if (code === 'EACCES' || code === 'EPERM') {
    return new ApiError({
      code: 'UNPROCESSABLE_ENTITY',
      message: 'Backend không có quyền đọc file ảnh đầu vào.',
      details: withReason(undefined, 'IMAGE_ACCESS_DENIED', {
        originalError: message || code,
        ...(details ?? {}),
      }),
    })
  }

  if (
    lowered.includes('input buffer contains unsupported image format') ||
    lowered.includes('unsupported image format') ||
    lowered.includes('unsupported file type')
  ) {
    return new ApiError({
      code: 'UNSUPPORTED_MEDIA_TYPE',
      message: 'Ảnh đầu vào không đúng định dạng hỗ trợ.',
      details: withReason(undefined, 'UNSUPPORTED_IMAGE_FORMAT', {
        ...(details ?? {}),
      }),
    })
  }

  if (
    lowered.includes('unsupported image') ||
    lowered.includes('vips') ||
    lowered.includes('metadata') ||
    lowered.includes('corrupt') ||
    lowered.includes('bad extract area')
  ) {
    return new ApiError({
      code: 'UNPROCESSABLE_ENTITY',
      message: 'Ảnh đầu vào không đọc được hoặc không đủ dữ liệu để OCR.',
      details: withReason(undefined, 'IMAGE_NOT_READABLE', {
        originalError: message || String(error),
        ...(details ?? {}),
      }),
    })
  }

  if (
    lowered.includes('canonical') ||
    lowered.includes('strict validation') ||
    lowered.includes('licenseplateraw')
  ) {
    return new ApiError({
      code: 'UNPROCESSABLE_ENTITY',
      message: 'OCR có kết quả trung gian nhưng backend không canonicalize được thành biển số hợp lệ.',
      details: withReason(undefined, 'ALPR_CANONICALIZE_FAILED', {
        originalError: message || String(error),
        ...(details ?? {}),
      }),
    })
  }

  return new ApiError({
    code: 'UNPROCESSABLE_ENTITY',
    message: 'Không nhận diện được biển số từ ảnh hiện tại.',
    details: withReason(undefined, 'ALPR_PREVIEW_FAILED', {
      originalError: message || String(error),
      ...(details ?? {}),
    }),
  })
}
