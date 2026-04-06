import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { AlprPreviewCandidate } from '@/lib/contracts/alpr'
import { cn } from '@/lib/utils'

function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
  className,
  count,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
  className?: string
  count?: number
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={cn('rounded-xl border border-border/50 bg-muted/15', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-muted/20"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</span>
          {count !== undefined && count > 0 ? (
            <Badge variant="secondary" className="text-[10px]">
              {count}
            </Badge>
          ) : null}
        </div>
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      {open ? <div className="border-t border-border/40 px-3 pb-3 pt-1">{children}</div> : null}
    </div>
  )
}

export function CandidateListCard({
  candidates,
  onApplyCandidate,
}: {
  candidates: AlprPreviewCandidate[]
  onApplyCandidate: (plate: string) => void
}) {
  const { t } = useTranslation()

  return (
    <CollapsibleSection title={t('runLaneCapture.candidates')} count={candidates.length} defaultOpen={false}>
      {candidates.length > 0 ? (
        <div className="space-y-2">
          {candidates.map((candidate, idx) => (
            <div
              key={`${candidate.plate}:${idx}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/50 bg-muted/20 p-2.5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-mono-data text-sm font-semibold text-foreground">{candidate.plate}</p>
                <Badge variant="outline" className="text-[10px]">
                  {candidate.score.toFixed(2)}
                </Badge>
                <Badge variant="muted" className="text-[10px]">
                  {t('runLaneCapture.votesValue', { count: candidate.votes })}
                </Badge>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onApplyCandidate(candidate.plate)}
                className="h-7 gap-1 text-[11px]"
              >
                <CheckCircle2 className="h-3 w-3" />
                {t('runLaneCapture.apply')}
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-4 text-center">
          <p className="text-xs text-muted-foreground">{t('runLaneCapture.noCandidates')}</p>
        </div>
      )}
    </CollapsibleSection>
  )
}
