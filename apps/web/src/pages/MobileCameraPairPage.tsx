import { useEffect, useMemo, useState } from 'react'
import { Check, ClipboardCopy, Loader2, Smartphone, Wifi } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MobilePairForm, type MobilePairDraft } from '@/features/mobile-pair/components/MobilePairForm'
import { MobileQrCard } from '@/features/mobile-pair/components/MobileQrCard'
import { ActivePairsTable } from '@/features/mobile-pair/components/ActivePairsTable'
import {
  buildMobileCapturePairUrl,
  createMobilePairToken,
  listActiveMobilePairs,
  registerActiveMobilePair,
  removeActiveMobilePair,
  touchActiveMobilePair,
  type ActiveMobilePair,
} from '@/lib/api/mobile'
import { getDevices } from '@/lib/api/devices'
import { getLanes, getSites } from '@/lib/api/topology'
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

export function MobileCameraPairPage() {
  const [sites, setSites] = useState<SiteRow[]>([])
  const [lanes, setLanes] = useState<LaneRow[]>([])
  const [devices, setDevices] = useState<DeviceRow[]>([])
  const [draft, setDraft] = useState<MobilePairDraft>(emptyDraft())
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [message, setMessage] = useState('')
  const [activePairs, setActivePairs] = useState<ActiveMobilePair[]>(() => listActiveMobilePairs())

  useEffect(() => {
    let active = true

    async function bootstrap() {
      setBusy(true)
      try {
        const siteRes = await getSites()
        if (!active) return
        setSites(siteRes.rows)
        setDraft((current) => ({
          ...current,
          siteCode: current.siteCode || siteRes.rows[0]?.siteCode || '',
        }))
      } catch (error) {
        if (!active) return
        setMessage(error instanceof Error ? error.message : String(error))
      } finally {
        if (active) setBusy(false)
      }
    }

    void bootstrap()
    return () => {
      active = false
    }
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
        const [laneRes, deviceRes] = await Promise.all([
          getLanes(draft.siteCode),
          getDevices({ siteCode: draft.siteCode }),
        ])
        if (!active) return
        setLanes(laneRes.rows)
        setDevices(deviceRes.rows)
      } catch (error) {
        if (!active) return
        setMessage(error instanceof Error ? error.message : String(error))
      } finally {
        if (active) setBusy(false)
      }
    }

    void loadContext()
    return () => {
      active = false
    }
  }, [draft.siteCode])

  const pairUrl = useMemo(() => buildMobileCapturePairUrl(draft), [draft])

  async function handleCopyPairUrl() {
    const ok = await copyText(pairUrl)
    setCopied(ok)
    if (ok) {
      window.setTimeout(() => setCopied(false), 1800)
      setMessage('Đã copy pair link.')
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
    if (!draft.siteCode || !draft.laneCode || !draft.deviceCode || !draft.deviceSecret) {
      setMessage('Thiếu site / lane / device / deviceSecret để tạo pair.')
      return
    }

    const row = registerActiveMobilePair(draft)
    setActivePairs(listActiveMobilePairs())
    setMessage(`Đã tạo pair ${row.pairId}.`)
  }

  function handleRemovePair(pairId: string) {
    removeActiveMobilePair(pairId)
    setActivePairs(listActiveMobilePairs())
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border/80 bg-card/95 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-4xl">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">capture surfaces</Badge>
              <Badge variant="outline">desktop pair</Badge>
              <Badge variant="outline">QR + link</Badge>
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Mobile Camera Pair</h1>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              Page này tách riêng flow pair trên desktop: chọn lane/device, tạo token, render QR, copy link và quản lý active pair list. Nó không trộn với capture debug hay mobile capture surface nữa.
            </p>
          </div>

          <div className="rounded-2xl border border-border/80 bg-background/40 p-4 text-sm text-muted-foreground">
            Dùng page này trên desktop. Điện thoại chỉ mở route <span className="font-mono-data">/mobile-capture</span>.
          </div>
        </div>
      </div>

      {message ? (
        <div className="rounded-2xl border border-border/80 bg-card/95 px-4 py-3 text-sm text-foreground">
          {message}
        </div>
      ) : null}

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
            }}
          />

          <div className="rounded-3xl border border-border/80 bg-card/95 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.12)]">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="muted">pair actions</Badge>
              <Badge variant="outline">local registry</Badge>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" onClick={handleCreatePair} disabled={busy || !pairUrl}>
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

        <MobileQrCard
          pairUrl={pairUrl}
          copied={copied}
          onCopy={() => void handleCopyPairUrl()}
          onOpen={() => handleOpenPairUrl()}
        />
      </div>

      <ActivePairsTable
        rows={activePairs}
        onOpen={(row) => handleOpenPairUrl(row.pairUrl, row.pairId)}
        onCopy={(row) => void copyText(row.pairUrl)}
        onRemove={handleRemovePair}
      />
    </div>
  )
}
