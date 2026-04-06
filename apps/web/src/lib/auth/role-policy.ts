import type { AuthRole } from '@/lib/contracts/auth'

export type AppNavGroupKey = 'Operations' | 'Monitoring' | 'Capture' | 'System'

export type RoutePath =
  | '/overview'
  | '/run-lane'
  | '/review-queue'
  | '/session-history'
  | '/lane-monitor'
  | '/device-health'
  | '/sync-outbox'
  | '/reports'
  | '/mobile-camera-pair'
  | '/capture-debug'
  | '/subscriptions'
  | '/parking-live'
  | '/settings'
  | '/mobile-capture'
  | '/topology'
  | '/accounts'

export type RoutePolicyMeta = {
  path: RoutePath
  label: string
  shortLabel: string
  description: string
  group: AppNavGroupKey
  allowedRoles?: AuthRole[]
  hidden?: boolean
  standalone?: boolean
  canonical?: boolean
  transitional?: boolean
  requiresSiteScope?: boolean
  forbiddenFallbacks?: Partial<Record<AuthRole, RoutePath | RoutePath[]>>
}

export type RoleRoutePolicy = RoutePolicyMeta

export type ActionPolicyKey =
  | 'route.overview.view'
  | 'route.runLane.view'
  | 'route.reviewQueue.view'
  | 'route.sessionHistory.view'
  | 'route.laneMonitor.view'
  | 'route.deviceHealth.view'
  | 'route.syncOutbox.view'
  | 'route.reports.view'
  | 'route.mobileCameraPair.view'
  | 'route.captureDebug.view'
  | 'route.subscriptions.view'
  | 'route.parkingLive.view'
  | 'route.settings.view'
  | 'route.accounts.view'
  | 'subscription.manage'
  | 'parkingLive.inspect'

export type ActionPolicy = {
  key: ActionPolicyKey
  allowedRoles: AuthRole[]
  description: string
}

const ADMIN_SHELL_ROLES: AuthRole[] = ['SUPER_ADMIN', 'SITE_ADMIN', 'MANAGER', 'OPERATOR']
const RUN_LANE_ROLES: AuthRole[] = [...ADMIN_SHELL_ROLES, 'GUARD']
const SESSION_READ_ROLES: AuthRole[] = [...ADMIN_SHELL_ROLES, 'GUARD', 'VIEWER']
const MONITOR_READ_ROLES: AuthRole[] = [...ADMIN_SHELL_ROLES, 'GUARD', 'VIEWER']
const REPORT_READ_ROLES: AuthRole[] = [...ADMIN_SHELL_ROLES, 'CASHIER', 'VIEWER']
const PARKING_LIVE_ROLES: AuthRole[] = [...ADMIN_SHELL_ROLES, 'GUARD', 'VIEWER']
const DASHBOARD_ROLES: AuthRole[] = [...ADMIN_SHELL_ROLES, 'GUARD', 'CASHIER', 'VIEWER']
const SETTINGS_ROLES: AuthRole[] = ['SUPER_ADMIN', 'SITE_ADMIN', 'MANAGER', 'CASHIER', 'GUARD', 'OPERATOR', 'VIEWER']
const TOPOLOGY_ADMIN_ROLES: AuthRole[] = ['SUPER_ADMIN', 'SITE_ADMIN']

const routePolicies: RoleRoutePolicy[] = [
  {
    path: '/overview',
    label: 'route.overview.label',
    shortLabel: 'route.overview.shortLabel',
    description: 'route.overview.description',
    group: 'Operations',
    allowedRoles: [...DASHBOARD_ROLES],
    requiresSiteScope: true,
    hidden: false,
    standalone: false,
    canonical: true,
    transitional: false,
  },
  {
    path: '/run-lane',
    label: 'route.runLane.label',
    shortLabel: 'route.runLane.shortLabel',
    description: 'route.runLane.description',
    group: 'Operations',
    allowedRoles: [...RUN_LANE_ROLES],
    requiresSiteScope: true,
    hidden: false,
    standalone: false,
    canonical: true,
    transitional: false,
  },
  {
    path: '/review-queue',
    label: 'route.reviewQueue.label',
    shortLabel: 'route.reviewQueue.shortLabel',
    description: 'route.reviewQueue.description',
    group: 'Operations',
    allowedRoles: [...RUN_LANE_ROLES],
    requiresSiteScope: true,
    hidden: false,
    standalone: false,
    canonical: true,
    transitional: false,
  },
  {
    path: '/session-history',
    label: 'route.sessionHistory.label',
    shortLabel: 'route.sessionHistory.shortLabel',
    description: 'route.sessionHistory.description',
    group: 'Operations',
    allowedRoles: [...SESSION_READ_ROLES],
    requiresSiteScope: true,
    hidden: false,
    standalone: false,
    canonical: true,
    transitional: false,
  },
  {
    path: '/lane-monitor',
    label: 'route.laneMonitor.label',
    shortLabel: 'route.laneMonitor.shortLabel',
    description: 'route.laneMonitor.description',
    group: 'Monitoring',
    allowedRoles: [...MONITOR_READ_ROLES],
    requiresSiteScope: true,
    hidden: false,
    standalone: false,
    canonical: true,
    transitional: false,
  },
  {
    path: '/device-health',
    label: 'route.deviceHealth.label',
    shortLabel: 'route.deviceHealth.shortLabel',
    description: 'route.deviceHealth.description',
    group: 'Monitoring',
    allowedRoles: [...MONITOR_READ_ROLES],
    requiresSiteScope: true,
    hidden: false,
    standalone: false,
    canonical: true,
    transitional: false,
  },
  {
    path: '/sync-outbox',
    label: 'route.syncOutbox.label',
    shortLabel: 'route.syncOutbox.shortLabel',
    description: 'route.syncOutbox.description',
    group: 'Monitoring',
    allowedRoles: [...ADMIN_SHELL_ROLES],
    requiresSiteScope: true,
    hidden: false,
    standalone: false,
    canonical: true,
    transitional: false,
  },
  {
    path: '/reports',
    label: 'route.reports.label',
    shortLabel: 'route.reports.shortLabel',
    description: 'route.reports.description',
    group: 'Monitoring',
    allowedRoles: [...REPORT_READ_ROLES],
    requiresSiteScope: true,
    hidden: false,
    standalone: false,
    canonical: true,
    transitional: false,
  },
  {
    path: '/mobile-camera-pair',
    label: 'route.mobileCameraPair.label',
    shortLabel: 'route.mobileCameraPair.shortLabel',
    description: 'route.mobileCameraPair.description',
    group: 'Capture',
    allowedRoles: [...RUN_LANE_ROLES],
    requiresSiteScope: true,
    hidden: false,
    standalone: false,
    canonical: true,
    transitional: false,
  },
  {
    path: '/capture-debug',
    label: 'route.captureDebug.label',
    shortLabel: 'route.captureDebug.shortLabel',
    description: 'route.captureDebug.description',
    group: 'Capture',
    allowedRoles: [...RUN_LANE_ROLES],
    requiresSiteScope: true,
    hidden: false,
    standalone: false,
    canonical: true,
    transitional: false,
  },
  {
    path: '/subscriptions',
    label: 'route.subscriptions.label',
    shortLabel: 'route.subscriptions.shortLabel',
    description: 'route.subscriptions.description',
    group: 'Operations',
    allowedRoles: [...ADMIN_SHELL_ROLES],
    requiresSiteScope: true,
    hidden: false,
    standalone: false,
    canonical: true,
    transitional: false,
    forbiddenFallbacks: {
      GUARD: '/run-lane',
      CASHIER: '/reports',
      VIEWER: '/overview',
    },
  },
  {
    path: '/parking-live',
    label: 'route.parkingLive.label',
    shortLabel: 'route.parkingLive.shortLabel',
    description: 'route.parkingLive.description',
    group: 'Monitoring',
    allowedRoles: [...PARKING_LIVE_ROLES],
    requiresSiteScope: true,
    hidden: false,
    standalone: false,
    canonical: true,
    transitional: false,
    forbiddenFallbacks: {
      CASHIER: '/reports',
      VIEWER: '/overview',
    },
  },
  {
    path: '/settings',
    label: 'route.settings.label',
    shortLabel: 'route.settings.shortLabel',
    description: 'route.settings.description',
    group: 'System',
    allowedRoles: [...SETTINGS_ROLES],
    requiresSiteScope: false,
    hidden: false,
    standalone: false,
    canonical: true,
    transitional: false,
  },
  {
    path: '/mobile-capture',
    label: 'route.mobileCapture.label',
    shortLabel: 'route.mobileCapture.shortLabel',
    description: 'route.mobileCapture.description',
    group: 'Capture',
    allowedRoles: undefined,
    requiresSiteScope: false,
    hidden: true,
    standalone: true,
    canonical: false,
    transitional: false,
  },
  {
    path: '/topology',
    label: 'Topology Management',
    shortLabel: 'Topology',
    description: 'Manage sites, gates, lanes, and devices',
    group: 'System',
    allowedRoles: [...TOPOLOGY_ADMIN_ROLES],
    requiresSiteScope: false,
    hidden: false,
    standalone: false,
    canonical: true,
    transitional: false,
  },
  {
    path: '/accounts',
    label: 'route.accountNav.label',
    shortLabel: 'route.accountNav.shortLabel',
    description: 'Manage user accounts, profiles, and role assignments',
    group: 'System',
    allowedRoles: [...ADMIN_SHELL_ROLES],
    requiresSiteScope: false,
    hidden: false,
    standalone: false,
    canonical: true,
    transitional: false,
  },
]

const actionPolicies: ActionPolicy[] = [
  { key: 'route.overview.view', allowedRoles: [...DASHBOARD_ROLES], description: 'Open the overview landing route.' },
  { key: 'route.runLane.view', allowedRoles: [...RUN_LANE_ROLES], description: 'Open the Run Lane workspace.' },
  { key: 'route.reviewQueue.view', allowedRoles: [...RUN_LANE_ROLES], description: 'Open the review queue workspace.' },
  { key: 'route.sessionHistory.view', allowedRoles: [...SESSION_READ_ROLES], description: 'Open the session history workspace.' },
  { key: 'route.laneMonitor.view', allowedRoles: [...MONITOR_READ_ROLES], description: 'Open live lane monitoring.' },
  { key: 'route.deviceHealth.view', allowedRoles: [...MONITOR_READ_ROLES], description: 'Open device health monitoring.' },
  { key: 'route.syncOutbox.view', allowedRoles: [...ADMIN_SHELL_ROLES], description: 'Open the sync outbox monitor.' },
  { key: 'route.reports.view', allowedRoles: [...REPORT_READ_ROLES], description: 'Open reporting surfaces.' },
  { key: 'route.mobileCameraPair.view', allowedRoles: [...RUN_LANE_ROLES], description: 'Open mobile camera pairing.' },
  { key: 'route.captureDebug.view', allowedRoles: [...RUN_LANE_ROLES], description: 'Open capture diagnostics.' },
  { key: 'route.subscriptions.view', allowedRoles: [...ADMIN_SHELL_ROLES], description: 'Open the subscriptions workspace.' },
  { key: 'route.parkingLive.view', allowedRoles: [...PARKING_LIVE_ROLES], description: 'Open the parking live workspace.' },
  { key: 'route.settings.view', allowedRoles: [...SETTINGS_ROLES], description: 'Open settings and diagnostics.' },
  { key: 'route.accounts.view', allowedRoles: [...ADMIN_SHELL_ROLES], description: 'Open the accounts management workspace.' },
  { key: 'subscription.manage', allowedRoles: [...ADMIN_SHELL_ROLES], description: 'Manage subscription lifecycle and assignments.' },
  { key: 'parkingLive.inspect', allowedRoles: [...PARKING_LIVE_ROLES], description: 'Inspect parking occupancy and slot details.' },
]

export const APP_SHELL_NAV_GROUPS: AppNavGroupKey[] = ['Operations', 'Monitoring', 'Capture', 'System']

export const ROUTE_POLICY_REGISTRY: Record<RoutePath, RoleRoutePolicy> = Object.fromEntries(
  routePolicies.map((route) => [route.path, route]),
) as Record<RoutePath, RoleRoutePolicy>

export const ACTION_POLICY_REGISTRY: Record<ActionPolicyKey, ActionPolicy> = Object.fromEntries(
  actionPolicies.map((policy) => [policy.key, policy]),
) as Record<ActionPolicyKey, ActionPolicy>

export const ROLE_HOME_PREFERENCES: Record<AuthRole, RoutePath[]> = {
  SUPER_ADMIN: ['/overview', '/reports', '/sync-outbox'],
  SITE_ADMIN: ['/overview', '/reports', '/subscriptions'],
  MANAGER: ['/overview', '/run-lane', '/reports'],
  OPERATOR: ['/run-lane', '/review-queue', '/lane-monitor'],
  GUARD: ['/run-lane', '/review-queue', '/lane-monitor'],
  CASHIER: ['/reports', '/overview', '/settings'],
  VIEWER: ['/overview', '/lane-monitor', '/session-history'],
}

function normalizeRoles(allowedRoles?: AuthRole[]) {
  return allowedRoles ? [...allowedRoles] : undefined
}

function normalizeRoute(route: RoleRoutePolicy): RoleRoutePolicy {
  return {
    ...route,
    allowedRoles: normalizeRoles(route.allowedRoles),
    hidden: route.hidden ?? false,
    standalone: route.standalone ?? false,
    canonical: route.canonical ?? false,
    transitional: route.transitional ?? false,
    requiresSiteScope: route.requiresSiteScope ?? false,
  }
}

export function listRoutePolicies(options?: { includeHidden?: boolean; includeStandalone?: boolean; canonicalOnly?: boolean }) {
  return routePolicies
    .map(normalizeRoute)
    .filter((route) => {
      if (!options?.includeHidden && route.hidden) return false
      if (!options?.includeStandalone && route.standalone) return false
      if (options?.canonicalOnly && !route.canonical) return false
      return true
    })
}

export function getRoutePolicy(pathname?: string | null) {
  if (!pathname) return null
  const route = ROUTE_POLICY_REGISTRY[pathname as RoutePath]
  if (!route) return null
  return normalizeRoute(route)
}

export function canAccessRoute(role: AuthRole | string | undefined, routeOrPath: RoutePath | string | Pick<RoleRoutePolicy, 'allowedRoles'>) {
  const policy = typeof routeOrPath === 'string' ? ROUTE_POLICY_REGISTRY[routeOrPath as RoutePath] : routeOrPath
  if (!policy?.allowedRoles || policy.allowedRoles.length === 0) return true
  if (!role) return false
  return policy.allowedRoles.includes(role as AuthRole)
}

export function canAccessAction(role: AuthRole | string | undefined, actionKey: ActionPolicyKey) {
  const policy = ACTION_POLICY_REGISTRY[actionKey]
  if (!policy || !role) return false
  return policy.allowedRoles.includes(role as AuthRole)
}

export function getFirstAllowedRoute(
  role?: AuthRole | string,
  options?: { canonicalOnly?: boolean; group?: AppNavGroupKey; includeStandalone?: boolean },
): RoutePath {
  const candidates = listRoutePolicies({
    includeStandalone: options?.includeStandalone,
    canonicalOnly: options?.canonicalOnly ?? true,
  }).filter((route) => !options?.group || route.group === options.group)

  return candidates.find((route) => canAccessRoute(role, route.path))?.path ?? '/overview'
}

function toFallbackList(value?: RoutePath | RoutePath[]) {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

export function getForbiddenFallbackPath(role?: AuthRole | string, requestedPath?: string): RoutePath {
  if (role && requestedPath) {
    const policy = ROUTE_POLICY_REGISTRY[requestedPath as RoutePath]
    const explicit = toFallbackList(policy?.forbiddenFallbacks?.[role as AuthRole])
    const matched = explicit.find((path) => canAccessRoute(role, path))
    if (matched) return matched
  }

  return getRoleHome(role)
}

export function getRoleHome(role?: AuthRole | string): RoutePath {
  if (!role) return '/overview'

  const preferredPaths = ROLE_HOME_PREFERENCES[role as AuthRole]
  if (preferredPaths?.length) {
    const preferredMatch = preferredPaths.find((path) => canAccessRoute(role, path))
    if (preferredMatch) return preferredMatch
  }

  return getFirstAllowedRoute(role, { canonicalOnly: true })
}

export function getCanonicalRoutesForRole(role?: AuthRole | string, group?: AppNavGroupKey) {
  return listRoutePolicies({ canonicalOnly: true }).filter((route) => {
    if (route.hidden || route.standalone || route.transitional) return false
    if (group && route.group !== group) return false
    return canAccessRoute(role, route.path)
  })
}
