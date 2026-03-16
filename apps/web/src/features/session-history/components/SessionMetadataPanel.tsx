import { Link } from 'react-router-dom'
import { ArrowRightLeft, CircleDot, ClipboardCheck, RadioTower, Ticket } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { SessionDetail } from '@/lib/contracts/sessions'
import {
  formatDateTime,
  formatNumber,
  readLatestDecision,
  readLatestRead,
  readPrimaryDeviceCode,
  sessionVariant,
} from '@/features/session-history/session-history-model'

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-3 first:pt-0 last:border-b-0 last:pb-0">
      <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="max-w-[68%] break-all text-right text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

export function SessionMetadataPanel({ detail }: { detail: SessionDetail }) {
  const latestDecision = readLatestDecision(detail)
  const latestRead = readLatestRead(detail)
  const deviceCode = readPrimaryDeviceCode(detail)

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,0.72fr)_minmax(320px,0.28fr)]">
      <Card className="border-border/80 bg-card/95">
        <CardHeader>
          <CardTitle>Metadata panel</CardTitle>
          <CardDescription>
            Core operational fields for triage — no raw log reading required.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant={detail.session.direction === 'ENTRY' ? 'entry' : 'exit'}>
              <ArrowRightLeft className="h-3.5 w-3.5" />
              {detail.session.direction}
            </Badge>
            <Badge variant={sessionVariant(detail.session.status)}>{detail.session.status}</Badge>
            {detail.session.reviewRequired ? <Badge variant="amber">review required</Badge> : null}
            {detail.incidents.length > 0 ? <Badge variant="destructive">incident {detail.incidents.length}</Badge> : null}
            {detail.manualReviews.length > 0 ? <Badge variant="outline">review refs {detail.manualReviews.length}</Badge> : null}
          </div>

          <div className="rounded-3xl border border-border/80 bg-muted/25 p-4">
            <MetadataRow label="Session" value={String(detail.session.sessionId)} />
            <MetadataRow label="Plate" value={detail.session.plateCompact || '—'} />
            <MetadataRow label="Ticket" value={detail.session.ticketId || '—'} />
            <MetadataRow label="Correlation" value={detail.session.correlationId || '—'} />
            <MetadataRow label="Site / gate / lane" value={`${detail.session.siteCode} / ${detail.session.gateCode} / ${detail.session.laneCode}`} />
            <MetadataRow label="Device" value={deviceCode} />
            <MetadataRow label="Opened" value={formatDateTime(detail.session.openedAt)} />
            <MetadataRow label="Last read" value={formatDateTime(detail.session.lastReadAt)} />
            <MetadataRow label="Resolved" value={formatDateTime(detail.session.resolvedAt)} />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card className="border-border/80 bg-card/95">
          <CardHeader>
            <CardTitle>Latest decision</CardTitle>
            <CardDescription>If not yet resolved, this block shows where the session is stuck.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {latestDecision ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="amber">{latestDecision.decisionCode}</Badge>
                  <Badge variant="outline">{latestDecision.finalAction || latestDecision.recommendedAction}</Badge>
                </div>
                <p className="text-sm text-foreground">{latestDecision.explanation}</p>
                <p className="text-xs text-muted-foreground">
                  {latestDecision.reasonCode}
                  {latestDecision.reasonDetail ? ` · ${latestDecision.reasonDetail}` : ''}
                </p>
                <p className="text-xs text-muted-foreground">created {formatDateTime(latestDecision.createdAt)}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No decisions yet — session is likely in a waiting state. ở đầu flow hoặc upstream chưa đủ dữ kiện.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95">
          <CardHeader>
            <CardTitle>Ops quick refs</CardTitle>
            <CardDescription>Next investigation links based on current lineage.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3 rounded-2xl border border-border/80 bg-background/40 px-4 py-3">
              <CircleDot className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div className="min-w-0 text-sm">
                <p className="font-medium text-foreground">Read lineage</p>
                <p className="mt-1 text-muted-foreground">
                  {latestRead
                    ? `${latestRead.readType} · ${formatDateTime(latestRead.occurredAt)} · device ${latestRead.evidence.sourceDeviceCode || latestRead.deviceId || '—'}`
                    : 'No reads in this session.'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-border/80 bg-background/40 px-4 py-3">
              <Ticket className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div className="min-w-0 text-sm">
                <p className="font-medium text-foreground">Session counters</p>
                <p className="mt-1 text-muted-foreground">
                  reads {detail.session.readCount} · decisions {detail.session.decisionCount} · barriers {detail.session.barrierCommandCount}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  presence={detail.session.presenceActive ? 'active' : 'released'} · RFID={detail.session.rfidUid || '—'}
                </p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button asChild variant="outline" size="sm">
                <Link to={`/review-queue?siteCode=${encodeURIComponent(detail.session.siteCode)}&q=${encodeURIComponent(detail.session.sessionId)}`}>
                  <ClipboardCheck className="h-4 w-4" />
                  Open Review Queue
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/sync-outbox">
                  <RadioTower className="h-4 w-4" />
                  Open Sync Outbox
                </Link>
              </Button>
            </div>

            <div className="rounded-2xl border border-border/80 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
              correlation={detail.session.correlationId || '—'} · decision density={formatNumber(detail.session.decisionCount)} · barrier density={formatNumber(detail.session.barrierCommandCount)}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
