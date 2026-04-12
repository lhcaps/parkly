import { Eye, EyeOff, LayoutGrid, ListFilter, RotateCcw, Rows3, SlidersHorizontal } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import {
  getOpsSummary,
  type SqlBoardKey,
  type SqlLaneLens,
  type SqlModuleLabels,
  type SqlModulePrefs,
  type SqlReviewLens,
  type SqlSectionKey,
  type SqlSurfaceData,
} from './sqlModules.utils'

function SummaryChip({
  title,
  value,
  variant,
}: {
  title: string
  value: number
  variant: 'secondary' | 'amber' | 'destructive'
}) {
  return (
    <div className="rounded-[1.3rem] border border-border/70 bg-background/40 px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{title}</p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        <Badge variant={variant}>{variant === 'secondary' ? 'OK' : 'LIVE'}</Badge>
      </div>
    </div>
  )
}

function TogglePill({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? 'default' : 'outline'}
      aria-pressed={active}
      onClick={onClick}
      className="h-9 rounded-full px-4 text-xs"
    >
      {active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
      {label}
    </Button>
  )
}

function LensToggle({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? 'default' : 'ghost'}
      aria-pressed={active}
      onClick={onClick}
      className="h-8 rounded-full px-3 text-[11px]"
    >
      {label}
    </Button>
  )
}

export function SqlModulesFocusPanel({
  data,
  labels,
  prefs,
  onToggleSection,
  onToggleBoard,
  onSetLaneLens,
  onSetReviewLens,
  onResetLayout,
}: {
  data: SqlSurfaceData
  labels: SqlModuleLabels
  prefs: SqlModulePrefs
  onToggleSection: (key: SqlSectionKey) => void
  onToggleBoard: (key: SqlBoardKey) => void
  onSetLaneLens: (lens: SqlLaneLens) => void
  onSetReviewLens: (lens: SqlReviewLens) => void
  onResetLayout: () => void
}) {
  const ops = getOpsSummary(data)

  return (
    <Card className="border-border/80 bg-card/95 shadow-[0_18px_56px_rgba(35,94,138,0.10)]">
      <CardHeader className="space-y-1">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
              <SlidersHorizontal className="h-4 w-4 text-primary" />
              {labels.focusTitle}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{labels.focusDesc}</p>
          </div>

          <Button type="button" variant="outline" size="sm" onClick={onResetLayout} className="gap-2">
            <RotateCcw className="h-3.5 w-3.5" />
            {labels.resetLayout}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="grid gap-3 sm:grid-cols-2">
          <SummaryChip title={labels.triggerSignal} value={data.triggerGap.missingCount} variant={data.triggerGap.missingCount > 0 ? 'destructive' : 'secondary'} />
          <SummaryChip title={labels.laneSignal} value={ops.laneAttentionCount} variant={ops.laneAttentionCount > 0 ? 'amber' : 'secondary'} />
          <SummaryChip title={labels.reviewSignal} value={ops.queueAttentionCount} variant={ops.queueAttentionCount > 0 ? 'amber' : 'secondary'} />
          <SummaryChip title={labels.sessionSignal} value={ops.staleSessionCount} variant={ops.staleSessionCount > 0 ? 'amber' : 'secondary'} />
        </div>

        <div className="space-y-5">
          <section>
            <div className="flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-primary" />
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{labels.visibleSections}</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {([
                ['overview', labels.overviewSection],
                ['studio', labels.studioSection],
                ['catalog', labels.catalogSection],
                ['liveOps', labels.liveOpsSection],
              ] as Array<[SqlSectionKey, string]>).map(([key, label]) => (
                <TogglePill key={key} label={label} active={prefs.sections[key]} onClick={() => onToggleSection(key)} />
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2">
              <Rows3 className="h-4 w-4 text-primary" />
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{labels.visibleBoards}</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {([
                ['sessions', labels.sessionsBoard],
                ['laneHealth', labels.laneBoard],
                ['queue', labels.queueBoard],
              ] as Array<[SqlBoardKey, string]>).map(([key, label]) => (
                <TogglePill key={key} label={label} active={prefs.boards[key]} onClick={() => onToggleBoard(key)} />
              ))}
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-[1.35rem] border border-border/70 bg-background/40 p-4">
              <div className="flex items-center gap-2">
                <ListFilter className="h-4 w-4 text-primary" />
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{labels.laneLens}</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <LensToggle active={prefs.laneLens === 'focus'} onClick={() => onSetLaneLens('focus')} label={labels.laneFocusOnly} />
                <LensToggle active={prefs.laneLens === 'all'} onClick={() => onSetLaneLens('all')} label={labels.showAllLanes} />
              </div>
            </section>

            <section className="rounded-[1.35rem] border border-border/70 bg-background/40 p-4">
              <div className="flex items-center gap-2">
                <ListFilter className="h-4 w-4 text-primary" />
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{labels.reviewLens}</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <LensToggle active={prefs.reviewLens === 'attention'} onClick={() => onSetReviewLens('attention')} label={labels.queueFocusOnly} />
                <LensToggle active={prefs.reviewLens === 'all'} onClick={() => onSetReviewLens('all')} label={labels.showAllQueue} />
              </div>
            </section>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
