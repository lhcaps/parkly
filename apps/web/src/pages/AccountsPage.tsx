import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Select } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  UserCheck,
  UserX,
  RefreshCcw,
  Edit2,
  Shield,
  Plus,
  Loader2,
  AlertCircle,
  CheckCircle2,
  UserCog,
  ChevronLeft,
  ChevronRight,
  Users,
  Car,
  CreditCard,
  Package,
  Eye,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

import { useAuth } from '@/features/auth/auth-context'
import { canAccessRoute } from '@/lib/auth/role-policy'
import type { AuthRole } from '@/lib/contracts/auth'
import { getSites } from '@/lib/api/topology'
import type { SiteRow } from '@parkly/contracts'
import {
  listUsers,
  createUser,
  updateUser,
  enableUser,
  disableUser,
  setUserSiteScopes,
  revokeUserSessions,
  getMyProfile,
  updateMyProfile,
  ROLE_LABELS,
  SCOPE_LEVELS,
  type UserSummary,
  type MyProfile,
  type ListUsersResponse,
} from '@/lib/api/user-management'
import {
  listCustomers,
  getCustomerDetail,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  type CreateCustomerPayload,
  type UpdateCustomerPayload,
} from '@/lib/api/customer-management'
import type { CustomerSummary, CustomerDetail } from '@parkly/contracts'
import { toAppErrorDisplay } from '@/lib/http/errors'

// ─── Profile Tab ──────────────────────────────────────────────────────────────

function ProfileTab() {
  const { t } = useTranslation()
  const { data: profile, isLoading, refetch } = useQuery({
    queryKey: ['accountPage', 'me'],
    queryFn: getMyProfile,
  })

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (body: { password?: string }) => updateMyProfile(body),
    onSuccess: () => {
      toast.success(t('accountPage.profile.passwordUpdated'))
      setNewPassword('')
      setConfirmPassword('')
      void refetch()
    },
    onError: (err) => {
      const display = toAppErrorDisplay(err, t('common.operationFailed'))
      toast.error(display.title, { description: display.message })
    },
  })

  const handleSave = () => {
    setLocalError(null)
    if (!newPassword) {
      setLocalError(t('accountPage.profile.passwordRequired'))
      return
    }
    if (newPassword.length < 8) {
      setLocalError(t('accountPage.profile.passwordMinLength'))
      return
    }
    if (newPassword !== confirmPassword) {
      setLocalError(t('accountPage.profile.passwordMismatch'))
      return
    }
    mutation.mutate({ password: newPassword })
  }

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-lg space-y-6">
        <div className="space-y-1">
          <Skeleton className="mx-auto h-5 w-32" />
          <Skeleton className="mx-auto h-4 w-48" />
        </div>
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="mx-auto h-10 w-28 rounded-xl" />
      </div>
    )
  }

  const p = profile as MyProfile

  return (
    <div className="mx-auto w-full max-w-lg space-y-8">
      {/* Profile Info Card */}
      <div className="rounded-2xl border border-border/80 bg-card p-6 space-y-4 shadow-sm ring-1 ring-border/40">
        <div className="flex flex-col items-center text-center sm:flex-row sm:text-left sm:items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 shadow-inner">
            <UserCog className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-lg tracking-tight">{p?.username}</h3>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-1.5">
              {p?.roles.map((role) => {
                const meta = ROLE_LABELS[role]
                return (
                  <Badge key={role} variant="outline" className={`text-[10px] border ${meta?.color ?? 'bg-muted text-muted-foreground'}`}>
                    {meta?.label ?? role}
                  </Badge>
                )
              })}
              {p?.status === 'ACTIVE' ? (
                <span className="flex items-center gap-1 text-[10px] text-emerald-500">
                  <CheckCircle2 className="h-3 w-3" /> ACTIVE
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] text-red-500">
                  <AlertCircle className="h-3 w-3" /> DISABLED
                </span>
              )}
            </div>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-center sm:text-left">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">User ID</p>
            <p className="font-mono text-xs text-foreground/80">{p?.userId}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Created</p>
            <p className="text-xs text-foreground/80">{p?.createdAt ? new Date(p.createdAt).toLocaleString() : '—'}</p>
          </div>
        </div>

        {p?.siteScopes && p.siteScopes.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2 text-center sm:text-left">Site Scopes</p>
            <div className="flex flex-wrap gap-1.5 justify-center sm:justify-start">
              {p.siteScopes.map((scope) => (
                <Badge key={scope.siteCode} variant="secondary" className="text-[10px]">
                  {scope.siteCode} · {scope.scopeLevel}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Password Update Card */}
      <div className="rounded-2xl border border-border/80 bg-card p-6 space-y-5 shadow-sm ring-1 ring-border/40">
        <div className="text-center sm:text-left">
          <h3 className="text-sm font-semibold">{t('accountPage.profile.changePassword')}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{t('accountPage.profile.changePasswordDesc')}</p>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t('accountPage.profile.newPassword')}
            </label>
            <Input
              type="password"
              placeholder={t('accountPage.profile.newPasswordPlaceholder')}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t('accountPage.profile.confirmPassword')}
            </label>
            <Input
              type="password"
              placeholder={t('accountPage.profile.confirmPasswordPlaceholder')}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          {localError && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {localError}
            </div>
          )}

          {mutation.isSuccess && (
            <div className="flex items-center gap-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs text-emerald-500">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              {t('accountPage.profile.passwordUpdated')}
            </div>
          )}
        </div>

        <div className="flex justify-center sm:justify-end">
          <Button
            onClick={handleSave}
            disabled={mutation.isPending || !newPassword || !confirmPassword}
            size="default"
            className="min-h-10 min-w-[10rem] font-semibold shadow-md shadow-primary/15"
          >
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              t('accountPage.profile.savePassword')
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── User Row Component ────────────────────────────────────────────────────────

function UserRow({
  user,
  onEdit,
  onToggleStatus,
  onRevokeSessions,
  onSetScopes,
}: {
  user: UserSummary
  onEdit: (user: UserSummary) => void
  onToggleStatus: (user: UserSummary) => void
  onRevokeSessions: (user: UserSummary) => void
  onSetScopes?: (user: UserSummary) => void
}) {
  const { t } = useTranslation()
  const actionBtn =
    'h-10 w-10 sm:h-9 sm:w-9 shrink-0 touch-manipulation opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity'

  return (
    <div className="group rounded-xl border border-transparent px-2 py-2 sm:px-3 sm:py-0 transition-colors hover:border-border/50 hover:bg-muted/30">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:py-2.5">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/50 bg-primary/10 text-primary text-xs font-semibold uppercase">
            {user.username.slice(0, 2)}
          </div>

          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-sm text-foreground/90 truncate">{user.username}</span>
              <span
                className={`flex items-center gap-1 text-[10px] font-mono shrink-0 ${
                  user.status === 'ACTIVE' ? 'text-emerald-500' : 'text-red-500'
                }`}
              >
                {user.status === 'ACTIVE' ? <CheckCircle2 className="h-2.5 w-2.5" /> : <AlertCircle className="h-2.5 w-2.5" />}
                {user.status}
              </span>
            </div>

            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {user.roles.map((role) => {
                const meta = ROLE_LABELS[role]
                return (
                  <Badge key={role} variant="outline" className={`text-[10px] border ${meta?.color ?? 'bg-muted text-muted-foreground'}`}>
                    {meta?.label ?? role}
                  </Badge>
                )
              })}
              {user.activeSessionCount > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  {user.activeSessionCount} session{user.activeSessionCount !== 1 ? 's' : ''}
                </span>
              )}
              {user.lastLoginAt && (
                <span className="text-[10px] text-muted-foreground hidden sm:inline">
                  last login {new Date(user.lastLoginAt).toLocaleString()}
                </span>
              )}
            </div>

            {user.siteScopes.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1 lg:hidden">
                {user.siteScopes.map((scope) => (
                  <Badge key={scope.siteCode} variant="secondary" className="text-[10px]">
                    {scope.siteCode}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 sm:justify-end sm:shrink-0 pl-[3.25rem] sm:pl-0">
          {user.siteScopes.length > 0 && (
            <div className="hidden lg:flex items-center gap-1 max-w-[14rem] flex-wrap justify-end">
              {user.siteScopes.slice(0, 3).map((scope) => (
                <Badge key={scope.siteCode} variant="secondary" className="text-[10px] shrink-0">
                  {scope.siteCode}
                </Badge>
              ))}
              {user.siteScopes.length > 3 && (
                <span className="text-[10px] text-muted-foreground">+{user.siteScopes.length - 3}</span>
              )}
            </div>
          )}

          <div className="flex items-center gap-0.5 sm:gap-1">
            {onSetScopes && (
              <Button
                variant="ghost"
                size="icon"
                className={actionBtn}
                title={t('accountPage.admin.setSiteScopes')}
                onClick={() => onSetScopes(user)}
              >
                <Shield className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className={actionBtn} title={t('accountPage.admin.editUser')} onClick={() => onEdit(user)}>
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={`${actionBtn} ${user.status === 'ACTIVE' ? 'text-amber-500 hover:text-amber-500' : 'text-emerald-500 hover:text-emerald-500'}`}
              title={user.status === 'ACTIVE' ? t('accountPage.admin.disable') : t('accountPage.admin.enable')}
              onClick={() => onToggleStatus(user)}
            >
              {user.status === 'ACTIVE' ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
            </Button>
            {user.activeSessionCount > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className={`${actionBtn} text-destructive hover:text-destructive`}
                title={t('accountPage.admin.revokeSessions')}
                onClick={() => onRevokeSessions(user)}
              >
                <RefreshCcw className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Edit User Dialog ──────────────────────────────────────────────────────────

function EditUserDialog({
  user,
  open,
  onClose,
  onSuccess,
}: {
  user: UserSummary | null
  open: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (open && user) {
      setUsername(user.username)
      setRole(user.roles[0] ?? '')
      setPassword('')
      setLocalError(null)
    }
  }, [open, user])

  const mutation = useMutation({
    mutationFn: (body: { username?: string; password?: string; role?: string; reason?: string }) =>
      updateUser(user!.userId, body),
    onSuccess: () => {
      toast.success(t('accountPage.admin.userUpdated', { username }))
      onClose()
      void queryClient.invalidateQueries({ queryKey: ['accountPage'] })
      onSuccess()
    },
    onError: (err) => {
      const display = toAppErrorDisplay(err, t('common.operationFailed'))
      toast.error(display.title, { description: display.message })
    },
  })

  const handleSave = () => {
    if (!user) return
    setLocalError(null)
    if (username && username !== user.username && username.length < 3) {
      setLocalError(t('accountPage.admin.usernameMinLength'))
      return
    }
    mutation.mutate({
      username: username !== user.username ? username : undefined,
      password: password || undefined,
      role: role !== user.roles[0] ? role : undefined,
      reason: 'ADMIN_UPDATE',
    })
  }

  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('accountPage.admin.editUser')}</DialogTitle>
          <DialogDescription>
            {t('accountPage.admin.editUserDesc', { username: user.username })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t('accountPage.admin.username')}
            </label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t('accountPage.admin.usernamePlaceholder')}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t('accountPage.admin.role')}
            </label>
            <Select
              value={role}
              onChange={setRole}
              options={Object.keys(ROLE_LABELS).map((r) => ({
                value: r,
                label: ROLE_LABELS[r]?.label ?? r,
              }))}
              placeholder={t('accountPage.admin.role')}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t('accountPage.admin.newPasswordOptional')}
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('accountPage.admin.newPasswordPlaceholder')}
              autoComplete="new-password"
            />
            <p className="text-[10px] text-muted-foreground">{t('accountPage.admin.passwordLeaveBlank')}</p>
          </div>

          {localError && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {localError}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            {t('accountPage.dialog.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('accountPage.dialog.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Create User Dialog ────────────────────────────────────────────────────────

function CreateUserDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [role, setRole] = useState<string>('OPERATOR')
  const [localError, setLocalError] = useState<string | null>(null)
  const [sites, setSites] = useState<SiteRow[]>([])

  useEffect(() => {
    if (open) {
      void getSites().then((res) => setSites(res.rows)).catch(() => {})
      setUsername('')
      setPassword('')
      setConfirmPassword('')
      setRole('OPERATOR')
      setLocalError(null)
    }
  }, [open])

  const mutation = useMutation({
    mutationFn: (body: { username: string; password: string; role: string }) =>
      createUser(body),
    onSuccess: () => {
      toast.success(t('accountPage.admin.userCreated', { username }))
      onClose()
      void queryClient.invalidateQueries({ queryKey: ['accountPage'] })
    },
    onError: (err) => {
      const display = toAppErrorDisplay(err, t('common.operationFailed'))
      toast.error(display.title, { description: display.message })
    },
  })

  const handleSave = () => {
    setLocalError(null)
    if (!username || username.length < 3) {
      setLocalError(t('accountPage.admin.usernameMinLength'))
      return
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      setLocalError(t('accountPage.admin.usernameInvalid'))
      return
    }
    if (!password || password.length < 8) {
      setLocalError(t('accountPage.admin.passwordMinLength'))
      return
    }
    if (password !== confirmPassword) {
      setLocalError(t('accountPage.admin.passwordMismatch'))
      return
    }
    mutation.mutate({ username, password, role })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('accountPage.admin.createUser')}</DialogTitle>
          <DialogDescription>
            {t('accountPage.admin.createUserDesc')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t('accountPage.admin.username')} *
            </label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t('accountPage.admin.usernamePlaceholder')}
              autoComplete="username"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t('accountPage.admin.role')} *
            </label>
            <Select
              value={role}
              onChange={setRole}
              options={Object.entries(ROLE_LABELS).map(([key, meta]) => ({
                value: key,
                label: meta.label,
              }))}
              placeholder={t('accountPage.admin.role')}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t('accountPage.admin.password')} *
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('accountPage.admin.passwordPlaceholder')}
              autoComplete="new-password"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t('accountPage.admin.confirmPassword')} *
            </label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('accountPage.admin.confirmPasswordPlaceholder')}
              autoComplete="new-password"
            />
          </div>

          {localError && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {localError}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            {t('accountPage.dialog.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('accountPage.admin.createUser')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Site Scopes Dialog ────────────────────────────────────────────────────────

function SiteScopesDialog({
  user,
  open,
  onClose,
}: {
  user: UserSummary | null
  open: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [sites, setSites] = useState<SiteRow[]>([])
  const [selectedScopes, setSelectedScopes] = useState<Array<{ siteCode: string; scopeLevel: string }>>([])

  useEffect(() => {
    if (open) {
      void getSites()
        .then((res) => setSites(res.rows))
        .catch(() => {})
      if (user) {
        setSelectedScopes([...user.siteScopes])
      }
    }
  }, [open, user])

  const mutation = useMutation({
    mutationFn: (body: Array<{ siteCode: string; scopeLevel: string }>) =>
      user ? setUserSiteScopes(user.userId, body) : Promise.reject('No user'),
    onSuccess: () => {
      toast.success(t('accountPage.admin.setSiteScopesUpdated', { username: user?.username }))
      onClose()
      void queryClient.invalidateQueries({ queryKey: ['accountPage'] })
    },
    onError: (err) => {
      const display = toAppErrorDisplay(err, t('common.operationFailed'))
      toast.error(display.title, { description: display.message })
    },
  })

  const toggleScope = (siteCode: string) => {
    const exists = selectedScopes.find((s) => s.siteCode === siteCode)
    if (exists) {
      setSelectedScopes((prev) => prev.filter((s) => s.siteCode !== siteCode))
    } else {
      setSelectedScopes((prev) => [...prev, { siteCode, scopeLevel: 'VIEWER' }])
    }
  }

  const updateScopeLevel = (siteCode: string, scopeLevel: string) => {
    setSelectedScopes((prev) =>
      prev.map((s) => (s.siteCode === siteCode ? { ...s, scopeLevel } : s)),
    )
  }

  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('accountPage.admin.setSiteScopes')}</DialogTitle>
          <DialogDescription>
            {t('accountPage.admin.setSiteScopesDesc', { username: user.username })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-[300px] overflow-y-auto py-2">
          {sites.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t('accountPage.admin.noSitesAvailable')}
            </p>
          )}
          {sites.map((site) => {
            const current = selectedScopes.find((s) => s.siteCode === site.siteCode)
            const isSelected = !!current
            return (
              <div
                key={site.siteCode}
                className={`flex items-center justify-between rounded-lg border px-3 py-2.5 transition-colors ${
                  isSelected ? 'border-primary/40 bg-primary/5' : 'border-border/50 hover:bg-muted/40'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleScope(site.siteCode)}
                    className="h-4 w-4 rounded border-input accent-primary"
                  />
                  <div>
                    <p className="text-sm font-medium">{site.siteCode}</p>
                    <p className="text-[10px] text-muted-foreground">{site.name ?? site.siteCode}</p>
                  </div>
                </div>

                {isSelected && (
                  <div className="w-[140px] shrink-0">
                    <Select
                      size="sm"
                      value={current!.scopeLevel}
                      onChange={(v) => updateScopeLevel(site.siteCode, v)}
                      options={SCOPE_LEVELS.map((level) => ({ value: level, label: level }))}
                      placeholder="—"
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            {t('accountPage.dialog.cancel')}
          </Button>
          <Button onClick={() => mutation.mutate(selectedScopes)} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('accountPage.dialog.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Customer Row Component ────────────────────────────────────────────────────

function CustomerRow({
  customer,
  onView,
  onEdit,
  onDelete,
}: {
  customer: CustomerSummary
  onView: (c: CustomerSummary) => void
  onEdit: (c: CustomerSummary) => void
  onDelete: (c: CustomerSummary) => void
}) {
  const { t } = useTranslation()
  const actionBtn =
    'h-10 w-10 sm:h-9 sm:w-9 shrink-0 touch-manipulation opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity'

  return (
    <div className="group rounded-xl border border-transparent px-2 py-2 sm:px-3 sm:py-0 transition-colors hover:border-border/50 hover:bg-muted/30">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:py-2.5">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/50 bg-blue-500/10 text-blue-600 text-xs font-semibold uppercase">
            {customer.fullName.slice(0, 2)}
          </div>

          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-sm text-foreground/90 truncate">{customer.fullName}</span>
              <span
                className={`flex items-center gap-1 text-[10px] font-mono shrink-0 ${
                  customer.status === 'ACTIVE' ? 'text-emerald-500' : 'text-amber-500'
                }`}
              >
                {customer.status === 'ACTIVE' ? (
                  <CheckCircle2 className="h-2.5 w-2.5" />
                ) : (
                  <AlertCircle className="h-2.5 w-2.5" />
                )}
                {t(`accountPage.customers.status.${customer.status}`)}
              </span>
            </div>

            <div className="flex items-center gap-3 mt-1.5 flex-wrap text-[10px] text-muted-foreground">
              {customer.phone && (
                <span className="font-mono">{customer.phone}</span>
              )}
              {customer.email && (
                <span className="hidden sm:inline truncate max-w-[12rem]">{customer.email}</span>
              )}
              <span className="flex items-center gap-1">
                <Car className="h-2.5 w-2.5" />
                {t('accountPage.customers.vehicleCount', { count: customer.vehicleCount })}
              </span>
              <span className="flex items-center gap-1">
                <CreditCard className="h-2.5 w-2.5" />
                {t('accountPage.customers.credentialCount', { count: customer.activeCredentialCount })}
              </span>
              <span className="flex items-center gap-1">
                <Package className="h-2.5 w-2.5" />
                {t('accountPage.customers.subscriptionCount', { count: customer.subscriptionCount })}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-0.5 sm:gap-1 pl-[3.25rem] sm:pl-0">
          <Button
            variant="ghost"
            size="icon"
            className={actionBtn}
            title={t('accountPage.customers.viewDetail')}
            onClick={() => onView(customer)}
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={actionBtn}
            title={t('accountPage.customers.editCustomer')}
            onClick={() => onEdit(customer)}
          >
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={`${actionBtn} text-destructive hover:text-destructive`}
            title={t('accountPage.customers.deleteCustomer')}
            onClick={() => onDelete(customer)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Customer Detail Dialog ────────────────────────────────────────────────────

function CustomerDetailDialog({
  customer,
  open,
  onClose,
}: {
  customer: CustomerSummary | null
  open: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { data: detail, isLoading } = useQuery<CustomerDetail>({
    queryKey: ['accountPage', 'customer', customer?.customerId],
    queryFn: () => getCustomerDetail(customer!.customerId),
    enabled: open && !!customer,
  })

  if (!customer) return null

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {t('accountPage.customers.detail.title')}: {customer.fullName}
          </DialogTitle>
          <DialogDescription>{customer.customerId}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3 py-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : detail ? (
          <div className="space-y-6 py-2">
            {/* Summary */}
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                {t('accountPage.customers.detail.summary')}
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('accountPage.customers.detail.fullName')}</p>
                  <p className="font-medium">{detail.fullName}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('accountPage.customers.detail.phone')}</p>
                  <p className="font-mono">{detail.phone ?? '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('accountPage.customers.detail.email')}</p>
                  <p className="truncate">{detail.email ?? '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('accountPage.customers.detail.status')}</p>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      detail.status === 'ACTIVE'
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600'
                        : 'border-amber-500/30 bg-amber-500/10 text-amber-600'
                    }`}
                  >
                    {t(`accountPage.customers.status.${detail.status}`)}
                  </Badge>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('accountPage.customers.detail.createdAt')}</p>
                  <p className="text-xs">{detail.createdAt ? new Date(detail.createdAt).toLocaleString() : '—'}</p>
                </div>
              </div>
            </div>

            {/* Vehicles */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Car className="h-3.5 w-3.5 text-muted-foreground" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('accountPage.customers.detail.vehicles')} ({detail.vehicles.length})
                </h4>
              </div>
              {detail.vehicles.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3 text-center">{t('accountPage.customers.detail.noVehicles')}</p>
              ) : (
                <div className="rounded-lg border border-border/50 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/40">
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">{t('accountPage.customers.detail.vehiclePlate')}</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">{t('accountPage.customers.detail.vehicleType')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.vehicles.map((v) => (
                        <tr key={v.vehicleId} className="border-t border-border/30">
                          <td className="px-3 py-2 font-mono font-medium">{v.licensePlate}</td>
                          <td className="px-3 py-2">
                            <Badge variant="secondary" className="text-[10px]">
                              {t(`accountPage.customers.vehicleType.${v.vehicleType}`)}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Credentials */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('accountPage.customers.detail.credentials')} ({detail.credentials.length})
                </h4>
              </div>
              {detail.credentials.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3 text-center">{t('accountPage.customers.detail.noCredentials')}</p>
              ) : (
                <div className="rounded-lg border border-border/50 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/40">
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">RFID UID</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Site</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">{t('accountPage.customers.detail.credentialStatus')}</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">{t('accountPage.customers.detail.credentialLastEvent')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.credentials.map((c) => (
                        <tr key={c.credentialId} className="border-t border-border/30">
                          <td className="px-3 py-2 font-mono font-medium">{c.rfidUid}</td>
                          <td className="px-3 py-2 font-mono">{c.siteCode}</td>
                          <td className="px-3 py-2">
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                c.status === 'ACTIVE'
                                  ? 'border-emerald-500/30 text-emerald-600'
                                  : c.status === 'BLOCKED'
                                  ? 'border-red-500/30 text-red-600'
                                  : 'border-amber-500/30 text-amber-600'
                              }`}
                            >
                              {t(`accountPage.customers.credentialStatus.${c.status}`)}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {c.lastEventTime ? new Date(c.lastEventTime).toLocaleString() : t('accountPage.customers.detail.never')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Subscriptions */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Package className="h-3.5 w-3.5 text-muted-foreground" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('accountPage.customers.detail.subscriptions')} ({detail.subscriptions.length})
                </h4>
              </div>
              {detail.subscriptions.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3 text-center">{t('accountPage.customers.detail.noSubscriptions')}</p>
              ) : (
                <div className="rounded-lg border border-border/50 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/40">
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">{t('accountPage.customers.detail.subscriptionSite')}</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">{t('accountPage.customers.detail.subscriptionPlan')}</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">{t('accountPage.customers.detail.subscriptionEnd')}</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">{t('accountPage.customers.detail.subscriptionStatus')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.subscriptions.map((s) => (
                        <tr key={s.subscriptionId} className="border-t border-border/30">
                          <td className="px-3 py-2 font-mono">{s.siteCode}</td>
                          <td className="px-3 py-2">
                            <Badge variant="secondary" className="text-[10px]">
                              {t(`accountPage.customers.planType.${s.planType}`)}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {s.endDate ? new Date(s.endDate).toLocaleDateString() : '—'}
                          </td>
                          <td className="px-3 py-2">
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                s.status === 'ACTIVE'
                                  ? 'border-emerald-500/30 text-emerald-600'
                                  : s.status === 'EXPIRED'
                                  ? 'border-muted-foreground/30 text-muted-foreground'
                                  : 'border-amber-500/30 text-amber-600'
                              }`}
                            >
                              {t(`accountPage.customers.subscriptionStatus.${s.status}`)}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            {t('accountPage.dialog.cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Create Customer Dialog ────────────────────────────────────────────────────

function CreateCustomerDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setFullName('')
      setPhone('')
      setEmail('')
      setLocalError(null)
    }
  }, [open])

  const mutation = useMutation({
    mutationFn: (body: CreateCustomerPayload) => createCustomer(body),
    onSuccess: (res) => {
      toast.success(t('accountPage.customers.customerCreated', { name: res.fullName }))
      onClose()
      void queryClient.invalidateQueries({ queryKey: ['accountPage'] })
    },
    onError: (err) => {
      const display = toAppErrorDisplay(err, t('common.operationFailed'))
      toast.error(display.title, { description: display.message })
    },
  })

  const handleSave = () => {
    setLocalError(null)
    if (!fullName || fullName.trim().length < 2) {
      setLocalError(t('accountPage.customers.form.fullNameRequired'))
      return
    }
    mutation.mutate({
      fullName: fullName.trim(),
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {t('accountPage.customers.newCustomer')}
          </DialogTitle>
          <DialogDescription>{t('accountPage.customers.pageDesc')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t('accountPage.customers.form.fullName')} *
            </label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t('accountPage.customers.form.fullNamePlaceholder')}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t('accountPage.customers.form.phone')}
            </label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t('accountPage.customers.form.phonePlaceholder')}
              type="tel"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t('accountPage.customers.form.email')}
            </label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('accountPage.customers.form.emailPlaceholder')}
              type="email"
            />
          </div>

          {localError && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {localError}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            {t('accountPage.dialog.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('accountPage.customers.newCustomer')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Edit Customer Dialog ──────────────────────────────────────────────────────

function EditCustomerDialog({
  customer,
  open,
  onClose,
}: {
  customer: CustomerSummary | null
  open: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'ACTIVE' | 'SUSPENDED'>('ACTIVE')
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (open && customer) {
      setFullName(customer.fullName)
      setPhone(customer.phone ?? '')
      setEmail(customer.email ?? '')
      setStatus(customer.status)
      setLocalError(null)
    }
  }, [open, customer])

  const mutation = useMutation({
    mutationFn: (body: UpdateCustomerPayload) => updateCustomer(customer!.customerId, body),
    onSuccess: (res) => {
      toast.success(t('accountPage.customers.customerUpdated', { name: res.fullName }))
      onClose()
      void queryClient.invalidateQueries({ queryKey: ['accountPage'] })
    },
    onError: (err) => {
      const display = toAppErrorDisplay(err, t('common.operationFailed'))
      toast.error(display.title, { description: display.message })
    },
  })

  const handleSave = () => {
    if (!customer) return
    setLocalError(null)
    if (fullName.trim().length < 2) {
      setLocalError(t('accountPage.customers.form.fullNameRequired'))
      return
    }
    mutation.mutate({
      fullName: fullName.trim() !== customer.fullName ? fullName.trim() : undefined,
      phone: phone.trim() !== (customer.phone ?? '') ? phone.trim() || null : undefined,
      email: email.trim() !== (customer.email ?? '') ? email.trim() || null : undefined,
      status: status !== customer.status ? status : undefined,
    })
  }

  if (!customer) return null

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit2 className="h-4 w-4" />
            {t('accountPage.customers.editCustomer')}
          </DialogTitle>
          <DialogDescription>{customer.customerId}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t('accountPage.customers.form.fullName')} *
            </label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t('accountPage.customers.form.fullNamePlaceholder')}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t('accountPage.customers.form.phone')}
            </label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t('accountPage.customers.form.phonePlaceholder')}
              type="tel"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t('accountPage.customers.form.email')}
            </label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('accountPage.customers.form.emailPlaceholder')}
              type="email"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t('accountPage.customers.form.status')}
            </label>
            <Select
              value={status}
              onChange={(v) => setStatus(v as 'ACTIVE' | 'SUSPENDED')}
              options={[
                { value: 'ACTIVE', label: t('accountPage.customers.status.ACTIVE') },
                { value: 'SUSPENDED', label: t('accountPage.customers.status.SUSPENDED') },
              ]}
            />
          </div>

          {localError && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {localError}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            {t('accountPage.dialog.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('accountPage.dialog.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Delete Customer Dialog ────────────────────────────────────────────────────

function DeleteCustomerDialog({
  customer,
  open,
  onClose,
}: {
  customer: CustomerSummary | null
  open: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => deleteCustomer(customer!.customerId),
    onSuccess: () => {
      toast.success(t('accountPage.customers.customerDeleted'))
      onClose()
      void queryClient.invalidateQueries({ queryKey: ['accountPage'] })
    },
    onError: (err) => {
      const display = toAppErrorDisplay(err, t('common.operationFailed'))
      toast.error(display.title, { description: display.message })
    },
  })

  if (!customer) return null

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-4 w-4" />
            {t('accountPage.customers.confirmDelete')}
          </DialogTitle>
          <DialogDescription>
            {t('accountPage.customers.confirmDeleteDesc', { name: customer.fullName })}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-destructive/30 bg-destructive/10 text-destructive text-xs font-semibold uppercase">
              {customer.fullName.slice(0, 2)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{customer.fullName}</p>
              <p className="text-[10px] text-muted-foreground font-mono">{customer.customerId}</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            {t('accountPage.dialog.cancel')}
          </Button>
          <Button variant="destructive" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('accountPage.customers.deleteCustomer')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Customers Tab ─────────────────────────────────────────────────────────────

function CustomersTab() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState<string>('')
  const [listCursor, setListCursor] = useState<string | undefined>(undefined)
  const [cursorStack, setCursorStack] = useState<string[]>([])
  const PAGE_SIZE = 20

  const statusFilterOptions = useMemo(
    () =>
      [
        { value: '', label: t('accountPage.customers.allStatuses') },
        { value: 'ACTIVE', label: t('accountPage.customers.statusActive') },
        { value: 'SUSPENDED', label: t('accountPage.customers.statusSuspended') },
      ] as const,
    [t],
  )

  const vehicleTypeFilterOptions = useMemo(
    () =>
      [
        { value: '', label: t('accountPage.customers.allVehicleTypes') },
        { value: 'CAR', label: t('accountPage.customers.vehicleTypeCar') },
        { value: 'MOTORBIKE', label: t('accountPage.customers.vehicleTypeMotorbike') },
      ] as const,
    [t],
  )

  const resetListPagination = () => {
    setListCursor(undefined)
    setCursorStack([])
  }

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['accountPage', 'customers', { search, statusFilter, vehicleTypeFilter, listCursor }],
    queryFn: () =>
      listCustomers({
        search: search || undefined,
        status: (statusFilter as 'ACTIVE' | 'SUSPENDED') || undefined,
        vehicleType: (vehicleTypeFilter as 'CAR' | 'MOTORBIKE') || undefined,
        cursor: listCursor,
        limit: PAGE_SIZE,
      }),
  })

  const customers = data?.rows ?? []
  const hasMore = data?.hasMore ?? false

  // ── Detail Dialog ──
  const [detailCustomer, setDetailCustomer] = useState<CustomerSummary | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // ── Edit Dialog ──
  const [editCustomer, setEditCustomer] = useState<CustomerSummary | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  // ── Create Dialog ──
  const [createOpen, setCreateOpen] = useState(false)

  // ── Delete Dialog ──
  const [deleteCustomer, setDeleteCustomerState] = useState<CustomerSummary | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const handleView = (c: CustomerSummary) => {
    setDetailCustomer(c)
    setDetailOpen(true)
  }

  const handleEdit = (c: CustomerSummary) => {
    setEditCustomer(c)
    setEditOpen(true)
  }

  const handleDelete = (c: CustomerSummary) => {
    setDeleteCustomerState(c)
    setDeleteOpen(true)
  }

  const goToPreviousPage = () => {
    if (cursorStack.length === 0) return
    const prevToken = cursorStack[cursorStack.length - 1]
    setCursorStack((s) => s.slice(0, -1))
    setListCursor(prevToken === '' ? undefined : prevToken)
  }

  const goToNextPage = () => {
    const nc = data?.nextCursor
    if (!nc) return
    setCursorStack((s) => [...s, listCursor ?? ''])
    setListCursor(nc)
  }

  return (
    <div className="space-y-4 sm:space-y-5 w-full min-w-0">
      <Card className="border-border/70 bg-gradient-to-b from-card via-card to-muted/20 shadow-md shadow-black/5">
        <CardContent className="space-y-3 p-3 sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:gap-3">
            <div className="min-w-0 flex-1">
              <Input
                placeholder={t('accountPage.customers.searchPlaceholder')}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  resetListPagination()
                }}
                className="h-10 w-full"
              />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:flex-1 lg:min-w-0 lg:gap-2">
              <div className="min-w-0 sm:min-w-[10rem] lg:flex-1">
                <Select
                  size="sm"
                  value={statusFilter}
                  onChange={(v) => {
                    setStatusFilter(v)
                    resetListPagination()
                  }}
                  options={[...statusFilterOptions]}
                  placeholder={t('accountPage.customers.allStatuses')}
                />
              </div>
              <div className="min-w-0 sm:min-w-[10rem] lg:flex-1">
                <Select
                  size="sm"
                  value={vehicleTypeFilter}
                  onChange={(v) => {
                    setVehicleTypeFilter(v)
                    resetListPagination()
                  }}
                  options={[...vehicleTypeFilterOptions]}
                  placeholder={t('accountPage.customers.allVehicleTypes')}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <Button
              variant="outline"
              size="default"
              className="h-10 w-full touch-manipulation sm:w-auto sm:min-w-[7rem]"
              onClick={() => void refetch()}
              disabled={isFetching}
            >
              <RefreshCcw className={`mr-2 h-4 w-4 shrink-0 ${isFetching ? 'animate-spin' : ''}`} />
              {t('accountPage.customers.refresh')}
            </Button>
            <Button
              size="lg"
              className="h-11 w-full gap-2 font-semibold shadow-lg shadow-primary/25 transition-shadow hover:shadow-xl hover:shadow-primary/30 sm:w-auto sm:px-6 touch-manipulation"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-5 w-5 shrink-0" />
              {t('accountPage.customers.newCustomer')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {isLoading
            ? t('accountPage.customers.loading')
            : t('accountPage.customers.results', { count: customers.length })}
        </p>
        {(search || statusFilter || vehicleTypeFilter) && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground h-7"
            onClick={() => {
              setSearch('')
              setStatusFilter('')
              setVehicleTypeFilter('')
              resetListPagination()
            }}
          >
            {t('accountPage.customers.clearFilters')}
          </Button>
        )}
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/40 p-1 sm:p-2 space-y-0.5">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ))
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border/50 bg-muted mb-4">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground/80">{t('accountPage.customers.noCustomers')}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('accountPage.customers.noCustomersDesc')}</p>
          </div>
        ) : (
          customers.map((customer: CustomerSummary) => (
            <CustomerRow
              key={customer.customerId}
              customer={customer}
              onView={handleView}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      {customers.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-border/50 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="outline"
            size="default"
            className="h-11 min-h-11 w-full touch-manipulation gap-2 sm:w-auto sm:min-w-[8.5rem]"
            onClick={goToPreviousPage}
            disabled={cursorStack.length === 0 || isLoading}
            aria-label={t('accountPage.customers.previous')}
          >
            <ChevronLeft className="h-4 w-4 shrink-0" />
            {t('accountPage.customers.previous')}
          </Button>
          <p className="order-first text-center text-sm text-muted-foreground sm:order-none sm:flex-1 sm:px-2">
            <span className="font-medium text-foreground/90">{t('accountPage.customers.page', { page: cursorStack.length + 1 })}</span>
            <span className="mx-1.5 text-border/80">·</span>
            <span>{t('accountPage.customers.results', { count: customers.length })}</span>
          </p>
          <Button
            type="button"
            variant="outline"
            size="default"
            className="h-11 min-h-11 w-full touch-manipulation gap-2 sm:w-auto sm:min-w-[8.5rem]"
            onClick={goToNextPage}
            disabled={!hasMore || isLoading}
            aria-label={t('accountPage.customers.next')}
          >
            {t('accountPage.customers.next')}
            <ChevronRight className="h-4 w-4 shrink-0" />
          </Button>
        </div>
      )}

      {/* Dialogs */}
      <CustomerDetailDialog
        customer={detailCustomer}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />
      <CreateCustomerDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
      <EditCustomerDialog
        customer={editCustomer}
        open={editOpen}
        onClose={() => setEditOpen(false)}
      />
      <DeleteCustomerDialog
        customer={deleteCustomer}
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
      />
    </div>
  )
}

// ─── Admin Tab ─────────────────────────────────────────────────────────────────

function AdminTab() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [roleFilter, setRoleFilter] = useState<string>('')
  const [listCursor, setListCursor] = useState<string | undefined>(undefined)
  const [cursorStack, setCursorStack] = useState<string[]>([])
  const PAGE_SIZE = 20

  const statusFilterOptions = useMemo(
    () =>
      [
        { value: '', label: t('accountPage.admin.allStatuses') },
        { value: 'ACTIVE', label: t('accountPage.admin.statusActive') },
        { value: 'DISABLED', label: t('accountPage.admin.statusDisabled') },
      ] as const,
    [t],
  )

  const roleFilterOptions = useMemo(() => {
    const opts = Object.entries(ROLE_LABELS).map(([key, meta]) => ({
      value: key,
      label: meta.label,
    }))
    return [{ value: '', label: t('accountPage.admin.allRoles') }, ...opts]
  }, [t])

  const resetListPagination = () => {
    setListCursor(undefined)
    setCursorStack([])
  }

  const { data, isLoading, isFetching, refetch }: { data?: ListUsersResponse; isLoading: boolean; isFetching: boolean; refetch: () => void } = useQuery<ListUsersResponse>({
    queryKey: ['accountPage', 'list', { search, statusFilter, roleFilter, listCursor }],
    queryFn: () =>
      listUsers({
        search: search || undefined,
        status: (statusFilter as 'ACTIVE' | 'DISABLED') || undefined,
        role: roleFilter || undefined,
        cursor: listCursor,
        limit: PAGE_SIZE,
      }),
  })

  const users = data?.rows ?? []
  const hasMore = data?.hasMore ?? false

  // ── Edit Dialog ──
  const [editUser, setEditUser] = useState<UserSummary | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  // ── Create Dialog ──
  const [createOpen, setCreateOpen] = useState(false)

  // ── Site Scopes Dialog ──
  const [scopesUser, setScopesUser] = useState<UserSummary | null>(null)
  const [scopesOpen, setScopesOpen] = useState(false)

  // ── Toggle Status ──
  const toggleMutation = useMutation({
    mutationFn: (user: UserSummary) =>
      user.status === 'ACTIVE'
        ? disableUser(user.userId, 'ADMIN_DISABLE')
        : enableUser(user.userId, 'ADMIN_ENABLE'),
    onSuccess: (res, user) => {
      toast.success(
        user.status === 'ACTIVE'
          ? t('accountPage.admin.userDisabled', { username: user.username })
          : t('accountPage.admin.userEnabled', { username: user.username }),
      )
      void queryClient.invalidateQueries({ queryKey: ['accountPage'] })
    },
    onError: (err) => {
      const display = toAppErrorDisplay(err, t('common.operationFailed'))
      toast.error(display.title, { description: display.message })
    },
  })

  // ── Revoke Sessions ──
  const revokeMutation = useMutation({
    mutationFn: (user: UserSummary) => revokeUserSessions(user.userId, 'ADMIN_REVOKE'),
    onSuccess: (res) => {
      toast.success(t('accountPage.admin.sessionsRevoked', { count: res.revokedSessionCount }))
      void queryClient.invalidateQueries({ queryKey: ['accountPage'] })
    },
    onError: (err) => {
      const display = toAppErrorDisplay(err, t('common.operationFailed'))
      toast.error(display.title, { description: display.message })
    },
  })

  const handleEdit = (user: UserSummary) => {
    setEditUser(user)
    setEditOpen(true)
  }

  const handleSetScopes = (user: UserSummary) => {
    setScopesUser(user)
    setScopesOpen(true)
  }

  const handleToggleStatus = (user: UserSummary) => {
    toggleMutation.mutate(user)
  }

  const handleRevokeSessions = (user: UserSummary) => {
    revokeMutation.mutate(user)
  }

  const goToPreviousPage = () => {
    if (cursorStack.length === 0) return
    const prevToken = cursorStack[cursorStack.length - 1]
    setCursorStack((s) => s.slice(0, -1))
    setListCursor(prevToken === '' ? undefined : prevToken)
  }

  const goToNextPage = () => {
    const nc = data?.nextCursor
    if (!nc) return
    setCursorStack((s) => [...s, listCursor ?? ''])
    setListCursor(nc)
  }

  return (
    <div className="space-y-4 sm:space-y-5 w-full min-w-0">
      <Card className="border-border/70 bg-gradient-to-b from-card via-card to-muted/20 shadow-md shadow-black/5">
        <CardContent className="space-y-3 p-3 sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:gap-3">
            <div className="min-w-0 flex-1">
              <Input
                placeholder={t('accountPage.admin.searchPlaceholder')}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  resetListPagination()
                }}
                className="h-10 w-full"
              />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:flex-1 lg:min-w-0 lg:gap-2">
              <div className="min-w-0 sm:min-w-[10rem] lg:flex-1">
                <Select
                  size="sm"
                  value={statusFilter}
                  onChange={(v) => {
                    setStatusFilter(v)
                    resetListPagination()
                  }}
                  options={[...statusFilterOptions]}
                  placeholder={t('accountPage.admin.allStatuses')}
                />
              </div>
              <div className="min-w-0 sm:min-w-[10rem] lg:flex-1">
                <Select
                  size="sm"
                  value={roleFilter}
                  onChange={(v) => {
                    setRoleFilter(v)
                    resetListPagination()
                  }}
                  options={roleFilterOptions}
                  placeholder={t('accountPage.admin.allRoles')}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <Button
              variant="outline"
              size="default"
              className="h-10 w-full touch-manipulation sm:w-auto sm:min-w-[7rem]"
              onClick={() => void refetch()}
              disabled={isFetching}
            >
              <RefreshCcw className={`mr-2 h-4 w-4 shrink-0 ${isFetching ? 'animate-spin' : ''}`} />
              {t('accountPage.admin.refresh')}
            </Button>
            <Button
              size="lg"
              className="h-11 w-full gap-2 font-semibold shadow-lg shadow-primary/25 transition-shadow hover:shadow-xl hover:shadow-primary/30 sm:w-auto sm:px-6 touch-manipulation"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-5 w-5 shrink-0" />
              {t('accountPage.admin.newUser')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {isLoading
            ? t('accountPage.admin.loading')
            : t('accountPage.admin.results', { count: users.length })}
        </p>
        {(search || statusFilter || roleFilter) && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground h-7"
            onClick={() => {
              setSearch('')
              setStatusFilter('')
              setRoleFilter('')
              resetListPagination()
            }}
          >
            {t('accountPage.admin.clearFilters')}
          </Button>
        )}
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/40 p-1 sm:p-2 space-y-0.5">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ))
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border/50 bg-muted mb-4">
              <UserCog className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground/80">{t('accountPage.admin.noUsers')}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('accountPage.admin.noUsersDesc')}</p>
          </div>
        ) : (
          users.map((user: UserSummary) => (
            <UserRow
              key={user.userId}
              user={user}
              onEdit={handleEdit}
              onToggleStatus={handleToggleStatus}
              onRevokeSessions={handleRevokeSessions}
              onSetScopes={handleSetScopes}
            />
          ))
        )}
      </div>

      {users.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-border/50 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="outline"
            size="default"
            className="h-11 min-h-11 w-full touch-manipulation gap-2 sm:w-auto sm:min-w-[8.5rem]"
            onClick={goToPreviousPage}
            disabled={cursorStack.length === 0 || isLoading}
            aria-label={t('accountPage.admin.previous')}
          >
            <ChevronLeft className="h-4 w-4 shrink-0" />
            {t('accountPage.admin.previous')}
          </Button>
          <p className="order-first text-center text-sm text-muted-foreground sm:order-none sm:flex-1 sm:px-2">
            <span className="font-medium text-foreground/90">{t('accountPage.admin.page', { page: cursorStack.length + 1 })}</span>
            <span className="mx-1.5 text-border/80">·</span>
            <span>{t('accountPage.admin.results', { count: users.length })}</span>
          </p>
          <Button
            type="button"
            variant="outline"
            size="default"
            className="h-11 min-h-11 w-full touch-manipulation gap-2 sm:w-auto sm:min-w-[8.5rem]"
            onClick={goToNextPage}
            disabled={!hasMore || isLoading}
            aria-label={t('accountPage.admin.next')}
          >
            {t('accountPage.admin.next')}
            <ChevronRight className="h-4 w-4 shrink-0" />
          </Button>
        </div>
      )}

      {/* Dialogs */}
      <EditUserDialog
        user={editUser}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSuccess={() => setEditUser(null)}
      />

      <CreateUserDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />

      <SiteScopesDialog
        user={scopesUser}
        open={scopesOpen}
        onClose={() => setScopesOpen(false)}
      />
    </div>
  )
}

// ─── Main Accounts Page ────────────────────────────────────────────────────────

export function AccountsPage() {
  const { t } = useTranslation()
  const auth = useAuth()
  const role = auth.principal?.role as AuthRole | undefined

  const canManage = canAccessRoute(role, '/accountPage')

  return (
    <div className="mx-auto min-h-0 w-full max-w-6xl animate-fade-in px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 shadow-sm">
            <UserCog className="h-5 w-5 text-primary" />
          </div>
          <div className="max-w-2xl">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t('accountPage.pageTitle')}</h1>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm leading-relaxed">{t('accountPage.pageDesc')}</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="profile" className="w-full min-w-0">
        <TabsList className="mb-6 mx-auto flex w-full max-w-2xl flex-wrap justify-center gap-1 sm:max-w-none sm:flex-nowrap">
          <TabsTrigger value="profile" className="flex-1 min-w-[8rem] sm:flex-none sm:px-6">
            {t('accountPage.tabs.myProfile')}
          </TabsTrigger>
          {canManage && (
            <TabsTrigger value="admin" className="flex-1 min-w-[8rem] sm:flex-none sm:px-6">
              {t('accountPage.tabs.admin')}
            </TabsTrigger>
          )}
          {canManage && (
            <TabsTrigger value="customers" className="flex-1 min-w-[8rem] sm:flex-none sm:px-6">
              {t('accountPage.tabs.customers')}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="profile" className="mt-2 flex justify-center px-0 sm:px-2">
          <ProfileTab />
        </TabsContent>

        {canManage && (
          <TabsContent value="admin" className="mt-2 w-full min-w-0 px-0 sm:px-1">
            <AdminTab />
          </TabsContent>
        )}

        {canManage && (
          <TabsContent value="customers" className="mt-2 w-full min-w-0 px-0 sm:px-1">
            <CustomersTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
