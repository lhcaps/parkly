import { memo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  actorHeadline,
  entityHeadline,
  formatDateTime,
  summarizeAudit,
  toneForAction,
} from '@/features/audit-viewer/audit-viewer-model'
import type { AuditRecord } from '@/lib/contracts/audit'
import { cn } from '@/lib/utils'

export const AuditTable = memo(function AuditTable({
  rows,
  selectedAuditId,
  onSelect,
}: {
  rows: AuditRecord[]
  selectedAuditId: string
  onSelect: (row: AuditRecord) => void
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-border text-sm">
        <thead>
          <tr className="text-left text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">
            <th className="px-4 py-3">Audit</th>
            <th className="px-4 py-3">Action</th>
            <th className="px-4 py-3">Actor</th>
            <th className="px-4 py-3">Entity</th>
            <th className="px-4 py-3">Correlation</th>
            <th className="px-4 py-3">Occurred</th>
            <th className="px-4 py-3 text-right">Open</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/70">
          {rows.map((row) => {
            const summary = summarizeAudit(row)
            const selected = row.auditId === selectedAuditId
            return (
              <tr key={row.auditId} className={cn('perf-list-item transition-colors', selected ? 'bg-primary/6' : 'hover:bg-muted/20')}>
                <td className="px-4 py-3 align-top">
                  <p className="font-mono-data text-xs font-semibold text-foreground">{row.auditId}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{row.siteCode || '—'}</p>
                </td>
                <td className="px-4 py-3 align-top">
                  <Badge variant={toneForAction(row.action)}>{row.action}</Badge>
                  {summary.changedKeys.length > 0 ? (
                    <p className="mt-2 max-w-[280px] text-xs text-muted-foreground">changed: {summary.changedKeys.join(', ')}</p>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">No diff keys.</p>
                  )}
                </td>
                <td className="px-4 py-3 align-top">
                  <p className="text-sm font-medium text-foreground">{actorHeadline(row.actor, row.actorUserId)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{row.actor?.role || row.actor?.principalType || '—'}</p>
                </td>
                <td className="px-4 py-3 align-top">
                  <p className="text-sm text-foreground">{entityHeadline(row)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">before {summary.beforeKeys} after {summary.afterKeys}</p>
                </td>
                <td className="px-4 py-3 align-top">
                  <p className="max-w-[180px] break-all text-xs text-foreground">{row.correlationId || row.requestId || '—'}</p>
                </td>
                <td className="px-4 py-3 align-top text-xs text-muted-foreground">{formatDateTime(row.occurredAt || row.createdAt)}</td>
                <td className="px-4 py-3 align-top text-right">
                  <Button variant={selected ? 'secondary' : 'outline'} size="sm" onClick={() => onSelect(row)}>
                    {selected ? 'Opened' : 'Open'}
                  </Button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
})
