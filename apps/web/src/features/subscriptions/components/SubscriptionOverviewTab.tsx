import { CalendarDays, Car, MapPin, UserRound } from 'lucide-react'
import { InlineMessage } from '@/components/ops/console'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { SubscriptionDetail } from '../types'

function formatDate(value: string | null | undefined) {
  return value ? value.slice(0, 10) : '—'
}

function pickPrimaryLabel<T extends { isPrimary: boolean; status: string }>(rows: T[]) {
  return rows.find((row) => row.isPrimary && row.status === 'ACTIVE') ?? rows.find((row) => row.isPrimary) ?? rows[0] ?? null
}

type Props = {
  detail: SubscriptionDetail
  readOnly: boolean
  onEditOverview: () => void
}

export function SubscriptionOverviewTab({ detail, readOnly, onEditOverview }: Props) {
  const primaryVehicle = pickPrimaryLabel(detail.vehicles)
  const primarySpot = pickPrimaryLabel(detail.spots)
  const activeVehicles = detail.vehicles.filter((vehicle) => vehicle.status === 'ACTIVE').length
  const activeSpots = detail.spots.filter((spot) => spot.status === 'ACTIVE').length

  const cards = [
    {
      key: 'customer',
      label: 'Customer',
      icon: UserRound,
      value: detail.customerName,
      meta: [detail.customerId, detail.customerPhone || null].filter(Boolean).join(' · ') || 'No customer phone in current payload',
    },
    {
      key: 'plan',
      label: 'Plan & validity',
      icon: CalendarDays,
      value: detail.planType,
      meta: `${formatDate(detail.startDate)} → ${formatDate(detail.endDate)}`,
    },
    {
      key: 'vehicle',
      label: 'Primary vehicle',
      icon: Car,
      value: primaryVehicle?.plateCompact || primaryVehicle?.licensePlate || 'No linked vehicle',
      meta: primaryVehicle ? `${primaryVehicle.status}${primaryVehicle.vehicleType ? ` · ${primaryVehicle.vehicleType}` : ''}` : `${activeVehicles} active vehicle(s)`,
    },
    {
      key: 'spot',
      label: 'Primary spot',
      icon: MapPin,
      value: primarySpot?.spotCode || 'No linked spot',
      meta: primarySpot ? `${primarySpot.status} · ${primarySpot.assignedMode} · Zone ${primarySpot.zoneCode}` : `${activeSpots} active spot assignment(s)`,
    },
  ]

  return (
    <div className="space-y-4">
      {!readOnly ? null : (
        <InlineMessage tone="info">
          You are in read-only mode for this workspace. Detail remains visible, but create and patch actions are hidden.
        </InlineMessage>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {cards.map(({ key, label, icon: Icon, value, meta }) => (
          <section key={key} className="rounded-2xl border border-border/70 bg-background/40 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-mono-data uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
                <p className="mt-2 text-sm font-semibold text-foreground">{value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{meta}</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-border/60 bg-muted/20 text-muted-foreground">
                <Icon className="h-4 w-4" />
              </div>
            </div>
          </section>
        ))}
      </div>

      <section className="rounded-2xl border border-border/70 bg-muted/15 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-mono-data uppercase tracking-[0.16em] text-muted-foreground">Operational summary</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="outline">{detail.siteCode} · {detail.siteName}</Badge>
              <Badge variant="entry">{activeVehicles} active vehicle{activeVehicles === 1 ? '' : 's'}</Badge>
              <Badge variant="entry">{activeSpots} active spot{activeSpots === 1 ? '' : 's'}</Badge>
              <Badge variant="secondary">status {detail.effectiveStatus}</Badge>
            </div>
          </div>
          {!readOnly ? <Button variant="outline" onClick={onEditOverview}>Edit overview</Button> : null}
        </div>
      </section>
    </div>
  )
}
