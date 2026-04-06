import { memo, useCallback, useEffect, useRef, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertTriangle,
  CheckCircle2,
  ImageOff,
  Loader2,
  RefreshCw,
  ScanSearch,
  ShieldCheck,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { CandidateListCard } from '@/features/run-lane/components/CandidateListCard'
import { EffectivePlateSourceBadge } from '@/features/run-lane/components/EffectivePlateSourceBadge'
import { useRunLanePreview } from '@/features/run-lane/hooks/useRunLanePreview'
import { useRunLaneActions, useRunLaneStore } from '@/features/run-lane/store/runLaneStoreContext'
import {
  selectRunLaneBackendSuggestedPlate,
  selectRunLaneCapture,
  selectRunLaneEffectivePlateForSubmit,
  selectRunLaneEffectivePlateSource,
  selectRunLaneOverride,
  selectRunLanePreview,
  selectRunLanePreviewCandidates,
} from '@/features/run-lane/store/runLaneSelectors'
import { cn } from '@/lib/utils'

function previewStageBadgeVariant(stage: 'idle' | 'uploading' | 'loading' | 'ready' | 'error') {
  if (stage === 'ready') return 'entry' as const
  if (stage === 'error') return 'destructive' as const
  if (stage === 'uploading' || stage === 'loading') return 'amber' as const
  return 'outline' as const
}

function StageLabel({ stage, message }: { stage: 'idle' | 'uploading' | 'loading' | 'ready' | 'error'; message?: string | null }) {
  const { t } = useTranslation()
  if (stage === 'idle') return <span className="text-muted-foreground">{t('runLaneCapture.stageIdle')}</span>
  if (stage === 'uploading') return <span className="text-amber-500">{message || t('runLaneCapture.stageUploadingMsg')}</span>
  if (stage === 'loading') return <span className="text-amber-500">{message || t('runLaneCapture.stageRecognizingMsg')}</span>
  if (stage === 'error') return <span className="text-destructive">{t('runLaneCapture.stageError')}</span>
  return <span className="text-green-500">{t('runLaneCapture.stageReady')}</span>
}

function progressToBadgeVariant(stage: string) {
  if (stage === 'ready') return 'entry' as const
  if (stage === 'error') return 'destructive' as const
  if (stage === 'uploading' || stage === 'recognizing') return 'amber' as const
  return 'outline' as const
}

function progressLabel(stage: string, t: (key: string) => string) {
  switch (stage) {
    case 'validating':
      return t('runLaneCapture.validating')
    case 'uploading':
      return t('runLaneCapture.uploading')
    case 'recognizing':
      return t('runLaneCapture.recognizing')
    case 'ready':
      return t('runLaneCapture.ready')
    case 'error':
      return t('runLaneCapture.error')
    default:
      return t('runLaneCapture.processing')
  }
}

const PlatePreviewResult = memo(function PlatePreviewResult({
  preview,
  effectivePlate,
  effectiveSource,
}: {
  preview: ReturnType<typeof selectRunLanePreview>
  effectivePlate: string
  effectiveSource: ReturnType<typeof selectRunLaneEffectivePlateSource>
}) {
  const { t } = useTranslation()
  const backendPlate = preview.result?.plateDisplay || preview.result?.recognizedPlate || t('common.dash')
  const confidence = preview.result?.confidence ?? null

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-border/40 bg-muted/20 p-2.5 transition-[background-color,border-color] hover:border-border/60 hover:bg-muted/30">
          <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">{t('runLaneCapture.backendPlate')}</p>
          <p className="break-all font-mono-data text-sm font-semibold text-foreground">{backendPlate}</p>
        </div>
        <div className="rounded-lg border border-border/40 bg-muted/20 p-2.5 transition-[background-color,border-color] hover:border-border/60 hover:bg-muted/30">
          <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">{t('runLaneCapture.effectivePlate')}</p>
          <div className="flex items-center gap-1.5">
            <p className="break-all font-mono-data text-sm font-semibold text-foreground">
              {effectivePlate || t('common.dash')}
            </p>
            <EffectivePlateSourceBadge source={effectiveSource} hasValue={Boolean(effectivePlate)} />
          </div>
        </div>
      </div>

      {confidence !== null ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="text-[10px]">
            <ShieldCheck className="mr-1 h-3 w-3" />
            {confidence.toFixed(2)}
          </Badge>
          {preview.result?.needsConfirm ? (
            <Badge variant="amber" className="text-[10px]">
              {t('runLaneCapture.needsConfirm')}
            </Badge>
          ) : preview.result ? (
            <Badge variant="entry" className="text-[10px]">
              {t('runLaneCapture.ready')}
            </Badge>
          ) : null}
        </div>
      ) : null}
    </div>
  )
})

const PlateOverrideInline = memo(function PlateOverrideInline() {
  const { t } = useTranslation()
  const actions = useRunLaneActions()
  const override = useRunLaneStore(selectRunLaneOverride)
  const backendSuggestedPlate = useRunLaneStore(selectRunLaneBackendSuggestedPlate)

  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    actions.setOverrideValue(event.target.value)
  }, [actions])

  return (
    <div className="space-y-2.5">
      <div className="space-y-1.5">
        <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
          {t('runLaneCapture.enterOrOverridePlate')}
        </label>
        <Input
          value={override.value}
          onChange={handleInputChange}
          placeholder={t('runLaneCapture.overridePlaceholder')}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="h-9 font-mono-data text-sm transition-[box-shadow,border-color] focus:ring-2 focus:ring-primary/20"
        />
        {override.sourceMode === 'manual_override' ? (
          <p className="animate-in fade-in text-[10px] text-amber-500 duration-200">{t('runLaneCapture.manualOverrideActive')}</p>
        ) : null}
      </div>

      {backendSuggestedPlate && override.sourceMode !== 'manual_override' ? (
        <div className="flex flex-col gap-2 rounded-lg border border-border/40 bg-muted/20 p-2.5 transition-[background-color,border-color] hover:border-border/60 hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] text-muted-foreground">{t('runLaneCapture.backendSuggested')}</p>
            <p className="font-mono-data text-sm font-semibold">{backendSuggestedPlate}</p>
          </div>
          <div className="flex gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={actions.applyBackendPreviewToOverride}
              className="h-7 gap-1 text-[11px] transition-[transform] hover:scale-105 active:scale-95"
            >
              <CheckCircle2 className="h-3 w-3" />
              {t('runLaneCapture.apply')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={actions.clearOverride}
              className="h-7 text-[11px] transition-[transform] hover:scale-105 active:scale-95"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ) : null}

      {!backendSuggestedPlate && !override.value ? (
        <p className="text-[11px] text-muted-foreground">{t('runLaneCapture.enterPlateManually')}</p>
      ) : null}
    </div>
  )
})

export const CapturePreviewPanel = memo(function CapturePreviewPanel() {
  const { t } = useTranslation()
  const actions = useRunLaneActions()
  const capture = useRunLaneStore(selectRunLaneCapture)
  const preview = useRunLaneStore(selectRunLanePreview)
  const candidates = useRunLaneStore(selectRunLanePreviewCandidates)
  const effectivePlate = useRunLaneStore(selectRunLaneEffectivePlateForSubmit)
  const effectiveSource = useRunLaneStore(selectRunLaneEffectivePlateSource)
  const { runPreview, cancelPreview, progress } = useRunLanePreview()

  const selectedFileRef = useRef<File | null>(null)
  const lastPreviewUrlRef = useRef<string>('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const isProcessingRef = useRef(false)

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
      cancelPreview()
    }
  }, [cancelPreview])

  const hasCapture = Boolean(capture.localPreviewUrl)
  const busy = preview.stage === 'uploading' || preview.stage === 'loading'

  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0]
    if (!nextFile) {
      event.currentTarget.value = ''
      return
    }

    event.currentTarget.value = ''

    if (isProcessingRef.current) {
      actions.setPreviewError(t('runLaneCapture.processing'))
      return
    }

    if (busy) cancelPreview()

    isProcessingRef.current = true
    selectedFileRef.current = nextFile

    requestAnimationFrame(() => {
      if (!selectedFileRef.current || selectedFileRef.current !== nextFile) {
        isProcessingRef.current = false
        return
      }

      try {
        const localPreviewUrl = URL.createObjectURL(nextFile)
        actions.setCaptureDraft({
          fileName: nextFile.name,
          fileSizeBytes: nextFile.size,
          localPreviewUrl,
        })

        void runPreview(nextFile).finally(() => {
          isProcessingRef.current = false
        })
      } catch (error) {
        isProcessingRef.current = false
        const errorMessage = error instanceof Error ? error.message : String(error)
        actions.setPreviewError(t('runLaneCapture.processingFileError', { error: errorMessage }))
      }
    })
  }, [actions, busy, cancelPreview, runPreview, t])

  const handleClear = useCallback(() => {
    cancelPreview()
    selectedFileRef.current = null
    isProcessingRef.current = false
    actions.clearCaptureDraft()
    actions.clearPreview()
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [actions, cancelPreview])

  const handlePaste = useCallback(async (event: ClipboardEvent) => {
    if (busy || isProcessingRef.current) return

    const items = event.clipboardData?.items
    if (!items) return

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index]
      if (!item.type.startsWith('image/')) continue

      event.preventDefault()
      const file = item.getAsFile()
      if (!file) break

      isProcessingRef.current = true
      selectedFileRef.current = file

      requestAnimationFrame(() => {
        try {
          const localPreviewUrl = URL.createObjectURL(file)
          actions.setCaptureDraft({
            fileName: file.name || 'clipboard-image.png',
            fileSizeBytes: file.size,
            localPreviewUrl,
          })

          void runPreview(file).finally(() => {
            isProcessingRef.current = false
          })
        } catch (error) {
          isProcessingRef.current = false
          const errorMessage = error instanceof Error ? error.message : String(error)
          actions.setPreviewError(t('runLaneCapture.processingClipboardError', { error: errorMessage }))
        }
      })
      break
    }
  }, [actions, busy, runPreview, t])

  useEffect(() => {
    const handler = (event: ClipboardEvent) => {
      if (busy || isProcessingRef.current) return
      void handlePaste(event)
    }
    window.addEventListener('paste', handler)
    return () => window.removeEventListener('paste', handler)
  }, [busy, handlePaste])

  const showProgress = progress.stage !== 'idle'
  const progressPct = progress.stage === 'uploading' ? progress.uploadProgress : 100

  return (
    <div className="space-y-3">
      {showProgress && progress.stage !== 'ready' && progress.stage !== 'error' ? (
        <Card className="animate-in slide-in-from-top-2 border-amber-400/30 bg-amber-50/80 duration-300 dark:bg-amber-950/30">
          <CardContent className="space-y-2.5 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />
                <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                  {progressLabel(progress.stage, t)}
                </span>
              </div>
              <Badge variant={progressToBadgeVariant(progress.stage)} className="text-[10px]">
                {progress.stage === 'uploading' ? `${progressPct}%` : progress.stage === 'recognizing' ? 'CPU' : ''}
              </Badge>
            </div>
            {progress.message ? (
              <p className="truncate pl-5 text-[11px] text-amber-600/80 dark:text-amber-500/80">{progress.message}</p>
            ) : null}
            {progress.stage === 'uploading' ? (
              <Progress value={progressPct} className="h-1.5" barClassName="bg-amber-500 transition-all" />
            ) : null}
            {progress.stage === 'recognizing' ? (
              <div className="flex items-center gap-1.5 pl-5">
                <div className="h-1 w-24 overflow-hidden rounded-full bg-amber-200 dark:bg-amber-900">
                  <div className="h-full animate-pulse rounded-full bg-amber-500" style={{ width: '60%' }} />
                </div>
                <span className="text-[10px] text-amber-500">{t('runLaneCapture.processing')}</span>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-border/50 bg-card/95 backdrop-blur-sm transition-[background-color,border-color,box-shadow] hover:border-border/70 hover:shadow-sm">
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={hasCapture ? 'entry' : 'outline'} className="text-[10px]">
                {hasCapture ? t('runLaneCapture.imageSelected') : t('runLaneCapture.imageNotSelected')}
              </Badge>
              <Badge variant={previewStageBadgeVariant(preview.stage)} className="text-[10px]">
                <StageLabel stage={preview.stage} message={preview.message} />
              </Badge>
              <EffectivePlateSourceBadge source={effectiveSource} hasValue={Boolean(effectivePlate)} />
            </div>

            <div className="flex gap-1.5">
              {selectedFileRef.current && !busy ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void runPreview(selectedFileRef.current)}
                  className="h-7 gap-1.5 text-[11px] transition-[transform] hover:scale-105 active:scale-95"
                >
                  <RefreshCw className="h-3 w-3" />
                  {t('runLaneCapture.rerun')}
                </Button>
              ) : null}

              {hasCapture ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  className="h-7 text-[11px] transition-[transform] hover:scale-105 active:scale-95"
                >
                  <X className="h-3 w-3" />
                  {t('runLaneCapture.clear')}
                </Button>
              ) : null}
            </div>
          </div>

          <label
            className={cn(
              'group flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border/50 bg-muted/10 px-6 py-6 text-center transition-[background-color,border-color] hover:border-primary/30 hover:bg-muted/20',
              busy ? 'cursor-not-allowed opacity-50' : '',
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleFileChange}
              disabled={busy}
            />
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary transition-transform group-hover:scale-110">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
            </div>
            <p className="text-sm font-medium text-foreground">
              {busy ? (preview.message || t('runLaneCapture.processing')) : t('runLaneCapture.selectImage')}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {busy
                ? preview.stage === 'uploading'
                  ? t('runLaneCapture.uploadImage')
                  : preview.stage === 'loading'
                    ? t('runLaneCapture.runAlpr')
                    : t('runLaneCapture.pleaseWait')
                : t('runLaneCapture.selectImageDesc')}
            </p>
          </label>

          {capture.fileName ? (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/40 bg-muted/10 px-3 py-2">
              <span className="text-xs text-muted-foreground">{t('runLaneCapture.file')}</span>
              <span className="font-mono-data text-xs font-medium">{capture.fileName}</span>
              <span className="text-xs text-muted-foreground">/</span>
              <span className="text-xs text-muted-foreground">
                {capture.fileSizeBytes ? `${Math.round(capture.fileSizeBytes / 1024)} KB` : t('common.dash')}
              </span>
            </div>
          ) : null}

          {preview.error ? (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p className="flex-1">{preview.error}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/95 backdrop-blur-sm transition-[background-color,border-color,box-shadow] hover:border-border/70 hover:shadow-sm">
        <CardContent className="space-y-3 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t('runLaneCapture.previewSurface')}</p>

          {capture.localPreviewUrl ? (
            <div className="overflow-hidden rounded-xl border border-border/50 bg-black/60 transition-[border-color] hover:border-border/70">
              <img
                src={capture.localPreviewUrl}
                alt={capture.fileName || t('runLaneCapture.previewAlt')}
                className="h-[240px] w-full object-contain transition-opacity duration-300 md:h-[280px]"
                loading="lazy"
              />
            </div>
          ) : (
            <div className="flex min-h-[160px] flex-col items-center justify-center rounded-xl border border-dashed border-border/50 bg-muted/10 px-6 py-8 text-center transition-[background-color,border-color] md:min-h-[180px]">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-border/50 bg-muted/20 text-muted-foreground">
                <ImageOff className="h-4 w-4" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">{t('runLaneCapture.noPreviewYetAlt')}</p>
            </div>
          )}

          {preview.stage === 'ready' ? (
            <div className="animate-in slide-in-from-bottom-2 duration-300">
              <PlatePreviewResult preview={preview} effectivePlate={effectivePlate} effectiveSource={effectiveSource} />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/95 backdrop-blur-sm transition-[background-color,border-color,box-shadow] hover:border-border/70 hover:shadow-sm">
        <CardContent className="space-y-3 p-4">
          <PlateOverrideInline />
        </CardContent>
      </Card>

      <CandidateListCard candidates={candidates} onApplyCandidate={actions.applyCandidateToOverride} />
    </div>
  )
})
