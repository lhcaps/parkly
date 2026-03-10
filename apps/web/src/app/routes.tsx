import type { ReactElement } from 'react'
import {
  Activity,
  ArrowRightLeft,
  Camera,
  ClipboardCheck,
  Cpu,
  History,
  LayoutGrid,
  RadioTower,
  Settings,
  Smartphone,
} from 'lucide-react'
import { CaptureDebugPage } from '@/pages/CaptureDebugPage'
import { DeviceHealthPage } from '@/pages/DeviceHealthPage'
import { LaneMonitorPage } from '@/pages/LaneMonitorPage'
import { MobileCameraPairPage } from '@/pages/MobileCameraPairPage'
import { MobileCapturePage } from '@/pages/MobileCapturePage'
import { OutboxMonitorPage } from '@/pages/OutboxMonitorPage'
import { OverviewPage } from '@/pages/OverviewPage'
import { ReviewQueuePage } from '@/pages/ReviewQueuePage'
import { RunLanePage } from '@/pages/RunLanePage'
import { SessionsPage } from '@/pages/SessionsPage'
import { SettingsPage } from '@/pages/SettingsPage'

export type AppNavGroupKey = 'Operations' | 'Monitoring' | 'Capture' | 'System'

export type AppNavItem = {
  path: string
  label: string
  shortLabel: string
  description: string
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
    description: 'Điểm vào nhanh cho điều phối ca trực, queue và cảnh báo hệ thống.',
    group: 'Operations',
    icon: LayoutGrid,
    element: <OverviewPage />,
  },
  {
    path: '/run-lane',
    label: 'Run Lane',
    shortLabel: 'Run Lane',
    description: 'Xử lý một lượt xe theo lane, từ ảnh vào tới kết quả quyết định.',
    group: 'Operations',
    icon: ArrowRightLeft,
    element: <RunLanePage />,
  },
  {
    path: '/review-queue',
    label: 'Review Queue',
    shortLabel: 'Review',
    description: 'Xử lý các trường hợp cần xác nhận thủ công và hành động tiếp theo.',
    group: 'Operations',
    icon: ClipboardCheck,
    element: <ReviewQueuePage />,
  },
  {
    path: '/session-history',
    label: 'Session History',
    shortLabel: 'Sessions',
    description: 'Tra cứu phiên, quyết định, barrier và bằng chứng theo dòng thời gian.',
    group: 'Operations',
    icon: History,
    element: <SessionsPage />,
  },
  {
    path: '/lane-monitor',
    label: 'Lane Monitor',
    shortLabel: 'Lane Monitor',
    description: 'Theo dõi sức khỏe lane, barrier và trạng thái phiên mới nhất.',
    group: 'Monitoring',
    icon: Activity,
    element: <LaneMonitorPage />,
  },
  {
    path: '/device-health',
    label: 'Device Health',
    shortLabel: 'Devices',
    description: 'Theo dõi heartbeat và suy giảm thiết bị theo site và lane.',
    group: 'Monitoring',
    icon: Cpu,
    element: <DeviceHealthPage />,
  },
  {
    path: '/sync-outbox',
    label: 'Sync Outbox',
    shortLabel: 'Outbox',
    description: 'Quan sát hàng đợi đồng bộ, retry và lỗi downstream.',
    group: 'Monitoring',
    icon: RadioTower,
    element: <OutboxMonitorPage />,
  },
  {
    path: '/mobile-camera-pair',
    label: 'Mobile Camera Pair',
    shortLabel: 'Pair Mobile',
    description: 'Ghép điện thoại vào lane để gửi ảnh và heartbeat từ thiết bị di động.',
    group: 'Capture',
    icon: Smartphone,
    element: <MobileCameraPairPage />,
  },
  {
    path: '/capture-debug',
    label: 'Capture Debug',
    shortLabel: 'Capture',
    description: 'Theo dõi feed capture và kết quả ALPR để xử lý sự cố ingest.',
    group: 'Capture',
    icon: Camera,
    element: <CaptureDebugPage />,
  },
  {
    path: '/settings',
    label: 'Settings',
    shortLabel: 'Settings',
    description: 'Thiết lập truy cập, ngữ cảnh mặc định và chẩn đoán cục bộ.',
    group: 'System',
    icon: Settings,
    element: <SettingsPage />,
  },
  {
    path: '/mobile-capture',
    label: 'Mobile Capture',
    shortLabel: 'Mobile Capture',
    description: 'Màn hình di động để chụp và gửi capture.',
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
