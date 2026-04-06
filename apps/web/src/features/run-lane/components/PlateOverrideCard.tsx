import { Eraser, RotateCcw, ScanText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { EffectivePlateSourceBadge } from '@/features/run-lane/components/EffectivePlateSourceBadge'
import {
  selectRunLaneBackendSuggestedPlate,
  selectRunLaneEffectivePlateForSubmit,
  selectRunLaneEffectivePlateSource,
  selectRunLaneOverride,
  selectRunLanePreview,
} from '@/features/run-lane/store/runLaneSelectors'
import { useRunLaneActions, useRunLaneStore } from '@/features/run-lane/store/runLaneStoreContext'

export function PlateOverrideCard() {
  const actions = useRunLaneActions()
  const preview = useRunLaneStore(selectRunLanePreview)
  const override = useRunLaneStore(selectRunLaneOverride)
  const backendSuggestedPlate = useRunLaneStore(selectRunLaneBackendSuggestedPlate)
  const effectivePlate = useRunLaneStore(selectRunLaneEffectivePlateForSubmit)
  const effectiveSource = useRunLaneStore(selectRunLaneEffectivePlateSource)

  return (
    <Card className="border-border/80 bg-card/95">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">override concurrency</Badge>
          <EffectivePlateSourceBadge source={effectiveSource} hasValue={Boolean(effectivePlate)} />
        </div>
        <CardTitle className="text-sm sm:text-base">Plate Override Card</CardTitle>
        <CardDescription>
          Preview and manual override run in parallel. This input is not disabled while backend preview is loading.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="block text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">
            Plate confirm / override
          </label>
          <Input
            value={override.value}
            onChange={(event) => actions.setOverrideValue(event.target.value)}
            placeholder="50-AF 668.79"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <p className="text-xs text-muted-foreground">
            First preview auto-fills when untouched. After manual input, later previews cannot overwrite this field.
          </p>
        </div>

        <div className="grid gap-3 rounded-2xl border border-border/80 bg-background/40 p-4 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">Backend suggested</p>
            <p className="mt-2 font-mono-data text-sm text-foreground break-all">{backendSuggestedPlate || '—'}</p>
          </div>
          <div>
            <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">Effective plate for submit</p>
            <p className="mt-2 font-mono-data text-sm font-medium text-foreground break-all">{effectivePlate || '—'}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={actions.applyBackendPreviewToOverride} disabled={!backendSuggestedPlate}>
            <RotateCcw className="h-3.5 w-3.5" />
            Use backend preview
          </Button>

          <Button type="button" variant="outline" size="sm" onClick={actions.clearOverride} disabled={!backendSuggestedPlate && !override.value}>
            <Eraser className="h-3.5 w-3.5" />
            Clear override
          </Button>

          {override.sourceMode === 'manual_override' ? <Badge variant="amber">manual override active</Badge> : null}
          {override.sourceMode === 'backend_preview' ? <Badge variant="muted">using backend preview</Badge> : null}
          {preview.stage === 'loading' || preview.stage === 'uploading' ? <Badge variant="outline">preview loading while input stays editable</Badge> : null}
        </div>

        <div className="rounded-2xl border border-border/80 bg-muted/25 p-4 text-sm text-muted-foreground">
          <div className="mb-2 flex items-center gap-2 text-foreground">
            <ScanText className="h-4 w-4 text-primary" />
            <span className="font-medium">Concurrency rule</span>
          </div>
          Auto-fill only occurs when <span className="font-mono-data">override.touched = false</span>. Once the operator edits the input,
          later previews only update candidates and backend output; they cannot overwrite the input.
        </div>
      </CardContent>
    </Card>
  )
}
