import type { ComponentType } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export type QuickActionItem = {
  to: string
  label: string
  helper: string
  badge?: string
  icon: ComponentType<{ className?: string }>
}

export function QuickActionsCard({
  title,
  description,
  actions,
}: {
  title: string
  description: string
  actions: QuickActionItem[]
}) {
  const { t } = useTranslation()

  return (
    <Card className="border-border/70 bg-card/90 shadow-[0_18px_56px_rgba(35,94,138,0.1)]">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {actions.map(({ to, label, helper, badge, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                'group relative block rounded-2xl border border-border/60 bg-background/40 p-4 transition-all duration-300',
                'hover:border-primary/35 hover:bg-primary/8 hover:shadow-[0_14px_42px_rgba(35,94,138,0.14)] hover:-translate-y-1',
                'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary transition-all duration-300 group-hover:scale-105 group-hover:bg-primary/15 group-hover:border-primary/30">
                  <Icon className="h-4 w-4 transition-transform duration-300 group-hover:scale-110" />
                </div>
                {badge ? (
                  <Badge variant="outline" className="shrink-0 text-[10px] transition-colors duration-300 group-hover:border-primary/40">
                    {t(badge)}
                  </Badge>
                ) : null}
              </div>

              <div className="mt-4">
                <p className="font-medium text-foreground transition-colors duration-300 group-hover:text-primary/90">{t(label)}</p>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{t(helper)}</p>
              </div>

              {/* Arrow indicator at bottom right */}
              <div className="mt-4 flex items-center justify-end">
                <div className="flex h-7 w-7 items-center justify-center rounded-full border border-primary/20 bg-primary/5 text-primary opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:scale-110 group-hover:bg-primary/10 group-hover:border-primary/30">
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
                </div>
              </div>

              {/* Gradient underline bar */}
              <div className="absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 rounded-b-2xl bg-gradient-to-r from-primary/40 via-primary/75 to-sky-300 transition-transform duration-300 group-hover:scale-x-100" />
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
