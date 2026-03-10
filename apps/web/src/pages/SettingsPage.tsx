import { useMemo, useState } from 'react'
import { Settings2, Wrench } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
    setMessage('Đã lưu token vào localStorage của browser này.')
  }

  function removeTokenValue() {
    clearToken()
    setTokenInput('')
    setMessage('Đã xoá token khỏi browser này.')
  }

  function savePrefsValue() {
    writeDefaultContextPrefs(prefs)
    setMessage('Đã lưu default context prefs.')
  }

  function resetPrefsValue() {
    const next = resetDefaultContextPrefs()
    setPrefs(next)
    setMessage('Đã reset default context prefs.')
    setDevMessage('Default context prefs đã được reset.')
  }

  function clearCacheValue() {
    clearLocalAppCache()
    setTokenInput(getToken())
    setPrefs(readDefaultContextPrefs())
    setDevMessage('Đã clear local cache của app trong browser này.')
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border/80 bg-card/95 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-4xl">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">settings v2</Badge>
              <Badge variant="outline">operator setup</Badge>
              <Badge variant="outline">developer debug</Badge>
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Settings</h1>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              PR-14 tách Settings thành hai mặt rõ ràng: phần operator để setup access/context, và phần developer/debug để dọn cache, xem build info và kiểm tra môi trường.
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="operator" className="space-y-5">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="operator">
            <Settings2 className="h-4 w-4" />
            Operator Setup
          </TabsTrigger>
          <TabsTrigger value="developer">
            <Wrench className="h-4 w-4" />
            Developer / Debug
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
