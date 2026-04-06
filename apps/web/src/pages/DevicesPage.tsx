import { useEffect, useMemo, useState } from 'react'
import { Activity, Cpu, MapPinned, RefreshCw, ServerCog, Unplug } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { getDevices, getGates, getHealth, getLanes, getSites, type DeviceRow, type GateRow, type LaneRow, type SiteRow } from '@/lib/api'

type SiteTopology = {
  site: SiteRow
  gates: GateRow[]
  lanes: LaneRow[]
  devices: DeviceRow[]
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
      <p className="mb-2 text-[11px] font-mono-data uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="font-mono-data text-2xl font-semibold text-foreground">{value}</p>
    </div>
  )
}

function heartbeatVariant(status: string | null): 'entry' | 'amber' | 'destructive' | 'muted' {
  if (status === 'ONLINE') return 'entry'
  if (status === 'DEGRADED' || status === 'MAINTENANCE') return 'amber'
  if (status === 'OFFLINE') return 'destructive'
  return 'muted'
}

export function DevicesPage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language.startsWith('en') ? 'en-GB' : 'vi-VN'
  const [topology, setTopology] = useState<SiteTopology[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [health, setHealth] = useState<string>('')

  async function load() {
    try {
      setLoading(true)
      setError('')
      const siteRes = await getSites()
      const items = await Promise.all(
        siteRes.rows.map(async (site) => {
          const [gateRes, laneRes, deviceRes] = await Promise.all([
            getGates(site.siteCode),
            getLanes(site.siteCode),
            getDevices({ siteCode: site.siteCode }),
          ])
          return { site, gates: gateRes.rows, lanes: laneRes.rows, devices: deviceRes.rows }
        }),
      )
      setTopology(items)

      try {
        const healthRes = await getHealth()
        setHealth(new Date(healthRes.ts).toLocaleString(locale))
      } catch {
        setHealth(t('devicesPage.unavailable'))
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError))
      setTopology([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const totals = useMemo(() => {
    const siteCount = topology.length
    const gateCount = topology.reduce((acc, item) => acc + item.gates.length, 0)
    const laneCount = topology.reduce((acc, item) => acc + item.lanes.length, 0)
    const deviceCount = topology.reduce((acc, item) => acc + item.devices.length, 0)
    const heartbeatCount = topology.reduce((acc, item) => acc + item.devices.filter((device) => device.heartbeatStatus).length, 0)
    return { siteCount, gateCount, laneCount, deviceCount, heartbeatCount }
  }, [topology])

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t('devicesPage.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('devicesPage.description')}</p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          {t('devicesPage.refresh')}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <Metric label={t('devicesPage.metrics.sites')} value={totals.siteCount} />
        <Metric label={t('devicesPage.metrics.gates')} value={totals.gateCount} />
        <Metric label={t('devicesPage.metrics.lanes')} value={totals.laneCount} />
        <Metric label={t('devicesPage.metrics.devices')} value={totals.deviceCount} />
        <Metric label={t('devicesPage.metrics.heartbeats')} value={totals.heartbeatCount} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>{t('devicesPage.topology.title')}</CardTitle>
            <CardDescription>{t('devicesPage.topology.description')}</CardDescription>
          </CardHeader>
          <Separator />
          <CardContent className="space-y-4 pt-5">
            {loading ? (
              <div className="text-sm text-muted-foreground">{t('devicesPage.topology.loading')}</div>
            ) : topology.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                {t('devicesPage.topology.empty')}
              </div>
            ) : (
              topology.map((item) => (
                <div key={item.site.siteCode} className="rounded-xl border border-border bg-card/80">
                  <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
                    <Badge variant="secondary">{item.site.siteCode}</Badge>
                    <p className="font-medium text-foreground">{item.site.name}</p>
                    <span className="text-xs text-muted-foreground">{item.site.timezone}</span>
                  </div>
                  <div className="space-y-3 p-4">
                    {item.gates.map((gate) => {
                      const gateLanes = item.lanes.filter((lane) => lane.gateCode === gate.gateCode)
                      return (
                        <div key={gate.gateCode} className="rounded-lg border border-border bg-muted/20 px-4 py-3">
                          <div className="mb-3 flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{gate.gateCode}</Badge>
                            <span className="text-sm text-muted-foreground">{gate.label}</span>
                            {gate.directions.map((direction) => (
                              <Badge key={direction} variant={direction === 'ENTRY' ? 'entry' : 'exit'}>
                                {direction}
                              </Badge>
                            ))}
                          </div>
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            {gateLanes.map((lane) => {
                              const laneDevices = item.devices.filter((device) => device.laneCode === lane.laneCode)
                              return (
                                <div key={`${lane.gateCode}:${lane.laneCode}`} className="rounded-lg border border-border/70 bg-background/40 px-3 py-3">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant={lane.direction === 'ENTRY' ? 'entry' : 'exit'}>{lane.laneCode}</Badge>
                                    <Badge variant="muted">{lane.deviceType || 'UNKNOWN'}</Badge>
                                    <Badge variant="outline">{lane.primaryDeviceCode ?? lane.deviceCode}</Badge>
                                  </div>
                                  <p className="mt-2 text-xs text-muted-foreground">
                                    {lane.label}
                                    {lane.locationHint ? ` | ${lane.locationHint}` : ''}
                                  </p>
                                  <div className="mt-3 space-y-2">
                                    {laneDevices.length === 0 ? (
                                      <div className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                                        {t('devicesPage.topology.noMappedDevices')}
                                      </div>
                                    ) : (
                                      laneDevices.map((device) => (
                                        <div key={device.deviceCode} className="flex flex-wrap items-center gap-2 rounded-md border border-border/70 px-3 py-2 text-xs">
                                          <Badge variant={device.isPrimary ? 'secondary' : 'outline'}>
                                            {device.deviceRole ?? t('devicesPage.topology.unassigned')}
                                          </Badge>
                                          <span className="font-mono-data text-foreground">{device.deviceCode}</span>
                                          <Badge variant={heartbeatVariant(device.heartbeatStatus)}>
                                            {device.heartbeatStatus ?? t('devicesPage.topology.noHeartbeat')}
                                          </Badge>
                                          {typeof device.heartbeatAgeSeconds === 'number' && (
                                            <span className="text-muted-foreground">
                                              {t('devicesPage.topology.age', { count: device.heartbeatAgeSeconds })}
                                            </span>
                                          )}
                                          {typeof device.latencyMs === 'number' && (
                                            <span className="text-muted-foreground">
                                              {t('devicesPage.topology.latency', { count: device.latencyMs })}
                                            </span>
                                          )}
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>{t('devicesPage.realityCheck.title')}</CardTitle>
              <CardDescription>{t('devicesPage.realityCheck.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-foreground/85">
              <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
                <div className="flex items-center gap-2">
                  <ServerCog className="h-4 w-4 text-muted-foreground" />
                  <p className="font-medium">{t('devicesPage.realityCheck.health.title')}</p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{t('devicesPage.realityCheck.health.description', { value: health || '—' })}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-muted-foreground" />
                  <p className="font-medium">{t('devicesPage.realityCheck.api.title')}</p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{t('devicesPage.realityCheck.api.description')}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <p className="font-medium">{t('devicesPage.realityCheck.heartbeat.title')}</p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{t('devicesPage.realityCheck.heartbeat.description')}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
                <div className="flex items-center gap-2">
                  <MapPinned className="h-4 w-4 text-muted-foreground" />
                  <p className="font-medium">{t('devicesPage.realityCheck.aggregate.title')}</p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{t('devicesPage.realityCheck.aggregate.description')}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Unplug className="h-4 w-4 text-muted-foreground" />
                  <p className="font-medium">{t('devicesPage.realityCheck.links.title')}</p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{t('devicesPage.realityCheck.links.description')}</p>
              </div>
            </CardContent>
          </Card>

          {error && (
            <Card>
              <CardContent className="pt-5 text-sm text-destructive">{error}</CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
