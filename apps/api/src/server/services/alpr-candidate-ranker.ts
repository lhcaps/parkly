import { buildPlateCanonical } from '@parkly/gate-core'

import { applyControlledConfusionMap } from './alpr-confusion-map'

export type AlprObservation = {
  provider: string
  cropVariant: string
  psm: number
  rawText: string
  lineMode: 'FULL' | 'TWO_LINE'
  stage: 'FAST' | 'DEEP' | 'HTTP'
  evidenceWeight?: number
}

export type RankedAlprCandidate = {
  key: string
  plate: string
  score: number
  votes: number
  cropVariants: string[]
  psmModes: number[]
  suspiciousFlags: string[]
  providerNames: string[]
  rawSamples: string[]
  previewStatus: 'STRICT_VALID' | 'REVIEW' | 'INVALID'
}

export type RankedAlprWinner = {
  cropVariant: string
  psm: number
  rawText: string
  score: number
  provider: string
  lineMode: 'FULL' | 'TWO_LINE'
}

export type RankAlprCandidatesOptions = {
  maxCandidates?: number
  provinceAllowlist?: string[]
}

function normalizeFragments(rawText: string) {
  const normalized = String(rawText ?? '')
    .normalize('NFKC')
    .toUpperCase()
    .replace(/[|_]/g, ' ')
    .replace(/[^A-Z0-9\s.\-]/g, ' ')

  const lines = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  return { normalized, lines }
}

function extractTextFragments(rawText: string, lineMode: 'FULL' | 'TWO_LINE') {
  const { normalized, lines } = normalizeFragments(rawText)
  const fragments = new Set<string>()

  for (const line of lines) {
    fragments.add(line)
    fragments.add(line.replace(/\s+/g, ' '))
    fragments.add(line.replace(/\s+/g, ''))
  }

  if (lines.length >= 2) {
    const joined = `${lines[0]} ${lines[1]}`.trim()
    fragments.add(joined)
    fragments.add(joined.replace(/\s+/g, ''))
    fragments.add(`${lines[0]}\n${lines[1]}`)
  }

  const inline = normalized.replace(/\s+/g, ' ').trim()
  if (inline) {
    fragments.add(inline)
    fragments.add(inline.replace(/\s+/g, ''))
  }

  for (const match of normalized.matchAll(/[0-9A-Z][0-9A-Z\s.\-]{4,20}[0-9A-Z]/g)) {
    fragments.add(match[0].trim())
    fragments.add(match[0].replace(/\s+/g, '').trim())
  }

  if (lineMode === 'TWO_LINE' && lines.length >= 2) {
    const oneLine = lines[0]
    if (oneLine && oneLine.length >= 6) {
      const midpoint = Math.floor(oneLine.length / 2)
      fragments.add(`${oneLine.slice(0, midpoint)} ${oneLine.slice(midpoint)}`.trim())
    }
  }

  return Array.from(fragments)
    .map((value) => value.trim())
    .filter((value) => value.length >= 5)
    .slice(0, 48)
}

function isLikelyProvinceCode(code: string | null | undefined, allowlist: ReadonlySet<string>) {
  const value = String(code ?? '').trim()
  if (!/^\d{2}$/.test(value)) return false
  if (allowlist.size > 0) return allowlist.has(value)
  if (value === '00' || value === '99') return false
  return true
}

function scoreCandidate(args: {
  plate: string
  observation: AlprObservation
  provinceAllowlist: ReadonlySet<string>
}) {
  const canonical = buildPlateCanonical(args.plate)
  let score = 0

  if (canonical.plateValidity === 'STRICT_VALID') score += 68
  else if (canonical.plateValidity === 'REVIEW') score += 48
  else score += 10

  if (canonical.plateFamily === 'DOMESTIC') score += 10
  else if (canonical.plateFamily !== 'UNKNOWN') score += 6

  const provinceCode = canonical.plateCompact?.slice(0, 2) ?? null
  if (isLikelyProvinceCode(provinceCode, args.provinceAllowlist)) score += 10
  else if (provinceCode) score -= 10

  if (canonical.reviewRequired) score -= 6
  score -= Math.min(12, canonical.suspiciousFlags.length * 4)
  score -= Math.min(10, canonical.ocrSubstitutions.length * 2)

  if (args.observation.lineMode === 'TWO_LINE') score += 6
  if (args.observation.stage === 'FAST') score += 3
  if (args.observation.stage === 'DEEP') score += 5
  if (args.observation.stage === 'HTTP') score += 4

  if (args.observation.provider === 'LOCAL') score += 2
  score += Math.max(0, Math.min(10, Number(args.observation.evidenceWeight ?? 0)))

  return {
    canonical,
    score: Math.max(0, Math.min(100, score)),
  }
}

export function rankAlprCandidates(observations: AlprObservation[], options: RankAlprCandidatesOptions = {}) {
  const provinceAllowlist = new Set((options.provinceAllowlist ?? []).map((item) => String(item).trim()).filter(Boolean))
  const candidateMap = new Map<string, {
    plate: string
    score: number
    votes: number
    cropVariants: Set<string>
    psmModes: Set<number>
    suspiciousFlags: Set<string>
    providerNames: Set<string>
    rawSamples: Set<string>
    previewStatus: 'STRICT_VALID' | 'REVIEW' | 'INVALID'
    winner: RankedAlprWinner | null
  }>()

  for (const observation of observations) {
    const rawFragments = extractTextFragments(observation.rawText, observation.lineMode)
    const expanded = new Set<string>()

    for (const fragment of rawFragments) {
      for (const variant of applyControlledConfusionMap(fragment)) expanded.add(variant)
    }

    for (const candidate of expanded) {
      const { canonical, score } = scoreCandidate({
        plate: candidate,
        observation,
        provinceAllowlist,
      })

      const key = canonical.plateCompact ?? candidate
      const existing = candidateMap.get(key) ?? {
        plate: canonical.plateDisplay ?? canonical.plateRaw ?? candidate,
        score: 0,
        votes: 0,
        cropVariants: new Set<string>(),
        psmModes: new Set<number>(),
        suspiciousFlags: new Set<string>(),
        providerNames: new Set<string>(),
        rawSamples: new Set<string>(),
        previewStatus: canonical.plateValidity,
        winner: null,
      }

      existing.score = Math.max(existing.score, score)
      existing.votes += 1
      existing.cropVariants.add(observation.cropVariant)
      existing.psmModes.add(observation.psm)
      existing.providerNames.add(observation.provider)
      existing.rawSamples.add(observation.rawText)
      for (const flag of canonical.suspiciousFlags) existing.suspiciousFlags.add(flag)
      if (canonical.plateValidity === 'STRICT_VALID') existing.previewStatus = 'STRICT_VALID'
      else if (existing.previewStatus !== 'STRICT_VALID' && canonical.plateValidity === 'REVIEW') existing.previewStatus = 'REVIEW'

      if (!existing.winner || score > existing.winner.score) {
        existing.winner = {
          cropVariant: observation.cropVariant,
          psm: observation.psm,
          rawText: observation.rawText,
          score,
          provider: observation.provider,
          lineMode: observation.lineMode,
        }
      }

      candidateMap.set(key, existing)
    }
  }

  const candidates: RankedAlprCandidate[] = Array.from(candidateMap.entries())
    .map(([key, entry]) => ({
      key,
      plate: entry.plate,
      score: entry.score,
      votes: entry.votes,
      cropVariants: Array.from(entry.cropVariants).sort(),
      psmModes: Array.from(entry.psmModes).sort((a, b) => a - b),
      suspiciousFlags: Array.from(entry.suspiciousFlags).sort(),
      providerNames: Array.from(entry.providerNames).sort(),
      rawSamples: Array.from(entry.rawSamples).slice(0, 3),
      previewStatus: entry.previewStatus,
    }))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score
      if (right.votes !== left.votes) return right.votes - left.votes
      return left.plate.localeCompare(right.plate)
    })
    .slice(0, options.maxCandidates ?? 5)

  const winner = candidates.length > 0 ? candidateMap.get(candidates[0].key)?.winner ?? null : null

  return { candidates, winner }
}
