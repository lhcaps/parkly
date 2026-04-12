import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { SurfaceState } from '@/components/ops/console'
import { type SelectOption } from '@/components/ui/select'
import type { AuthRole } from '@/lib/contracts/auth'
import {
  getSqlSurfaceSnapshot,
  quoteSqlTicketPrice,
  runSqlAuthCleanup,
} from '@/lib/api/sql-surface'

import { SqlModulesCatalog } from './sql-modules/SqlModulesCatalog'
import { SqlModulesOverview } from './sql-modules/SqlModulesOverview'
import { SqlModulesStudio } from './sql-modules/SqlModulesStudio'
import {
  getCatalogSource,
  getSqlModuleLabels,
  localInput,
  showError,
  t2,
  type SqlCatalogTab,
} from './sql-modules/sqlModules.utils'

export function SqlModulesTab({ role }: { role?: AuthRole | string }) {
  const { i18n } = useTranslation()
  const isEn = i18n.language.startsWith('en')
  const locale = isEn ? 'en-GB' : 'vi-VN'
  const labels = useMemo(() => getSqlModuleLabels(isEn), [isEn])
  const queryClient = useQueryClient()
  const canManage = role === 'SUPER_ADMIN' || role === 'SITE_ADMIN' || role === 'MANAGER' || role === 'OPERATOR'

  const [tab, setTab] = useState<SqlCatalogTab>('procedures')
  const [search, setSearch] = useState('')
  const [moduleFilter, setModuleFilter] = useState('all')
  const deferredSearch = useDeferredValue(search)

  const [siteCode, setSiteCode] = useState('')
  const [vehicleType, setVehicleType] = useState<'CAR' | 'MOTORBIKE'>('CAR')
  const [entryTime, setEntryTime] = useState(() => {
    const date = new Date()
    date.setHours(date.getHours() - 2)
    return localInput(date)
  })
  const [exitTime, setExitTime] = useState(() => localInput(new Date()))

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['settings', 'sql-surface'],
    queryFn: getSqlSurfaceSnapshot,
  })

  useEffect(() => {
    if (!siteCode && data?.siteScope.sites[0]?.siteCode) {
      setSiteCode(data.siteScope.sites[0].siteCode)
    }
  }, [data?.siteScope.sites, siteCode])

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['settings', 'sql-surface'] })
    await refetch()
  }

  const cleanup = useMutation({
    mutationFn: runSqlAuthCleanup,
    onSuccess: (result) => {
      toast.success(
        t2(
          isEn,
          `Đã xoá ${result.deletedExpired} session hết hạn và ${result.deletedRevoked} session đã revoke.`,
          `Removed ${result.deletedExpired} expired and ${result.deletedRevoked} revoked sessions.`,
        ),
      )
      void refresh()
    },
    onError: (err) => showError(err, 'Cleanup failed'),
  })

  const quote = useMutation({
    mutationFn: quoteSqlTicketPrice,
    onError: (err) => showError(err, 'Pricing quote failed'),
  })

  const moduleOptions = useMemo<SelectOption[]>(() => {
    const base = [{ value: 'all', label: labels.allModules }]
    const extra = (data?.moduleGroups ?? []).map((group) => ({
      value: group.moduleKey,
      label: `${group.moduleLabel} (${group.total})`,
    }))
    return [...base, ...extra]
  }, [data?.moduleGroups, labels.allModules])

  const siteOptions = useMemo<SelectOption[]>(
    () => (data?.siteScope.sites ?? []).map((site) => ({ value: site.siteCode, label: site.siteCode, description: site.name })),
    [data?.siteScope.sites],
  )

  const vehicleOptions = useMemo<SelectOption[]>(
    () => [
      { value: 'CAR', label: t2(isEn, 'Ô tô', 'Car') },
      { value: 'MOTORBIKE', label: t2(isEn, 'Xe máy', 'Motorbike') },
    ],
    [isEn],
  )

  const filteredCatalog = useMemo(() => {
    if (!data) return []

    const term = deferredSearch.trim().toLowerCase()
    return getCatalogSource(data, tab).filter((item) => {
      if (moduleFilter !== 'all' && item.moduleKey !== moduleFilter) return false
      if (!term) return true
      return (
        item.name.toLowerCase().includes(term) ||
        item.moduleLabel.toLowerCase().includes(term) ||
        String(item.objectType ?? '').toLowerCase().includes(term) ||
        String(item.detail ?? '').toLowerCase().includes(term)
      )
    })
  }, [data, deferredSearch, moduleFilter, tab])

  function handleSearchChange(value: string) {
    startTransition(() => {
      setSearch(value)
    })
  }

  function handleQuote() {
    const entry = new Date(entryTime)
    const exit = new Date(exitTime)

    if (Number.isNaN(entry.getTime()) || Number.isNaN(exit.getTime())) {
      toast.error(t2(isEn, 'Thời gian vào/ra không hợp lệ.', 'Invalid entry/exit time.'))
      return
    }

    if (exit <= entry) {
      toast.error(t2(isEn, 'Giờ ra phải sau giờ vào.', 'Exit time must be later than entry time.'))
      return
    }

    quote.mutate({
      siteCode,
      vehicleType,
      entryTime: entry.toISOString(),
      exitTime: exit.toISOString(),
    })
  }

  if (isLoading) {
    return <SurfaceState title={labels.title} description={labels.desc} tone="loading" className="min-h-[320px]" />
  }

  if (!data) {
    return <SurfaceState title={labels.title} description={labels.empty} tone="error" className="min-h-[320px]" />
  }

  return (
    <div className="space-y-6" data-testid="sql-modules-tab">
      <SqlModulesOverview
        data={data}
        labels={labels}
        isEn={isEn}
        isFetching={isFetching}
        onRefresh={refresh}
      />

      <SqlModulesCatalog
        data={data}
        labels={labels}
        tab={tab}
        onTabChange={setTab}
        search={search}
        onSearchChange={handleSearchChange}
        moduleFilter={moduleFilter}
        onModuleFilterChange={setModuleFilter}
        moduleOptions={moduleOptions}
        filteredCatalog={filteredCatalog}
      />

      <SqlModulesStudio
        labels={labels}
        locale={locale}
        canManage={canManage}
        cleanupPending={cleanup.isPending}
        cleanupData={cleanup.data}
        onRunCleanup={async () => cleanup.mutateAsync()}
        siteCode={siteCode}
        onSiteCodeChange={setSiteCode}
        siteOptions={siteOptions}
        vehicleType={vehicleType}
        onVehicleTypeChange={setVehicleType}
        vehicleOptions={vehicleOptions}
        entryTime={entryTime}
        onEntryTimeChange={setEntryTime}
        exitTime={exitTime}
        onExitTimeChange={setExitTime}
        quotePending={quote.isPending}
        quoteResult={quote.data}
        onRunQuote={handleQuote}
      />
    </div>
  )
}
