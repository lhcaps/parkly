import { useEffect, useMemo, type FormEventHandler, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function SubscriptionEditorDialogShell({
  open,
  title,
  description,
  submitLabel,
  busy,
  onClose,
  onSubmit,
  children,
  footer,
}: {
  open: boolean
  title: string
  description?: string
  submitLabel: string
  busy?: boolean
  onClose: () => void
  onSubmit: FormEventHandler<HTMLFormElement>
  children: ReactNode
  footer?: ReactNode
}) {
  const titleId = useMemo(() => `sub-dialog-${Math.random().toString(36).slice(2, 10)}`, [])
  const descriptionId = useMemo(() => `sub-dialog-desc-${Math.random().toString(36).slice(2, 10)}`, [])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [busy, onClose, open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm" aria-hidden="true" onClick={() => !busy && onClose()} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className="relative z-[111] w-full max-w-3xl rounded-3xl border border-border/90 bg-card/98 shadow-[0_36px_120px_rgba(0,0,0,0.42)]"
      >
        <form onSubmit={onSubmit}>
          <div className="flex items-start justify-between gap-4 border-b border-border/70 px-6 py-5 bg-gradient-to-r from-primary/5 via-transparent to-transparent">
            <div className="min-w-0">
              <h2 id={titleId} className="text-xl font-bold tracking-tight text-foreground">{title}</h2>
              {description ? <p id={descriptionId} className="mt-2 text-sm text-muted-foreground leading-relaxed">{description}</p> : null}
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={onClose} disabled={busy} title="Close dialog" aria-label="Close subscription editor dialog" className="h-9 w-9">
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="max-h-[75vh] overflow-y-auto px-6 py-6">{children}</div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border/70 px-6 py-5 bg-gradient-to-r from-primary/5 via-transparent to-transparent">
            <div className="min-h-6 text-sm text-muted-foreground leading-relaxed">{footer}</div>
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" onClick={onClose} disabled={busy} size="lg" className="h-11 px-6">
                Cancel
              </Button>
              <Button type="submit" disabled={busy} size="lg" className="h-11 px-6 gap-2">
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                {submitLabel}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}
