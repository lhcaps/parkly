import { useTranslation } from 'react-i18next'
import { Monitor, Moon, Sun } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { type AppLocale, setAppLocale } from '@/i18n'
import { type ThemeChoice, useTheme } from '@/providers/ThemeProvider'

const THEME_OPTIONS: Array<{
  value: ThemeChoice
  icon: typeof Sun
  labelKey: string
  description: string
}> = [
  { value: 'light', icon: Sun, labelKey: 'appearance.themeLight', description: 'appearance.themeLightDesc' },
  { value: 'dark', icon: Moon, labelKey: 'appearance.themeDark', description: 'appearance.themeDarkDesc' },
  { value: 'system', icon: Monitor, labelKey: 'appearance.themeSystem', description: 'appearance.themeSystemDesc' },
]

export function AppearancePreferencesTab() {
  const { t, i18n } = useTranslation()
  const { theme, setTheme } = useTheme()

  return (
    <Card className="border-border/80 bg-card/95 overflow-hidden">
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-6 py-5">
        <CardTitle className="text-xl font-bold tracking-tight">{t('appearance.title')}</CardTitle>
        <CardDescription className="text-sm mt-1">{t('appearance.description')}</CardDescription>
      </div>

      <CardContent className="p-6 space-y-8">
        {/* Theme Selection - Large Touch-Friendly Buttons */}
        <div className="space-y-4">
          <Label className="text-base font-semibold">{t('appearance.themeLabel')}</Label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {THEME_OPTIONS.map(({ value, icon: Icon, labelKey, description }) => (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                className={cn(
                  'group relative flex flex-col items-start gap-4 rounded-2xl border-2 p-6 transition-all duration-200 text-left',
                  theme === value
                    ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20'
                    : 'border-border/60 bg-muted/30 hover:border-primary/40 hover:bg-muted/50',
                )}
              >
                {/* Icon */}
                <div
                  className={cn(
                    'flex h-14 w-14 items-center justify-center rounded-2xl border-2 transition-all duration-200',
                    theme === value
                      ? 'border-primary bg-primary text-primary-foreground shadow-md'
                      : 'border-border/60 bg-background text-muted-foreground group-hover:border-primary/30',
                  )}
                >
                  <Icon className="h-7 w-7" />
                </div>

                {/* Text */}
                <div className="space-y-1">
                  <p className={cn(
                    'text-base font-semibold transition-colors',
                    theme === value ? 'text-foreground' : 'text-foreground/80',
                  )}>
                    {t(labelKey)}
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {t(description)}
                  </p>
                </div>

                {/* Active indicator */}
                {theme === value && (
                  <div className="absolute right-4 top-4">
                    <div className="h-3 w-3 rounded-full bg-primary shadow-sm shadow-primary/50" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Language Selection - Large Select */}
        <div className="space-y-4">
          <Label htmlFor="parkly-locale" className="text-base font-semibold">
            {t('appearance.languageLabel')}
          </Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setAppLocale('vi')}
              className={cn(
                'flex items-center gap-4 rounded-2xl border-2 p-5 transition-all duration-200 text-left',
                i18n.language.startsWith('vi')
                  ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20'
                  : 'border-border/60 bg-muted/30 hover:border-primary/40 hover:bg-muted/50',
              )}
            >
              <div className={cn(
                'flex h-12 w-12 items-center justify-center rounded-xl border-2 text-2xl font-bold transition-all',
                i18n.language.startsWith('vi')
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border/60 bg-background text-muted-foreground',
              )}>
                🇻🇳
              </div>
              <div className="space-y-1">
                <p className="text-base font-semibold">{t('appearance.languageVi')}</p>
                <p className="text-sm text-muted-foreground">Tiếng Việt</p>
              </div>
              {i18n.language.startsWith('vi') && (
                <div className="ml-auto h-3 w-3 rounded-full bg-primary shadow-sm shadow-primary/50" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setAppLocale('en')}
              className={cn(
                'flex items-center gap-4 rounded-2xl border-2 p-5 transition-all duration-200 text-left',
                i18n.language.startsWith('en')
                  ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20'
                  : 'border-border/60 bg-muted/30 hover:border-primary/40 hover:bg-muted/50',
              )}
            >
              <div className={cn(
                'flex h-12 w-12 items-center justify-center rounded-xl border-2 text-2xl font-bold transition-all',
                i18n.language.startsWith('en')
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border/60 bg-background text-muted-foreground',
              )}>
                🇬🇧
              </div>
              <div className="space-y-1">
                <p className="text-base font-semibold">{t('appearance.languageEn')}</p>
                <p className="text-sm text-muted-foreground">English</p>
              </div>
              {i18n.language.startsWith('en') && (
                <div className="ml-auto h-3 w-3 rounded-full bg-primary shadow-sm shadow-primary/50" />
              )}
            </button>
          </div>
          <p className="text-sm text-muted-foreground">{t('appearance.languageHint')}</p>
        </div>
      </CardContent>
    </Card>
  )
}
