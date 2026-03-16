import { useEffect, useMemo, useRef, type ChangeEvent } from 'react'
import {
  Cpu,
  FileImage,
  ImageOff,
  Loader2,
  MonitorSmartphone,
  RefreshCw,
  ScanSearch,
  ShieldCheck,
  TriangleAlert,
  Upload,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CandidateListCard } from '@/features/run-lane/components/CandidateListCard'
import { EffectivePlateSourceBadge } from '@/features/run-lane/components/EffectivePlateSourceBadge'
import { PlateOverrideCard } from '@/features/run-lane/components/PlateOverrideCard'
import { useRunLanePreview } from '@/features/run-lane/hooks/useRunLanePreview'
import { useRunLaneActions, useRunLaneStore } from '@/features/run-lane/store/runLaneStoreContext'
import {
  selectRunLaneCapture,
  selectRunLaneEffectivePlateForSubmit,
  selectRunLaneEffectivePlateSource,
  selectRunLanePreview,
  selectRunLanePreviewCandidates,
} from '@/features/run-lane/store/runLaneSelectors'

function formatFileSize(sizeBytes: number | null) {
  if (!sizeBytes || sizeBytes <= 0) return '—'
  if (sizeBytes >= 1024 * 1024) return `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`
  return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`
}

function previewStageBadgeVariant(stage: 'idle' | 'uploading' | 'loading' | 'ready' | 'error') {
  if (stage === 'ready') return 'entry' as const
  if (stage === 'error') return 'destructive' as const
  if (stage === 'uploading' || stage === 'loading') return 'amber' as const
  return 'outline' as const
}

export function CapturePreviewPanel() {
  const actions = useRunLaneActions()
  const capture = useRunLaneStore(selectRunLaneCapture)
  const preview = useRunLaneStore(selectRunLanePreview)
  const candidates = useRunLaneStore(selectRunLanePreviewCandidates)
  const effectivePlate = useRunLaneStore(selectRunLaneEffectivePlateForSubmit)
  const effectiveSource = useRunLaneStore(selectRunLaneEffectivePlateSource)
  const { runPreview } = useRunLanePreview()

  const selectedFileRef = useRef<File | null>(null)
  const lastPreviewUrlRef = useRef<string>('')

  useEffect(() => {
    const previous = lastPreviewUrlRef.current
    if (previous && previous !== capture.localPreviewUrl && previous.startsWith('blob:')) {
      URL.revokeObjectURL(previous)
    }
    lastPreviewUrlRef.current = capture.localPreviewUrl
  }, [capture.localPreviewUrl])

  useEffect(() => {
    return () => {
      const previous = lastPreviewUrlRef.current
      if (previous && previous.startsWith('blob:')) {
        URL.revokeObjectURL(previous)
      }
    }
  }, [])

  const previewBadge = useMemo(() => {
    return capture.status === 'selected' ? 'local preview ready' : 'placeholder'
  }, [capture.status])

  const backendPreviewDisplay = preview.result?.plateDisplay || preview.result?.recognizedPlate || '—'

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0]
    if (!nextFile) return

    selectedFileRef.current = nextFile

    const localPreviewUrl = URL.createObjectURL(nextFile)
    actions.setCaptureDraft({
      fileName: nextFile.name,
      fileSizeBytes: nextFile.size,
      localPreviewUrl,
    })

    void runPreview(nextFile)
    event.currentTarget.value = ''
  }

  return (
    <div className="space-y-5">
      <Card className="border-border/80 bg-card/95 shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">capture + preview</Badge>
              <Badge variant={capture.status === 'selected' ? 'entry' : 'outline'}>{previewBadge}</Badge>
              <Badge variant={previewStageBadgeVariant(preview.stage)}>{preview.stage}</Badge>
              <EffectivePlateSourceBadge source={effectiveSource} hasValue={Boolean(effectivePlate)} />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void runPreview(selectedFileRef.current)}
                disabled={!selectedFileRef.current || preview.stage === 'uploading' || preview.stage === 'loading'}
              >
                {preview.stage === 'uploading' || preview.stage === 'loading'
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <RefreshCw className="h-3.5 w-3.5" />}
                Re-run preview
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  selectedFileRef.current = null
                  actions.clearCaptureDraft()
                }}
                disabled={!capture.localPreviewUrl && !preview.result}
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </Button>
            </div>
          </div>

          <div>
            <CardTitle className="text-base sm:text-lg">Capture Preview Panel</CardTitle>
            <CardDescription>
              Three distinct layers: local image, backend preview, and manual override. Submit always reads from the effective plate.ctive plate đã resolve source.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <label className="group flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-border/80 bg-background/40 px-5 py-8 text-center transition hover:border-primary/40 hover:bg-primary/5">
            <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <Upload className="h-5 w-5" />
            </div>
            <p className="text-base font-medium">Select a plate image or a test lane image</p>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              When an image is selected, a local preview mounts immediately while upload and backend preview run in the background.
              The override input remains editable throughout.
            </p>
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border/80 bg-muted/25 p-4">
              <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">File name</p>
              <p className="mt-2 text-sm font-medium break-all">{capture.fileName || 'Not selected file'}</p>
            </div>
            <div className="rounded-2xl border border-border/80 bg-muted/25 p-4">
              <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">File size</p>
              <p className="mt-2 text-sm font-medium">{formatFileSize(capture.fileSizeBytes)}</p>
            </div>
            <div className="rounded-2xl border border-border/80 bg-muted/25 p-4">
              <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">Updated</p>
              <p className="mt-2 text-sm font-medium">{capture.updatedAt ? new Date(capture.updatedAt).toLocaleTimeString('vi-VN') : '—'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card/95">
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={capture.localPreviewUrl ? 'entry' : 'outline'}>
                {capture.localPreviewUrl ? 'local image mounted' : 'empty state'}
              </Badge>
              <Badge variant={previewStageBadgeVariant(preview.stage)}>{preview.stage}</Badge>
              {preview.result?.previewStatus ? (
                <Badge
                  variant={
                    preview.result.previewStatus === 'STRICT_VALID'
                      ? 'entry'
                      : preview.result.previewStatus === 'REVIEW'
                        ? 'amber'
                        : 'destructive'
                  }
                >
                  {preview.result.previewStatus}
                </Badge>
              ) : null}
            </div>

            {preview.result?.needsConfirm
              ? <Badge variant="amber">needs confirm</Badge>
              : preview.result
                ? <Badge variant="entry">auto-ready</Badge>
                : null}
          </div>

          <div>
            <CardTitle className="text-sm sm:text-base">Preview Surface</CardTitle>
            <CardDescription>{preview.message}</CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {capture.localPreviewUrl ? (
            <div className="overflow-hidden rounded-3xl border border-border/80 bg-black/50">
              <img
                src={capture.localPreviewUrl}
                alt={capture.fileName || 'Run lane local preview'}
                className="h-[360px] w-full object-contain"
              />
            </div>
          ) : (
            <div className="flex min-h-[220px] flex-col items-center justify-center rounded-3xl border border-dashed border-border/80 bg-background/40 px-6 py-10 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border/80 bg-muted/30 text-muted-foreground">
                <ImageOff className="h-5 w-5" />
              </div>
              <p className="text-base font-medium">— capture local</p>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                When an image is selected, this panel shows a local preview immediately before backend preview returns.
              </p>
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-border/80 bg-muted/25 p-4">
              <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                <Cpu className="h-3.5 w-3.5" />
                backend preview
              </div>
              <p className="font-mono-data text-sm font-medium text-foreground break-all">{backendPreviewDisplay}</p>
            </div>

            <div className="rounded-2xl border border-border/80 bg-muted/25 p-4">
              <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
                confidence
              </div>
              <p className="font-mono-data text-sm font-medium text-foreground">
                {preview.result ? preview.result.confidence.toFixed(2) : '—'}
              </p>
            </div>

            <div className="rounded-2xl border border-border/80 bg-muted/25 p-4">
              <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                <TriangleAlert className="h-3.5 w-3.5" />
                winner
              </div>
              <p className="font-mono-data text-sm font-medium text-foreground">
                {preview.result?.winner ? `${preview.result.winner.cropVariant} / ${preview.result.winner.psm}` : '—'}
              </p>
            </div>

            <div className="rounded-2xl border border-border/80 bg-muted/25 p-4">
              <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                <FileImage className="h-3.5 w-3.5" />
                effective plate
              </div>
              <p className="font-mono-data text-sm font-medium text-foreground break-all">{effectivePlate || '—'}</p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
              <div className="mb-2 flex items-center gap-2 text-foreground">
                <MonitorSmartphone className="h-4 w-4 text-primary" />
                <span className="font-medium">Preview concurrency</span>
              </div>
              Preview loading only updates the preview slice. The override card stays editable and is not disabled by network state.k state.
            </div>

            <div className="rounded-2xl border border-border/80 bg-muted/25 p-4 text-sm text-muted-foreground">
              <div className="mb-2 flex items-center gap-2 text-foreground">
                <ScanSearch className="h-4 w-4 text-primary" />
                <span className="font-medium">Auto-fill rule</span>
              </div>
              Auto-fill only populates the input when untouched. Once typed manually, new preview results cannot overwrite it.
            </div>
          </div>
        </CardContent>
      </Card>

      <PlateOverrideCard />
      <CandidateListCard candidates={candidates} onApplyCandidate={actions.applyCandidateToOverride} />
    </div>
  )
}
