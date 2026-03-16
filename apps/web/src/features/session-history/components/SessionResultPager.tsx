import { ArrowLeft, ArrowRight, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

type SearchMeta = {
  mode: 'window' | 'search-scan' | 'exact-session'
  term: string
  pagesScanned: number
  truncated: boolean
}

export function SessionResultPager({
  rowCount,
  selectedId,
  currentPage,
  hasPrev,
  hasNext,
  loading,
  searchMeta,
  onPrev,
  onNext,
}: {
  rowCount: number
  selectedId: string
  currentPage: number
  hasPrev: boolean
  hasNext: boolean
  loading: boolean
  searchMeta: SearchMeta
  onPrev: () => void
  onNext: () => void
}) {
  const inSearchMode = searchMeta.mode !== 'window'

  return (
    <Card className="border-border/80 bg-card/95 shadow-[0_18px_60px_rgba(0,0,0,0.12)]">
      <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">rows {rowCount}</Badge>
            <Badge variant="muted">page {currentPage}</Badge>
            {selectedId ? <Badge variant="secondary">selected {selectedId}</Badge> : null}
            {inSearchMode ? <Badge variant="amber">deep search</Badge> : null}
          </div>

          {inSearchMode ? (
            <div className="flex items-start gap-2 rounded-2xl border border-primary/20 bg-primary/8 px-3 py-3 text-sm text-primary">
              <Search className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0">
                <p className="font-medium text-foreground">Keyword is being scanned across multiple backend pages</p>
                <p className="mt-1 text-xs text-primary/90">
                  term={searchMeta.term || '—'} · pages={searchMeta.pagesScanned}
                  {searchMeta.truncated ? ' · results are truncated by the current scan limit' : ''}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Pagination follows the backend cursor. Repeat the same filter, site, and time range without opening the DB.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={onPrev} disabled={!hasPrev || loading || inSearchMode}>
            <ArrowLeft className="h-4 w-4" />
            Previous page
          </Button>
          <Button variant="outline" size="sm" onClick={onNext} disabled={!hasNext || loading || inSearchMode}>
            Next page
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
