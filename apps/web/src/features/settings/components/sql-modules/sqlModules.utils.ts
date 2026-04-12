import { toast } from 'sonner'

import type { SqlCatalogObject, SqlSurfaceSnapshot } from '@/lib/api/sql-surface'
import { toAppErrorDisplay } from '@/lib/http/errors'

export const MODULE_ROUTES: Record<string, string> = {
  auth: '/accounts',
  dashboard: '/overview',
  gate: '/lane-monitor',
  subscription: '/subscriptions',
  pricing: '/reports',
  incident: '/review-queue',
  payment: '/session-history',
  system: '/settings',
}

export const SQL_MODULE_PREFS_STORAGE_KEY = 'parkly.sql-module-layout.v1'

export type SqlCatalogTab = 'views' | 'procedures' | 'triggers' | 'constraints' | 'packages'
export type SqlSectionKey = 'overview' | 'studio' | 'catalog' | 'liveOps'
export type SqlBoardKey = 'sessions' | 'laneHealth' | 'queue'
export type SqlLaneLens = 'focus' | 'all'
export type SqlReviewLens = 'attention' | 'all'

export type SqlSurfaceData = SqlSurfaceSnapshot
export type SqlActiveSessionRow = SqlSurfaceSnapshot['previews']['activeSessions'][number]
export type SqlLaneHealthRow = SqlSurfaceSnapshot['previews']['laneHealth'][number]
export type SqlActiveQueueRow = SqlSurfaceSnapshot['previews']['activeQueue'][number]

export type SqlModulePrefs = {
  sections: Record<SqlSectionKey, boolean>
  boards: Record<SqlBoardKey, boolean>
  laneLens: SqlLaneLens
  reviewLens: SqlReviewLens
}

export const DEFAULT_SQL_MODULE_PREFS: SqlModulePrefs = {
  sections: {
    overview: true,
    studio: true,
    catalog: true,
    liveOps: true,
  },
  boards: {
    sessions: true,
    laneHealth: true,
    queue: true,
  },
  laneLens: 'focus',
  reviewLens: 'attention',
}

export function t2(isEn: boolean, vi: string, en: string) {
  return isEn ? en : vi
}

export function dt(value: string | null | undefined, locale: string) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'

  return date.toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function vnd(value: number | null | undefined, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0))
}

export function localInput(date: Date) {
  const localDate = new Date(date)
  localDate.setSeconds(0, 0)

  const yyyy = localDate.getFullYear()
  const mm = `${localDate.getMonth() + 1}`.padStart(2, '0')
  const dd = `${localDate.getDate()}`.padStart(2, '0')
  const hh = `${localDate.getHours()}`.padStart(2, '0')
  const mi = `${localDate.getMinutes()}`.padStart(2, '0')

  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
}

export function healthVariant(value: string) {
  if (value === 'OFFLINE' || value === 'BARRIER_FAULT') return 'destructive' as const
  if (value.startsWith('DEGRADED')) return 'amber' as const
  return 'secondary' as const
}

export function statusVariant(ok: boolean, count: number, minimum: number) {
  if (ok) return 'secondary' as const
  if (count === 0) return 'destructive' as const
  return 'amber' as const
}

export function showError(err: unknown, fallback: string) {
  const display = toAppErrorDisplay(err, fallback)
  toast.error(display.title, { description: display.message })
}

export function testId(value: string | number) {
  return String(value).replace(/[^a-zA-Z0-9_-]+/g, '-')
}

export function getCatalogSource(data: SqlSurfaceData, tab: SqlCatalogTab): SqlCatalogObject[] {
  const views = Array.isArray(data.objects?.views) ? data.objects.views : []
  const procedures = Array.isArray(data.objects?.procedures) ? data.objects.procedures : []
  const triggers = Array.isArray(data.objects?.triggers) ? data.objects.triggers : []
  const constraints = Array.isArray(data.objects?.constraints) ? data.objects.constraints : []
  const moduleGroups = Array.isArray(data.moduleGroups) ? data.moduleGroups : []

  if (tab === 'views') return views
  if (tab === 'constraints') return constraints
  if (tab === 'triggers') return triggers
  if (tab === 'packages') {
    return moduleGroups.map((group) => ({
      name: group.moduleKey === 'system' ? 'system_ops.*' : `pkg_${group.moduleKey}_*`,
      moduleKey: group.moduleKey,
      moduleLabel: group.moduleLabel,
      objectType: 'PACKAGE',
      detail: `${group.views.length} views / ${group.procedures.length} procedures / ${(group.triggers ?? []).length} triggers / ${(group.constraints ?? []).length} constraints`,
      objectCount: group.total,
    }))
  }
  return procedures
}

export function laneNeedsAttention(lane: SqlLaneHealthRow) {
  return laneSeverity(lane) < 3
}

export function queueNeedsAttention(row: SqlActiveQueueRow) {
  return row.openManualReviewCount > 0 || row.reviewRequired
}

export function sessionNeedsAttention(session: SqlActiveSessionRow) {
  return session.sessionState !== 'ACTIVE'
}

export function laneSeverity(lane: SqlLaneHealthRow) {
  if (lane.aggregateHealth === 'OFFLINE') return 0
  if (lane.aggregateHealth === 'BARRIER_FAULT') return 1
  if (lane.aggregateHealth.startsWith('DEGRADED')) return 2
  if (lane.laneOperationalStatus !== 'ACTIVE') return 2
  return 3
}

export function lanePriority(lane: SqlLaneHealthRow) {
  return [
    laneSeverity(lane),
    lane.activePresenceCount > 0 ? 0 : 1,
    lane.siteCode,
    lane.gateCode,
    lane.laneCode,
  ] as const
}

export function queuePriority(row: SqlActiveQueueRow) {
  return [
    row.openManualReviewCount > 0 ? 0 : row.reviewRequired ? 1 : 2,
    row.openedAt ? new Date(row.openedAt).getTime() : Number.MAX_SAFE_INTEGER,
    row.siteCode,
    row.laneCode,
  ] as const
}

export function sessionPriority(session: SqlActiveSessionRow) {
  return [
    sessionNeedsAttention(session) ? 0 : 1,
    session.lastSeenAt ? new Date(session.lastSeenAt).getTime() : 0,
    session.username,
  ] as const
}

export function compareTuple(left: readonly (number | string)[], right: readonly (number | string)[]) {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const a = left[index]
    const b = right[index]

    if (a === b) continue
    if (typeof a === 'number' && typeof b === 'number') return a - b
    return String(a).localeCompare(String(b))
  }

  return 0
}

export function getOpsSummary(data: SqlSurfaceData) {
  const laneAttentionCount = data.previews.laneHealth.filter(laneNeedsAttention).length
  const offlineLaneCount = data.previews.laneHealth.filter((lane) => lane.aggregateHealth === 'OFFLINE').length
  const queueAttentionCount = data.previews.activeQueue.filter(queueNeedsAttention).length
  const reviewOpenCount = data.previews.activeQueue.filter((row) => row.openManualReviewCount > 0).length
  const staleSessionCount = data.previews.activeSessions.filter(sessionNeedsAttention).length

  return {
    laneAttentionCount,
    offlineLaneCount,
    queueAttentionCount,
    reviewOpenCount,
    staleSessionCount,
  }
}

function mergeBooleanRecord<T extends string>(defaults: Record<T, boolean>, value: unknown) {
  const next = { ...defaults }
  if (!value || typeof value !== 'object') return next

  const source = value as Partial<Record<T, unknown>>
  for (const key of Object.keys(defaults) as T[]) {
    if (typeof source[key] === 'boolean') {
      next[key] = source[key] as boolean
    }
  }

  return next
}

export function readSqlModulePrefs() {
  if (typeof window === 'undefined') return DEFAULT_SQL_MODULE_PREFS

  try {
    const raw = window.localStorage.getItem(SQL_MODULE_PREFS_STORAGE_KEY)
    if (!raw) return DEFAULT_SQL_MODULE_PREFS

    const parsed = JSON.parse(raw) as Partial<SqlModulePrefs> | null
    if (!parsed || typeof parsed !== 'object') return DEFAULT_SQL_MODULE_PREFS

    return {
      sections: mergeBooleanRecord(DEFAULT_SQL_MODULE_PREFS.sections, parsed.sections),
      boards: mergeBooleanRecord(DEFAULT_SQL_MODULE_PREFS.boards, parsed.boards),
      laneLens: parsed.laneLens === 'all' ? 'all' : DEFAULT_SQL_MODULE_PREFS.laneLens,
      reviewLens: parsed.reviewLens === 'all' ? 'all' : DEFAULT_SQL_MODULE_PREFS.reviewLens,
    } satisfies SqlModulePrefs
  } catch {
    return DEFAULT_SQL_MODULE_PREFS
  }
}

export function writeSqlModulePrefs(prefs: SqlModulePrefs) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(SQL_MODULE_PREFS_STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // Ignore localStorage failures and keep the UI usable.
  }
}

export function getSqlModuleLabels(isEn: boolean) {
  return {
    title: t2(isEn, 'Bề mặt SQL theo module', 'Module-based SQL surface'),
    desc: t2(
      isEn,
      'Theo dõi package giả lập, readiness của schema và các procedure vận hành ngay trong app.',
      'Track package-like SQL modules, schema readiness, and operator procedures directly inside the app.',
    ),
    refresh: t2(isEn, 'Làm mới surface', 'Refresh surface'),
    minBadge: t2(isEn, 'Tối thiểu 20 object mỗi loại', 'Minimum 20 objects per type'),
    allModules: t2(isEn, 'Tất cả module', 'All modules'),
    empty: t2(isEn, 'Không có dữ liệu phù hợp.', 'No matching data.'),
    catalogSearch: t2(isEn, 'Tìm object SQL', 'Search SQL objects'),
    openPage: t2(isEn, 'Mở trang tương ứng', 'Open matching page'),
    runbookTitle: t2(isEn, 'Checklist 2 lệnh để chạm trigger thứ 20', 'Two-command checklist to reach trigger #20'),
    runbookDesc: t2(
      isEn,
      'MySQL local vẫn chặn tạo trigger bằng tài khoản ứng dụng. Chạy 2 lệnh sau bằng DB admin.',
      'Local MySQL is still blocking trigger creation for the app account. Run these 2 commands with a DB admin account.',
    ),
    triggerGap: t2(isEn, 'Còn thiếu trigger để đủ baseline', 'A trigger gap is still blocking baseline readiness'),
    triggerOk: t2(isEn, 'Schema đã đạt baseline SQL', 'SQL schema baseline is ready'),
    triggerReadyDesc: t2(
      isEn,
      'Views, procedures và triggers đều đã chạm ngưỡng tối thiểu.',
      'Views, procedures, and triggers have all reached the minimum target.',
    ),
    inspectOnly: t2(
      isEn,
      'Tài khoản này chỉ xem được SQL surface; các nút thao tác cần quyền vận hành.',
      'This account can inspect the SQL surface, but action buttons still require operations permissions.',
    ),
    modules: t2(isEn, 'Bản đồ module', 'Module map'),
    modulesDesc: t2(
      isEn,
      'Nhìn nhanh module nào map vào route vận hành nào và đang có những object gì.',
      'Quickly see which module maps into which operational route and which objects are already present.',
    ),
    catalog: t2(isEn, 'Catalog object SQL', 'SQL object catalog'),
    catalogDesc: t2(
      isEn,
      'Lọc surface theo module hoặc theo tên object, và duyệt riêng constraints hay package coverage.',
      'Filter the SQL surface by module or object name, and browse constraints or package coverage separately.',
    ),
    sqlExplorer: t2(isEn, 'SQL explorer', 'SQL explorer'),
    sqlExplorerDesc: t2(
      isEn,
      'Giữ package coverage và object inventory trong cùng một workspace cố định, có scroll nội bộ.',
      'Keep package coverage and the object inventory in one fixed workspace with internal scrolling.',
    ),
    matchingObjects: t2(isEn, 'mục khớp bộ lọc', 'entries match the current filters'),
    viewsTab: 'Views',
    proceduresTab: 'Procedures',
    triggersTab: 'Triggers',
    constraintsTab: t2(isEn, 'Constraints', 'Constraints'),
    packagesTab: t2(isEn, 'Packages', 'Packages'),
    packageCoverage: t2(isEn, 'Package coverage', 'Package coverage'),
    packageCoverageDesc: t2(
      isEn,
      'Nhìn nhanh package nào đang phủ nhiều object SQL nhất và nhảy vào module tương ứng.',
      'Quickly see which package covers the most SQL objects and jump into the matching module.',
    ),
    objectInventory: t2(isEn, 'Object inventory', 'Object inventory'),
    objectInventoryDesc: t2(
      isEn,
      'Danh sách object được giữ trong một vùng cao cố định để không kéo dài trang vô tận.',
      'The object list stays inside a fixed-height region so the page does not grow endlessly.',
    ),
    catalogFilterLabel: t2(isEn, 'Bộ lọc catalog', 'Catalog filters'),
    catalogRailHint: t2(
      isEn,
      'Danh sách mới ưu tiên đọc tên object rõ, metadata ngắn và route mở nhanh theo module.',
      'The new inventory favors readable object names, compact metadata, and a fast jump into the matching module route.',
    ),
    catalogScrollHint: t2(
      isEn,
      'Khu inventory có scroll nội bộ để giữ toàn bộ tab SQL gọn trong một khối ổn định.',
      'The inventory uses an internal scroll region to keep the whole SQL tab inside a stable block.',
    ),
    catalogCoverage: t2(isEn, 'Độ phủ surface', 'Surface coverage'),
    catalogRoute: t2(isEn, 'Mở module', 'Open module'),
    catalogTable: t2(isEn, 'Table', 'Table'),
    catalogObjectType: t2(isEn, 'Type', 'Type'),
    catalogPackageCoverage: t2(isEn, 'Coverage', 'Coverage'),
    packageSignal: t2(isEn, 'Packages', 'Packages'),
    constraintSignal: t2(isEn, 'Constraints', 'Constraints'),
    scopeSignal: t2(isEn, 'Scope', 'Scope'),
    procedureStudio: t2(isEn, 'Procedure studio', 'Procedure studio'),
    procedureStudioDesc: t2(
      isEn,
      'Giữ các thao tác SQL thường dùng trong một khu thao tác rõ ràng hơn.',
      'Keep the common SQL-backed actions in one clearer operational workspace.',
    ),
    liveOps: t2(isEn, 'Live ops board', 'Live ops board'),
    liveOpsDesc: t2(
      isEn,
      'Ưu tiên lane xấu, queue cần review và session lệch chuẩn trước.',
      'Prioritize unhealthy lanes, queues that need review, and off-pattern sessions first.',
    ),
    cleanup: t2(isEn, 'Dọn auth session', 'Auth session cleanup'),
    cleanupDesc: t2(
      isEn,
      'Chạy `pkg_auth_cleanup_sessions` bằng policy backend hiện tại.',
      'Run `pkg_auth_cleanup_sessions` with the current backend policy.',
    ),
    cleanupBtn: t2(isEn, 'Chạy cleanup', 'Run cleanup'),
    cleanupConfirmTitle: t2(isEn, 'Chạy dọn auth session?', 'Run auth session cleanup?'),
    cleanupConfirmDesc: t2(
      isEn,
      'Tác vụ này sẽ xoá session đã hết hạn hoặc đã revoke quá retention hiện tại.',
      'This action removes expired and long-revoked sessions based on the current retention window.',
    ),
    quote: t2(isEn, 'Quote giá vé theo procedure', 'Ticket quote via procedure'),
    quoteDesc: t2(
      isEn,
      'Chạy `pkg_pricing_quote_ticket` ngay trong frontend để mô phỏng giá vé.',
      'Run `pkg_pricing_quote_ticket` directly from the frontend to simulate ticket pricing.',
    ),
    quoteBtn: t2(isEn, 'Tính tiền', 'Quote ticket'),
    activeSessions: t2(isEn, 'Auth session đang hoạt động', 'Active auth sessions'),
    activeSessionsDesc: t2(
      isEn,
      'Ưu tiên các session đang ở trạng thái khác ACTIVE hoặc đã stale.',
      'Prioritize sessions that are no longer fully ACTIVE or look stale.',
    ),
    laneHealth: t2(isEn, 'Lane health theo view', 'Lane health from view'),
    laneHealthDesc: t2(
      isEn,
      'Lens mặc định đẩy lane lỗi lên trước, sau đó mới đến lane đang ổn.',
      'The default lens pushes unhealthy lanes to the top before showing stable ones.',
    ),
    queue: t2(isEn, 'Hàng đợi gate đang mở', 'Active gate queue'),
    queueDesc: t2(
      isEn,
      'Lens review chỉ giữ lại queue có review mở hoặc queue đang cần can thiệp.',
      'The review lens only keeps rows with open reviews or rows that need intervention.',
    ),
    revokeBtn: t2(isEn, 'Revoke user', 'Revoke user'),
    recoverBtn: t2(isEn, 'Force recovery', 'Force recovery'),
    reviewBtn: t2(isEn, 'Mở review', 'Open review'),
    reviewOpen: t2(isEn, 'Review đã mở', 'Review open'),
    confirmCancel: t2(isEn, 'Huỷ', 'Cancel'),
    site: 'Site',
    entry: t2(isEn, 'Giờ vào', 'Entry time'),
    exit: t2(isEn, 'Giờ ra', 'Exit time'),
    vehicleType: t2(isEn, 'Loại xe', 'Vehicle type'),
    lastSeen: t2(isEn, 'Last seen', 'Last seen'),
    barrier: 'Barrier',
    presence: 'Presence',
    status: t2(isEn, 'Trạng thái', 'Status'),
    openedAt: t2(isEn, 'Mở lúc', 'Opened at'),
    noQuote: t2(
      isEn,
      'Chưa có quote. Chọn site, loại xe và khoảng thời gian rồi bấm tính tiền.',
      'No quote yet. Pick a site, vehicle type, and time range, then run the calculator.',
    ),
    noTariff: t2(isEn, 'Không tìm thấy tariff phù hợp.', 'No matching tariff found.'),
    focusTitle: t2(isEn, 'Focus controls', 'Focus controls'),
    focusDesc: t2(
      isEn,
      'Bật tắt từng section và đổi lens vận hành mà không cần cuộn xuống từng board.',
      'Toggle each section and switch operational lenses without scrolling through every board.',
    ),
    visibleSections: t2(isEn, 'Section hiển thị', 'Visible sections'),
    visibleBoards: t2(isEn, 'Board đang bật', 'Enabled boards'),
    laneLens: t2(isEn, 'Lane lens', 'Lane lens'),
    reviewLens: t2(isEn, 'Review lens', 'Review lens'),
    laneFocusOnly: t2(isEn, 'Chỉ lane cần chú ý', 'Focus issues'),
    showAllLanes: t2(isEn, 'Hiện tất cả lane', 'Show all lanes'),
    queueFocusOnly: t2(isEn, 'Chỉ queue cần review', 'Review attention'),
    showAllQueue: t2(isEn, 'Hiện toàn bộ queue', 'Show all queue'),
    resetLayout: t2(isEn, 'Khôi phục bố cục', 'Reset layout'),
    overviewSection: t2(isEn, 'Overview', 'Overview'),
    studioSection: t2(isEn, 'Procedure studio', 'Procedure studio'),
    catalogSection: t2(isEn, 'Catalog', 'Catalog'),
    liveOpsSection: t2(isEn, 'Live ops', 'Live ops'),
    sessionsBoard: t2(isEn, 'Sessions', 'Sessions'),
    laneBoard: t2(isEn, 'Lane health', 'Lane health'),
    queueBoard: t2(isEn, 'Review queue', 'Review queue'),
    laneFocusEmpty: t2(
      isEn,
      'Lens hiện tại không còn lane nào cần chú ý.',
      'No lane currently needs attention in this lens.',
    ),
    queueFocusEmpty: t2(
      isEn,
      'Lens hiện tại không còn queue nào cần review.',
      'No queue currently needs review in this lens.',
    ),
    boardHidden: t2(
      isEn,
      'Tất cả live boards đang tắt. Bật lại ít nhất một board để theo dõi live ops.',
      'All live boards are hidden. Re-enable at least one board to watch live ops.',
    ),
    triggerSignal: t2(isEn, 'Trigger gap', 'Trigger gap'),
    laneSignal: t2(isEn, 'Lane attention', 'Lane attention'),
    reviewSignal: t2(isEn, 'Review pressure', 'Review pressure'),
    sessionSignal: t2(isEn, 'Stale sessions', 'Stale sessions'),
  }
}

export type SqlModuleLabels = ReturnType<typeof getSqlModuleLabels>
