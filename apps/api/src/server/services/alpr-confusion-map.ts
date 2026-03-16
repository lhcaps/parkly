import { OCR_TO_ALPHA_MAP, OCR_TO_DIGIT_MAP } from '@parkly/gate-core'

export type AlprConfusionPosition = 'PROVINCE' | 'SERIES' | 'SERIAL'

const MAX_VARIANTS = 12

function normalizeCompact(input: string) {
  return String(input ?? '')
    .normalize('NFKC')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

function replacementFor(position: AlprConfusionPosition, ch: string) {
  if (position === 'SERIES') return OCR_TO_ALPHA_MAP[ch] ?? null
  return OCR_TO_DIGIT_MAP[ch] ?? null
}

function guessPosition(index: number): AlprConfusionPosition {
  if (index < 2) return 'PROVINCE'
  if (index < 4) return 'SERIES'
  return 'SERIAL'
}

export function applyControlledConfusionMap(input: string): string[] {
  const compact = normalizeCompact(input)
  if (!compact) return []

  const seen = new Set<string>([compact])
  const queue: Array<{ value: string; edits: number }> = [{ value: compact, edits: 0 }]

  while (queue.length > 0 && seen.size < MAX_VARIANTS) {
    const current = queue.shift()!
    if (current.edits >= 2) continue

    for (let i = 0; i < current.value.length; i += 1) {
      const position = guessPosition(i)
      const replacement = replacementFor(position, current.value[i])
      if (!replacement || replacement === current.value[i]) continue

      const next = `${current.value.slice(0, i)}${replacement}${current.value.slice(i + 1)}`
      if (seen.has(next)) continue

      seen.add(next)
      queue.push({ value: next, edits: current.edits + 1 })
      if (seen.size >= MAX_VARIANTS) break
    }
  }

  return Array.from(seen)
}
