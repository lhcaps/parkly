import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getTopology } from '@/lib/api/topology-admin-queries'
import {
  getUnassignedDevices,
  syncLaneDevices,
  createLane,
  updateLane,
  type SyncLaneDevicesPayload,
} from '@/lib/api/topology-admin'

export function useTopologyData(siteCode: string) {
  return useQuery({
    queryKey: ['topology', 'full', siteCode],
    queryFn: () => getTopology(siteCode),
    enabled: !!siteCode,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })
}

export function useUnassignedDevices(siteCode: string | null) {
  return useQuery({
    queryKey: ['topology', 'unassigned', siteCode],
    queryFn: () => getUnassignedDevices(siteCode!),
    enabled: !!siteCode,
    staleTime: 15_000,
  })
}

export function useSyncLaneDevices() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (args: { laneId: string; payload: SyncLaneDevicesPayload }) =>
      syncLaneDevices(args.laneId, args.payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['topology'] })
    },
  })
}

export function useCreateLane() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (args: {
      siteId?: string
      siteCode?: string
      gateCode: string
      laneCode: string
      name: string
      direction: string
      sortOrder?: number
    }) => createLane(args),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['topology'] })
    },
  })
}

export function useUpdateLane() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (args: {
      laneId: string
      payload: Record<string, unknown>
    }) => updateLane(args.laneId, args.payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['topology'] })
    },
  })
}
