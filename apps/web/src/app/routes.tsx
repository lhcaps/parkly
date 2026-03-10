import type { ReactElement } from 'react'
import {
  Activity,
  ArrowRightLeft,
  Camera,
  ClipboardCheck,
  Cpu,
  LayoutGrid,
  RadioTower,
  Settings,
  Smartphone,
  History,
} from 'lucide-react'
import { ReviewQueuePage } from '@/pages/ReviewQueuePage'
import { SessionsPage } from '@/pages/SessionsPage'
import { LaneMonitorPage } from '@/pages/LaneMonitorPage'
import { DeviceHealthPage } from '@/pages/DeviceHealthPage'
import { OutboxMonitorPage } from '@/pages/OutboxMonitorPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { MobileCapturePage } from '@/pages/MobileCapturePage'
import { OverviewPage } from '@/pages/OverviewPage'
import { RunLanePage } from '@/pages/RunLanePage'
import { CaptureDebugPage } from '@/pages/CaptureDebugPage'
import { MobileCameraPairPage } from '@/pages/MobileCameraPairPage'

export type AppNavGroupKey = 'Operations' | 'Monitoring' | 'Capture' | 'System'

export type AppNavItem = {
  path: string
  label: string
  shortLabel: string
  description: string
  badge?: string
  group: AppNavGroupKey
  icon: typeof Activity
  element: ReactElement
  hidden?: boolean
  standalone?: boolean
}

export const APP_NAV_ITEMS: AppNavItem[] = [
  {
    path: '/overview',
    label: 'Overview',
    shortLabel: 'Overview',
    description: 'Điểm vào điều hành theo task: lane, queue, health và outbox.',
    badge: 'default',
    group: 'Operations',
    icon: LayoutGrid,
    element: <OverviewPage />,
  },
  {
    path: '/run-lane',
    label: 'Run Lane',
    shortLabel: 'Run Lane',
    description: 'Run Lane v3 với scoped store, layout 3 cột và điểm vào cho preview/submit authoritative.',
    badge: 'entry',
    group: 'Operations',
    icon: ArrowRightLeft,
    element: <RunLanePage />,
  },
  {
    path: '/review-queue',
    label: 'Review Queue',
    shortLabel: 'Review',
    description: 'Claim review, manual approve/reject và audit trail.',
    badge: 'amber',
    group: 'Operations',
    icon: ClipboardCheck,
    element: <ReviewQueuePage />,
  },
  {
    path: '/session-history',
    label: 'Session History',
    shortLabel: 'Sessions',
    description: 'Timeline của session, decision, barrier và bằng chứng.',
    group: 'Operations',
    icon: History,
    element: <SessionsPage />,
  },
  {
    path: '/lane-monitor',
    label: 'Lane Monitor',
    shortLabel: 'Lane Monitor',
    description: 'Realtime lane cards, barrier state và session mới nhất.',
    group: 'Monitoring',
    icon: Activity,
    element: <LaneMonitorPage />,
  },
  {
    path: '/device-health',
    label: 'Device Health',
    shortLabel: 'Devices',
    description: 'Heartbeat aging, online/degraded/offline theo thiết bị.',
    group: 'Monitoring',
    icon: Cpu,
    element: <DeviceHealthPage />,
  },
  {
    path: '/sync-outbox',
    label: 'Sync Outbox',
    shortLabel: 'Outbox',
    description: 'Outbox feed, retry state và backlog đồng bộ.',
    group: 'Monitoring',
    icon: RadioTower,
    element: <OutboxMonitorPage />,
  },
  {
    path: '/mobile-camera-pair',
    label: 'Mobile Camera Pair',
    shortLabel: 'Pair Mobile',
    description: 'Ghép điện thoại thành camera edge và tạo link cấu hình nhanh.',
    group: 'Capture',
    icon: Smartphone,
    element: <MobileCameraPairPage />,
  },
  {
    path: '/capture-debug',
    label: 'Capture Debug',
    shortLabel: 'Capture Debug',
    description: 'Quan sát ALPR capture feed, heartbeat và debug edge camera.',
    group: 'Capture',
    icon: Camera,
    element: <CaptureDebugPage />,
  },
  {
    path: '/settings',
    label: 'Settings',
    shortLabel: 'Settings',
    description: 'Auth token, environment và hướng dẫn vận hành console.',
    group: 'System',
    icon: Settings,
    element: <SettingsPage />,
  },
  {
    path: '/mobile-capture',
    label: 'Mobile Capture',
    shortLabel: 'Mobile Capture',
    description: 'Trang standalone trên điện thoại để chụp và gửi capture.',
    group: 'Capture',
    icon: Smartphone,
    element: <MobileCapturePage />,
    hidden: true,
    standalone: true,
  },
]

export const APP_SHELL_NAV_GROUPS: AppNavGroupKey[] = ['Operations', 'Monitoring', 'Capture', 'System']

export const SHELL_ROUTES = APP_NAV_ITEMS.filter((item) => !item.hidden && !item.standalone)
export const STANDALONE_ROUTES = APP_NAV_ITEMS.filter((item) => item.standalone)

export const LEGACY_ROUTE_REDIRECTS: Array<{ from: string; to: string }> = [
  { from: '/', to: '/overview' },
  { from: '/dashboard', to: '/overview' },
  { from: '/manual-control', to: '/run-lane' },
  { from: '/gate', to: '/run-lane' },
  { from: '/sessions', to: '/session-history' },
  { from: '/outbox-monitor', to: '/sync-outbox' },
  { from: '/gate-events', to: '/capture-debug' },
  { from: '/devices', to: '/device-health' },
  { from: '/reports', to: '/overview' },
]

export function getRouteMeta(pathname: string) {
  return APP_NAV_ITEMS.find((item) => item.path === pathname) ?? null
}

export function getNavItemsByGroup(group: AppNavGroupKey) {
  return SHELL_ROUTES.filter((item) => item.group === group)
}

