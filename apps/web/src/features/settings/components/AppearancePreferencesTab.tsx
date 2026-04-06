import { useTranslation } from 'react-i18next'
import { Monitor, Moon, Sun } from 'lucide-react'
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { setAppLocale } from '@/i18n'
import { type ThemeChoice, useTheme } from '@/providers/ThemeProvider'

const THEME_OPTIONS: Array<{
  value: ThemeChoice
  icon: typeof Sun
  labelKey: string
  descriptionKey: string
}> = [
  { value: 'light', icon: Sun, labelKey: 'appearance.themeLight', descriptionKey: 'appearance.themeLightDesc' },
  { value: 'dark', icon: Moon, labelKey: 'appearance.themeDark', descriptionKey: 'appearance.themeDarkDesc' },
  { value: 'system', icon: Monitor, labelKey: 'appearance.themeSystem', descriptionKey: 'appearance.themeSystemDesc' },
]

export function AppearancePreferencesTab() {
  const { t, i18n } = useTranslation()
  const { theme, setTheme } = useTheme()

  return (
    <Card className="overflow-hidden border-border/70 bg-card/90 shadow-[0_24px_72px_rgba(35,94,138,0.12)]">
      <div className="relative overflow-hidden px-6 py-5">
        <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(135deg,hsl(var(--primary)/0.2),transparent_72%)]" />
        <div aria-hidden="true" className="absolute right-0 top-0 h-28 w-28 rounded-full bg-cyan-100/70 blur-3xl" />
        <div className="relative">
          <CardTitle className="text-xl font-bold tracking-tight">{t('appearance.title')}</CardTitle>
          <CardDescription className="mt-1 max-w-2xl text-sm">{t('appearance.description')}</CardDescription>
        </div>
      </div>

      <CardContent className="space-y-8 p-6">
        <div className="space-y-4">
          <Label className="text-base font-semibold">{t('appearance.themeLabel')}</Label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {THEME_OPTIONS.map(({ value, icon: Icon, labelKey, descriptionKey }) => (
              <button
                key={value}
                type="button"
                aria-pressed={theme === value}
                onClick={() => setTheme(value)}
                className={cn(
                  'group relative flex flex-col items-start gap-4 rounded-[1.75rem] border p-5 text-left transition-[background-color,border-color,box-shadow,transform] duration-200 motion-reduce:transform-none',
                  theme === value
                    ? 'border-primary/30 bg-[linear-gradient(160deg,hsl(var(--primary)/0.16),hsl(var(--card))_72%)] shadow-[0_18px_42px_rgba(35,94,138,0.15)]'
                    : 'border-border/60 bg-secondary/45 hover:border-primary/30 hover:bg-card/92',
                )}
              >
                <div
                  className={cn(
                    'w-full rounded-[1.35rem] border border-white/50 p-3 shadow-inner shadow-white/50 dark:border-border/40 dark:shadow-none',
                    value === 'light' && 'bg-[linear-gradient(180deg,#ffffff,#e8f5fb)]',
                    value === 'dark' && 'bg-[linear-gradient(180deg,#102033,#162b45)]',
                    value === 'system' && 'bg-[linear-gradient(90deg,#ffffff_0%,#eef8fc_50%,#162b45_50%,#102033_100%)]',
                  )}
                >
                  <div className="h-2 w-16 rounded-full bg-primary/20" />
                  <div className="mt-3 grid gap-2">
                    <div className={cn('h-8 rounded-xl', value === 'dark' ? 'bg-white/8' : 'bg-white/80')} />
                    <div className="grid grid-cols-2 gap-2">
                      <div className={cn('h-6 rounded-lg', value === 'dark' ? 'bg-white/10' : 'bg-primary/14')} />
                      <div className={cn('h-6 rounded-lg', value === 'dark' ? 'bg-white/6' : 'bg-sky-100')} />
                    </div>
                  </div>
                </div>

                <div
                  className={cn(
                    'flex h-12 w-12 items-center justify-center rounded-2xl border transition-[background-color,border-color,color,transform] duration-200 motion-reduce:transform-none',
                    theme === value
                      ? 'border-primary/30 bg-primary text-primary-foreground shadow-[0_12px_24px_hsl(var(--primary)/0.24)]'
                      : 'border-border/60 bg-background text-muted-foreground group-hover:border-primary/30',
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>

                <div className="space-y-1">
                  <p
                    className={cn(
                      'text-base font-semibold transition-colors',
                      theme === value ? 'text-foreground' : 'text-foreground/80',
                    )}
                  >
                    {t(labelKey)}
                  </p>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {t(descriptionKey)}
                  </p>
                </div>

                {theme === value ? (
                  <div className="absolute right-4 top-4">
                    <div className="h-3 w-3 rounded-full bg-primary shadow-sm shadow-primary/50" />
                  </div>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <Label htmlFor="parkly-locale" className="text-base font-semibold">
            {t('appearance.languageLabel')}
          </Label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <button
              type="button"
              aria-pressed={i18n.language.startsWith('vi')}
              onClick={() => setAppLocale('vi')}
              className={cn(
                'flex items-center gap-4 rounded-[1.75rem] border p-5 text-left transition-[background-color,border-color,box-shadow,transform] duration-200 motion-reduce:transform-none',
                i18n.language.startsWith('vi')
                  ? 'border-primary/30 bg-[linear-gradient(160deg,hsl(var(--primary)/0.16),hsl(var(--card))_78%)] shadow-[0_18px_42px_rgba(35,94,138,0.15)]'
                  : 'border-border/60 bg-secondary/45 hover:border-primary/30 hover:bg-card/92',
              )}
            >
              <div
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-xl border-2 text-base font-bold tracking-[0.2em] transition-[background-color,border-color,color] duration-200',
                  i18n.language.startsWith('vi')
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border/60 bg-background text-muted-foreground',
                )}
              >
                VI
              </div>
              <div className="space-y-1">
                <p className="text-base font-semibold">{t('appearance.languageVi')}</p>
                <p className="text-sm text-muted-foreground">{t('appearance.languageViDesc')}</p>
              </div>
              {i18n.language.startsWith('vi') ? (
                <div className="ml-auto h-3 w-3 rounded-full bg-primary shadow-sm shadow-primary/50" />
              ) : null}
            </button>

            <button
              type="button"
              aria-pressed={i18n.language.startsWith('en')}
              onClick={() => setAppLocale('en')}
              className={cn(
                'flex items-center gap-4 rounded-[1.75rem] border p-5 text-left transition-[background-color,border-color,box-shadow,transform] duration-200 motion-reduce:transform-none',
                i18n.language.startsWith('en')
                  ? 'border-primary/30 bg-[linear-gradient(160deg,hsl(var(--primary)/0.16),hsl(var(--card))_78%)] shadow-[0_18px_42px_rgba(35,94,138,0.15)]'
                  : 'border-border/60 bg-secondary/45 hover:border-primary/30 hover:bg-card/92',
              )}
            >
              <div
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-xl border-2 text-base font-bold tracking-[0.2em] transition-[background-color,border-color,color] duration-200',
                  i18n.language.startsWith('en')
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border/60 bg-background text-muted-foreground',
                )}
              >
                EN
              </div>
              <div className="space-y-1">
                <p className="text-base font-semibold">{t('appearance.languageEn')}</p>
                <p className="text-sm text-muted-foreground">{t('appearance.languageEnDesc')}</p>
              </div>
              {i18n.language.startsWith('en') ? (
                <div className="ml-auto h-3 w-3 rounded-full bg-primary shadow-sm shadow-primary/50" />
              ) : null}
            </button>
          </div>
          <p className="text-sm text-muted-foreground">{t('appearance.languageHint')}</p>
        </div>
      </CardContent>
    </Card>
  )
}
