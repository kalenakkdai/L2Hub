import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { fetchCurrentUser, hasPermission, roleLabel } from '../../../api/auth'
import {
  fetchUser,
  fetchUsers,
  syncRosterMemberships,
  type UserListItem,
} from '../../../api/users'
import { AppShell } from '../../../components/layout/AppShell'
import { Button } from '../../../components/ui/Button'
import { ErrorState } from '../../../components/ui/ErrorState'
import { FullPageMessage } from '../../../components/FullPageMessage'

function formatLastActive(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date)
}

function statusLabel(status: string): string {
  if (status === 'awaiting_signup') return 'Awaiting signup'
  return status.replaceAll('_', ' ')
}

function committeeLabel(committee: {
  name: string
  is_head: boolean
  membership_type?: string
}): string {
  if (committee.is_head || committee.membership_type === 'head') {
    return `${committee.name} · Head`
  }
  if (committee.membership_type === 'baby') {
    return `${committee.name} · Baby`
  }
  return committee.name
}

function isAccountLinked(user: UserListItem): boolean {
  return user.account_linked !== false
}

function RoleBadges({ user }: { user: UserListItem }) {
  if (user.roles.length === 0) {
    return (
      <span className="rounded-control bg-status-neutral-bg px-2 py-0.5 text-[11px] font-medium text-ink-muted">
        {roleLabel(user.primary_role)}
      </span>
    )
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {user.roles.map((role) => (
        <span
          key={`${role.slug}-${role.committee_id ?? 'global'}-${role.event_id ?? ''}`}
          className="inline-flex flex-col rounded-control border border-border-subtle bg-surface-sunken px-2 py-1"
        >
          <span className="text-[11px] font-semibold text-ink">
            {roleLabel(role.slug)}
          </span>
          {role.scope === 'committee' ? (
            <span className="text-[10px] text-ink-subtle">
              {role.committee_name ?? 'Committee'}
            </span>
          ) : role.scope === 'global' ? (
            <span className="text-[10px] text-ink-subtle">Global</span>
          ) : null}
        </span>
      ))}
    </div>
  )
}

function UserDetailPanel({
  userId,
  onClose,
}: {
  userId: string
  onClose: () => void
}) {
  const detailQuery = useQuery({
    queryKey: ['admin-users', userId],
    queryFn: () => fetchUser(userId),
  })

  return (
    <aside
      className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-border-subtle bg-surface shadow-overlay"
      aria-label="User details"
    >
      <div className="flex items-start justify-between border-b border-border-subtle px-5 py-4">
        <div>
          <h2 className="text-title font-semibold text-ink">
            {detailQuery.data?.full_name ?? 'Camper'}
          </h2>
          <p className="text-sm text-ink-muted">{detailQuery.data?.email}</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {detailQuery.isPending ? (
          <p className="text-sm text-ink-muted">Loading camper…</p>
        ) : null}
        {detailQuery.isError ? (
          <p className="text-sm text-status-danger">Could not load camper details.</p>
        ) : null}
        {detailQuery.data ? (
          <div className="space-y-6">
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                Profile
              </h3>
              <dl className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-subtle">Status</dt>
                  <dd className="font-medium capitalize text-ink">
                    {statusLabel(detailQuery.data.status)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-subtle">Created</dt>
                  <dd className="text-ink">
                    {formatLastActive(detailQuery.data.created_at)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-subtle">Last active</dt>
                  <dd className="text-ink">
                    {formatLastActive(detailQuery.data.last_active_at)}
                  </dd>
                </div>
              </dl>
            </section>

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                Global roles
              </h3>
              <ul className="mt-2 space-y-1 text-sm text-ink">
                {detailQuery.data.global_roles.length === 0 ? (
                  <li className="text-ink-subtle">None</li>
                ) : (
                  detailQuery.data.global_roles.map((role) => (
                    <li key={role.slug}>{roleLabel(role.slug)}</li>
                  ))
                )}
              </ul>
            </section>

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                Scoped roles
              </h3>
              <ul className="mt-2 space-y-1 text-sm text-ink">
                {detailQuery.data.scoped_roles.length === 0 ? (
                  <li className="text-ink-subtle">None</li>
                ) : (
                  detailQuery.data.scoped_roles.map((role) => (
                    <li key={`${role.slug}-${role.committee_id}`}>
                      {roleLabel(role.slug)}
                      {role.committee_name ? ` · ${role.committee_name}` : ''}
                    </li>
                  ))
                )}
              </ul>
            </section>

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                Committees
              </h3>
              <ul className="mt-2 space-y-1 text-sm text-ink">
                {detailQuery.data.committees.length === 0 ? (
                  <li className="text-ink-subtle">None</li>
                ) : (
                  detailQuery.data.committees.map((committee) => (
                    <li key={committee.id}>
                      {committee.name}
                      {committee.is_head ? ' · Head' : ''}
                    </li>
                  ))
                )}
              </ul>
            </section>

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                Effective permissions
              </h3>
              <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto text-xs text-ink-muted">
                {detailQuery.data.effective_permissions.map((permission) => (
                  <li key={permission} className="font-mono">
                    {permission}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : null}
      </div>
    </aside>
  )
}

export function UsersPage() {
  const [query, setQuery] = useState('')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const meQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchCurrentUser,
  })

  const usersQuery = useQuery({
    queryKey: ['admin-users', query],
    queryFn: () => fetchUsers({ q: query.trim() || undefined }),
    enabled: hasPermission(meQuery.data, 'users.view'),
  })

  const syncMutation = useMutation({
    mutationFn: syncRosterMemberships,
    onSuccess: (result) => {
      setSyncMessage(
        `Synced roster: ${result.memberships_created} memberships created.`,
      )
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
    onError: () => {
      setSyncMessage('Could not sync roster memberships.')
    },
  })

  const name = meQuery.data?.full_name?.trim() || meQuery.data?.email || 'User'
  const filtered = useMemo(() => usersQuery.data?.users ?? [], [usersQuery.data])
  const canManage = hasPermission(meQuery.data, 'users.manage')

  if (meQuery.isPending) {
    return <FullPageMessage>Loading…</FullPageMessage>
  }

  if (meQuery.isError || !meQuery.data) {
    return (
      <FullPageMessage>
        <ErrorState
          title="Could not load your profile"
          description="Sign in again, then reopen Campers."
        />
      </FullPageMessage>
    )
  }

  if (!hasPermission(meQuery.data, 'users.view')) {
    return (
      <AppShell name={name} role={meQuery.data.role} permissions={meQuery.data.permissions}>
        <ErrorState
          variant="unauthorized"
          title="Campers is restricted"
          description="Only accounts with users.view can open this roster."
        />
      </AppShell>
    )
  }

  function openCamper(user: UserListItem) {
    if (!isAccountLinked(user)) return
    setSelectedUserId(user.id)
  }

  return (
    <AppShell name={name} role={meQuery.data.role} permissions={meQuery.data.permissions}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-display font-semibold text-ink">Campers</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Leadership 2 class roster — spreadsheet campers plus signed-up accounts.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={syncMutation.isPending}
              onClick={() => {
                setSyncMessage(null)
                syncMutation.mutate()
              }}
            >
              {syncMutation.isPending ? 'Syncing…' : 'Sync roster'}
            </Button>
          ) : null}
        </div>
      </div>

      {syncMessage ? (
        <p className="mb-3 text-sm text-ink-muted" role="status">
          {syncMessage}
        </p>
      ) : null}

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="sr-only" htmlFor="users-search">
          Search campers
        </label>
        <input
          id="users-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name or email"
          className="w-full max-w-sm rounded-control border border-border-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-subtle"
        />
        <Link to="/dashboard" className="text-sm text-ink-muted hover:text-ink">
          ← Dashboard
        </Link>
      </div>

      {usersQuery.isPending ? (
        <p className="text-sm text-ink-muted" role="status">
          Loading campers…
        </p>
      ) : null}

      {usersQuery.isError ? (
        <ErrorState
          title="Could not load campers"
          description="Check that the backend is running and your account still has users.view."
        />
      ) : null}

      {usersQuery.isSuccess ? (
        <div className="overflow-hidden rounded-card border border-border-subtle bg-surface shadow-xs">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <caption className="sr-only">Leadership 2 campers roster</caption>
            <thead className="border-b border-border-strong bg-surface-sunken">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold text-ink-muted">Camper</th>
                <th className="px-3 py-3 text-xs font-semibold text-ink-muted">Role(s)</th>
                <th className="px-3 py-3 text-xs font-semibold text-ink-muted">
                  Committee(s)
                </th>
                <th className="px-3 py-3 text-xs font-semibold text-ink-muted">Status</th>
                <th className="px-3 py-3 text-xs font-semibold text-ink-muted">
                  Last Active
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-ink-muted">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => {
                const linked = isAccountLinked(user)
                return (
                  <tr
                    key={user.id}
                    className="border-b border-border-subtle last:border-b-0 hover:bg-surface-sunken"
                  >
                    <td className="px-4 py-3 align-top">
                      {linked ? (
                        <button
                          type="button"
                          className="text-left"
                          onClick={() => openCamper(user)}
                        >
                          <span className="block text-sm font-semibold text-ink">
                            {user.full_name ?? 'Unnamed camper'}
                          </span>
                          <span className="block text-xs text-ink-subtle">
                            {user.email || 'No account yet'}
                          </span>
                        </button>
                      ) : (
                        <div>
                          <span className="block text-sm font-semibold text-ink">
                            {user.full_name ?? 'Unnamed camper'}
                          </span>
                          <span className="block text-xs text-ink-subtle">
                            No account yet
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <RoleBadges user={user} />
                    </td>
                    <td className="px-3 py-3 align-top text-xs text-ink-muted">
                      {user.committees.length === 0
                        ? user.primary_role === 'ac' || user.primary_role === 'asbo'
                          ? 'Global'
                          : '—'
                        : user.committees.map((c) => committeeLabel(c)).join(', ')}
                    </td>
                    <td className="px-3 py-3 align-top text-xs font-medium capitalize text-ink">
                      {statusLabel(user.status)}
                    </td>
                    <td className="px-3 py-3 align-top text-xs text-ink-muted">
                      {formatLastActive(user.last_active_at)}
                    </td>
                    <td className="px-4 py-3 text-right align-top">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!linked}
                        aria-label={
                          linked
                            ? `Open details for ${user.full_name ?? user.email}`
                            : `${user.full_name ?? 'Camper'} has not signed up`
                        }
                        onClick={() => openCamper(user)}
                      >
                        •••
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 ? (
            <p className="px-4 py-6 text-sm text-ink-muted">No campers match this search.</p>
          ) : null}
        </div>
      ) : null}

      {selectedUserId ? (
        <UserDetailPanel
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
        />
      ) : null}
    </AppShell>
  )
}
