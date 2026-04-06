import { useCallback, useState } from 'react'
import { toAppErrorDisplay } from '@/lib/http/errors'
import { canAccessAction } from '@/lib/auth/role-policy'
import { createSubscription, patchSubscription } from '../api/subscriptions'
import {
  createSubscriptionSpot,
  createSubscriptionVehicle,
  patchSubscriptionSpot,
  patchSubscriptionVehicle,
} from '../api/subscription-assets'
import type {
  SubscriptionCreateInput,
  SubscriptionMutationState,
  SubscriptionSpotMutationInput,
  SubscriptionSpotPatchInput,
  SubscriptionStatus,
  SubscriptionVehicleMutationInput,
  SubscriptionVehiclePatchInput,
} from '../types'
import type { AuthRole } from '@/lib/contracts/auth'

export type SubscriptionMutationHookArgs = {
  operatorRole: string
  selectedId: string
  reloadList: () => Promise<void>
  reloadDetail: (subscriptionId?: string) => Promise<void>
  focusSubscription: (subscriptionId: string, options?: { siteCode?: string; status?: string; plate?: string; activeTab?: string }) => void
}

export type SubscriptionMutationHookResult = {
  state: SubscriptionMutationState
  canMutate: boolean
  clearMessages: () => void
  createSubscription: (input: SubscriptionCreateInput) => Promise<boolean>
  patchSubscriptionStatus: (subscriptionId: string, status: SubscriptionStatus) => Promise<boolean>
  updateSubscription: (subscriptionId: string, patch: { planType?: 'MONTHLY' | 'VIP'; startDate?: string; endDate?: string }) => Promise<boolean>
  createVehicleLink: (input: SubscriptionVehicleMutationInput) => Promise<boolean>
  updateVehicleLink: (subscriptionId: string, subscriptionVehicleId: string, patch: SubscriptionVehiclePatchInput, successMessage?: string) => Promise<boolean>
  createSpotLink: (input: SubscriptionSpotMutationInput) => Promise<boolean>
  updateSpotLink: (subscriptionId: string, subscriptionSpotId: string, patch: SubscriptionSpotPatchInput, successMessage?: string) => Promise<boolean>
}

const EMPTY_STATE: SubscriptionMutationState = {
  busy: false,
  error: '',
  success: '',
  action: '',
}

export function useSubscriptionMutations({
  operatorRole,
  selectedId,
  reloadList,
  reloadDetail,
  focusSubscription,
}: SubscriptionMutationHookArgs): SubscriptionMutationHookResult {
  const [state, setState] = useState<SubscriptionMutationState>(EMPTY_STATE)
  const canMutate = canAccessAction(operatorRole as AuthRole, 'subscription.manage')

  const clearMessages = useCallback(() => {
    setState(EMPTY_STATE)
  }, [])

  const runMutation = useCallback(async <T,>(
    action: string,
    work: () => Promise<T>,
    after: (result: T) => Promise<void>,
    successMessage: string,
  ) => {
    if (!canMutate) {
      setState({ busy: false, error: 'Current role is read-only for subscription mutations.', success: '', action })
      return false
    }

    setState({ busy: true, error: '', success: '', action })
    try {
      const result = await work()
      await after(result)
      setState({ busy: false, error: '', success: successMessage, action })
      return true
    } catch (error) {
      const display = toAppErrorDisplay(error, `${action} failed`)
      const errorMessage = action === 'Create subscription' && display.code === 'NOT_FOUND'
        ? 'Customer not found. Use an existing customer_id, phone number, or email.'
        : display.message
      setState({
        busy: false,
        error: errorMessage + (display.requestId ? ` (requestId: ${display.requestId})` : ''),
        success: '',
        action,
      })
      return false
    }
  }, [canMutate])

  const createSubscriptionFlow = useCallback(async (input: SubscriptionCreateInput) => {
    return runMutation(
      'Create subscription',
      () => createSubscription(input),
      async (created) => {
        await reloadList()
        focusSubscription(created.subscriptionId, {
          siteCode: created.siteCode,
          status: '',
          plate: '',
          activeTab: 'overview',
        })
        await reloadDetail(created.subscriptionId)
      },
      'Subscription created successfully.',
    )
  }, [focusSubscription, reloadDetail, reloadList, runMutation])

  const patchSubscriptionStatusFlow = useCallback(async (subscriptionId: string, status: SubscriptionStatus) => {
    return runMutation(
      'Change subscription status',
      () => patchSubscription(subscriptionId, { status }),
      async (updated) => {
        await reloadList()
        await reloadDetail(updated.subscriptionId)
      },
      `Subscription status updated to ${status}.`,
    )
  }, [reloadDetail, reloadList, runMutation])

  const updateSubscriptionFlow = useCallback(async (subscriptionId: string, patch: { planType?: 'MONTHLY' | 'VIP'; startDate?: string; endDate?: string }) => {
    return runMutation(
      'Update subscription overview',
      () => patchSubscription(subscriptionId, patch),
      async (updated) => {
        await reloadList()
        await reloadDetail(updated.subscriptionId)
      },
      'Subscription overview updated.',
    )
  }, [reloadDetail, reloadList, runMutation])

  const createVehicleFlow = useCallback(async (input: SubscriptionVehicleMutationInput) => {
    return runMutation(
      'Add linked vehicle',
      () => createSubscriptionVehicle(input),
      async () => {
        await reloadList()
        await reloadDetail(input.subscriptionId)
      },
      'Vehicle link created successfully.',
    )
  }, [reloadDetail, reloadList, runMutation])

  const updateVehicleFlow = useCallback(async (subscriptionId: string, subscriptionVehicleId: string, patch: SubscriptionVehiclePatchInput, successMessage = 'Vehicle link updated.') => {
    return runMutation(
      'Update linked vehicle',
      () => patchSubscriptionVehicle(subscriptionVehicleId, patch),
      async () => {
        await reloadList()
        await reloadDetail(subscriptionId || selectedId)
      },
      successMessage,
    )
  }, [reloadDetail, reloadList, runMutation, selectedId])

  const createSpotFlow = useCallback(async (input: SubscriptionSpotMutationInput) => {
    return runMutation(
      'Add linked spot',
      () => createSubscriptionSpot(input),
      async () => {
        await reloadList()
        await reloadDetail(input.subscriptionId)
      },
      'Spot assignment created successfully.',
    )
  }, [reloadDetail, reloadList, runMutation])

  const updateSpotFlow = useCallback(async (subscriptionId: string, subscriptionSpotId: string, patch: SubscriptionSpotPatchInput, successMessage = 'Spot assignment updated.') => {
    return runMutation(
      'Update linked spot',
      () => patchSubscriptionSpot(subscriptionSpotId, patch),
      async () => {
        await reloadList()
        await reloadDetail(subscriptionId || selectedId)
      },
      successMessage,
    )
  }, [reloadDetail, reloadList, runMutation, selectedId])

  return {
    state,
    canMutate,
    clearMessages,
    createSubscription: createSubscriptionFlow,
    patchSubscriptionStatus: patchSubscriptionStatusFlow,
    updateSubscription: updateSubscriptionFlow,
    createVehicleLink: createVehicleFlow,
    updateVehicleLink: updateVehicleFlow,
    createSpotLink: createSpotFlow,
    updateSpotLink: updateSpotFlow,
  }
}
