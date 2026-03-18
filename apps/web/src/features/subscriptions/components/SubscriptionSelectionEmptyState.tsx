import { EmptySelectionCard } from '@/components/ops/console'

type Props = {
  hasRows: boolean
  reason?: string
  onResetFilters?: () => void
}

export function SubscriptionSelectionEmptyState({ hasRows, reason, onResetFilters }: Props) {
  if (!hasRows) {
    return (
      <EmptySelectionCard
        title="No subscriptions in the current result set"
        description={reason || 'This is an empty business result. Adjust filters or reset the workspace to load a broader set of subscriptions.'}
        action={onResetFilters ? { label: 'Reset filters', onClick: onResetFilters } : undefined}
      />
    )
  }

  return (
    <EmptySelectionCard
      title="Select a subscription"
      description={reason || 'Choose a row from the list to inspect overview details, linked spots, and linked vehicles.'}
    />
  )
}
