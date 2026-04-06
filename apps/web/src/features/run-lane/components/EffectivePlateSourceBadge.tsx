import { Cpu, Keyboard, ScanSearch } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import type { RunLaneEffectivePlateSource } from '@/features/run-lane/store/runLaneTypes'

export function EffectivePlateSourceBadge({
  source,
  hasValue,
}: {
  source: RunLaneEffectivePlateSource
  hasValue?: boolean
}) {
  const { t } = useTranslation()

  if (!hasValue || source === 'none') {
    return (
      <Badge variant="outline">
        <ScanSearch className="h-3 w-3" />
        {t('runLaneCapture.effectivePlateNone')}
      </Badge>
    )
  }

  if (source === 'manual_override') {
    return (
      <Badge variant="amber">
        <Keyboard className="h-3 w-3" />
        {t('runLaneCapture.effectivePlateManual')}
      </Badge>
    )
  }

  return (
    <Badge variant="secondary">
      <Cpu className="h-3 w-3" />
      {t('runLaneCapture.effectivePlateBackend')}
    </Badge>
  )
}
