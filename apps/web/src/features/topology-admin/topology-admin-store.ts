import { create } from 'zustand'

export type TopologyAdminState = {
  siteCode: string | null
  selectedNodeId: string | null
  drawerOpen: boolean
  drawerDeviceId: string | null
  drawerLaneId: string | null
  draggedDeviceId: string | null
}

type TopologyAdminActions = {
  setSiteCode: (code: string | null) => void
  selectNode: (nodeId: string | null) => void
  openDrawer: (deviceId: string, laneId: string) => void
  closeDrawer: () => void
  setDraggedDevice: (deviceId: string | null) => void
  reset: () => void
}

const initialState: TopologyAdminState = {
  siteCode: null,
  selectedNodeId: null,
  drawerOpen: false,
  drawerDeviceId: null,
  drawerLaneId: null,
  draggedDeviceId: null,
}

export const useTopologyAdminStore = create<TopologyAdminState & TopologyAdminActions>()((set) => ({
  ...initialState,

  setSiteCode: (code) => set({ siteCode: code }),

  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

  openDrawer: (deviceId, laneId) =>
    set({ drawerOpen: true, drawerDeviceId: deviceId, drawerLaneId: laneId }),

  closeDrawer: () =>
    set({ drawerOpen: false, drawerDeviceId: null, drawerLaneId: null }),

  setDraggedDevice: (deviceId) => set({ draggedDeviceId: deviceId }),

  reset: () => set(initialState),
}))
