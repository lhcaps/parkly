import { readFile } from 'node:fs/promises'
import path from 'node:path'

export type AlprHttpProviderName = 'HTTP' | 'OCRSPACE' | 'PLATE_RECOGNIZER'

export type AlprHttpProviderResult = {
  provider: AlprHttpProviderName
  status: 'SUCCESS' | 'ERROR' | 'TIMEOUT'
  latencyMs: number
  rawText: string | null
  failureReason: string | null
  candidates: Array<{
    plate: string
    score: number
    rawText: string
  }>
}

export type CallAlprHttpProviderArgs = {
  provider: AlprHttpProviderName
  endpoint: string
  timeoutMs: number
  token?: string | null
  imageUrl?: string | null
  imagePath?: string | null
  plateHint?: string | null
}

function normalizePlateLike(value: unknown) {
  const text = String(value ?? '').trim()
  return text ? text : null
}

function normalizeScore(value: unknown, fallback = 55) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  if (n <= 1) return Math.max(0, Math.min(100, n * 100))
  return Math.max(0, Math.min(100, n))
}

function normalizeGenericResponse(provider: AlprHttpProviderName, payload: any, latencyMs: number): AlprHttpProviderResult {
  const explicitCandidates = Array.isArray(payload?.candidates)
    ? payload.candidates
        .map((item: any) => ({
          plate: normalizePlateLike(item?.plate ?? item?.recognizedPlate ?? item?.text),
          score: normalizeScore(item?.score ?? item?.confidence ?? item?.probability),
          rawText: String(item?.rawText ?? item?.text ?? item?.plate ?? ''),
        }))
        .filter((item) => item.plate)
    : []

  const singlePlate = normalizePlateLike(payload?.recognizedPlate ?? payload?.plate ?? payload?.text)
  const singleRawText = String(payload?.rawText ?? payload?.text ?? payload?.recognizedPlate ?? '')

  const candidates = explicitCandidates.length > 0
    ? explicitCandidates as Array<{ plate: string; score: number; rawText: string }>
    : singlePlate
      ? [{ plate: singlePlate, score: normalizeScore(payload?.confidence ?? payload?.score), rawText: singleRawText }]
      : []

  return {
    provider,
    status: 'SUCCESS',
    latencyMs,
    rawText: normalizePlateLike(payload?.rawText ?? payload?.text),
    failureReason: candidates.length > 0 ? null : 'PROVIDER_EMPTY_RESULT',
    candidates,
  }
}

function normalizeOcrSpaceResponse(payload: any, latencyMs: number): AlprHttpProviderResult {
  const parsedResults = Array.isArray(payload?.ParsedResults) ? payload.ParsedResults : []
  const rawText = parsedResults
    .map((item: any) => String(item?.ParsedText ?? '').trim())
    .filter(Boolean)
    .join('\n') || null

  const candidates = rawText
    ? [{ plate: rawText, score: 58, rawText }]
    : []

  return {
    provider: 'OCRSPACE',
    status: 'SUCCESS',
    latencyMs,
    rawText,
    failureReason: candidates.length > 0 ? null : normalizePlateLike(payload?.ErrorMessage) ?? 'PROVIDER_EMPTY_RESULT',
    candidates,
  }
}

function normalizePlateRecognizerResponse(payload: any, latencyMs: number): AlprHttpProviderResult {
  const results = Array.isArray(payload?.results) ? payload.results : []
  const candidates = results
    .map((item: any) => ({
      plate: normalizePlateLike(item?.plate),
      score: normalizeScore(item?.score ?? item?.dscore ?? item?.confidence),
      rawText: String(item?.plate ?? ''),
    }))
    .filter((item) => item.plate) as Array<{ plate: string; score: number; rawText: string }>

  return {
    provider: 'PLATE_RECOGNIZER',
    status: 'SUCCESS',
    latencyMs,
    rawText: candidates[0]?.rawText ?? null,
    failureReason: candidates.length > 0 ? null : 'PROVIDER_EMPTY_RESULT',
    candidates,
  }
}

function buildProviderRequest(args: CallAlprHttpProviderArgs) {
  const headers: Record<string, string> = {}
  let body: BodyInit | undefined

  if (args.provider === 'HTTP') {
    headers['content-type'] = 'application/json'
    if (args.token) headers.authorization = `Bearer ${args.token}`
    body = JSON.stringify({
      imageUrl: args.imageUrl ?? null,
      imagePath: args.imagePath ?? null,
      plateHint: args.plateHint ?? null,
    })
    return { headers, body }
  }

  const form = new FormData()

  if (args.provider === 'OCRSPACE') {
    if (args.token) form.set('apikey', args.token)
    form.set('isOverlayRequired', 'false')
    form.set('language', 'eng')
    form.set('OCREngine', '2')

    if (args.imageUrl) {
      form.set('url', args.imageUrl)
    }
  }

  if (args.provider === 'PLATE_RECOGNIZER' && args.token) {
    headers.authorization = `Token ${args.token}`
  }

  return { headers, body: form as unknown as BodyInit }
}

async function appendUploadFileIfNeeded(form: FormData, imagePath: string | null | undefined, fieldNames: string[]) {
  const absolutePath = String(imagePath ?? '').trim()
  if (!absolutePath) return false

  const content = await readFile(absolutePath)
  const filename = path.basename(absolutePath) || 'upload.jpg'
  const blob = new Blob([content])
  for (const fieldName of fieldNames) form.set(fieldName, blob, filename)
  return true
}

export async function callAlprHttpProvider(args: CallAlprHttpProviderArgs): Promise<AlprHttpProviderResult> {
  const startedAt = Date.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), Math.max(500, args.timeoutMs))

  try {
    const request = buildProviderRequest(args)
    if (request.body instanceof FormData) {
      if (args.provider === 'OCRSPACE' && !args.imageUrl) {
        await appendUploadFileIfNeeded(request.body, args.imagePath, ['file'])
      }
      if (args.provider === 'PLATE_RECOGNIZER') {
        const appended = await appendUploadFileIfNeeded(request.body, args.imagePath, ['upload'])
        if (!appended && args.imageUrl) request.body.set('upload_url', args.imageUrl)
      }
    }

    const response = await fetch(args.endpoint, {
      method: 'POST',
      headers: request.headers,
      body: request.body,
      signal: controller.signal,
    })

    const latencyMs = Date.now() - startedAt
    const contentType = String(response.headers.get('content-type') ?? '').toLowerCase()
    const payload = contentType.includes('application/json')
      ? await response.json()
      : { rawText: await response.text() }

    if (!response.ok) {
      return {
        provider: args.provider,
        status: 'ERROR',
        latencyMs,
        rawText: normalizePlateLike((payload as any)?.rawText ?? (payload as any)?.text),
        failureReason: normalizePlateLike((payload as any)?.message) ?? `HTTP_${response.status}`,
        candidates: [],
      }
    }

    if (args.provider === 'OCRSPACE') return normalizeOcrSpaceResponse(payload, latencyMs)
    if (args.provider === 'PLATE_RECOGNIZER') return normalizePlateRecognizerResponse(payload, latencyMs)
    return normalizeGenericResponse(args.provider, payload, latencyMs)
  } catch (error: any) {
    const latencyMs = Date.now() - startedAt
    const aborted = error?.name === 'AbortError'
    return {
      provider: args.provider,
      status: aborted ? 'TIMEOUT' : 'ERROR',
      latencyMs,
      rawText: null,
      failureReason: aborted ? 'PROVIDER_TIMEOUT' : String(error?.message ?? 'PROVIDER_ERROR'),
      candidates: [],
    }
  } finally {
    clearTimeout(timeout)
  }
}
