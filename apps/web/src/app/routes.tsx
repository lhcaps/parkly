import { lazy, type ReactElement } from 'react'
import {
  Activity,
  ArrowRightLeft,
  BarChart3,
  Camera,
  ClipboardCheck,
  Cpu,
  CreditCard,
  History,
  LayoutGrid,
  MapPin,
  RadioTower,
  Settings,
  Smartphone,
} from 'lucide-react'
import type { AuthRole } from '@/lib/contracts/auth'

const pageLoaders = {
  overview: () => import('@/pages/OverviewPage').then((module) => ({ default: module.OverviewPage })),
  runLane: () => import('@/pages/RunLanePage').then((module) => ({ default: module.RunLanePage })),
  reviewQueue: () => import('@/pages/ReviewQueuePage').then((module) => ({ default: module.ReviewQueuePage })),
  sessions: () => import('@/pages/SessionsPage').then((module) => ({ default: module.SessionsPage })),
  laneMonitor: () => import('@/pages/LaneMonitorPage').then((module) => ({ default: module.LaneMonitorPage })),
  deviceHealth: () => import('@/pages/DeviceHealthPage').then((module) => ({ default: module.DeviceHealthPage })),
  outbox: () => import('@/pages/OutboxMonitorPage').then((module) => ({ default: module.OutboxMonitorPage })),
  reports: () => import('@/pages/ReportsPage').then((module) => ({ default: module.ReportsPage })),
  mobileCameraPair: () => import('@/pages/MobileCameraPairPage').then((module) => ({ default: module.MobileCameraPairPage })),
  captureDebug: () => import('@/pages/CaptureDebugPage').then((module) => ({ default: module.CaptureDebugPage })),
  settings: () => import('@/pages/SettingsPage').then((module) => ({ default: module.SettingsPage })),
  mobileCapture: () => import('@/pages/MobileCapturePage').then((module) => ({ default: module.MobileCapturePage })),
  subscriptions: () => import('@/pages/SubscriptionsPage').then((module) => ({ default: module.SubscriptionsPage })),
  parkingLive: () => import('@/pages/ParkingLivePage').then((module) => ({ default: module.ParkingLivePage })),
} as const

const OverviewPage = lazy(pageLoaders.overview)
const RunLanePage = lazy(pageLoaders.runLane)
const ReviewQueuePage = lazy(pageLoaders.reviewQueue)
const SessionsPage = lazy(pageLoaders.sessions)
const LaneMonitorPage = lazy(pageLoaders.laneMonitor)
const DeviceHealthPage = lazy(pageLoaders.deviceHealth)
const OutboxMonitorPage = lazy(pageLoaders.outbox)
const ReportsPage = lazy(pageLoaders.reports)
const MobileCameraPairPage = lazy(pageLoaders.mobileCameraPair)
const CaptureDebugPage = lazy(pageLoaders.captureDebug)
const SettingsPage = lazy(pageLoaders.settings)
const MobileCapturePage = lazy(pageLoaders.mobileCapture)
const SubscriptionsPage = lazy(pageLoaders.subscriptions)
const ParkingLivePage = lazy(pageLoaders.parkingLive)

const ROUTE_PRELOADS: Record<string, Array<keyof typeof pageLoaders>> = {
  '/overview': ['reviewQueue', 'sessions', 'runLane', 'subscriptions'],
  '/subscriptions': ['overview'],
  '/parking-live': ['overview'],
  '/run-lane': ['reviewQueue', 'sessions'],
  '/review-queue': ['sessions', 'runLane'],
  '/session-history': ['reviewQueue', 'outbox', 'reports'],
  '/reports': ['overview'],
}

type LoaderKey = keyof typeof pageLoaders

export function preloadRoutesForPath(pathname: string) {
  const targets = ROUTE_PRELOADS[pathname] ?? []
  return Promise.allSettled(targets.map((target) => pageLoaders[target]()))
}

export function preloadRoutesForRole(role?: AuthRole | string) {
  const defaultPath = getDefaultRouteForRole(role)
  return preloadRoutesForPath(defaultPath)
}

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
  allowedRoles?: AuthRole[]
}

export const APP_NAV_ITEMS: AppNavItem[] = [
  {
    path: '/overview',
    label: 'Overview',
    shortLabel: 'Overview',
    description: 'Shift landing page. Queue status, lane alerts, and dependency health at a glance.',
    group: 'Operations',
    icon: LayoutGrid,
    element: <OverviewPage />,
    allowedRoles: ['ADMIN', 'OPS', 'GUARD', 'CASHIER', 'WORKER'],
  },
  {
    path: '/run-lane',
    label: 'Run Lane',
    shortLabel: 'Run Lane',
    description: 'Process a vehicle through a lane — from image capture to decision and gate action.',
    group: 'Operations',
    icon: ArrowRightLeft,
    element: <RunLanePage />,
    allowedRoles: ['ADMIN', 'OPS', 'GUARD'],
  },
  {
    path: '/review-queue',
    label: 'Review Queue',
    shortLabel: 'Review',
    description: 'Claim and resolve cases that require manual operator confirmation.',
    group: 'Operations',
    icon: ClipboardCheck,
    element: <ReviewQueuePage />,
    allowedRoles: ['ADMIN', 'OPS', 'GUARD'],
  },
  {
    path: '/session-history',
    label: 'Session History',
    shortLabel: 'Sessions',
    description: 'Look up sessions, decisions, barrier events, and evidence by timeline.',
    group: 'Operations',
    icon: History,
    element: <SessionsPage />,
    allowedRoles: ['ADMIN', 'OPS', 'GUARD', 'WORKER'],
  },
  {
    path: '/lane-monitor',
    label: 'Lane Monitor',
    shortLabel: 'Lane Monitor',
    description: 'Live lane health, barrier status, and latest session state across sites.',
    group: 'Monitoring',
    icon: Activity,
    element: <LaneMonitorPage />,
    allowedRoles: ['ADMIN', 'OPS', 'GUARD', 'WORKER'],
  },
  {
    path: '/device-health',
    label: 'Device Health',
    shortLabel: 'Devices',
    description: 'Monitor device heartbeats and degradation by site and lane.',
    group: 'Monitoring',
    icon: Cpu,
    element: <DeviceHealthPage />,
    allowedRoles: ['ADMIN', 'OPS', 'GUARD', 'WORKER'],
  },
  {
    path: '/sync-outbox',
    label: 'Sync Outbox',
    shortLabel: 'Outbox',
    description: 'Inspect the sync queue — retries, failures, and downstream delivery status.',
    group: 'Monitoring',
    icon: RadioTower,
    element: <OutboxMonitorPage />,
    allowedRoles: ['ADMIN', 'OPS', 'WORKER'],
  },
  {
    path: '/reports',
    label: 'Reports',
    shortLabel: 'Reports',
    description: 'Operational summaries by site and time window.',
    group: 'Monitoring',
    icon: BarChart3,
    element: <ReportsPage />,
    allowedRoles: ['ADMIN', 'OPS', 'CASHIER', 'WORKER'],
  },
  {
    path: '/mobile-camera-pair',
    label: 'Mobile Camera Pair',
    shortLabel: 'Pair Mobile',
    description: 'Pair a mobile device to a lane for image capture and heartbeat.',
    group: 'Capture',
    icon: Smartphone,
    element: <MobileCameraPairPage />,
    allowedRoles: ['ADMIN', 'OPS', 'GUARD'],
  },
  {
    path: '/capture-debug',
    label: 'Capture Debug',
    shortLabel: 'Capture',
    description: 'Monitor the capture feed and ALPR results to diagnose ingest issues.',
    group: 'Capture',
    icon: Camera,
    element: <CaptureDebugPage />,
    allowedRoles: ['ADMIN', 'OPS', 'GUARD', 'WORKER'],
  },
  {
    path: '/subscriptions',
    label: 'Subscriptions',
    shortLabel: 'Subscriptions',
    description: 'Manage parking subscriptions — vehicles, spot assignments, and status.',
    group: 'Operations',
    icon: CreditCard,
    element: <SubscriptionsPage />,
    allowedRoles: ['ADMIN', 'OPS'],
  },
  {
    path: '/parking-live',
    label: 'Parking Live',
    shortLabel: 'Parking',
    description: 'Realtime parking occupancy — floor view, slot status, and drill-down detail.',
    group: 'Monitoring',
    icon: MapPin,
    element: <ParkingLivePage />,
    allowedRoles: ['ADMIN', 'OPS', 'GUARD'],
  },
  {
    path: '/settings',
    label: 'Settings',
    shortLabel: 'Settings',
    description: 'Configure default context and review auth and runtime diagnostics.',
    group: 'System',
    icon: Settings,
    element: <SettingsPage />,
    allowedRoles: ['ADMIN', 'OPS', 'GUARD', 'CASHIER', 'WORKER'],
  },
  {
    path: '/mobile-capture',
    label: 'Mobile Capture',
    shortLabel: 'Mobile Capture',
    description: 'Mobile screen for capturing and submitting images.',
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
  { from: '/dashboard', to: '/overview' },
  { from: '/manual-control', to: '/run-lane' },
  { from: '/gate', to: '/run-lane' },
  { from: '/sessions', to: '/session-history' },
  { from: '/outbox-monitor', to: '/sync-outbox' },
  { from: '/gate-events', to: '/capture-debug' },
  { from: '/devices', to: '/device-health' },
]

const ROLE_HOME_PREFERENCES: Record<AuthRole, string[]> = {
  ADMIN: ['/overview', '/reports', '/sync-outbox'],
  OPS: ['/overview', '/run-lane', '/review-queue'],
  GUARD: ['/run-lane', '/review-queue', '/lane-monitor'],
  CASHIER: ['/overview', '/reports', '/session-history'],
  WORKER: ['/lane-monitor', '/device-health', '/session-history'],
}

export function getRouteMeta(pathname: string) {
  return APP_NAV_ITEMS.find((item) => item.path === pathname) ?? null
}

export function canAccessRoute(role: AuthRole | string | undefined, item: Pick<AppNavItem, 'allowedRoles'>) {
  if (!item.allowedRoles || item.allowedRoles.length === 0) return true
  if (!role) return false
  return item.allowedRoles.includes(role as AuthRole)
}

export function getNavItemsByGroup(group: AppNavGroupKey, role?: AuthRole | string) {
  return SHELL_ROUTES.filter((item) => item.group === group && canAccessRoute(role, item))
}

export function getDefaultRouteForRole(role?: AuthRole | string) {
  if (!role) return '/overview'

  const preferredPaths = ROLE_HOME_PREFERENCES[role as AuthRole]
  if (preferredPaths) {
    const preferredMatch = SHELL_ROUTES.find((item) => preferredPaths.includes(item.path) && canAccessRoute(role, item))
    if (preferredMatch) return preferredMatch.path
  }

  return SHELL_ROUTES.find((item) => canAccessRoute(role, item))?.path ?? '/overview'
}
