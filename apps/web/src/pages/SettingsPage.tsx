import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Languages, Settings2, Wrench } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/ops/console'
import { AppearancePreferencesTab } from '@/features/settings/components/AppearancePreferencesTab'
import { OperatorSetupTab } from '@/features/settings/components/OperatorSetupTab'
import { DeveloperDebugTab } from '@/features/settings/components/DeveloperDebugTab'
import { useAuth } from '@/features/auth/auth-context'
import {
  clearLocalAppCache,
  getBuildDebugInfo,
  listLocalAppCacheKeys,
  readDefaultContextPrefs,
  resetDefaultContextPrefs,
  writeDefaultContextPrefs,
} from '@/lib/api'
import { getApiBasePreview, getRefreshToken, getToken } from '@/lib/http/client'

export function SettingsPage() {
  const { t } = useTranslation()
  const auth = useAuth()
  const [prefs, setPrefs] = useState(readDefaultContextPrefs())
  const [message, setMessage] = useState('')
  const [devMessage, setDevMessage] = useState('')

  const apiBase = useMemo(() => getApiBasePreview(), [])
  const buildInfo = useMemo(() => getBuildDebugInfo(), [])
  const cacheKeys = useMemo(() => listLocalAppCacheKeys(), [message, devMessage])
  const accessTokenPreview = useMemo(() => {
    const token = getToken()
    return token ? `${token.slice(0, 8)}...${token.slice(-4)}` : ''
  }, [message, devMessage])
  const refreshTokenPreview = useMemo(() => {
    const token = getRefreshToken()
    return token ? `${token.slice(0, 8)}...${token.slice(-4)}` : ''
  }, [message, devMessage])

  function savePrefsValue() {
    const next = writeDefaultContextPrefs(prefs)
    setPrefs(next ?? readDefaultContextPrefs())
    setMessage(t('settingsPage.savedContext'))
  }

  function resetPrefsValue() {
    const next = resetDefaultContextPrefs()
    setPrefs(next)
    setMessage(t('settingsPage.resetContext'))
    setDevMessage(t('settingsPage.resetContext'))
  }

  function clearCacheValue() {
    clearLocalAppCache()
    setPrefs(readDefaultContextPrefs())
    setDevMessage(t('settingsPage.cacheCleared'))
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('settingsPage.eyebrow')}
        title={t('settingsPage.title')}
        description={t('settingsPage.description')}
      />

      <Tabs defaultValue="operator" className="space-y-6">
        <TabsList className="w-full justify-start gap-2 rounded-2xl border border-border bg-muted/60 p-1.5">
          <TabsTrigger value="operator">
            <Settings2 className="h-5 w-5" />
            {t('settingsPage.tabOperator')}
          </TabsTrigger>
          <TabsTrigger value="appearance">
            <Languages className="h-5 w-5" />
            {t('settingsPage.tabAppearance')}
          </TabsTrigger>
          <TabsTrigger value="developer">
            <Wrench className="h-5 w-5" />
            {t('settingsPage.tabDeveloper')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="operator">
          <OperatorSetupTab
            principal={auth.principal}
            message={message}
            prefs={prefs}
            authBusy={auth.isBusy}
            onLogout={() => void auth.logout()}
            onPrefsChange={(patch) => setPrefs((current) => ({ ...current, ...patch }))}
            onSavePrefs={savePrefsValue}
            onResetPrefs={resetPrefsValue}
          />
        </TabsContent>

        <TabsContent value="appearance">
          <AppearancePreferencesTab />
        </TabsContent>

        <TabsContent value="developer">
          <DeveloperDebugTab
            apiBase={apiBase}
            tokenPreview={accessTokenPreview || refreshTokenPreview}
            buildInfo={buildInfo}
            prefs={prefs}
            cacheKeys={cacheKeys}
            message={devMessage}
            onClearCache={clearCacheValue}
            onResetPrefs={resetPrefsValue}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
