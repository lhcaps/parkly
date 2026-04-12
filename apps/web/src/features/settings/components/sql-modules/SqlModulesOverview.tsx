import {
  Box,
  DatabaseZap,
  GitBranch,
  Layers3,
  Link2,
  LockKeyhole,
  RefreshCcw,
  Sparkles,
} from 'lucide-react'

import { InlineMessage } from '@/components/ops/console'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

import {
  statusVariant,
  t2,
  type SqlModuleLabels,
  type SqlSurfaceData,
} from './sqlModules.utils'

function ReadinessStat({
  title,
  value,
  minimum,
  ok,
  icon: Icon,
  isEn,
}: {
  title: string
  value: number
  minimum?: number | null
  ok: boolean
  icon: typeof DatabaseZap
  isEn: boolean
}) {
  return (
    <div className="rounded-[1.5rem] border border-border/70 bg-background/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {minimum != null ? (
          <>
            <Badge variant={statusVariant(ok, value, minimum)}>
              {ok ? t2(isEn, 'đạt chuẩn', 'ready') : t2(isEn, `thiếu ${Math.max(0, minimum - value)}`, `missing ${Math.max(0, minimum - value)}`)}
            </Badge>
            <Badge variant="outline">{minimum}</Badge>
          </>
        ) : (
          <Badge variant="outline">{t2(isEn, 'tham khảo', 'reference')}</Badge>
        )}
      </div>
    </div>
  )
}

function SignalCard({
  title,
  value,
  badge,
  icon: Icon,
}: {
  title: string
  value: string | number
  badge: React.ReactNode
  icon: typeof DatabaseZap
}) {
  return (
    <div className="rounded-[1.4rem] border border-border/70 bg-background/45 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3">{badge}</div>
    </div>
  )
}

export function SqlModulesOverview({
  data,
  labels,
  isEn,
  isFetching,
  onRefresh,
}: {
  data: SqlSurfaceData
  labels: SqlModuleLabels
  isEn: boolean
  isFetching: boolean
  onRefresh: () => Promise<void> | void
}) {
  const packageCount = data.moduleGroups.length
  const scopeLabel = data.siteScope.requestedSiteCode ?? `${data.siteScope.siteCount} ${labels.site}`

  return (
    <Card className="overflow-hidden border-border/80 bg-card/95 shadow-[0_24px_72px_rgba(35,94,138,0.14)]">
      <div className="bg-[radial-gradient(circle_at_top_left,_rgba(58,130,198,0.18),_transparent_52%),linear-gradient(90deg,rgba(58,130,198,0.10),transparent)] px-6 py-5">
        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                    <DatabaseZap className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">SQL</p>
                    <h3 className="text-2xl font-semibold tracking-tight">{labels.title}</h3>
                  </div>
                </div>

                <p className="text-sm leading-relaxed text-muted-foreground">{labels.desc}</p>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{labels.minBadge}</Badge>
                  <Badge variant="secondary">{data.schemaVersion == null ? 'Schema' : `v${data.schemaVersion}`}</Badge>
                  <Badge variant="outline">{scopeLabel}</Badge>
                </div>
              </div>

              <Button
                variant="outline"
                onClick={() => void onRefresh()}
                disabled={isFetching}
                className="gap-2"
                data-testid="sql-surface-refresh"
              >
                <RefreshCcw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                {labels.refresh}
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <SignalCard
              title={labels.triggerSignal}
              value={data.triggerGap.missingCount}
              icon={GitBranch}
              badge={
                <Badge variant={data.triggerGap.missingCount > 0 ? 'destructive' : 'secondary'}>
                  {data.triggerGap.missingCount > 0 ? labels.triggerGap : labels.triggerOk}
                </Badge>
              }
            />
            <SignalCard
              title={labels.packageSignal}
              value={packageCount}
              icon={Box}
              badge={<Badge variant="secondary">{t2(isEn, 'đã map module', 'mapped modules')}</Badge>}
            />
            <SignalCard
              title={labels.constraintSignal}
              value={data.counts.constraints}
              icon={Link2}
              badge={<Badge variant="outline">FK / PK / UNIQUE</Badge>}
            />
            <SignalCard
              title={labels.scopeSignal}
              value={data.siteScope.isAllSites ? data.siteScope.siteCount : scopeLabel}
              icon={LockKeyhole}
              badge={
                <Badge variant={data.siteScope.isAllSites ? 'secondary' : 'outline'}>
                  {data.siteScope.isAllSites ? t2(isEn, 'toàn site', 'all sites') : t2(isEn, 'lọc theo site', 'site filtered')}
                </Badge>
              }
            />
          </div>
        </div>
      </div>

      <CardContent className="space-y-6 pt-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ReadinessStat title="Views" value={data.counts.views} minimum={data.minimumPerType} ok={data.readiness.viewsReady} icon={Layers3} isEn={isEn} />
          <ReadinessStat title="Procedures" value={data.counts.procedures} minimum={data.minimumPerType} ok={data.readiness.proceduresReady} icon={Sparkles} isEn={isEn} />
          <ReadinessStat title="Triggers" value={data.counts.triggers} minimum={data.minimumPerType} ok={data.readiness.triggersReady} icon={GitBranch} isEn={isEn} />
          <ReadinessStat title="Constraints" value={data.counts.constraints} minimum={null} ok icon={Link2} isEn={isEn} />
        </div>

        {data.triggerGap.missingCount > 0 ? (
          <div className="space-y-4 rounded-[1.7rem] border border-primary/20 bg-primary/6 p-5">
            <InlineMessage tone="warning">
              <div>
                <p className="font-semibold">{labels.triggerGap}</p>
                <p className="mt-1 text-sm text-muted-foreground">{labels.runbookDesc}</p>
              </div>
            </InlineMessage>

            <div className="grid gap-4 xl:grid-cols-[1.12fr_0.88fr]">
              <div className="rounded-[1.4rem] border border-border/70 bg-card/90 p-5">
                <p className="text-sm font-semibold">{labels.runbookTitle}</p>
                <div className="mt-4 space-y-3">
                  {data.triggerGap.commands.map((command, index) => (
                    <div key={command} className="rounded-2xl border border-border/70 bg-background/55 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        {index + 1}. Command
                      </p>
                      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all font-mono-data text-xs text-foreground">
                        {command}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.4rem] border border-border/70 bg-card/90 p-5">
                <p className="text-sm font-semibold">Trigger</p>
                <div className="mt-4 space-y-3">
                  <div className="flex items-start justify-between gap-3 rounded-2xl border border-border/70 bg-background/55 px-4 py-3">
                    <div>
                      <p className="font-mono-data text-sm font-semibold">{data.triggerGap.requiredTriggerName}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{data.triggerGap.scriptPath}</p>
                    </div>
                    <Badge variant="destructive">{data.counts.triggers}/{data.minimumPerType}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="amber">
                      {t2(isEn, `thiếu ${data.triggerGap.missingCount}`, `missing ${data.triggerGap.missingCount}`)}
                    </Badge>
                    <Badge variant="outline">
                      {data.triggerGap.trustFunctionCreatorsEnabled === null
                        ? 'log_bin_trust_function_creators = unknown'
                        : `log_bin_trust_function_creators = ${data.triggerGap.trustFunctionCreatorsEnabled ? 'ON' : 'OFF'}`}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <InlineMessage tone="success">
            <div>
              <p className="font-semibold">{labels.triggerOk}</p>
              <p className="mt-1 text-sm text-muted-foreground">{labels.triggerReadyDesc}</p>
            </div>
          </InlineMessage>
        )}
      </CardContent>
    </Card>
  )
}
