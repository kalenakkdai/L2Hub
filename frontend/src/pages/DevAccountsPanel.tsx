import { Info } from 'lucide-react'

/**
 * Development-only sign-in hints.
 *
 * Gated on import.meta.env.DEV, which Vite replaces with `false` in a
 * production build and then tree-shakes — so these addresses cannot reach a
 * deployed bundle. Never put a real person's credentials here.
 *
 * The accounts themselves come from the seed migration; if they drift, fix
 * the migration rather than hardcoding new ones.
 */
export function DevAccountsPanel() {
  if (!import.meta.env.DEV) return null

  return (
    <>
      <div className="my-6 flex items-center gap-3.5">
        <span className="h-px flex-1 bg-border-subtle" />
        <span className="font-mono text-[10.5px] tracking-[0.14em] text-ink-faint uppercase">
          Development
        </span>
        <span className="h-px flex-1 bg-border-subtle" />
      </div>

      <div className="rounded-card border border-border-subtle bg-surface px-4 py-3.5">
        <p className="mb-1.5 flex items-center gap-2 text-[13px] font-medium text-ink">
          <Info aria-hidden="true" className="h-3.5 w-3.5 text-ink-subtle" />
          Development accounts
        </p>
        <p className="font-mono text-xs leading-relaxed text-ink-subtle">
          Seeded by <span className="text-ink-muted">20260807040000_seed_development_users.sql</span>.
          See <span className="text-ink-muted">docs/authentication.md</span> for the
          addresses and password.
        </p>
      </div>
    </>
  )
}
