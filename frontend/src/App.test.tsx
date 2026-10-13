import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { type SupabaseMock } from './test/supabaseMock'

vi.mock('./lib/supabase', async () => {
  const { createSupabaseMock } =
    await vi.importActual<typeof import('./test/supabaseMock')>('./test/supabaseMock')
  return { supabase: createSupabaseMock() }
})

const { supabase } = await import('./lib/supabase')
const { default: App } = await import('./App')

const mock = supabase as unknown as SupabaseMock

describe('App', () => {
  beforeEach(() => {
    mock.__setSession(null)
  })

  it('does not show the temporary live demo banner', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>,
    )

    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.queryByText(/live demo/i)).not.toBeInTheDocument()
    expect(document.querySelector('[data-live-demo-banner]')).toBeNull()
  })
})
