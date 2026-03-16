import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { AlertCircle, CheckCircle2, FileImage, Loader2, ScanSearch, ShieldAlert, Upload, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { previewImageFile } from '@/lib/api/alpr'
import type { AlprRecognizeRes } from '@/lib/contracts/alpr'
import { cn } from '@/lib/utils'

function pickRawString(raw: Record<string, unknown>, key: string) {
  const value = raw[key]
  return typeof value === 'string' ? value : ''
}

export function PreviewDebugPanel() {
  const [file, setFile] = useState<File | null>(null)
  const [plateHint, setPlateHint] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [result, setResult] = useState<AlprRecognizeRes | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const diagnostics = useMemo(() => {
    if (!result) return []
    const raw = result.raw || {}
    return [
      ['provider', pickRawString(raw, 'provider')],
      ['mode', pickRawString(raw, 'mode')],
      ['imageUrl', pickRawString(raw, 'imageUrl')],
      ['imagePath', pickRawString(raw, 'imagePath')],
      ['rawText', pickRawString(raw, 'rawText')],
      ['failureReason', pickRawString(raw, 'failureReason')],
      ['cacheHit', String(raw.cacheHit ?? '')],
      ['latencyMs', String(raw.latencyMs ?? '')],
    ].filter((item) => item[1])
  }, [result])

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null
    setFile(picked)
    setResult(null)
    setImageUrl('')
    setError('')
  }

  function clearFile() {
    setFile(null)
    setResult(null)
    setImageUrl('')
    setError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleRun() {
    if (!file) {
      setError('Select an image before running preview debug.')
      return
    }

    setBusy(true)
    setError('')
    try {
      const preview = await previewImageFile(file, plateHint || undefined)
      setImageUrl(preview.uploaded.imageUrl)
      setResult(preview.preview)
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : String(runError))
      setResult(null)
      setImageUrl('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="border-border/80 bg-card/95 shadow-[0_18px_60px_rgba(0,0,0,0.12)]">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">preview debug</Badge>
          {result ? (
            <Badge variant={result.previewStatus === 'STRICT_VALID' ? 'entry' : result.previewStatus === 'REVIEW' ? 'amber' : 'destructive'}>
              {result.previewStatus}
            </Badge>
          ) : null}
        </div>
        <CardTitle>Preview Debug Panel</CardTitle>
        <CardDescription>
          Inspect raw OCR, candidates, crop/PSM/winner, and provider diagnostics without affecting Run Lane state.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* File picker row */}
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          {/* Hidden native file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handleFileChange}
            aria-label="Select image file"
          />

          {/* Styled file selector */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'flex h-10 w-full items-center gap-2.5 rounded-2xl border px-3 text-left text-sm transition-colors',
              'border-border/80 bg-input hover:border-primary/40 hover:bg-accent/50',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            <FileImage className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className={cn('flex-1 truncate', file ? 'text-foreground' : 'text-muted-foreground')}>
              {file ? file.name : 'Choose image…'}
            </span>
            {file ? (
              <span
                role="button"
                tabIndex={0}
                aria-label="Clear selected file"
                onClick={(e) => { e.stopPropagation(); clearFile() }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); clearFile() } }}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </span>
            ) : null}
          </button>

          <Input
            value={plateHint}
            onChange={(e) => setPlateHint(e.target.value)}
            placeholder="Plate hint (optional)"
          />

          <Button type="button" onClick={() => void handleRun()} disabled={busy || !file}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Run preview
          </Button>
        </div>

        {error ? (
          <div className="flex items-start gap-2 rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-4 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="break-all">{error}</span>
          </div>
        ) : null}

        {!result ? (
          <div className="rounded-2xl border border-dashed border-border/80 bg-background/40 px-4 py-12 text-center text-sm text-muted-foreground">
            No preview result yet.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
              <div className="overflow-hidden rounded-3xl border border-border/80 bg-black/50">
                {imageUrl ? (
                  <img src={imageUrl} alt="ALPR debug" className="h-[280px] w-full object-contain" />
                ) : (
                  <div className="flex h-[280px] items-center justify-center text-muted-foreground">No image</div>
                )}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
                  <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">Recognized plate</p>
                  <p className="mt-2 font-mono-data text-sm font-semibold text-foreground">{result.plateDisplay || result.recognizedPlate || '—'}</p>
                </div>
                <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
                  <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">Confidence</p>
                  <p className="mt-2 font-mono-data text-sm font-semibold text-foreground">{result.confidence.toFixed(2)}</p>
                </div>
                <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
                  <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">Winner</p>
                  <p className="mt-2 text-sm text-foreground">
                    {result.winner ? `${result.winner.cropVariant} · psm ${result.winner.psm} · ${result.winner.rawText || '—'}` : '—'}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
                  <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">Review</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {result.needsConfirm
                      ? <Badge variant="amber"><ShieldAlert className="h-3 w-3" />Needs confirm</Badge>
                      : <Badge variant="secondary"><CheckCircle2 className="h-3 w-3" />Ready</Badge>}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-border/80 bg-background/40 p-4">
              <div className="mb-3 flex items-center gap-2">
                <ScanSearch className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium">Candidates</p>
              </div>

              {result.candidates.length === 0 ? (
                <p className="text-sm text-muted-foreground">No candidates.</p>
              ) : (
                <div className="space-y-3">
                  {result.candidates.map((candidate) => (
                    <div key={`${candidate.plate}:${candidate.score}:${candidate.votes}`} className="rounded-2xl border border-border/80 bg-card/80 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{candidate.plate}</Badge>
                        <Badge variant="muted">score {candidate.score.toFixed(2)}</Badge>
                        <Badge variant="muted">votes {candidate.votes}</Badge>
                      </div>
                      <p className="mt-2 break-all text-xs text-muted-foreground">
                        crop={candidate.cropVariants.join(', ') || '—'} · psm={candidate.psmModes.join(', ') || '—'} · flags={candidate.suspiciousFlags.join(', ') || '—'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-border/80 bg-background/40 p-4">
              <p className="text-sm font-medium">Diagnostics</p>
              {diagnostics.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No diagnostic summary.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {diagnostics.map(([key, value]) => (
                    <div key={key} className="flex items-start justify-between gap-3 border-b border-border/60 py-2 last:border-b-0">
                      <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">{key}</p>
                      <p className="max-w-[70%] break-all text-right text-xs text-foreground">{value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
