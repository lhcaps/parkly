import type { ComponentType } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export type QuickActionItem = {
  to: string
  label: string
  helper: string
  badge?: string
  icon: ComponentType<{ className?: string }>
}

export function QuickActionsCard({
  title = 'Quick Actions',
  description = 'Đi thẳng vào task đang cần xử lý thay vì đi vòng qua nhiều route.',
  actions,
}: {
  title?: string
  description?: string
  actions: QuickActionItem[]
}) {
  return (
    <Card className="border-border/80 bg-card/95 shadow-[0_18px_60px_rgba(0,0,0,0.12)]">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {actions.map(({ to, label, helper, badge, icon: Icon }) => (
          <div key={to} className="rounded-2xl border border-border/80 bg-background/40 p-4 transition hover:border-primary/30 hover:bg-primary/5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </div>
              {badge ? <Badge variant="outline">{badge}</Badge> : null}
            </div>

            <p className="mt-4 font-medium">{label}</p>
            <p className="mt-1 text-sm text-muted-foreground">{helper}</p>

            <Button asChild variant="outline" size="sm" className="mt-4 justify-start">
              <Link to={to}>
                Mở route
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
