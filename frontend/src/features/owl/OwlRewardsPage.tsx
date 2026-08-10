import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Feather, Loader, Lock } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { AppShell } from '../../components/layout/AppShell'
import { ErrorState } from '../../components/ui/ErrorState'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { useGradebook } from '../grades/hooks/useGradebook'
import { isAPlus, letterGrade } from '../grades/utils/letterGrade'
import {
  fetchOwlProfile,
  syncOwlEligibility,
  updateOwlCosmetics,
  type OwlCatalogItem,
  type OwlProfile,
} from './api'
import { CustomOwl } from './CustomOwl'

/**
 * A+-only owl rewards: spend points on campsite owl cosmetics.
 *
 * Eligibility is synced from the weighted grade percent. Dropping below 97%
 * revokes customize access and the backend sends a notification.
 */
export function OwlRewardsPage() {
  const me = useCurrentUser()
  const queryClient = useQueryClient()
  const gradebook = useGradebook()
  const owlQuery = useQuery({ queryKey: ['owl', 'me'], queryFn: fetchOwlProfile })
  const synced = useRef(false)

  const weighted =
    gradebook.data?.summary.weightedPercent ??
    owlQuery.data?.weightedPercent ??
    null

  useEffect(() => {
    if (synced.current) return
    if (!gradebook.isSuccess) return
    synced.current = true
    const percent = gradebook.data.summary.weightedPercent ?? null
    void syncOwlEligibility(percent).then((data: OwlProfile) => {
      queryClient.setQueryData(['owl', 'me'], data)
    })
  }, [gradebook.isSuccess, gradebook.data, queryClient])

  const save = useMutation({
    mutationFn: updateOwlCosmetics,
    onSuccess: (data) => {
      queryClient.setQueryData(['owl', 'me'], data)
    },
  })

  if (me.shell) return me.shell
  const { profile, name, committee } = me

  const owl = owlQuery.data
  const eligible = owl?.eligible ?? isAPlus(weighted)
  const letter = owl?.letterGrade ?? letterGrade(weighted)

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-title font-semibold text-ink">My owl</h1>
        <p className="mt-1 text-sm text-ink-muted">
          A+ students (97%+) unlock the campsite owl and spend reward points on
          cosmetics. Drop below A+ and customization pauses.
        </p>
      </div>
      {owl ? (
        <p className="text-sm tabular-nums text-ink-subtle">
          {owl.points} pts
          {letter ? ` · ${letter}` : ''}
          {weighted != null ? ` · ${weighted.toFixed(1)}%` : ''}
        </p>
      ) : null}
    </div>
  )

  return (
    <AppShell
      name={name}
      role={profile.role}
      committee={committee}
      permissions={profile.permissions}
      header={header}
    >
      {(owlQuery.isPending || (gradebook.isPending && !owl)) && (
        <p className="flex items-center gap-2.5 py-10 text-sm text-ink-subtle">
          <Loader aria-hidden="true" className="h-4 w-4 animate-spin" />
          Checking your grade…
        </p>
      )}

      {owlQuery.isError && (
        <ErrorState
          title="Could not load your owl"
          description="Try again in a moment."
          onRetry={() => void owlQuery.refetch()}
        />
      )}

      {owl && !eligible ? (
        <section className="rounded-card border border-border-subtle bg-surface p-6 shadow-xs">
          <Lock className="size-7 text-ink-subtle" aria-hidden="true" />
          <h2 className="mt-3 text-lg font-semibold text-ink">
            Owl customization locked
          </h2>
          <p className="mt-2 max-w-lg text-sm text-ink-muted">
            This page is for A+ students only. Your standing is{' '}
            <strong className="text-ink">{letter ?? 'not yet graded'}</strong>
            {weighted != null ? ` (${weighted.toFixed(1)}%)` : ''}. Reach 97%+
            to unlock cosmetics and earn welcome points. If you just dropped
            below A+, check your inbox — we sent a notice.
          </p>
          {owl.cosmetics ? (
            <div className="mt-6 opacity-60">
              <CustomOwl cosmetics={owl.cosmetics} size={120} label="Locked owl" />
              <p className="mt-2 text-xs text-ink-subtle">
                Your look is saved and will return when you earn A+ again.
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      {owl && eligible ? (
        <CustomizePanel
          owl={owl}
          saving={save.isPending}
          error={
            save.isError
              ? save.error instanceof Error
                ? save.error.message
                : 'Could not save'
              : null
          }
          onSave={(patch) => save.mutate(patch)}
        />
      ) : null}
    </AppShell>
  )
}

function CustomizePanel({
  owl,
  saving,
  error,
  onSave,
}: {
  owl: OwlProfile
  saving: boolean
  error: string | null
  onSave: (patch: {
    bellyColor?: string
    wingColor?: string
    accessory?: string
    trail?: string
  }) => void
}) {
  const [bellyColor, setBelly] = useState(owl.cosmetics.bellyColor)
  const [wingColor, setWing] = useState(owl.cosmetics.wingColor)
  const [accessory, setAccessory] = useState(owl.cosmetics.accessory)
  const [trail, setTrail] = useState(owl.cosmetics.trail)

  useEffect(() => {
    setBelly(owl.cosmetics.bellyColor)
    setWing(owl.cosmetics.wingColor)
    setAccessory(owl.cosmetics.accessory)
    setTrail(owl.cosmetics.trail)
  }, [owl])

  const preview: OwlProfile['cosmetics'] = {
    ...owl.cosmetics,
    bellyColor,
    wingColor,
    accessory,
    trail,
    palette: {
      belly: {
        ...owl.cosmetics.palette.belly,
        ...(owl.catalog.bellyColors.find((o) => o.id === bellyColor) ?? {}),
        fill:
          owl.catalog.bellyColors.find((o) => o.id === bellyColor)?.fill ??
          owl.cosmetics.palette.belly.fill,
        fillDeep:
          owl.catalog.bellyColors.find((o) => o.id === bellyColor)?.fillDeep ??
          owl.cosmetics.palette.belly.fillDeep,
      },
      wing: {
        ...owl.cosmetics.palette.wing,
        near:
          owl.catalog.wingColors.find((o) => o.id === wingColor)?.near ??
          owl.cosmetics.palette.wing.near,
        far:
          owl.catalog.wingColors.find((o) => o.id === wingColor)?.far ??
          owl.cosmetics.palette.wing.far,
      },
    },
  }

  const estimatedCost =
    optionCost(owl, 'bellyColor', bellyColor) +
    optionCost(owl, 'wingColor', wingColor) +
    optionCost(owl, 'accessory', accessory) +
    optionCost(owl, 'trail', trail)

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <section className="flex flex-col items-center rounded-card border border-border-subtle bg-[#0f1724] px-4 py-8 shadow-xs">
        <CustomOwl cosmetics={preview} />
        <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-amber-100/80">
          <Feather className="size-3.5" aria-hidden="true" />
          A+ owl
        </p>
      </section>

      <section className="space-y-5 rounded-card border border-border-subtle bg-surface p-4 shadow-xs sm:p-5">
        <OptionGroup
          title="Belly"
          options={owl.catalog.bellyColors}
          value={bellyColor}
          unlocked={owl.cosmetics.unlocked}
          field="bellyColor"
          onChange={setBelly}
        />
        <OptionGroup
          title="Wings"
          options={owl.catalog.wingColors}
          value={wingColor}
          unlocked={owl.cosmetics.unlocked}
          field="wingColor"
          onChange={setWing}
        />
        <OptionGroup
          title="Accessory"
          options={owl.catalog.accessories}
          value={accessory}
          unlocked={owl.cosmetics.unlocked}
          field="accessory"
          onChange={setAccessory}
        />
        <OptionGroup
          title="Trail"
          options={owl.catalog.trails}
          value={trail}
          unlocked={owl.cosmetics.unlocked}
          field="trail"
          onChange={setTrail}
        />

        {error ? (
          <p className="text-sm text-status-danger" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={saving}
            className="rounded-control bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-700 disabled:opacity-50"
            onClick={() =>
              onSave({ bellyColor, wingColor, accessory, trail })
            }
          >
            {saving
              ? 'Saving…'
              : estimatedCost > 0
                ? `Apply · ${estimatedCost} pts`
                : 'Apply look'}
          </button>
          <p className="text-xs text-ink-subtle">
            You have {owl.points} points. Owned unlocks are free to re-equip.
          </p>
        </div>
      </section>
    </div>
  )
}

function optionCost(
  owl: OwlProfile,
  field: string,
  value: string,
): number {
  const current = {
    bellyColor: owl.cosmetics.bellyColor,
    wingColor: owl.cosmetics.wingColor,
    accessory: owl.cosmetics.accessory,
    trail: owl.cosmetics.trail,
  }[field]
  if (current === value) return 0
  if (owl.cosmetics.unlocked.includes(`${field}:${value}`)) return 0
  const lists = {
    bellyColor: owl.catalog.bellyColors,
    wingColor: owl.catalog.wingColors,
    accessory: owl.catalog.accessories,
    trail: owl.catalog.trails,
  }[field]
  return lists?.find((o) => o.id === value)?.cost ?? 0
}

function OptionGroup({
  title,
  options,
  value,
  unlocked,
  field,
  onChange,
}: {
  title: string
  options: OwlCatalogItem[]
  value: string
  unlocked: string[]
  field: string
  onChange: (id: string) => void
}) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold tracking-wide text-ink-subtle uppercase">
        {title}
      </legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => {
          const owned = unlocked.includes(`${field}:${option.id}`) || option.cost === 0
          const selected = value === option.id
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              aria-pressed={selected}
              className={[
                'rounded-control border px-3 py-1.5 text-left text-sm',
                selected
                  ? 'border-accent-600 bg-accent-600/10 text-ink'
                  : 'border-border-subtle text-ink-muted hover:bg-surface-sunken',
              ].join(' ')}
            >
              <span className="font-medium text-ink">{option.label}</span>
              <span className="mt-0.5 block text-[11px] text-ink-subtle">
                {owned ? 'Owned' : `${option.cost} pts`}
              </span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
