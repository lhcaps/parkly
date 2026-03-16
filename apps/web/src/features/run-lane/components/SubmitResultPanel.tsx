import { Layers3 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DecisionSummaryCard } from '@/features/run-lane/components/DecisionSummaryCard'
import { EffectivePlateSourceBadge } from '@/features/run-lane/components/EffectivePlateSourceBadge'
import { GateEventSummaryCard } from '@/features/run-lane/components/GateEventSummaryCard'
import { PostSubmitActionsCard } from '@/features/run-lane/components/PostSubmitActionsCard'
import { SessionSummaryCard } from '@/features/run-lane/components/SessionSummaryCard'
import { useRunLaneStore } from '@/features/run-lane/store/runLaneStoreContext'
import {
  selectRunLaneEffectivePlateForSubmit,
  selectRunLaneEffectivePlateSource,
  selectRunLaneSubmit,
  selectRunLaneSubmitDecision,
  selectRunLaneSubmitEvent,
  selectRunLaneSubmitSession,
  selectRunLaneTopology,
} from '@/features/run-lane/store/runLaneSelectors'

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-3 first:pt-0 last:border-b-0 last:pb-0">
      <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="break-all text-right text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

export function SubmitResultPanel() {
  const submit = useRunLaneStore(selectRunLaneSubmit)
  const topology = useRunLaneStore(selectRunLaneTopology)
  const effectivePlate = useRunLaneStore(selectRunLaneEffectivePlateForSubmit)
  const effectiveSource = useRunLaneStore(selectRunLaneEffectivePlateSource)
  const session = useRunLaneStore(selectRunLaneSubmitSession)
  const decision = useRunLaneStore(selectRunLaneSubmitDecision)
  const event = useRunLaneStore(selectRunLaneSubmitEvent)

  return (
    <div className="space-y-5">
      <Card className="border-border/80 bg-card/95 shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">result surface</Badge>
            <Badge
              variant={
                submit.stage === 'success'
                  ? 'entry'
                  : submit.stage === 'error'
                    ? 'destructive'
                    : submit.stage === 'submitting'
                      ? 'amber'
                      : 'outline'
              }
            >
              {submit.stage}
            </Badge>
            <EffectivePlateSourceBadge source={effectiveSource} hasValue={Boolean(effectivePlate)} />
          </div>
          <div>
            <CardTitle className="text-base sm:text-lg">Submit Result Panel</CardTitle>
            <CardDescription>
              The right panel is a live result surface — decision, session, event, and post-submit actions are all visible. đều nằm tại chỗ.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-3xl border border-border/80 bg-background/40 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Layers3 className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium">Authoritative boundary</p>
            </div>
            <p className="text-sm text-muted-foreground">{submit.message}</p>
          </div>

          <div className="rounded-3xl border border-border/80 bg-muted/25 p-4">
            <SummaryRow label="Site" value={topology.siteCode || 'Not selected'} />
            <SummaryRow label="Lane" value={topology.laneCode || 'Not selected'} />
            <SummaryRow label="Effective plate" value={effectivePlate || '— effective plate'} />
            <SummaryRow label="Plate source" value={effectiveSource} />
            <SummaryRow label="Current session" value={session?.sessionId ? String(session.sessionId) : '—'} />
            <SummaryRow label="Decision code" value={decision?.decisionCode || '—'} />
            <SummaryRow label="Gate event" value={event?.eventId != null ? String(event.eventId) : '—'} />
          </div>
        </CardContent>
      </Card>

      <DecisionSummaryCard decision={decision} />
      <SessionSummaryCard session={session} />
      <GateEventSummaryCard event={event} />
      <PostSubmitActionsCard />
    </div>
  )
}
