import { CheckCircle2, ScanSearch } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { AlprPreviewCandidate } from '@/lib/contracts/alpr'

export function CandidateListCard({
  candidates,
  onApplyCandidate,
}: {
  candidates: AlprPreviewCandidate[]
  onApplyCandidate: (plate: string) => void
}) {
  return (
    <Card className="border-border/80 bg-card/95">
      <CardHeader>
        <CardTitle className="text-sm sm:text-base">Candidate List</CardTitle>
        <CardDescription>
          Click candidate để áp vào override. Preview loading hay refresh không được khóa input override.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {candidates.length > 0 ? (
          <div className="space-y-3">
            {candidates.map((candidate) => (
              <div
                key={`${candidate.plate}:${candidate.score}:${candidate.votes}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-background/40 p-4"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono-data text-sm font-medium text-foreground">{candidate.plate}</p>
                    <Badge variant="outline">score {candidate.score.toFixed(2)}</Badge>
                    <Badge variant="muted">votes {candidate.votes}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    crop={candidate.cropVariants.join(', ') || '—'} · psm={candidate.psmModes.join(', ') || '—'}
                  </p>
                  {candidate.suspiciousFlags.length > 0 && (
                    <p className="text-xs text-muted-foreground">flags={candidate.suspiciousFlags.join(', ')}</p>
                  )}
                </div>

                <Button type="button" variant="outline" size="sm" onClick={() => onApplyCandidate(candidate.plate)}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Áp vào override
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex min-h-[120px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-background/40 px-6 py-8 text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl border border-border/80 bg-muted/25 text-muted-foreground">
              <ScanSearch className="h-4 w-4" />
            </div>
            <p className="text-sm font-medium">Chưa có candidate từ backend preview</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Khi preview trả về top candidates, card này sẽ cho operator áp nhanh vào override.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
