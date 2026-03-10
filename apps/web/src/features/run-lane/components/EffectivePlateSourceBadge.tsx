import { Cpu, Keyboard, ScanSearch } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { RunLaneEffectivePlateSource } from '@/features/run-lane/store/runLaneTypes'

export function EffectivePlateSourceBadge({
  source,
  hasValue,
}: {
  source: RunLaneEffectivePlateSource
  hasValue?: boolean
}) {
  if (!hasValue || source === 'none') {
    return (
      <Badge variant="outline">
        <ScanSearch className="h-3 w-3" />
        chưa có effective plate
      </Badge>
    )
  }

  if (source === 'manual_override') {
    return (
      <Badge variant="amber">
        <Keyboard className="h-3 w-3" />
        manual override
      </Badge>
    )
  }

  return (
    <Badge variant="secondary">
      <Cpu className="h-3 w-3" />
      backend preview
    </Badge>
  )
}
