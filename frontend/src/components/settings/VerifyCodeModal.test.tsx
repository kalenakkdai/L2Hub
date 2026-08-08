import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VerifyCodeModal } from './VerifyCodeModal'

vi.mock('../../lib/supabase', async () => {
  const { createSupabaseMock } =
    await vi.importActual<typeof import('../../test/supabaseMock')>('../../test/supabaseMock')
  return { supabase: createSupabaseMock() }
})

function setup(overrides: Partial<Parameters<typeof VerifyCodeModal>[0]> = {}) {
  const send = overrides.send ?? vi.fn(async () => {})
  const verify = overrides.verify ?? vi.fn(async () => {})
  const onVerified = overrides.onVerified ?? vi.fn()
  const onClose = overrides.onClose ?? vi.fn()

  render(
    <VerifyCodeModal
      open
      channel="email"
      destination="ada@example.edu"
      onClose={onClose}
      onVerified={onVerified}
      send={send}
      verify={verify}
      {...overrides}
    />,
  )

  return { send, verify, onVerified, onClose }
}

const digits = () => screen.getAllByRole('textbox')

describe('VerifyCodeModal', () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('sends a code as soon as it opens', async () => {
    const { send } = setup()
    await waitFor(() => expect(send).toHaveBeenCalledWith('ada@example.edu'))
  })

  it('shows a spinner while sending', async () => {
    let release: () => void = () => {}
    const send = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve
        }),
    )
    setup({ send })

    expect(await screen.findByText('Sending your code…')).toBeInTheDocument()
    release()
    await waitFor(() => expect(screen.queryByText('Sending your code…')).not.toBeInTheDocument())
  })

  it('renders six separate inputs', async () => {
    setup()
    await waitFor(() => expect(digits()).toHaveLength(6))
  })

  it('auto-advances as digits are typed', async () => {
    const user = userEvent.setup()
    setup()
    await waitFor(() => expect(digits()).toHaveLength(6))

    await user.type(digits()[0], '1')
    expect(digits()[1]).toHaveFocus()

    await user.type(digits()[1], '2')
    expect(digits()[2]).toHaveFocus()
  })

  it('fills every box from a pasted code', async () => {
    const user = userEvent.setup()
    const { verify } = setup()
    await waitFor(() => expect(digits()).toHaveLength(6))

    digits()[0].focus()
    await user.paste('123456')

    await waitFor(() => expect(verify).toHaveBeenCalledWith('ada@example.edu', '123456'))
  })

  it('ignores non-numeric characters in a pasted code', async () => {
    const user = userEvent.setup()
    const { verify } = setup()
    await waitFor(() => expect(digits()).toHaveLength(6))

    digits()[0].focus()
    await user.paste('12-34-56')

    await waitFor(() => expect(verify).toHaveBeenCalledWith('ada@example.edu', '123456'))
  })

  it('steps backwards on backspace in an empty box', async () => {
    const user = userEvent.setup()
    setup()
    await waitFor(() => expect(digits()).toHaveLength(6))

    await user.type(digits()[0], '1')
    expect(digits()[1]).toHaveFocus()

    await user.keyboard('{Backspace}')
    expect(digits()[0]).toHaveFocus()
    expect(digits()[0]).toHaveValue('')
  })

  it('submits automatically once six digits are present', async () => {
    const user = userEvent.setup()
    const { verify } = setup()
    await waitFor(() => expect(digits()).toHaveLength(6))

    for (const [index, digit] of [...'246813'].entries()) {
      await user.type(digits()[index], digit)
    }

    await waitFor(() => expect(verify).toHaveBeenCalledWith('ada@example.edu', '246813'))
  })

  it('flips to Verified and reports back', async () => {
    const user = userEvent.setup()
    const onVerified = vi.fn()
    setup({ onVerified })
    await waitFor(() => expect(digits()).toHaveLength(6))

    digits()[0].focus()
    await user.paste('123456')

    expect(await screen.findByText('Verified')).toBeInTheDocument()
    await waitFor(() => expect(onVerified).toHaveBeenCalled(), { timeout: 2000 })
  })

  describe('errors', () => {
    it.each([
      // Supabase answers a wrong code and an expired one with the same body,
      // so both land on the one message that is true of either.
      ['Invalid token', 'That code is not right, or it has expired. Check it, or send a new one.'],
      [
        'Token has expired or is invalid',
        'That code is not right, or it has expired. Check it, or send a new one.',
      ],
      ['Email rate limit exceeded', 'Too many attempts. Wait a moment before trying again.'],
      // GoTrue's actual wording for the resend cooldown, which matches none of
      // the phrases the old classifier looked for.
      [
        'For security purposes, you can only request this after 4 seconds.',
        'Too many attempts. Wait a moment before trying again.',
      ],
    ])('surfaces %s', async (thrown, expected) => {
      const user = userEvent.setup()
      const verify = vi.fn(async () => {
        throw new Error(thrown)
      })
      setup({ verify })
      await waitFor(() => expect(digits()).toHaveLength(6))

      digits()[0].focus()
      await user.paste('123456')

      expect(await screen.findByRole('alert')).toHaveTextContent(expected)
    })

    it('clears the boxes after a rejected code so the next attempt starts clean', async () => {
      const user = userEvent.setup()
      const verify = vi.fn(async () => {
        throw new Error('Invalid token')
      })
      setup({ verify })
      await waitFor(() => expect(digits()).toHaveLength(6))

      digits()[0].focus()
      await user.paste('123456')

      await screen.findByRole('alert')
      expect(digits()[0]).toHaveValue('')
    })

    it('reports a send failure without pretending a code arrived', async () => {
      const send = vi.fn(async () => {
        throw new Error('network down')
      })
      setup({ send })

      expect(await screen.findByRole('alert')).toBeInTheDocument()
    })
  })

  describe('resend', () => {
    it('starts disabled with a countdown', async () => {
      setup()
      const resend = await screen.findByRole('button', { name: /Resend in \d+s/ })
      expect(resend).toBeDisabled()
    })

    it('counts the cooldown down', async () => {
      setup()
      const initial = await screen.findByRole('button', { name: /Resend in (\d+)s/ })
      const seconds = (label: string) => Number(/(\d+)s/.exec(label)?.[1])
      const started = seconds(initial.textContent ?? '')

      // The exact starting value is pinned by the unit tests on
      // secondsUntilResend; what matters here is that the timer runs.
      expect(started).toBeGreaterThan(40)

      await waitFor(
        () => {
          const now = screen.getByRole('button', { name: /Resend in (\d+)s/ })
          expect(seconds(now.textContent ?? '')).toBeLessThan(started)
        },
        { timeout: 2500 },
      )
    })
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    setup({ onClose })
    await waitFor(() => expect(digits()).toHaveLength(6))

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })

  it('is a labelled modal dialog', async () => {
    setup()
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleName(/Verify your email address/)
  })

  it('renders nothing when closed', () => {
    const { container } = render(
      <VerifyCodeModal
        open={false}
        channel="email"
        destination="ada@example.edu"
        onClose={vi.fn()}
        onVerified={vi.fn()}
        send={vi.fn()}
        verify={vi.fn()}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
