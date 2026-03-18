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
import {
  APP_SHELL_NAV_GROUPS,
  canAccessRoute as canAccessRouteByPolicy,
  getCanonicalRoutesForRole,
  getRoleHome,
  getRoutePolicy,
  ROLE_HOME_PREFERENCES,
  type AppNavGroupKey,
  type RoleRoutePolicy,
  type RoutePath,
} from '@/lib/auth/role-policy'

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

const ROUTE_PRELOADS: Partial<Record<RoutePath, Array<keyof typeof pageLoaders>>> = {
  '/overview': ['reviewQueue', 'sessions', 'runLane', 'subscriptions'],
  '/subscriptions': ['overview'],
  '/parking-live': ['overview'],
  '/run-lane': ['reviewQueue', 'sessions'],
  '/review-queue': ['sessions', 'runLane'],
  '/session-history': ['reviewQueue', 'outbox', 'reports'],
  '/reports': ['overview'],
}

type RouteViewDefinition = {
  path: RoutePath
  icon: typeof Activity
  element: ReactElement
}

export type AppNavItem = RoleRoutePolicy & {
  icon: typeof Activity
  element: ReactElement
}

const ROUTE_VIEWS: RouteViewDefinition[] = [
  { path: '/overview', icon: LayoutGrid, element: <OverviewPage /> },
  { path: '/run-lane', icon: ArrowRightLeft, element: <RunLanePage /> },
  { path: '/review-queue', icon: ClipboardCheck, element: <ReviewQueuePage /> },
  { path: '/session-history', icon: History, element: <SessionsPage /> },
  { path: '/lane-monitor', icon: Activity, element: <LaneMonitorPage /> },
  { path: '/device-health', icon: Cpu, element: <DeviceHealthPage /> },
  { path: '/sync-outbox', icon: RadioTower, element: <OutboxMonitorPage /> },
  { path: '/reports', icon: BarChart3, element: <ReportsPage /> },
  { path: '/mobile-camera-pair', icon: Smartphone, element: <MobileCameraPairPage /> },
  { path: '/capture-debug', icon: Camera, element: <CaptureDebugPage /> },
  { path: '/subscriptions', icon: CreditCard, element: <SubscriptionsPage /> },
  { path: '/parking-live', icon: MapPin, element: <ParkingLivePage /> },
  { path: '/settings', icon: Settings, element: <SettingsPage /> },
  { path: '/mobile-capture', icon: Smartphone, element: <MobileCapturePage /> },
]

function buildAppNavItem(definition: RouteViewDefinition): AppNavItem {
  const policy = getRoutePolicy(definition.path)
  if (!policy) {
    throw new Error(`Missing route policy for ${definition.path}`)
  }

  return {
    ...policy,
    icon: definition.icon,
    element: definition.element,
  }
}

export const APP_NAV_ITEMS: AppNavItem[] = ROUTE_VIEWS.map(buildAppNavItem)
export const SHELL_ROUTES = APP_NAV_ITEMS.filter((item) => !item.hidden && !item.standalone)
export const STANDALONE_ROUTES = APP_NAV_ITEMS.filter((item) => item.standalone)

export const LEGACY_ROUTE_REDIRECTS: Array<{ from: string; to: RoutePath }> = [
  { from: '/dashboard', to: '/overview' },
  { from: '/manual-control', to: '/run-lane' },
  { from: '/gate', to: '/run-lane' },
  { from: '/sessions', to: '/session-history' },
  { from: '/outbox-monitor', to: '/sync-outbox' },
  { from: '/gate-events', to: '/capture-debug' },
  { from: '/devices', to: '/device-health' },
]

export { APP_SHELL_NAV_GROUPS, ROLE_HOME_PREFERENCES }

export function preloadRoutesForPath(pathname: string) {
  const targets = ROUTE_PRELOADS[pathname as RoutePath] ?? []
  return Promise.allSettled(targets.map((target) => pageLoaders[target]()))
}

export function preloadRoutesForRole(role?: AuthRole | string) {
  const defaultPath = getDefaultRouteForRole(role)
  return preloadRoutesForPath(defaultPath)
}

export function getRouteMeta(pathname: string) {
  return APP_NAV_ITEMS.find((item) => item.path === pathname) ?? null
}

export function canAccessRoute(role: AuthRole | string | undefined, item: Pick<AppNavItem, 'path'>) {
  return canAccessRouteByPolicy(role, item.path)
}

export function getNavItemsByGroup(group: AppNavGroupKey, role?: AuthRole | string) {
  const allowedPaths = new Set<string>(getCanonicalRoutesForRole(role, group).map((item) => item.path))
  return SHELL_ROUTES.filter((item) => allowedPaths.has(item.path))
}

export function getDefaultRouteForRole(role?: AuthRole | string) {
  return getRoleHome(role)
}
