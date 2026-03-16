import { ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  formatDateTime,
  outboxStatusVariant,
  prettyJson,
  summarizeFailure,
  type OutboxTriageRecord,
} from '@/features/outbox-monitor/outbox-triage-model'

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
      <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 break-all text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

export function OutboxDetailPanel({ selected }: { selected: OutboxTriageRecord | null }) {
  if (!selected) {
    return (
      <Card className="border-border/80 bg-card/95 shadow-[0_18px_60px_rgba(0,0,0,0.12)] xl:sticky xl:top-20 xl:self-start">
        <CardHeader>
          <CardTitle>Outbox detail</CardTitle>
          <CardDescription>Select an outbox record to view triage summary, correlation, retry details, and payload..</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-2xl border border-dashed border-border/80 bg-background/40 px-4 py-12 text-center text-sm text-muted-foreground">
            The detail panel shows why a record failed, its correlation, and which audit or session to investigate next..
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border/80 bg-card/95 shadow-[0_18px_60px_rgba(0,0,0,0.12)] xl:sticky xl:top-20 xl:self-start">
      <CardHeader className="space-y-4">
        <div>
          <CardTitle>Outbox detail</CardTitle>
          <CardDescription>Focus on root cause, retry timeline, and investigation path — not just raw JSON.ỉ xả raw payload.</CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={outboxStatusVariant(selected.status)}>{selected.status}</Badge>
          <Badge variant="outline">attempts {selected.attempts}</Badge>
          <Badge variant="muted">{selected.source}</Badge>
          {selected.reviewRequired ? <Badge variant="amber">review</Badge> : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="rounded-3xl border border-border/80 bg-background/35 p-4">
          <p className="text-sm font-semibold text-foreground">Failure summary</p>
          <p className="mt-2 text-sm text-muted-foreground">{summarizeFailure(selected)}</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <SummaryCell label="Outbox" value={selected.outboxId} />
          <SummaryCell label="Event" value={selected.eventId} />
          <SummaryCell label="Site / Lane" value={`${selected.siteCode || '—'} / ${selected.laneCode || '—'}`} />
          <SummaryCell label="Device / Plate" value={`${selected.deviceCode || '—'} / ${selected.plate || '—'}`} />
          <SummaryCell label="Correlation" value={selected.correlationId || '—'} />
          <SummaryCell label="Request" value={selected.requestId || '—'} />
          <SummaryCell label="Action / Entity" value={`${selected.action || '—'} / ${selected.entityTable || '—'}:${selected.entityId || '—'}`} />
          <SummaryCell label="Times" value={`updated ${formatDateTime(selected.updatedAt)} · retry ${formatDateTime(selected.nextRetryAt)}`} />
        </div>

        <div className="flex flex-wrap gap-2">
          {selected.correlationId ? (
            <Button variant="outline" size="sm" asChild>
              <Link to={`/audit-viewer?correlationId=${encodeURIComponent(selected.correlationId)}`}>
                Audit by correlation
                <ExternalLink className="h-4 w-4" />
              </Link>
            </Button>
          ) : null}
          {selected.requestId ? (
            <Button variant="outline" size="sm" asChild>
              <Link to={`/audit-viewer?requestId=${encodeURIComponent(selected.requestId)}`}>
                Audit by request
                <ExternalLink className="h-4 w-4" />
              </Link>
            </Button>
          ) : null}
          {selected.sessionId ? (
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/session-history?sessionId=${encodeURIComponent(selected.sessionId)}`}>
                Session history
                <ExternalLink className="h-4 w-4" />
              </Link>
            </Button>
          ) : null}
        </div>

        <Tabs defaultValue="summary" className="space-y-4">
          <TabsList>
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="payload">Payload</TabsTrigger>
            <TabsTrigger value="transport">Transport</TabsTrigger>
          </TabsList>

          <TabsContent value="summary">
            <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
              <pre className="overflow-x-auto text-[11px] leading-5 text-foreground">{prettyJson({
                source: selected.source,
                status: selected.status,
                attempts: selected.attempts,
                correlationId: selected.correlationId,
                requestId: selected.requestId,
                action: selected.action,
                entityTable: selected.entityTable,
                entityId: selected.entityId,
                sessionId: selected.sessionId,
                reviewRequired: selected.reviewRequired,
              })}</pre>
            </div>
          </TabsContent>

          <TabsContent value="payload">
            <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
              <pre className="overflow-x-auto text-[11px] leading-5 text-foreground">{prettyJson(selected.payload)}</pre>
            </div>
          </TabsContent>

          <TabsContent value="transport">
            <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
              <pre className="overflow-x-auto text-[11px] leading-5 text-foreground">{prettyJson({
                eventTime: selected.eventTime,
                createdAt: selected.createdAt,
                updatedAt: selected.updatedAt,
                sentAt: selected.sentAt,
                nextRetryAt: selected.nextRetryAt,
                mongoDocId: selected.mongoDocId,
                lastError: selected.lastError,
              })}</pre>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
