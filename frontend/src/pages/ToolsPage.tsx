import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Mic } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { AppShell } from '../components/layout/AppShell'
import { FullPageMessage } from '../components/FullPageMessage'
import { ErrorState } from '../components/ui/ErrorState'
import { fetchCurrentUser, hasPermission } from '../api/auth'

type Tool = {
  name: string
  to: string
  blurb: string
  icon: LucideIcon
  /** Hidden entirely when the camper does not hold this key. */
  permission?: string
}

const TOOLS: Tool[] = [
  {
    name: 'Note Taker',
    to: '/note-taker',
    blurb:
      'Record a meeting, keep the original audio, and get a raw transcript plus an auto-written meeting note. Docs file themselves onto the event timeline in Event planning.',
    icon: Mic,
    permission: 'note_taker.view',
  },
]

export function ToolsPage() {
  const meQuery = useQuery({ queryKey: ['auth', 'me'], queryFn: fetchCurrentUser })

  if (meQuery.isPending) return <FullPageMessage>Loading…</FullPageMessage>
  if (meQuery.isError || !meQuery.data) {
    return (
      <FullPageMessage>
        <ErrorState title="Could not load profile" description="Sign in again." />
      </FullPageMessage>
    )
  }

  const me = meQuery.data
  const tools = TOOLS.filter(
    (tool) => !tool.permission || hasPermission(me, tool.permission),
  )

  return (
    <AppShell
      name={me.full_name ?? me.email}
      role={me.role}
      permissions={me.permissions}
    >
      <header className="mb-5 border-b border-border-subtle pb-4">
        <h1 className="text-display font-semibold text-ink">Tools</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Utilities that support the rest of the hub.
        </p>
      </header>

      {tools.length === 0 ? (
        <p className="rounded-card border border-border-subtle bg-surface px-4 py-8 text-center text-sm text-ink-muted shadow-xs">
          No tools are available to your role yet.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {tools.map((tool) => {
            const Icon = tool.icon
            return (
              <li key={tool.to}>
                <Link
                  to={tool.to}
                  className="flex h-full gap-3 rounded-card border border-border-subtle bg-surface p-4 shadow-xs hover:bg-surface-sunken"
                >
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-accent-50 text-accent-700">
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-ink">
                      {tool.name}
                    </span>
                    <span className="mt-1 block text-xs text-ink-muted">
                      {tool.blurb}
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </AppShell>
  )
}
