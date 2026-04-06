import { useEffect, useRef, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { LoginPanel } from '@/features/auth/components/LoginPanel'

export function LoginPage() {
  const { t } = useTranslation()
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (root === null) return

    const rootEl: HTMLDivElement = root

    function onMove(e: MouseEvent) {
      const rect = rootEl.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * 100
      rootEl.style.setProperty('--lx', `${x.toFixed(2)}%`)
      rootEl.style.setProperty('--ly', `${y.toFixed(2)}%`)
    }

    rootEl.addEventListener('mousemove', onMove, { passive: true })
    return () => rootEl.removeEventListener('mousemove', onMove)
  }, [])

  return (
    <div ref={rootRef} className="login-root" style={{ '--lx': '65%', '--ly': '35%' } as CSSProperties}>
      <div className="login-orb login-orb-a" />
      <div className="login-orb login-orb-b" />
      <div className="login-orb login-orb-c" />
      <div className="login-grid" />
      <div className="login-spotlight" />

      <div className="login-content min-h-dvh flex flex-col">
        <div className="flex items-center justify-between px-8 py-5">
          <div className="flex items-center gap-3">
            <div
              className="login-brand-dot flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-[13px] font-bold text-primary-foreground"
              style={{ fontFamily: 'IBM Plex Mono, monospace' }}
            >
              P
            </div>
            <div>
              <p className="font-mono-data text-[11px] uppercase tracking-[0.22em] text-muted-foreground/70">
                {t('loginPage.brand')}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground/55">
                {t('loginPage.subtitle')}
              </p>
            </div>
          </div>
          <span className="font-mono-data text-[10px] uppercase tracking-[0.18em] text-muted-foreground/40">
            {t('loginPage.signInMark')}
          </span>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center px-4 py-6 sm:px-6 sm:py-10">
          <div className="w-full max-w-[min(100%,26rem)] shrink-0">
            <LoginPanel />
          </div>
        </div>

        <div className="px-8 py-4 text-center">
          <p className="font-mono-data text-[10px] uppercase tracking-[0.16em] text-muted-foreground/30">
            {t('loginPage.footer')}
          </p>
        </div>
      </div>
    </div>
  )
}
