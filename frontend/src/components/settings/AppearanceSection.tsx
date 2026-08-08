import { SettingsCard, Toggle } from './primitives'
import { cn } from '../ui/cn'
import type { Theme } from '../../lib/appearance'
import type { ProfilePatch, SaveStatus, SettingsProfile } from '../../hooks/useProfile'

type AppearanceSectionProps = {
  profile: SettingsProfile
  status: SaveStatus
  save: (patch: ProfilePatch) => void
  saveNow: () => void
}

const THEMES: { value: Theme; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

/**
 * Theme, reduce motion, compact density.
 *
 * Each of these writes an attribute onto the document root, which is what the
 * CSS actually reacts to — the settings are not stored flags that something
 * else has to remember to honour.
 */
export function AppearanceSection({
  profile,
  status,
  save,
  saveNow,
}: AppearanceSectionProps) {
  const set = (patch: ProfilePatch) => {
    save(patch)
    saveNow()
  }

  return (
    <SettingsCard
      id="appearance"
      title="Appearance"
      description="How the Campsite looks and moves for you."
      status={status}
    >
      <fieldset>
        <legend className="text-[13px] font-medium text-ink">Theme</legend>
        <div className="mt-2 flex gap-2">
          {THEMES.map((theme) => (
            <label
              key={theme.value}
              className={cn(
                'cursor-pointer rounded-control border px-3 py-1.5 text-sm transition duration-200',
                profile.theme === theme.value
                  ? 'border-accent-600 bg-accent-50 font-medium text-accent-ink'
                  : 'border-border-subtle text-ink-subtle hover:bg-surface-muted hover:text-ink',
              )}
            >
              <input
                type="radio"
                name="theme"
                value={theme.value}
                checked={profile.theme === theme.value}
                onChange={() => set({ theme: theme.value })}
                className="sr-only"
              />
              {theme.label}
            </label>
          ))}
        </div>
        <p className="mt-2 text-[12.5px] text-ink-subtle">
          A dark palette has not been built yet, so dark currently looks the same as light.
        </p>
      </fieldset>

      <div className="mt-5 flex items-start justify-between gap-4 border-t border-border-divider pt-5">
        <div>
          <p className="text-[13px] font-medium text-ink">Reduce motion</p>
          <p className="mt-1 text-[12.5px] text-ink-subtle">
            Turns off hover movement, the level-up celebration, and section reveals.
          </p>
        </div>
        <Toggle
          checked={profile.reduce_motion}
          label="Reduce motion"
          onChange={(next) => set({ reduce_motion: next })}
        />
      </div>

      <div className="mt-5 flex items-start justify-between gap-4 border-t border-border-divider pt-5">
        <div>
          <p className="text-[13px] font-medium text-ink">Compact density</p>
          <p className="mt-1 text-[12.5px] text-ink-subtle">
            Tightens spacing so more fits on screen.
          </p>
        </div>
        <Toggle
          checked={profile.compact_density}
          label="Compact density"
          onChange={(next) => set({ compact_density: next })}
        />
      </div>
    </SettingsCard>
  )
}
