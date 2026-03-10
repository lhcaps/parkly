import { useMemo, useState } from 'react'
import { Settings2, Wrench } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/ops/console'
import { OperatorSetupTab } from '@/features/settings/components/OperatorSetupTab'
import { DeveloperDebugTab } from '@/features/settings/components/DeveloperDebugTab'
import {
  clearLocalAppCache,
  getBuildDebugInfo,
  listLocalAppCacheKeys,
  readDefaultContextPrefs,
  resetDefaultContextPrefs,
  writeDefaultContextPrefs,
} from '@/lib/api'
import { clearToken, getApiBasePreview, getToken, setToken } from '@/lib/http/client'

export function SettingsPage() {
  const [token, setTokenInput] = useState(getToken())
  const [prefs, setPrefs] = useState(readDefaultContextPrefs())
  const [message, setMessage] = useState('')
  const [devMessage, setDevMessage] = useState('')

  const apiBase = useMemo(() => getApiBasePreview(), [])
  const buildInfo = useMemo(() => getBuildDebugInfo(), [])
  const cacheKeys = useMemo(() => listLocalAppCacheKeys(), [message, devMessage])

  function saveTokenValue() {
    setToken(token.trim())
    setTokenInput(getToken())
    setMessage('Đã lưu token cho browser này.')
  }

  function removeTokenValue() {
    clearToken()
    setTokenInput('')
    setMessage('Đã xoá token khỏi browser này.')
  }

  function savePrefsValue() {
    const next = writeDefaultContextPrefs(prefs)
    setPrefs(next ?? readDefaultContextPrefs())
    setMessage('Đã lưu default context.')
  }

  function resetPrefsValue() {
    const next = resetDefaultContextPrefs()
    setPrefs(next)
    setMessage('Đã reset default context.')
    setDevMessage('Default context đã được reset.')
  }

  function clearCacheValue() {
    clearLocalAppCache()
    setTokenInput(getToken())
    setPrefs(readDefaultContextPrefs())
    setDevMessage('Đã clear local cache của app trong browser này.')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="System"
        title="Settings"
        description="Thiết lập token, default context và công cụ chẩn đoán cục bộ cho browser hiện tại."
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
            token={token}
            prefs={prefs}
            message={message}
            onTokenChange={setTokenInput}
            onApplyPreset={setTokenInput}
            onSaveToken={saveTokenValue}
            onClearToken={removeTokenValue}
            onPrefsChange={(patch) => setPrefs((current) => ({ ...current, ...patch }))}
            onSavePrefs={savePrefsValue}
            onResetPrefs={resetPrefsValue}
          />
        </TabsContent>

        <TabsContent value="developer">
          <DeveloperDebugTab
            apiBase={apiBase}
            tokenPreview={token ? `${token.slice(0, 8)}...${token.slice(-4)}` : ''}
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
