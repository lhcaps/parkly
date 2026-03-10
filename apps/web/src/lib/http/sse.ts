import { buildUrl, getToken } from '@/lib/http/client'

export function makeSseUrl(path: string) {
  const url = new URL(buildUrl(path), window.location.origin)
  const token = getToken()
  if (token) url.searchParams.set('token', token)
  return url.toString()
}
