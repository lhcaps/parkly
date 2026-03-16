import { LoginPanel } from '@/features/auth/components/LoginPanel'

export function LoginPage() {
  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">System</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Auth shell + session bootstrap</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground sm:text-base">
            Sign in một lần ở lớp app shell. Toàn bộ route chính sau đó dùng cùng user context, cùng session lifecycle và cùng RBAC contract.
          </p>
        </div>
        <LoginPanel />
      </div>
    </div>
  )
}
