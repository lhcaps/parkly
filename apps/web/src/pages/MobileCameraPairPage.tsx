import { useEffect, useMemo, useState } from 'react'
import { Check, ClipboardCopy, Loader2, Smartphone, Wifi } from 'lucide-react'
import { PageHeader } from '@/components/ops/console'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ValidationSummary } from '@/components/forms/validation-summary'
import { ConfirmActionButton, PageStateRenderer, StateBanner } from '@/components/state/page-state'
import { MobilePairForm, type MobilePairDraft } from '@/features/mobile-pair/components/MobilePairForm'
import { MobileQrCard } from '@/features/mobile-pair/components/MobileQrCard'
import { ActivePairsTable } from '@/features/mobile-pair/components/ActivePairsTable'

// Cập nhật import mới từ @/lib/api/mobile
import {
  buildMobileCapturePairUrl,
  createMobilePairToken,
  isMobilePairOriginLoopback,
  listActiveMobilePairs,
  registerActiveMobilePair,
  removeActiveMobilePair,
  resolveMobilePairOrigin,
  touchActiveMobilePair,
  type ActiveMobilePair,
} from '@/lib/api/mobile'

import { getDevices } from '@/lib/api/devices'
import { getLanes, getSites } from '@/lib/api/topology'
import { extractValidationFieldErrors } from '@/lib/http/errors'
import type { DeviceRow } from '@/lib/contracts/devices'
import type { LaneRow, SiteRow } from '@/lib/contracts/topology'

function emptyDraft(): MobilePairDraft {
  return {
    siteCode: '',
    laneCode: '',
    direction: 'ENTRY',
    deviceCode: '',
    deviceSecret: '',
    token: '',
  }
}

async function copyText(value: string) {
  if (!value) return false
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    return false
  }
}

function validatePairDraft(draft: MobilePairDraft) {
  const items: Array<{ field: string; message: string }> = []
  if (!draft.siteCode) items.push({ field: 'siteCode', message: 'Select site before creating a pair.' })
  if (!draft.laneCode) items.push({ field: 'laneCode', message: 'Select lane so the pair link retains context.' })
  if (!draft.deviceCode) items.push({ field: 'deviceCode', message: 'Device missingCode để mobile gửi heartbeat/capture đúng devices.' })
  if (!draft.deviceSecret) items.push({ field: 'deviceSecret', message: 'Device missingSecret để ký request từ mobile.' })
  return items
}

export function MobileCameraPairPage() {
  const [sites, setSites] = useState<SiteRow[]>([])
  const [lanes, setLanes] = useState<LaneRow[]>([])
  const [devices, setDevices] = useState<DeviceRow[]>([])
  const [draft, setDraft] = useState<MobilePairDraft>(emptyDraft())
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [activePairs, setActivePairs] = useState<ActiveMobilePair[]>(() => listActiveMobilePairs())

  useEffect(() => {
    let active = true
    async function bootstrap() {
      setBusy(true)
      try {
        setError(null)
        const siteRes = await getSites()
        if (!active) return
        setSites(siteRes.rows)
        setDraft((current) => ({
          ...current,
          siteCode: current.siteCode || siteRes.rows[0]?.siteCode || '',
        }))
      } catch (bootstrapError) {
        if (!active) return
        setError(bootstrapError)
      } finally {
        if (active) setBusy(false)
      }
    }
    void bootstrap()
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    async function loadContext() {
      if (!draft.siteCode) {
        setLanes([])
        setDevices([])
        return
      }
      setBusy(true)
      try {
        setError(null)
        const [laneRes, deviceRes] = await Promise.all([
          getLanes(draft.siteCode),
          getDevices({ siteCode: draft.siteCode }),
        ])
        if (!active) return
        setLanes(laneRes.rows)
        setDevices(deviceRes.rows)
      } catch (loadError) {
        if (!active) return
        setError(loadError)
      } finally {
        if (active) setBusy(false)
      }
    }
    void loadContext()
    return () => { active = false }
  }, [draft.siteCode])

  const pairUrl = useMemo(() => buildMobileCapturePairUrl(draft), [draft])
  const draftValidation = useMemo(() => validatePairDraft(draft), [draft])
  const backendValidation = useMemo(() => extractValidationFieldErrors(error instanceof Error ? (error as any).details : undefined), [error])

  // --- Bổ sung logic origin resolution cho v6 ---
  const pairOrigin = useMemo(() => resolveMobilePairOrigin(), [])
  const pairOriginLoopback = useMemo(() => isMobilePairOriginLoopback(), [])

  async function handleCopyPairUrl() {
    const ok = await copyText(pairUrl)
    setCopied(ok)
    if (ok) {
      window.setTimeout(() => setCopied(false), 1800)
      setMessage('Pair link copied.')
    }
  }

  function handleOpenPairUrl(url = pairUrl, pairId?: string) {
    if (!url) return
    if (pairId) {
      touchActiveMobilePair(pairId)
      setActivePairs(listActiveMobilePairs())
    }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  function handleCreatePair() {
    if (draftValidation.length > 0) {
      setMessage('Required context missing to create pair.')
      return
    }
    const row = registerActiveMobilePair(draft)
    setActivePairs(listActiveMobilePairs())
    setMessage(`Created pair ${row.pairId}.`)
  }

  function handleRemovePair(pairId: string) {
    removeActiveMobilePair(pairId)
    setActivePairs(listActiveMobilePairs())
    setMessage(`Deleted pair ${pairId}.`)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Capture"
        title="Mobile Camera Pair"
        description="Create pair links for mobile devices, render QR codes, and manage the local registry."
        badges={[
          { label: 'desktop pair', variant: 'secondary' },
          { label: 'QR + link', variant: 'outline' },
          { label: activePairs.length > 0 ? `active ${activePairs.length}` : 'no pair', variant: activePairs.length > 0 ? 'secondary' : 'outline' },
        ]}
      />

      <ValidationSummary items={[...draftValidation, ...backendValidation]} />
      {message ? <StateBanner className="border-border/80 bg-card/95">{message}</StateBanner> : null}
      {error ? <StateBanner error={error} /> : null}

      <PageStateRenderer
        loading={busy && sites.length === 0}
        error={error && sites.length === 0 ? error : null}
        empty={!busy && !error && sites.length === 0}
        emptyTitle="No sites available"
        emptyDescription="Your current role or scope returned no sites — pair links cannot be created."
      >
        <>
          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="space-y-5">
              <MobilePairForm
                sites={sites}
                lanes={lanes}
                devices={devices}
                value={draft}
                loading={busy}
                onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
                onGenerateToken={() => setDraft((current) => ({ ...current, token: createMobilePairToken() }))}
                onClear={() => {
                  setDraft(emptyDraft())
                  setMessage('')
                  setError(null)
                }}
              />

              <div className="rounded-3xl border border-border/80 bg-card/95 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.12)]">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="muted">pair actions</Badge>
                  <Badge variant="outline">local registry</Badge>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button type="button" onClick={handleCreatePair} disabled={busy || draftValidation.length > 0 || !pairUrl}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
                    Create pair
                  </Button>
                  <Button type="button" variant="outline" onClick={() => void handleCopyPairUrl()} disabled={!pairUrl}>
                    {copied ? <Check className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}
                    {copied ? 'Copied' : 'Copy current link'}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => handleOpenPairUrl()} disabled={!pairUrl}>
                    <Smartphone className="h-4 w-4" />
                    Open current link
                  </Button>
                </div>
              </div>
            </div>

            {/* Cập nhật MobileQrCard với các prop origin mới */}
            <MobileQrCard
              pairUrl={pairUrl}
              copied={copied}
              pairOrigin={pairOrigin}
              pairOriginLoopback={pairOriginLoopback}
              onCopy={() => void handleCopyPairUrl()}
              onOpen={() => handleOpenPairUrl()}
            />
          </div>

          <ActivePairsTable
            rows={activePairs}
            onOpen={(row) => handleOpenPairUrl(row.pairUrl, row.pairId)}
            onCopy={(row) => void copyText(row.pairUrl)}
            onRemove={(pairId) => {
              if (!window.confirm(`Delete pair ${pairId}?\n\nThis only removes the local registry entry on this browser.`)) return
              handleRemovePair(pairId)
            }}
          />

          {activePairs.length > 0 ? (
            <div className="flex justify-end">
              <ConfirmActionButton
                variant="ghost"
                size="sm"
                confirmTitle="Clear all local pairs?"
                confirmDescription="Only this browser's local registry is cleared. Existing QR codes are not revoked."
                onConfirm={() => {
                  activePairs.forEach((row) => removeActiveMobilePair(row.pairId))
                  setActivePairs(listActiveMobilePairs())
                  setMessage('All local pair registry entries cleared.')
                }}
              >
                Clear local registry
              </ConfirmActionButton>
            </div>
          ) : null}
        </>
      </PageStateRenderer>
    </div>
  )
}