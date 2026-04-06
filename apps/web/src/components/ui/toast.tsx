import { Toaster as SonnerToaster } from 'sonner'

/**
 * Toast provider — wrap at the root (App or layout).
 * Usage anywhere: `import { toast } from 'sonner'`
 * then `toast.success('Saved')` / `toast.error('Failed')`
 */
export function ToastProvider() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        className:
          'rounded-2xl border border-border/80 bg-card text-foreground shadow-[0_16px_48px_rgba(0,0,0,0.25)] backdrop-blur-md',
        descriptionClassName: 'text-muted-foreground',
        duration: 4000,
      }}
      gap={8}
      offset={16}
      closeButton
      richColors
      theme="dark"
    />
  )
}
