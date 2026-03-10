import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { SessionDetail } from '@/lib/contracts/sessions'

function Section({
  title,
  description,
  empty,
  children,
}: {
  title: string
  description: string
  empty: string
  children: ReactNode
}) {
  return (
    <Card className="border-border/80 bg-card/95">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {children || <p className="text-sm text-muted-foreground">{empty}</p>}
      </CardContent>
    </Card>
  )
}

export function SessionDetailConsole({ detail }: { detail: SessionDetail }) {
  const mediaRows = detail.reads.filter((read) => read.evidence.media || read.evidence.cameraFrameRef || read.evidence.cropRef)

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <Section title="Reads" description="Read events theo thời gian và thiết bị nguồn." empty="Không có read event.">
        {detail.reads.length === 0 ? <p className="text-sm text-muted-foreground">Không có read event.</p> : (
          <div className="space-y-3">
            {detail.reads.map((read) => (
              <div key={read.readEventId} className="rounded-2xl border border-border/80 bg-background/40 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{read.readType}</Badge>
                  <p className="text-xs text-muted-foreground">{new Date(read.occurredAt).toLocaleTimeString('vi-VN')}</p>
                </div>
                <p className="mt-2 break-all text-muted-foreground">
                  plate={read.plateCompact || read.plateRaw || '—'} · rfid={read.rfidUid || '—'} · sensor={read.sensorState || '—'}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {read.evidence.sourceDeviceCode ? <Badge variant="muted">device={read.evidence.sourceDeviceCode}</Badge> : null}
                  {typeof read.ocrConfidence === 'number' ? <Badge variant="muted">ocr={read.ocrConfidence}</Badge> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Decisions" description="Decision log đã tách reasonCode và reasonDetail rõ ràng." empty="Chưa có decision.">
        {detail.decisions.length === 0 ? <p className="text-sm text-muted-foreground">Chưa có decision.</p> : (
          <div className="space-y-3">
            {detail.decisions.map((decision) => (
              <div key={decision.decisionId} className="rounded-2xl border border-border/80 bg-background/40 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="amber">{decision.decisionCode}</Badge>
                  <Badge variant="outline">{decision.recommendedAction}</Badge>
                  {decision.reviewRequired ? <Badge variant="amber">review</Badge> : null}
                </div>
                <p className="mt-2 break-all text-foreground/90">{decision.explanation}</p>
                <p className="mt-1 break-all text-muted-foreground">
                  {decision.reasonCode}{decision.reasonDetail ? ` · ${decision.reasonDetail}` : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Barrier commands" description="Barrier lifecycle và command result." empty="Chưa có barrier command.">
        {detail.barrierCommands.length === 0 ? <p className="text-sm text-muted-foreground">Chưa có barrier command.</p> : (
          <div className="space-y-3">
            {detail.barrierCommands.map((command) => (
              <div key={command.commandId} className="rounded-2xl border border-border/80 bg-background/40 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{command.commandType}</Badge>
                  <Badge variant="outline">{command.status}</Badge>
                </div>
                <p className="mt-2 break-all text-muted-foreground">
                  reason={command.reasonCode || '—'} · requestId={command.requestId || '—'} · issued={new Date(command.issuedAt).toLocaleTimeString('vi-VN')} · ack={command.ackAt ? 'yes' : 'no'}
                </p>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Manual reviews" description="Review queue lineage gắn với session này." empty="Chưa có manual review.">
        {detail.manualReviews.length === 0 ? <p className="text-sm text-muted-foreground">Chưa có manual review.</p> : (
          <div className="space-y-3">
            {detail.manualReviews.map((review) => (
              <div key={review.reviewId} className="rounded-2xl border border-border/80 bg-background/40 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={review.status === 'OPEN' ? 'amber' : 'muted'}>{review.status}</Badge>
                  <p className="font-mono-data text-sm">{review.queueReasonCode}</p>
                </div>
                <p className="mt-2 break-all text-muted-foreground">
                  claim={review.claimedByUserId || '—'} · resolve={review.resolvedByUserId || '—'}
                </p>
                {review.note ? <p className="mt-1 break-all text-foreground/90">{review.note}</p> : null}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Evidence / media" description="Media references được gom lại thành surface đọc được." empty="Chưa có media evidence.">
        {mediaRows.length === 0 ? <p className="text-sm text-muted-foreground">Chưa có media evidence.</p> : (
          <div className="space-y-3">
            {mediaRows.map((read) => (
              <div key={`${read.readEventId}:media`} className="rounded-2xl border border-border/80 bg-background/40 px-4 py-3 text-sm">
                <p className="font-mono-data text-sm">read={read.readEventId}</p>
                <p className="mt-2 break-all text-muted-foreground">
                  mediaId={read.evidence.media?.mediaId || '—'} · url={read.evidence.media?.mediaUrl || read.evidence.cameraFrameRef || read.evidence.cropRef || '—'}
                </p>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Incidents" description="Incident surface tách khỏi raw snapshot." empty="Chưa có incident.">
        {detail.incidents.length === 0 ? <p className="text-sm text-muted-foreground">Chưa có incident.</p> : (
          <div className="space-y-3">
            {detail.incidents.map((incident) => (
              <div key={incident.incidentId} className="rounded-2xl border border-border/80 bg-background/40 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={incident.status === 'OPEN' ? 'amber' : 'muted'}>{incident.status}</Badge>
                  <p className="font-mono-data text-sm">{incident.incidentType} · {incident.title}</p>
                </div>
                <p className="mt-2 break-all text-muted-foreground">
                  severity={incident.severity}{incident.detail ? ` · ${incident.detail}` : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}
