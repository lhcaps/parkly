import { useEffect, useState } from 'react'
import { BarChart3, CalendarRange, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { getReportsSummary, getSites, type ReportsSummaryRes, type SiteRow } from '@/lib/api'

function Metric({ label, value, helper, positive = false, negative = false }: { label: string; value: string | number; helper: string; positive?: boolean; negative?: boolean }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-[11px] font-mono-data uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className={cn('mt-2 font-mono-data text-3xl font-semibold', positive && 'text-success', negative && 'text-destructive')}>{value}</p>
        <p className="mt-2 text-xs text-muted-foreground">{helper}</p>
      </CardContent>
    </Card>
  )
}

export function ReportsPage() {
  const [sites, setSites] = useState<SiteRow[]>([])
  const [siteCode, setSiteCode] = useState('')
  const [days, setDays] = useState(7)
  const [summary, setSummary] = useState<ReportsSummaryRes | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load(nextSiteCode?: string, nextDays?: number) {
    try {
      setLoading(true)
      setError('')
      const effectiveSiteCode = nextSiteCode || siteCode
      const effectiveDays = nextDays || days
      if (!effectiveSiteCode) return
      const data = await getReportsSummary(effectiveSiteCode, effectiveDays)
      setSummary(data)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError))
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    async function bootstrap() {
      try {
        const siteRes = await getSites()
        if (!active) return
        setSites(siteRes.rows)
        const firstSite = siteRes.rows[0]?.siteCode || ''
        setSiteCode(firstSite)
        if (firstSite) await load(firstSite, 7)
      } catch (bootstrapError) {
        if (!active) return
        setError(bootstrapError instanceof Error ? bootstrapError.message : String(bootstrapError))
      }
    }
    void bootstrap()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const entryShare = summary?.total ? Math.round((summary.entry / summary.total) * 100) : 0
  const exitShare = summary?.total ? Math.round((summary.exit / summary.total) * 100) : 0

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Reports Summary</h1>
          <p className="mt-1 text-sm text-muted-foreground">Trang này bám đúng endpoint đang có thật: /api/reports/summary?siteCode=...&days=...</p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading || !siteCode}>
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bộ lọc báo cáo</CardTitle>
          <CardDescription>Backend hiện chỉ support summary theo siteCode và số ngày.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px_auto]">
          <select value={siteCode} onChange={(e) => setSiteCode(e.target.value)} className="h-10 rounded-lg border border-input bg-muted px-3 text-sm font-mono-data">
            {sites.map((site) => <option key={site.siteCode} value={site.siteCode}>{site.siteCode} · {site.name}</option>)}
          </select>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="h-10 rounded-lg border border-input bg-muted px-3 text-sm font-mono-data">
            {[1, 3, 7, 14, 30].map((n) => <option key={n} value={n}>{n} ngày</option>)}
          </select>
          <Button onClick={() => void load(siteCode, days)} disabled={loading || !siteCode}>
            <BarChart3 className="h-4 w-4" />
            Load summary
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Card>
          <CardContent className="pt-5 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Metric label="Site" value={summary?.siteCode || '—'} helper="siteCode backend trả về" />
        <Metric label="Window" value={summary ? `${summary.days}d` : '—'} helper="Khoảng thời gian tổng hợp" />
        <Metric label="Total" value={summary?.total || 0} helper="Tổng gate events" positive={Boolean(summary && summary.total > 0)} />
        <Metric label="Entry vs Exit" value={summary ? `${entryShare}% / ${exitShare}%` : '—'} helper="Tỷ trọng luồng vào / ra" />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Summary breakdown</CardTitle>
            <CardDescription>Không fake chart; chỉ render số backend trả về.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-success/20 bg-success/6 px-5 py-5">
                <div className="flex items-center gap-2 text-success">
                  <TrendingUp className="h-4 w-4" />
                  <p className="text-sm font-semibold">ENTRY</p>
                </div>
                <p className="mt-3 font-mono-data text-4xl font-semibold">{summary?.entry || 0}</p>
                <p className="mt-2 text-xs text-muted-foreground">Số lượt xe vào trong cửa sổ báo cáo.</p>
              </div>
              <div className="rounded-xl border border-destructive/20 bg-destructive/6 px-5 py-5">
                <div className="flex items-center gap-2 text-destructive">
                  <TrendingDown className="h-4 w-4" />
                  <p className="text-sm font-semibold">EXIT</p>
                </div>
                <p className="mt-3 font-mono-data text-4xl font-semibold">{summary?.exit || 0}</p>
                <p className="mt-2 text-xs text-muted-foreground">Số lượt xe ra trong cửa sổ báo cáo.</p>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/20 px-4 py-4">
              <div className="mb-3 flex items-center gap-2">
                <CalendarRange className="h-4 w-4 text-muted-foreground" />
                <p className="text-[11px] font-mono-data uppercase tracking-widest text-muted-foreground">Interpreting the API</p>
              </div>
              <ul className="space-y-2 text-sm text-foreground/85">
                <li>Backend đang group gate_events theo direction và khoảng thời gian gần nhất.</li>
                <li>Không có breakdown theo gateCode hoặc laneCode trong endpoint hiện tại.</li>
                <li>Không có chart timeseries thật nếu backend chưa expose endpoint chi tiết hơn.</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick facts</CardTitle>
            <CardDescription>Render trực tiếp từ summary hiện tại.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-foreground/85">
            <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
              <Badge variant="secondary">{summary?.siteCode || siteCode || '—'}</Badge>
              <p className="mt-2 text-xs text-muted-foreground">Site đang được tổng hợp.</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
              <Badge variant="outline">{summary ? `${summary.days} ngày` : `${days} ngày`}</Badge>
              <p className="mt-2 text-xs text-muted-foreground">Window dùng để query /api/reports/summary.</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
              <Badge variant="entry">ENTRY {summary?.entry || 0}</Badge>
              <Badge variant="exit" className="ml-2">EXIT {summary?.exit || 0}</Badge>
              <p className="mt-2 text-xs text-muted-foreground">Hai số này là toàn bộ nội dung analytics mà backend đang trả về.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
