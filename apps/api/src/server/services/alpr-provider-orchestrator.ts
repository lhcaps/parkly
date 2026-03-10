import { config } from '../config'

import { callAlprHttpProvider, type AlprHttpProviderName } from './alpr-provider-http'
import type { AlprObservation, RankedAlprCandidate } from './alpr-candidate-ranker'

export type AlprProviderTrace = {
  provider: string
  called: boolean
  status: 'SKIPPED' | 'SUCCESS' | 'ERROR' | 'TIMEOUT'
  latencyMs: number
  reason: string | null
}

export type RunAlprProviderOrchestrationArgs = {
  imageUrl?: string | null
  imagePath?: string | null
  plateHint?: string | null
  localTopCandidate?: RankedAlprCandidate | null
}

export type RunAlprProviderOrchestrationResult = {
  observations: AlprObservation[]
  traces: AlprProviderTrace[]
}

function providerEndpointFor(name: AlprHttpProviderName) {
  if (name === 'HTTP') return config.alpr.httpProvider.url
  if (name === 'OCRSPACE') return config.alpr.ocrSpace.url
  if (name === 'PLATE_RECOGNIZER') return config.alpr.plateRecognizer.url
  return null
}

function providerTokenFor(name: AlprHttpProviderName) {
  if (name === 'HTTP') return config.alpr.httpProvider.token
  if (name === 'OCRSPACE') return config.alpr.ocrSpace.apiKey
  if (name === 'PLATE_RECOGNIZER') return config.alpr.plateRecognizer.token
  return null
}

function shouldSkipExternal(localTopCandidate?: RankedAlprCandidate | null) {
  if (!localTopCandidate) return false
  if (localTopCandidate.previewStatus !== 'STRICT_VALID') return false
  return localTopCandidate.score >= config.alpr.externalEscalationThreshold
}

function isHttpProviderName(name: string): name is AlprHttpProviderName {
  return name === 'HTTP' || name === 'OCRSPACE' || name === 'PLATE_RECOGNIZER'
}

export async function runAlprProviderOrchestration(args: RunAlprProviderOrchestrationArgs): Promise<RunAlprProviderOrchestrationResult> {
  const traces: AlprProviderTrace[] = []
  const observations: AlprObservation[] = []

  if (shouldSkipExternal(args.localTopCandidate)) {
    for (const provider of config.alpr.providerOrder.filter((item) => item !== 'LOCAL')) {
      traces.push({
        provider,
        called: false,
        status: 'SKIPPED',
        latencyMs: 0,
        reason: 'LOCAL_STRICT_VALID_ALREADY_ACCEPTED',
      })
    }
    return { observations, traces }
  }

  for (const provider of config.alpr.providerOrder) {
    if (!isHttpProviderName(provider)) continue

    const endpoint = providerEndpointFor(provider)
    if (!endpoint) {
      traces.push({
        provider,
        called: false,
        status: 'SKIPPED',
        latencyMs: 0,
        reason: 'PROVIDER_NOT_CONFIGURED',
      })
      continue
    }

    const result = await callAlprHttpProvider({
      provider,
      endpoint,
      timeoutMs: config.alpr.providerTimeoutMs,
      token: providerTokenFor(provider),
      imageUrl: args.imageUrl ?? null,
      imagePath: args.imagePath ?? null,
      plateHint: args.plateHint ?? null,
    })

    traces.push({
      provider,
      called: true,
      status: result.status,
      latencyMs: result.latencyMs,
      reason: result.failureReason,
    })

    for (const candidate of result.candidates) {
      observations.push({
        provider,
        cropVariant: `${provider.toLowerCase()}_response`,
        psm: 0,
        rawText: candidate.rawText || candidate.plate,
        lineMode: 'FULL',
        stage: 'HTTP',
        evidenceWeight: Math.round(candidate.score / 10),
      })
    }

    const hasStrictEnough = result.candidates.some((candidate) => candidate.score >= config.alpr.externalEscalationThreshold)
    if (hasStrictEnough) break
  }

  return { observations, traces }
}

