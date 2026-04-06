import { AlertTriangle } from 'lucide-react'

export function ValidationSummary({
  items,
  title = 'Check form input',
}: {
  items: Array<{ field: string; message: string }>
  title?: string
}) {
  if (items.length === 0) return null

  return (
    <div className="rounded-2xl border border-primary/25 bg-primary/10 px-4 py-4 text-sm text-primary">
      <div className="flex items-center gap-2 font-medium">
        <AlertTriangle className="h-4 w-4" />
        {title}
      </div>
      <ul className="mt-3 space-y-2 pl-5 text-sm text-foreground">
        {items.map((item) => (
          <li key={`${item.field}:${item.message}`}>
            <span className="font-mono-data text-xs uppercase tracking-[0.16em] text-muted-foreground">{item.field}</span>
            <span className="mx-2 text-muted-foreground">—</span>
            <span>{item.message}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
