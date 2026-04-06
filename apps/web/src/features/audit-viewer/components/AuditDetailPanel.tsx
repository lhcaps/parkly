import { ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  actorHeadline,
  entityHeadline,
  formatDateTime,
  prettyJson,
  summarizeAudit,
  toneForAction,
} from '@/features/audit-viewer/audit-viewer-model'
import type { AuditRecord } from '@/lib/contracts/audit'

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
      <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 break-all text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

export function AuditDetailPanel({
  selected,
  loading,
  error,
  onRefresh,
}: {
  selected: AuditRecord | null
  loading: boolean
  error: string
  onRefresh: () => void
}) {
  const { t } = useTranslation()

  if (!selected) {
    return (
      <Card className="border-border/80 bg-card/95 shadow-[0_18px_60px_rgba(35,94,138,0.12)] xl:sticky xl:top-20 xl:self-start">
        <CardHeader>
          <CardTitle>{t('auditViewer.detail.title')}</CardTitle>
          <CardDescription>{t('auditViewer.detail.emptyDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-2xl border border-dashed border-border/80 bg-background/40 px-4 py-12 text-center text-sm text-muted-foreground">
            {t('auditViewer.detail.emptyHint')}
          </div>
        </CardContent>
      </Card>
    )
  }

  const summary = summarizeAudit(selected)

  return (
    <Card className="border-border/80 bg-card/95 shadow-[0_18px_60px_rgba(35,94,138,0.12)] xl:sticky xl:top-20 xl:self-start">
      <CardHeader className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{t('auditViewer.detail.title')}</CardTitle>
            <CardDescription>{t('auditViewer.detail.description')}</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {t('common.refresh')}
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant={toneForAction(selected.action)}>{selected.action}</Badge>
          <Badge variant="outline">{t('auditViewer.detail.siteBadge', { value: selected.siteCode || t('common.dash') })}</Badge>
          <Badge variant="muted">{t('auditViewer.detail.auditBadge', { value: selected.auditId })}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {error ? <div className="rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div> : null}

        <div className="grid gap-3 md:grid-cols-2">
          <SummaryCell label={t('auditViewer.detail.actor')} value={actorHeadline(selected.actor, selected.actorUserId)} />
          <SummaryCell label={t('auditViewer.detail.entity')} value={entityHeadline(selected)} />
          <SummaryCell label={t('auditViewer.detail.request')} value={selected.requestId || t('common.dash')} />
          <SummaryCell label={t('auditViewer.detail.correlation')} value={selected.correlationId || t('common.dash')} />
          <SummaryCell label={t('auditViewer.detail.occurred')} value={formatDateTime(selected.occurredAt)} />
          <SummaryCell label={t('auditViewer.detail.created')} value={formatDateTime(selected.createdAt)} />
        </div>

        <div className="rounded-3xl border border-border/80 bg-background/35 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{t('auditViewer.detail.changedKeysBadge', { count: summary.changedKeys.length })}</Badge>
            <Badge variant="outline">{t('auditViewer.detail.beforeBadge', { count: summary.beforeKeys })}</Badge>
            <Badge variant="outline">{t('auditViewer.detail.afterBadge', { count: summary.afterKeys })}</Badge>
            <Badge variant="outline">{t('auditViewer.detail.familyBadge', { value: summary.actionFamily })}</Badge>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {summary.changedKeys.length > 0
              ? t('auditViewer.detail.changedFields', { value: summary.changedKeys.join(', ') })
              : t('auditViewer.detail.noDiff')}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {selected.correlationId ? (
            <Button variant="outline" size="sm" asChild>
              <Link to={`/sync-outbox?correlationId=${encodeURIComponent(selected.correlationId)}`}>
                {t('auditViewer.detail.openOutbox')}
                <ExternalLink className="h-4 w-4" />
              </Link>
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/session-history?q=${encodeURIComponent(selected.entityId)}`}>
              {t('auditViewer.detail.openSessions')}
              <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <Tabs defaultValue="diff" className="space-y-4">
          <TabsList>
            <TabsTrigger value="diff">{t('auditViewer.detail.tabs.diff')}</TabsTrigger>
            <TabsTrigger value="before">{t('auditViewer.detail.tabs.before')}</TabsTrigger>
            <TabsTrigger value="after">{t('auditViewer.detail.tabs.after')}</TabsTrigger>
            <TabsTrigger value="actor">{t('auditViewer.detail.tabs.actor')}</TabsTrigger>
          </TabsList>

          <TabsContent value="diff">
            <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
              <pre className="overflow-x-auto text-[11px] leading-5 text-foreground">{prettyJson({
                changedKeys: summary.changedKeys,
                requestId: selected.requestId,
                correlationId: selected.correlationId,
                action: selected.action,
                entity: { table: selected.entityTable, id: selected.entityId },
              })}</pre>
            </div>
          </TabsContent>

          <TabsContent value="before">
            <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
              <pre className="overflow-x-auto text-[11px] leading-5 text-foreground">{prettyJson(selected.beforeSnapshot)}</pre>
            </div>
          </TabsContent>

          <TabsContent value="after">
            <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
              <pre className="overflow-x-auto text-[11px] leading-5 text-foreground">{prettyJson(selected.afterSnapshot)}</pre>
            </div>
          </TabsContent>

          <TabsContent value="actor">
            <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
              <pre className="overflow-x-auto text-[11px] leading-5 text-foreground">{prettyJson(selected.actor)}</pre>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
