import { SectionHeading } from '../../components/ui/SectionHeading'
import { DashboardModuleCard } from './DashboardModuleCard'
import { GROUP_LABELS } from './moduleGroups'
import type { DashboardModule, ModuleGroupKey } from './types'

type ModuleGroupProps = {
  group: ModuleGroupKey
  modules: DashboardModule[]
}

/** One labelled band of module cards. Renders nothing when the group is empty. */
export function ModuleGroup({ group, modules }: ModuleGroupProps) {
  if (modules.length === 0) return null

  const headingId = `module-group-${group}`

  return (
    <section aria-labelledby={headingId}>
      <SectionHeading id={headingId}>{GROUP_LABELS[group]}</SectionHeading>

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {modules.map((module) => (
          <DashboardModuleCard key={module.id} module={module} />
        ))}
      </ul>
    </section>
  )
}
