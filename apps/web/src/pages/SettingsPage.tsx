import { useMemo, useState } from 'react'
import { Settings2, Wrench } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/ops/console'
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
    setMessage('Default context saved.')
  }

  function resetPrefsValue() {
    const next = resetDefaultContextPrefs()
    setPrefs(next)
    setMessage('Default context reset.')
    setDevMessage('Default context has been reset.')
  }

  function clearCacheValue() {
    clearLocalAppCache()
    setPrefs(readDefaultContextPrefs())
    setDevMessage('Local app cache cleared for this browser.')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="System"
        title="Settings"
        description="Diagnostics for auth shell, token runtime, and default context for this browser.manual không còn là luồng đăng nhập chính."
      />

      <Tabs defaultValue="operator" className="space-y-5">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="operator">
            <Settings2 className="h-4 w-4" />
            Operator setup
          </TabsTrigger>
          <TabsTrigger value="developer">
            <Wrench className="h-4 w-4" />
            Developer / debug
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
