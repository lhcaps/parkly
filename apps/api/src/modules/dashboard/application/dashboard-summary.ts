import type { AuthenticatedPrincipal } from '../../auth/application/auth-service'
import {
  composeDashboardSummaryDocument,
  summarizeIncidentRows,
  summarizeLaneRows,
  summarizeOccupancyRows,
  summarizeSubscriptionRows,
  type DashboardSummaryDocument,
} from './dashboard-summary-composer'
import {
  queryIncidentSummarySiteRows,
  queryLaneSummarySiteRows,
  queryOccupancySummarySiteRows,
  querySubscriptionSummarySiteRows,
} from '../../../server/services/read-models/dashboard-summary.read-model'
import { resolveDashboardSiteScope } from '../../../server/services/read-models/site-scope'

export type DashboardSummaryQuery = {
  principal: AuthenticatedPrincipal
  siteCode?: string | null
  sinceHours?: number
  expiringInDays?: number
}

function normalizeSinceHours(value?: number | null) {
  const parsed = Number(value ?? 24)
  return Math.min(24 * 30, Math.max(1, Number.isFinite(parsed) ? Math.trunc(parsed) : 24))
}

function normalizeExpiringInDays(value?: number | null) {
  const parsed = Number(value ?? 7)
  return Math.min(90, Math.max(0, Number.isFinite(parsed) ? Math.trunc(parsed) : 7))
}

async function loadDashboardSiteRows(args: DashboardSummaryQuery) {
  const scope = await resolveDashboardSiteScope({
    principal: args.principal,
    requestedSiteCode: args.siteCode ?? null,
  })
  const sinceHours = normalizeSinceHours(args.sinceHours)
  const expiringInDays = normalizeExpiringInDays(args.expiringInDays)

  const [incidents, occupancy, lanes, subscriptions] = await Promise.all([
    queryIncidentSummarySiteRows({ siteCodes: scope.siteCodes, sinceHours }),
    queryOccupancySummarySiteRows({ siteCodes: scope.siteCodes }),
    queryLaneSummarySiteRows({ siteCodes: scope.siteCodes }),
    querySubscriptionSummarySiteRows({ siteCodes: scope.siteCodes, expiringInDays }),
  ])

  return {
    generatedAt: new Date().toISOString(),
    scope,
    sinceHours,
    expiringInDays,
    incidents,
    occupancy,
    lanes,
    subscriptions,
  }
}

export async function getDashboardSummary(query: DashboardSummaryQuery): Promise<DashboardSummaryDocument> {
  const snapshot = await loadDashboardSiteRows(query)
  return composeDashboardSummaryDocument(snapshot)
}

export async function getDashboardSiteSummary(query: DashboardSummaryQuery & { siteCode: string }): Promise<DashboardSummaryDocument> {
  return await getDashboardSummary(query)
}

export async function getDashboardIncidentSummary(query: DashboardSummaryQuery) {
  const snapshot = await loadDashboardSiteRows(query)
  return {
    generatedAt: snapshot.generatedAt,
    scope: snapshot.scope,
    filters: { sinceHours: snapshot.sinceHours },
    summary: summarizeIncidentRows(snapshot.incidents),
    sites: snapshot.incidents,
  }
}

export async function getDashboardOccupancySummary(query: DashboardSummaryQuery) {
  const snapshot = await loadDashboardSiteRows(query)
  return {
    generatedAt: snapshot.generatedAt,
    scope: snapshot.scope,
    filters: {},
    summary: summarizeOccupancyRows(snapshot.occupancy),
    sites: snapshot.occupancy,
  }
}

export async function getDashboardLaneSummary(query: DashboardSummaryQuery) {
  const snapshot = await loadDashboardSiteRows(query)
  return {
    generatedAt: snapshot.generatedAt,
    scope: snapshot.scope,
    filters: {},
    summary: summarizeLaneRows(snapshot.lanes),
    sites: snapshot.lanes,
  }
}

export async function getDashboardSubscriptionSummary(query: DashboardSummaryQuery) {
  const snapshot = await loadDashboardSiteRows(query)
  return {
    generatedAt: snapshot.generatedAt,
    scope: snapshot.scope,
    filters: { expiringInDays: snapshot.expiringInDays },
    summary: summarizeSubscriptionRows(snapshot.subscriptions),
    sites: snapshot.subscriptions,
  }
}
