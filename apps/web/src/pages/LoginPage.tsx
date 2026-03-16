import { useEffect, useRef } from 'react'
import { LoginPanel } from '@/features/auth/components/LoginPanel'

export function LoginPage() {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = rootRef.current
    if (!el) return

    function onMove(e: MouseEvent) {
      const rect = el!.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * 100
      el!.style.setProperty('--lx', `${x.toFixed(2)}%`)
      el!.style.setProperty('--ly', `${y.toFixed(2)}%`)
    }

    el.addEventListener('mousemove', onMove, { passive: true })
    return () => el.removeEventListener('mousemove', onMove)
  }, [])

  return (
    <div ref={rootRef} className="login-root" style={{ '--lx': '65%', '--ly': '35%' } as React.CSSProperties}>
      {/* Layered background */}
      <div className="login-orb login-orb-a" />
      <div className="login-orb login-orb-b" />
      <div className="login-orb login-orb-c" />
      <div className="login-grid" />
      <div className="login-spotlight" />

      {/* Page content */}
      <div className="login-content min-h-dvh flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-8 py-5">
          <div className="flex items-center gap-3">
            <div
              className="login-brand-dot flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-[13px] font-bold text-primary-foreground"
              style={{ fontFamily: 'IBM Plex Mono, monospace' }}
            >
              P
            </div>
            <span className="font-mono-data text-[11px] uppercase tracking-[0.22em] text-muted-foreground/70">
              Parkly Console
            </span>
          </div>
          <span className="font-mono-data text-[10px] uppercase tracking-[0.18em] text-muted-foreground/40">
            v1 · ops
          </span>
        </div>

        {/* Main content */}
        <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
          <div className="w-full max-w-5xl">
            <LoginPanel />
          </div>
        </div>

        {/* Bottom bar */}
        <div className="px-8 py-4 text-center">
          <p className="font-mono-data text-[10px] text-muted-foreground/30 uppercase tracking-[0.16em]">
            Secure operations console · All sessions are logged
          </p>
        </div>
      </div>
    </div>
  )
}
