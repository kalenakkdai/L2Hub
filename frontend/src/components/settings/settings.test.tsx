import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfirmDialog, Toggle, VerificationChip } from './primitives'
import { AvatarField } from './AvatarField'
import { DangerZone } from './DangerZone'
import { NotificationsGrid } from './NotificationsGrid'
import { ProfileSection } from './ProfileSection'
import { SettingsLayout } from './SettingsLayout'
import {
  applyAccentColor,
  applyAppearance,
  contrastRatio,
  prefersReducedMotion,
  resolveTheme,
} from '../../lib/appearance'
import { filterNavSections, type NavSection } from '../layout/navigation'
import {
  CHANNELS,
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
  SOURCED_EVENT_TYPES,
} from '../../hooks/useNotificationPrefs'
import type { SettingsProfile } from '../../hooks/useProfile'

vi.mock('../../lib/supabase', async () => {
  const { createSupabaseMock } =
    await vi.importActual<typeof import('../../test/supabaseMock')>('../../test/supabaseMock')
  return { supabase: createSupabaseMock() }
})

function profile(overrides: Partial<SettingsProfile> = {}): SettingsProfile {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'ada@example.edu',
    full_name: 'Ada Lovelace',
    display_name: null,
    pronouns: null,
    grade_year: 11,
    avatar_url: null,
    phone: null,
    phone_verified: false,
    email_verified: true,
    theme: 'system',
    reduce_motion: false,
    compact_density: false,
    quiet_hours_start: null,
    quiet_hours_end: null,
    notifications_paused: false,
    ...overrides,
  }
}

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('Toggle', () => {
  it('is a switch that reports its state', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Toggle checked={false} label="Reduce motion" onChange={onChange} />)

    const toggle = screen.getByRole('switch', { name: 'Reduce motion' })
    expect(toggle).toHaveAttribute('aria-checked', 'false')

    await user.click(toggle)
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('explains why it is disabled instead of just going grey', () => {
    render(
      <Toggle
        checked={false}
        label="SMS"
        disabled
        disabledReason="Verify your phone first."
        onChange={vi.fn()}
      />,
    )

    const toggle = screen.getByRole('switch', { name: 'SMS' })
    expect(toggle).toBeDisabled()
    expect(toggle).toHaveAccessibleDescription('Verify your phone first.')
  })
})

describe('VerificationChip', () => {
  it.each([
    [true, 'Verified'],
    [false, 'Unverified'],
  ])('renders %s as %s', (verified, label) => {
    render(<VerificationChip verified={verified} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })
})

describe('NotificationsGrid', () => {
  const noop = vi.fn()

  it('renders every sourced event type against every channel', () => {
    renderWithQuery(
      <NotificationsGrid profile={profile()} status="idle" save={noop} saveNow={noop} />,
    )

    expect(screen.getAllByRole('row')).toHaveLength(SOURCED_EVENT_TYPES.length + 1)
    expect(screen.getAllByRole('switch')).toHaveLength(
      SOURCED_EVENT_TYPES.length * CHANNELS.length + 1, // + the master pause
    )
  })

  it('offers no switch for an event type nothing emits', () => {
    renderWithQuery(
      <NotificationsGrid profile={profile()} status="idle" save={noop} saveNow={noop} />,
    )

    // These have a column value and a label but no emitter anywhere in the
    // codebase. A switch for them would gate nothing.
    const unsourced = EVENT_TYPES.filter((type) => !SOURCED_EVENT_TYPES.includes(type))
    expect(unsourced.length).toBeGreaterThan(0)

    for (const eventType of unsourced) {
      expect(
        screen.queryByRole('rowheader', { name: new RegExp(EVENT_TYPE_LABELS[eventType]) }),
      ).not.toBeInTheDocument()
    }
  })

  it('disables SMS until the phone is verified', () => {
    renderWithQuery(
      <NotificationsGrid
        profile={profile({ phone_verified: false })}
        status="idle"
        save={noop}
        saveNow={noop}
      />,
    )

    const smsToggles = screen.getAllByRole('switch', { name: /by SMS$/ })
    expect(smsToggles).toHaveLength(SOURCED_EVENT_TYPES.length)
    for (const toggle of smsToggles) {
      expect(toggle).toBeDisabled()
      expect(toggle).toHaveAccessibleDescription(/Verify your phone/)
    }
  })

  it('enables SMS once the phone is verified', async () => {
    renderWithQuery(
      <NotificationsGrid
        profile={profile({ phone: '+15551234567', phone_verified: true })}
        status="idle"
        save={noop}
        saveNow={noop}
      />,
    )

    // Toggles stay disabled until the saved preferences arrive.
    await waitFor(() => {
      for (const toggle of screen.getAllByRole('switch', { name: /by SMS$/ })) {
        expect(toggle).toBeEnabled()
      }
    })
  })

  it('says what the row actually gates', () => {
    renderWithQuery(
      <NotificationsGrid profile={profile()} status="idle" save={noop} saveNow={noop} />,
    )

    // The Wrapped row used to be mislabelled "New event created" while gating
    // the Wrapped lifecycle. Now each has its own row and its own emitter, so
    // the label and the emitter describe the same thing.
    expect(screen.getByText('Event Wrapped updates')).toBeInTheDocument()
    expect(screen.getByText(/requested, finishes generating, or is published/)).toBeInTheDocument()
    // event_created is now sourced in its own right (web push), so its row is
    // offered separately from Wrapped.
    expect(screen.getByText('New event created')).toBeInTheDocument()
  })

  it('does not promise that quiet-hours notifications arrive later', () => {
    renderWithQuery(
      <NotificationsGrid profile={profile()} status="idle" save={noop} saveNow={noop} />,
    )

    // deliver() drops them rather than queueing, so the copy must not say wait.
    expect(screen.queryByText(/wait until quiet hours end/)).not.toBeInTheDocument()
    expect(screen.getByText(/are not sent/)).toBeInTheDocument()
  })

  it('saves the master pause immediately rather than waiting for a blur', async () => {
    const user = userEvent.setup()
    const save = vi.fn()
    const saveNow = vi.fn()
    renderWithQuery(
      <NotificationsGrid profile={profile()} status="idle" save={save} saveNow={saveNow} />,
    )

    await user.click(screen.getByRole('switch', { name: 'Pause all notifications' }))

    expect(save).toHaveBeenCalledWith({ notifications_paused: true })
    expect(saveNow).toHaveBeenCalled()
  })
})

describe('avatar placement', () => {
  const account = {
    id: 'u1',
    email: 'brittany@example.edu',
    full_name: 'Brittany Lu',
    role: 'member',
    status: 'active',
    created_at: '2026-08-01T00:00:00Z',
    roles: [],
    permissions: [],
    committees: [],
  } as never

  it('renders the avatar picker in the settings sidebar', () => {
    render(
      <MemoryRouter>
        <SettingsLayout
          title="My settings"
          sections={[{ id: 'profile', label: 'Profile' }]}
          aside={<AvatarField avatarUrl={null} fallback="Brittany" onChange={() => {}} />}
        >
          <p>content</p>
        </SettingsLayout>
      </MemoryRouter>,
    )

    const upload = screen.getByRole('button', { name: /Upload/ })
    const sidebar = screen.getByRole('heading', { level: 1 }).parentElement
    expect(sidebar).toContainElement(upload)

    // The section list it sits above is in the same column.
    expect(sidebar).toContainElement(screen.getByRole('link', { name: 'Profile' }))
  })

  it('no longer puts the avatar inside the Profile card', () => {
    renderWithQuery(
      <ProfileSection
        profile={profile()}
        account={account}
        status="idle"
        save={() => {}}
        saveNow={() => {}}
      />,
    )

    // It was one 40px circle among a grid of text inputs; it now lives in the
    // sidebar at a size where you can see what you uploaded.
    expect(screen.queryByRole('button', { name: /Upload|Replace/ })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Display name')).toBeInTheDocument()
  })

  it('shows the initial until a photo is set', () => {
    render(<AvatarField avatarUrl={null} fallback="brittany@example.edu" onChange={() => {}} />)

    expect(screen.getByText('B')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument()
  })

  it('offers Replace and Remove once a photo is set', () => {
    render(
      <AvatarField
        avatarUrl="https://example.test/a.png"
        fallback="Brittany"
        onChange={() => {}}
      />,
    )

    expect(screen.getByRole('button', { name: /Replace/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Remove/ })).toBeInTheDocument()
  })
})

describe('ConfirmDialog', () => {
  it('keeps the action disabled until the confirmation text matches', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog
        open
        title="Break Camp?"
        description="This cannot be undone."
        confirmLabel="Break Camp"
        confirmText="L2 Campsite"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    )

    const confirm = screen.getByRole('button', { name: 'Break Camp' })
    expect(confirm).toBeDisabled()

    await user.type(screen.getByLabelText(/Type/), 'L2 Camps')
    expect(confirm).toBeDisabled()

    await user.type(screen.getByLabelText(/Type/), 'ite')
    expect(confirm).toBeEnabled()

    await user.click(confirm)
    expect(onConfirm).toHaveBeenCalled()
  })

  it('needs no typing when no confirmation text is required', () => {
    render(
      <ConfirmDialog
        open
        title="Sign out everywhere?"
        description="Every session ends."
        confirmLabel="Sign out"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Sign out' })).toBeEnabled()
  })

  it('is an alertdialog describing what will happen', () => {
    render(
      <ConfirmDialog
        open
        title="Break Camp?"
        description="This cannot be undone."
        confirmLabel="Break Camp"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toHaveAccessibleName('Break Camp?')
    expect(dialog).toHaveAccessibleDescription('This cannot be undone.')
  })
})

describe('DangerZone', () => {
  it('puts every action behind a confirmation', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()

    render(
      <DangerZone
        actions={[
          {
            id: 'leave',
            label: 'Leave this Campsite',
            description: 'Removes you from every committee.',
            buttonLabel: 'Leave',
            confirmTitle: 'Leave the Campsite?',
            confirmDescription: 'You will lose access.',
            onConfirm,
          },
        ]}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Leave' }))

    // Nothing happens on the click itself — only after confirming.
    expect(onConfirm).not.toHaveBeenCalled()
    const dialog = screen.getByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Leave' }))
    expect(onConfirm).toHaveBeenCalled()
  })

  it('explains a disabled action instead of leaving it inert', () => {
    render(
      <DangerZone
        actions={[
          {
            id: 'break',
            label: 'Break Camp',
            description: 'Archives the Campsite.',
            buttonLabel: 'Break Camp',
            confirmTitle: 'Break Camp?',
            confirmDescription: 'Everyone loses access.',
            disabled: true,
            disabledReason: 'Only an AC or President can break camp.',
            onConfirm: vi.fn(),
          },
        ]}
      />,
    )

    const button = screen.getByRole('button', { name: 'Break Camp' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('title', 'Only an AC or President can break camp.')
  })
})

describe('appearance', () => {
  it('writes each preference onto the root element', () => {
    const root = document.createElement('html')

    applyAppearance({ theme: 'dark', reduceMotion: true, compactDensity: true }, root)

    expect(root.getAttribute('data-theme')).toBe('dark')
    expect(root.getAttribute('data-reduce-motion')).toBe('true')
    expect(root.getAttribute('data-density')).toBe('compact')
  })

  it('removes the attributes when the preferences are off', () => {
    const root = document.createElement('html')
    applyAppearance({ theme: 'dark', reduceMotion: true, compactDensity: true }, root)

    applyAppearance({ theme: 'light', reduceMotion: false, compactDensity: false }, root)

    expect(root.getAttribute('data-theme')).toBe('light')
    expect(root.hasAttribute('data-reduce-motion')).toBe(false)
    expect(root.hasAttribute('data-density')).toBe(false)
  })

  it('reports reduced motion from the in-app setting, not just the OS one', () => {
    const root = document.createElement('html')
    expect(prefersReducedMotion(root)).toBe(false)

    applyAppearance({ theme: 'system', reduceMotion: true, compactDensity: false }, root)
    // This is what stops the confetti and the count-up, which CSS cannot reach.
    expect(prefersReducedMotion(root)).toBe(true)
  })
})

describe('accent colour', () => {
  it('applies a colour dark enough to carry white text', () => {
    const root = document.createElement('html')

    expect(applyAccentColor('#12372a', root)).toBe(true)
    expect(root.style.getPropertyValue('--color-accent-600')).toBe('#12372a')
    // The hover step is derived rather than asked for.
    expect(root.style.getPropertyValue('--color-accent-700')).not.toBe('')
  })

  it('refuses a colour that would make button text unreadable', () => {
    const root = document.createElement('html')

    // Pale yellow: 1.1:1 against white. A Campsite must not be able to
    // configure itself into invisible buttons.
    expect(applyAccentColor('#ffee88', root)).toBe(false)
    expect(root.style.getPropertyValue('--color-accent-600')).toBe('')
  })

  it('clears back to the default palette when unset', () => {
    const root = document.createElement('html')
    applyAccentColor('#12372a', root)

    expect(applyAccentColor(null, root)).toBe(false)
    expect(root.style.getPropertyValue('--color-accent-600')).toBe('')
  })

  it('ignores a malformed colour rather than writing garbage', () => {
    const root = document.createElement('html')
    expect(applyAccentColor('not-a-colour', root)).toBe(false)
  })

  it('computes contrast the way WCAG does', () => {
    // Black on white is the maximum, 21:1.
    expect(Math.round(contrastRatio('#000000', '#ffffff') ?? 0)).toBe(21)
    expect(contrastRatio('#ffffff', '#ffffff')).toBe(1)
  })
})

describe('theme resolution', () => {
  it.each([
    ['light', 'light'],
    ['dark', 'dark'],
  ] as const)('passes %s through unchanged', (theme, expected) => {
    expect(resolveTheme(theme)).toBe(expected)
  })

  it('resolves system to something the stylesheet can use', () => {
    expect(['light', 'dark']).toContain(resolveTheme('system'))
  })
})

describe('module toggles gate navigation', () => {
  const sections: NavSection[] = [
    {
      items: [
        { label: 'Dashboard', to: '/dashboard', icon: (() => null) as never },
        { label: 'Grades', to: '/grades', module: 'grades', icon: (() => null) as never },
      ],
    },
  ]

  it('hides a module the Campsite switched off', () => {
    const filtered = filterNavSections(sections, [], { grades: false })

    expect(filtered[0].items.map((item) => item.label)).toEqual(['Dashboard'])
  })

  it('shows a module that is switched on', () => {
    const filtered = filterNavSections(sections, [], { grades: true })

    expect(filtered[0].items.map((item) => item.label)).toEqual(['Dashboard', 'Grades'])
  })

  it('treats an unconfigured module as available', () => {
    // A new feature should not be invisible until someone remembers to
    // switch it on.
    const filtered = filterNavSections(sections, [], {})

    expect(filtered[0].items.map((item) => item.label)).toEqual(['Dashboard', 'Grades'])
  })

  it('still applies permission gating alongside module gating', () => {
    const gated: NavSection[] = [
      {
        items: [
          {
            label: 'Campers',
            to: '/admin/users',
            permission: 'users.view',
            icon: (() => null) as never,
          },
        ],
      },
    ]

    expect(filterNavSections(gated, [], {})).toEqual([])
    expect(filterNavSections(gated, ['users.view'], {})[0].items).toHaveLength(1)
  })
})

describe('avatar validation', () => {
  const file = (type: string, size: number) =>
    new File([new Uint8Array(size)], 'a', { type })

  it('accepts the image types the bucket allows', async () => {
    const { validateAvatar } = await import('../../lib/avatars')
    for (const type of ['image/png', 'image/jpeg', 'image/webp', 'image/gif']) {
      expect(validateAvatar(file(type, 1000))).toBeNull()
    }
  })

  it('rejects a type the bucket would refuse anyway', async () => {
    const { validateAvatar } = await import('../../lib/avatars')
    // Checked here so the camper is told before a slow upload fails.
    expect(validateAvatar(file('application/pdf', 10))).toBe('unsupported_type')
  })

  it('rejects a file over the bucket size limit', async () => {
    const { validateAvatar, MAX_BYTES } = await import('../../lib/avatars')
    expect(validateAvatar(file('image/png', MAX_BYTES + 1))).toBe('too_large')
    expect(validateAvatar(file('image/png', MAX_BYTES))).toBeNull()
  })
})
