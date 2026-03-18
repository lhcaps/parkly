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
  | 'subscription.manage'
  | 'parkingLive.inspect'

export type ActionPolicy = {
  key: ActionPolicyKey
  allowedRoles: AuthRole[]
  description: string
}

const ALL_ROLES: AuthRole[] = ['ADMIN', 'OPS', 'GUARD', 'CASHIER', 'WORKER']

const routePolicies: RoleRoutePolicy[] = [
  {
    path: '/overview',
    label: 'Overview',
    shortLabel: 'Overview',
    description: 'Shift landing page. Queue status, lane alerts, and dependency health at a glance.',
    group: 'Operations',
    allowedRoles: [...ALL_ROLES],
    hidden: false,
    standalone: false,
    canonical: true,
    transitional: false,
  },
  {
    path: '/run-lane',
    label: 'Run Lane',
    shortLabel: 'Run Lane',
    description: 'Process a vehicle through a lane — from image capture to decision and gate action.',
    group: 'Operations',
    allowedRoles: ['ADMIN', 'OPS', 'GUARD'],
    hidden: false,
    standalone: false,
    canonical: true,
    transitional: false,
  },
  {
    path: '/review-queue',
    label: 'Review Queue',
    shortLabel: 'Review',
    description: 'Claim and resolve cases that require manual operator confirmation.',
    group: 'Operations',
    allowedRoles: ['ADMIN', 'OPS', 'GUARD'],
    hidden: false,
    standalone: false,
    canonical: true,
    transitional: false,
  },
  {
    path: '/session-history',
    label: 'Session History',
    shortLabel: 'Sessions',
    description: 'Look up sessions, decisions, barrier events, and evidence by timeline.',
    group: 'Operations',
    allowedRoles: ['ADMIN', 'OPS', 'GUARD', 'WORKER'],
    hidden: false,
    standalone: false,
    canonical: true,
    transitional: false,
  },
  {
    path: '/lane-monitor',
    label: 'Lane Monitor',
    shortLabel: 'Lane Monitor',
    description: 'Live lane health, barrier status, and latest session state across sites.',
    group: 'Monitoring',
    allowedRoles: ['ADMIN', 'OPS', 'GUARD', 'WORKER'],
    hidden: false,
    standalone: false,
    canonical: true,
    transitional: false,
  },
  {
    path: '/device-health',
    label: 'Device Health',
    shortLabel: 'Devices',
    description: 'Monitor device heartbeats and degradation by site and lane.',
    group: 'Monitoring',
    allowedRoles: ['ADMIN', 'OPS', 'GUARD', 'WORKER'],
    hidden: false,
    standalone: false,
    canonical: true,
    transitional: false,
  },
  {
    path: '/sync-outbox',
    label: 'Sync Outbox',
    shortLabel: 'Outbox',
    description: 'Inspect the sync queue — retries, failures, and downstream delivery status.',
    group: 'Monitoring',
    allowedRoles: ['ADMIN', 'OPS', 'WORKER'],
    hidden: false,
    standalone: false,
    canonical: true,
    transitional: false,
  },
  {
    path: '/reports',
    label: 'Reports',
    shortLabel: 'Reports',
    description: 'Operational summaries by site and time window.',
    group: 'Monitoring',
    allowedRoles: ['ADMIN', 'OPS', 'CASHIER', 'WORKER'],
    hidden: false,
    standalone: false,
    canonical: true,
    transitional: false,
  },
  {
    path: '/mobile-camera-pair',
    label: 'Mobile Camera Pair',
    shortLabel: 'Pair Mobile',
    description: 'Pair a mobile device to a lane for image capture and heartbeat.',
    group: 'Capture',
    allowedRoles: ['ADMIN', 'OPS', 'GUARD'],
    hidden: false,
    standalone: false,
    canonical: true,
    transitional: false,
  },
  {
    path: '/capture-debug',
    label: 'Capture Debug',
    shortLabel: 'Capture',
    description: 'Monitor the capture feed and ALPR results to diagnose ingest issues.',
    group: 'Capture',
    allowedRoles: ['ADMIN', 'OPS', 'GUARD', 'WORKER'],
    hidden: false,
    standalone: false,
    canonical: true,
    transitional: false,
  },
  {
    path: '/subscriptions',
    label: 'Subscriptions',
    shortLabel: 'Subscriptions',
    description: 'Manage parking subscriptions — vehicles, spot assignments, and status.',
    group: 'Operations',
    allowedRoles: ['ADMIN', 'OPS'],
    hidden: false,
    standalone: false,
    canonical: true,
    transitional: false,
    forbiddenFallbacks: {
      GUARD: '/run-lane',
      CASHIER: '/reports',
      WORKER: '/lane-monitor',
    },
  },
  {
    path: '/parking-live',
    label: 'Parking Live',
    shortLabel: 'Parking',
    description: 'Realtime parking occupancy — floor view, slot status, and drill-down detail.',
    group: 'Monitoring',
    allowedRoles: ['ADMIN', 'OPS', 'GUARD'],
    hidden: false,
    standalone: false,
    canonical: true,
    transitional: false,
    forbiddenFallbacks: {
      CASHIER: '/reports',
      WORKER: '/lane-monitor',
    },
  },
  {
    path: '/settings',
    label: 'Settings',
    shortLabel: 'Settings',
    description: 'Configure default context and review auth and runtime diagnostics.',
    group: 'System',
    allowedRoles: [...ALL_ROLES],
    hidden: false,
    standalone: false,
    canonical: true,
    transitional: false,
  },
  {
    path: '/mobile-capture',
    label: 'Mobile Capture',
    shortLabel: 'Mobile Capture',
    description: 'Mobile screen for capturing and submitting images.',
    group: 'Capture',
    allowedRoles: undefined,
    hidden: true,
    standalone: true,
    canonical: false,
    transitional: false,
  },
]

const actionPolicies: ActionPolicy[] = [
  {
    key: 'route.overview.view',
    allowedRoles: [...ALL_ROLES],
    description: 'Open the overview landing route.',
  },
  {
    key: 'route.runLane.view',
    allowedRoles: ['ADMIN', 'OPS', 'GUARD'],
    description: 'Open the Run Lane workspace.',
  },
  {
    key: 'route.reviewQueue.view',
    allowedRoles: ['ADMIN', 'OPS', 'GUARD'],
    description: 'Open the review queue workspace.',
  },
  {
    key: 'route.sessionHistory.view',
    allowedRoles: ['ADMIN', 'OPS', 'GUARD', 'WORKER'],
    description: 'Open the session history workspace.',
  },
  {
    key: 'route.laneMonitor.view',
    allowedRoles: ['ADMIN', 'OPS', 'GUARD', 'WORKER'],
    description: 'Open live lane monitoring.',
  },
  {
    key: 'route.deviceHealth.view',
    allowedRoles: ['ADMIN', 'OPS', 'GUARD', 'WORKER'],
    description: 'Open device health monitoring.',
  },
  {
    key: 'route.syncOutbox.view',
    allowedRoles: ['ADMIN', 'OPS', 'WORKER'],
    description: 'Open the sync outbox monitor.',
  },
  {
    key: 'route.reports.view',
    allowedRoles: ['ADMIN', 'OPS', 'CASHIER', 'WORKER'],
    description: 'Open reporting surfaces.',
  },
  {
    key: 'route.mobileCameraPair.view',
    allowedRoles: ['ADMIN', 'OPS', 'GUARD'],
    description: 'Open mobile camera pairing.',
  },
  {
    key: 'route.captureDebug.view',
    allowedRoles: ['ADMIN', 'OPS', 'GUARD', 'WORKER'],
    description: 'Open capture diagnostics.',
  },
  {
    key: 'route.subscriptions.view',
    allowedRoles: ['ADMIN', 'OPS'],
    description: 'Open the subscriptions workspace.',
  },
  {
    key: 'route.parkingLive.view',
    allowedRoles: ['ADMIN', 'OPS', 'GUARD'],
    description: 'Open the parking live workspace.',
  },
  {
    key: 'route.settings.view',
    allowedRoles: [...ALL_ROLES],
    description: 'Open settings and diagnostics.',
  },
  {
    key: 'subscription.manage',
    allowedRoles: ['ADMIN', 'OPS'],
    description: 'Manage subscription lifecycle and assignments.',
  },
  {
    key: 'parkingLive.inspect',
    allowedRoles: ['ADMIN', 'OPS', 'GUARD'],
    description: 'Inspect parking occupancy and slot details.',
  },
]

export const APP_SHELL_NAV_GROUPS: AppNavGroupKey[] = ['Operations', 'Monitoring', 'Capture', 'System']

export const ROUTE_POLICY_REGISTRY: Record<RoutePath, RoleRoutePolicy> = Object.fromEntries(
  routePolicies.map((route) => [route.path, route]),
) as Record<RoutePath, RoleRoutePolicy>

export const ACTION_POLICY_REGISTRY: Record<ActionPolicyKey, ActionPolicy> = Object.fromEntries(
  actionPolicies.map((policy) => [policy.key, policy]),
) as Record<ActionPolicyKey, ActionPolicy>

export const ROLE_HOME_PREFERENCES: Record<AuthRole, RoutePath[]> = {
  ADMIN: ['/overview', '/reports', '/sync-outbox'],
  OPS: ['/overview', '/run-lane', '/review-queue'],
  GUARD: ['/run-lane', '/review-queue', '/lane-monitor'],
  CASHIER: ['/reports', '/overview', '/settings'],
  WORKER: ['/lane-monitor', '/device-health', '/session-history'],
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
  if (!policy) return false
  if (!role) return false
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

export function isMainNavPathVisibleForRole(role: AuthRole | string | undefined, path: RoutePath) {
  return getCanonicalRoutesForRole(role).some((route) => route.path === path)
}
