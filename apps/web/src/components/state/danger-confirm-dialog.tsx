import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type TriggerRenderProps = {
  onClick: () => void
  disabled?: boolean
  'aria-haspopup': 'dialog'
  'aria-expanded': boolean
}

export function DangerConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  disabled = false,
  busy = false,
  tone = 'danger',
  meta,
  trigger,
}: {
  title: string
  description?: string
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void | Promise<void>
  disabled?: boolean
  busy?: boolean
  tone?: 'danger' | 'warning'
  meta?: ReactNode
  trigger: (props: TriggerRenderProps) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const cancelRef = useRef<HTMLButtonElement | null>(null)
  const titleId = useMemo(() => `confirm-${Math.random().toString(36).slice(2, 10)}`, [])
  const descriptionId = useMemo(() => `confirm-desc-${Math.random().toString(36).slice(2, 10)}`, [])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const frame = window.requestAnimationFrame(() => cancelRef.current?.focus())
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !confirming) setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.cancelAnimationFrame(frame)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, confirming])

  async function handleConfirm() {
    try {
      setConfirming(true)
      await onConfirm()
      setOpen(false)
    } finally {
      setConfirming(false)
    }
  }

  return (
    <>
      {trigger({
        onClick: () => setOpen(true),
        disabled: disabled || busy,
        'aria-haspopup': 'dialog',
        'aria-expanded': open,
      })}
      {open
        ? createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-zinc-950/55 backdrop-blur-sm" onClick={() => !confirming && setOpen(false)} aria-hidden="true" />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={description ? descriptionId : undefined}
              className="relative z-[101] w-full max-w-md rounded-3xl border border-border/90 bg-card/98 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.35)]"
            >
              <div className="flex items-start gap-3">
                <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border', tone === 'danger' ? 'border-destructive/25 bg-destructive/12 text-destructive' : 'border-primary/25 bg-primary/12 text-primary')}>
                  <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h2 id={titleId} className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
                  {description ? <p id={descriptionId} className="mt-2 text-sm text-muted-foreground">{description}</p> : null}
                  {meta ? <div className="mt-3 text-xs text-muted-foreground">{meta}</div> : null}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <Button ref={cancelRef} type="button" variant="outline" onClick={() => setOpen(false)} disabled={confirming}>
                  {cancelLabel}
                </Button>
                <Button type="button" variant={tone === 'danger' ? 'destructive' : 'secondary'} onClick={() => void handleConfirm()} disabled={confirming}>
                  {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {confirmLabel}
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )
        : null}
    </>
  )
}
