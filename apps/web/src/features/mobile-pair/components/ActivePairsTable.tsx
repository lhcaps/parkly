import { Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmActionButton } from '@/components/state/page-state'
import { deriveActiveMobilePairOriginState, type ActiveMobilePair } from '@/lib/api/mobile'

export function ActivePairsTable({
  rows,
  effectiveOrigin,
  onOpen,
  onCopy,
  onRemove,
}: {
  rows: ActiveMobilePair[]
  effectiveOrigin: string
  onOpen: (row: ActiveMobilePair) => void
  onCopy: (row: ActiveMobilePair) => void
  onRemove: (pairId: string) => void
}) {
  return (
    <div className="rounded-3xl border border-border/80 bg-card/95 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.12)]">
      <div className="mb-4">
        <p className="text-sm font-medium">Active pairs</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Stored in the browser local registry for quick re-opening or copying of pair links.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 bg-background/40 px-4 py-10 text-center text-sm text-muted-foreground">
          No pairs saved on this browser.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const originState = deriveActiveMobilePairOriginState(row, effectiveOrigin)
            return (
              <div key={row.pairId} className="rounded-2xl border border-border/80 bg-background/40 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={row.direction === 'ENTRY' ? 'entry' : 'exit'}>{row.direction}</Badge>
                      <Badge variant="outline">{row.siteCode}</Badge>
                      <Badge variant="outline">{row.laneCode}</Badge>
                      <Badge variant="muted">{row.deviceCode}</Badge>
                      <Badge variant={originState.variant}>{originState.label}</Badge>
                    </div>

                    <p className="mt-2 break-all font-mono-data text-xs text-muted-foreground">{row.pairUrl}</p>
                    <p className="mt-2 break-all font-mono-data text-[11px] text-muted-foreground">
                      origin {row.pairOrigin || '—'} · registry v{row.registryVersion}
                      {row.migratedAt ? ` · migrated ${new Date(row.migratedAt).toLocaleString('vi-VN')}` : ''}
                    </p>
                    <p className="mt-2 text-[11px] text-muted-foreground">{originState.detail}</p>
                    <p className="mt-2 text-[11px] font-mono-data text-muted-foreground">
                      created {new Date(row.createdAt).toLocaleString('vi-VN')} · last open {new Date(row.lastOpenedAt).toLocaleString('vi-VN')}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => onCopy(row)}>
                      Copy
                    </Button>
                    <Button type="button" size="sm" onClick={() => onOpen(row)}>
                      Open
                    </Button>
                    <ConfirmActionButton
                      variant="ghost"
                      size="sm"
                      confirmTitle="Remove pair from list?"
                      confirmDescription="This only removes the entry from this browser's local registry. The pair token on the server is not revoked; you can still use the link until it expires."
                      onConfirm={() => onRemove(row.pairId)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </ConfirmActionButton>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
