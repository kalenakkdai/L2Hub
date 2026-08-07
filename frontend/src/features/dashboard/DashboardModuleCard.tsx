import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { moduleIcon } from './moduleIcons'
import type { DashboardModule } from './types'

/**
 * A launcher tile. Deliberately quiet: the featured card and the greeting own
 * the visual weight on this page, and a grid of loud cards would flatten the
 * hierarchy.
 */
export function DashboardModuleCard({ module }: { module: DashboardModule }) {
  const Icon = moduleIcon(module.icon)

  return (
    <li>
      <Link
        to={module.to}
        className="group flex h-full flex-col rounded-card border border-border-subtle bg-surface p-5 shadow-card transition duration-150 ease-out-quick hover:border-border-strong hover:shadow-card-hover"
      >
        <div className="flex items-start justify-between gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-control bg-accent-50">
            <Icon aria-hidden="true" className="h-4.5 w-4.5 text-accent-700" />
          </span>

          {module.badge && (
            <StatusBadge tone={module.badge.tone}>{module.badge.label}</StatusBadge>
          )}
        </div>

        <h3 className="mt-4 flex items-center gap-2 font-medium text-ink">
          {module.title}
          {module.count !== undefined && (
            <span className="text-sm text-ink-subtle tabular-nums">{module.count}</span>
          )}
        </h3>

        <p className="mt-1 text-sm text-ink-muted">{module.description}</p>

        <span className="mt-4 inline-flex items-center gap-1 text-label font-medium text-accent-700">
          Open
          {/* 2px of movement is the whole animation. */}
          <ArrowRight
            aria-hidden="true"
            className="h-3.5 w-3.5 transition-transform duration-150 ease-out-quick group-hover:translate-x-0.5"
          />
        </span>
      </Link>
    </li>
  )
}
