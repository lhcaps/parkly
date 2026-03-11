import type { NextFunction, Request, Response } from 'express'
import { config, type AppRole } from './config'
import { isRevoked as isAuthTokenRevoked } from './services/auth-revocation.service'

function extractBearer(req: Request): string | null {
  const h = req.header('authorization')
  if (!h) return null
  const m = /^Bearer\s+(.+)$/i.exec(String(h).trim())
  return m?.[1] ? String(m[1]).trim() : null
}

function extractQueryToken(req: Request): string | null {
  if (config.allowQueryToken !== 'ON') return null
  if (req.method !== 'GET') return null
  const token = String((req.query as any)?.token ?? '').trim()
  return token ? token : null
}

function extractForwardedTokenId(req: Request): string | null {
  const tokenId = String(req.header('x-auth-token-id') ?? '').trim()
  return tokenId || null
}

export async function isRequestTokenRevoked(req: Request) {
  const tokenId = extractForwardedTokenId(req)
  if (!tokenId) return false
  return await isAuthTokenRevoked(tokenId)
}

export function requireAuth(allowed: AppRole[]) {
  return function middleware(req: Request, res: Response, next: NextFunction) {
    void (async () => {
      if (config.authMode === 'OFF') {
        req.auth = { role: 'ADMIN', actorUserId: config.actors.ADMIN }
        return next()
      }

      const token = extractBearer(req) ?? extractQueryToken(req)
      if (!token) {
        return res.status(401).json({ code: 'UNAUTHENTICATED', message: 'Missing Bearer token' })
      }

      const forwardedTokenId = extractForwardedTokenId(req)
      if (forwardedTokenId && await isAuthTokenRevoked(forwardedTokenId)) {
        return res.status(401).json({ code: 'UNAUTHENTICATED', message: 'Token has been revoked' })
      }

      const role = (Object.keys(config.tokens) as AppRole[]).find((r) => config.tokens[r] && token === config.tokens[r])
      if (!role) {
        return res.status(401).json({ code: 'UNAUTHENTICATED', message: 'Invalid token' })
      }

      if (!allowed.includes(role)) {
        return res.status(403).json({ code: 'FORBIDDEN', message: `Role ${role} is not allowed` })
      }

      req.auth = { role, actorUserId: config.actors[role] }
      next()
    })().catch(next)
  }
}

export function getRequestActor(req: Request) {
  const role = req.auth?.role ?? 'ADMIN'
  return {
    role,
    actorUserId: req.auth?.actorUserId,
    actorLabel: req.auth?.actorUserId != null ? `${role}:${req.auth.actorUserId.toString()}` : role,
  }
}