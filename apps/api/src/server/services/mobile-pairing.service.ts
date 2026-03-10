import { randomUUID } from 'node:crypto'

export type MobilePairingContext = {
  pairToken: string
  siteCode: string
  laneCode: string
  direction: 'ENTRY' | 'EXIT'
  deviceCode: string
  createdAt: string
  expiresAt: string
}

const PAIRING_TTL_MS = 1000 * 60 * 60 * 8
const store = new Map<string, MobilePairingContext>()

function prune(now = Date.now()) {
  for (const [token, value] of store.entries()) {
    if (new Date(value.expiresAt).getTime() <= now) {
      store.delete(token)
    }
  }
}

export function createMobilePairing(args: {
  siteCode: string
  laneCode: string
  direction: 'ENTRY' | 'EXIT'
  deviceCode: string
}) {
  prune()
  const createdAt = new Date()
  const expiresAt = new Date(createdAt.getTime() + PAIRING_TTL_MS)
  const pairing: MobilePairingContext = {
    pairToken: randomUUID(),
    siteCode: String(args.siteCode ?? '').trim().toUpperCase(),
    laneCode: String(args.laneCode ?? '').trim().toUpperCase(),
    direction: args.direction === 'EXIT' ? 'EXIT' : 'ENTRY',
    deviceCode: String(args.deviceCode ?? '').trim().toUpperCase(),
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  }
  store.set(pairing.pairToken, pairing)
  return pairing
}

export function getMobilePairing(pairToken: string) {
  prune()
  const token = String(pairToken ?? '').trim()
  if (!token) return null
  const value = store.get(token) ?? null
  if (!value) return null
  if (new Date(value.expiresAt).getTime() <= Date.now()) {
    store.delete(token)
    return null
  }
  return value
}
