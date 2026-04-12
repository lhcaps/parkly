import { Gauge, PlayCircle, TimerReset } from 'lucide-react'

import { InlineMessage } from '@/components/ops/console'
import { DangerConfirmDialog } from '@/components/state/danger-confirm-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, type SelectOption } from '@/components/ui/select'
import type { SqlAuthCleanupResult, SqlPricingQuoteResult } from '@/lib/api/sql-surface'

import { type SqlModuleLabels, vnd } from './sqlModules.utils'

function MiniMetric({
  label,
  value,
  focus = false,
}: {
  label: string
  value: string | number
  focus?: boolean
}) {
  return (
    <div className={`rounded-2xl border px-4 py-3 ${focus ? 'border-primary/30 bg-primary/8' : 'border-border/70 bg-background/35'}`}>
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-semibold tracking-tight">{value}</p>
    </div>
  )
}

export function SqlModulesStudio({
  labels,
  locale,
  canManage,
  cleanupPending,
  cleanupData,
  onRunCleanup,
  siteCode,
  onSiteCodeChange,
  siteOptions,
  vehicleType,
  onVehicleTypeChange,
  vehicleOptions,
  entryTime,
  onEntryTimeChange,
  exitTime,
  onExitTimeChange,
  quotePending,
  quoteResult,
  onRunQuote,
}: {
  labels: SqlModuleLabels
  locale: string
  canManage: boolean
  cleanupPending: boolean
  cleanupData?: SqlAuthCleanupResult
  onRunCleanup: () => Promise<unknown>
  siteCode: string
  onSiteCodeChange: (value: string) => void
  siteOptions: SelectOption[]
  vehicleType: 'CAR' | 'MOTORBIKE'
  onVehicleTypeChange: (value: 'CAR' | 'MOTORBIKE') => void
  vehicleOptions: SelectOption[]
  entryTime: string
  onEntryTimeChange: (value: string) => void
  exitTime: string
  onExitTimeChange: (value: string) => void
  quotePending: boolean
  quoteResult?: SqlPricingQuoteResult
  onRunQuote: () => void
}) {
  return (
    <Card className="border-border/80 bg-card/95 shadow-[0_18px_56px_rgba(35,94,138,0.08)]">
      <CardHeader className="space-y-1">
        <CardTitle className="text-base font-semibold tracking-tight">{labels.procedureStudio}</CardTitle>
        <p className="text-sm text-muted-foreground">{labels.procedureStudioDesc}</p>
      </CardHeader>

      <CardContent className="space-y-4">
        {!canManage ? (
          <InlineMessage tone="info">
            <div>
              <p className="font-semibold">{labels.procedureStudio}</p>
              <p className="mt-1 text-sm text-muted-foreground">{labels.inspectOnly}</p>
            </div>
          </InlineMessage>
        ) : null}

        <div className="grid gap-4 2xl:grid-cols-2">
          <section className="rounded-[1.45rem] border border-border/70 bg-background/40 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                <TimerReset className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{labels.cleanup}</p>
                <p className="mt-1 text-sm text-muted-foreground">{labels.cleanupDesc}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="outline">expired: {cleanupData?.retentionDays.expired ?? 3}d</Badge>
              <Badge variant="outline">revoked: {cleanupData?.retentionDays.revoked ?? 30}d</Badge>
            </div>

            <div className="mt-4">
              <DangerConfirmDialog
                title={labels.cleanupConfirmTitle}
                description={labels.cleanupConfirmDesc}
                confirmLabel={labels.cleanupBtn}
                cancelLabel={labels.confirmCancel}
                tone="warning"
                disabled={!canManage}
                busy={cleanupPending}
                dialogTestId="sql-auth-cleanup-dialog"
                cancelTestId="sql-auth-cleanup-cancel"
                confirmTestId="sql-auth-cleanup-confirm"
                meta={
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">expired: {cleanupData?.retentionDays.expired ?? 3}d</Badge>
                    <Badge variant="outline">revoked: {cleanupData?.retentionDays.revoked ?? 30}d</Badge>
                  </div>
                }
                onConfirm={async () => {
                  await onRunCleanup()
                }}
                trigger={({ onClick, disabled, ...triggerProps }) => (
                  <Button
                    className="w-full gap-2"
                    onClick={onClick}
                    disabled={disabled}
                    data-testid="sql-auth-cleanup-trigger"
                    {...triggerProps}
                  >
                    <PlayCircle className={`h-4 w-4 ${cleanupPending ? 'animate-pulse' : ''}`} />
                    {labels.cleanupBtn}
                  </Button>
                )}
              />
            </div>

            {cleanupData ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <MiniMetric label="Expired" value={cleanupData.deletedExpired} />
                <MiniMetric label="Revoked" value={cleanupData.deletedRevoked} />
              </div>
            ) : null}
          </section>

          <section className="rounded-[1.45rem] border border-border/70 bg-background/40 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                <Gauge className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{labels.quote}</p>
                <p className="mt-1 text-sm text-muted-foreground">{labels.quoteDesc}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{labels.site}</label>
                <Select value={siteCode} onChange={onSiteCodeChange} options={siteOptions} placeholder={labels.site} />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{labels.vehicleType}</label>
                <Select
                  value={vehicleType}
                  onChange={(value) => onVehicleTypeChange(value as 'CAR' | 'MOTORBIKE')}
                  options={vehicleOptions}
                  placeholder={labels.vehicleType}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{labels.entry}</label>
                  <Input type="datetime-local" value={entryTime} onChange={(event) => onEntryTimeChange(event.target.value)} />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{labels.exit}</label>
                  <Input type="datetime-local" value={exitTime} onChange={(event) => onExitTimeChange(event.target.value)} />
                </div>
              </div>
            </div>

            <Button
              className="mt-4 w-full gap-2"
              disabled={!siteCode || quotePending}
              data-testid="sql-pricing-quote-trigger"
              onClick={onRunQuote}
            >
              <PlayCircle className={`h-4 w-4 ${quotePending ? 'animate-pulse' : ''}`} />
              {labels.quoteBtn}
            </Button>

            {quoteResult ? (
              <div className="mt-4 space-y-3 rounded-2xl border border-border/70 bg-background/40 p-4" data-testid="sql-pricing-quote-result">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{quoteResult.siteCode}</Badge>
                  <Badge variant="outline">{vehicleType}</Badge>
                  <Badge variant={quoteResult.tariffId ? 'outline' : 'amber'}>
                    {quoteResult.tariffId ? `Tariff #${quoteResult.tariffId}` : labels.noTariff}
                  </Badge>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <MiniMetric label="Minutes" value={quoteResult.minutes} />
                  <MiniMetric label="Free" value={quoteResult.freeMinutes} />
                  <MiniMetric label="Per hour" value={vnd(quoteResult.perHour, locale)} />
                  <MiniMetric label="Daily cap" value={quoteResult.dailyCap == null ? '--' : vnd(quoteResult.dailyCap, locale)} />
                  <MiniMetric label="Subtotal" value={vnd(quoteResult.subtotal, locale)} />
                  <MiniMetric label="Total" value={vnd(quoteResult.total, locale)} focus />
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-border/70 bg-background/35 px-4 py-5 text-sm text-muted-foreground">
                {labels.noQuote}
              </div>
            )}
          </section>
        </div>
      </CardContent>
    </Card>
  )
}
