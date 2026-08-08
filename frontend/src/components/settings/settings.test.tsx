import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfirmDialog, Toggle, VerificationChip } from './primitives'
import { DangerZone } from './DangerZone'
import { NotificationsGrid } from './NotificationsGrid'
import { applyAppearance, prefersReducedMotion } from '../../lib/appearance'
import { CHANNELS, EVENT_TYPES } from '../../hooks/useNotificationPrefs'
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

  it('renders every event type against every channel', () => {
    renderWithQuery(
      <NotificationsGrid profile={profile()} status="idle" save={noop} saveNow={noop} />,
    )

    expect(screen.getAllByRole('row')).toHaveLength(EVENT_TYPES.length + 1)
    expect(screen.getAllByRole('switch')).toHaveLength(
      EVENT_TYPES.length * CHANNELS.length + 1, // + the master pause
    )
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
    expect(smsToggles).toHaveLength(EVENT_TYPES.length)
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

  it('says overdue alerts ignore quiet hours', () => {
    renderWithQuery(
      <NotificationsGrid profile={profile()} status="idle" save={noop} saveNow={noop} />,
    )

    expect(
      screen.getByText('Always sends, even during quiet hours'),
    ).toBeInTheDocument()
    expect(screen.getByText(/Overdue task alerts still send/)).toBeInTheDocument()
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
