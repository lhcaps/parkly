import path from 'node:path'
import fs from 'node:fs/promises'

export type RuntimeMarkerPayload = Record<string, unknown> & {
  name?: string
  updatedAt?: string
  outcome?: string
}

export function resolveRuntimeDir() {
  const configured = String(process.env.OBS_RUNTIME_DIR ?? process.env.PARKLY_RUNTIME_DIR ?? '').trim()
  return configured ? path.resolve(process.cwd(), configured) : path.resolve(process.cwd(), '.runtime')
}

function markerPath(name: string) {
  return path.join(resolveRuntimeDir(), 'observability', `${String(name).trim().toLowerCase()}.json`)
}

export async function writeRuntimeMarker(name: string, payload: RuntimeMarkerPayload) {
  const filePath = markerPath(name)
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  const body = {
    name,
    updatedAt: new Date().toISOString(),
    ...payload,
  }
  await fs.writeFile(filePath, JSON.stringify(body, null, 2), 'utf8')
  return body
}

export async function readRuntimeMarker<T extends RuntimeMarkerPayload = RuntimeMarkerPayload>(name: string): Promise<T | null> {
  try {
    const text = await fs.readFile(markerPath(name), 'utf8')
    const parsed = JSON.parse(text)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed as T
  } catch {
    return null
  }
}
