import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeSession, type SupabaseMock } from '../test/supabaseMock'

vi.mock('../lib/supabase', async () => {
  const { createSupabaseMock: create } =
    await vi.importActual<typeof import('../test/supabaseMock')>('../test/supabaseMock')
  return { supabase: create() }
})

const { supabase } = await import('../lib/supabase')
const { apiFetch, ApiError, SessionExpiredError } = await import('./client')

const mock = supabase as unknown as SupabaseMock

function mockResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

function authHeaderOf(init: RequestInit | undefined): string | undefined {
  const headers = init?.headers as Record<string, string> | undefined
  return headers?.Authorization
}

describe('apiFetch', () => {
  beforeEach(() => {
    mock.__setSession(makeSession())
    vi.restoreAllMocks()
  })

  it('sends the access token from the current Supabase session', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(mockResponse(200, { ok: true }))

    await apiFetch('/auth/me')

    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('http://127.0.0.1:8000/auth/me')
    expect(authHeaderOf(init)).toBe('Bearer test-access-token')
  })

  it('reads the token freshly on every call rather than caching it', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse(200, {}))

    await apiFetch('/auth/me')
    mock.__setSession(makeSession({ access_token: 'rotated-token' }))
    await apiFetch('/auth/me')

    const calls = vi.mocked(globalThis.fetch).mock.calls

    expect(authHeaderOf(calls[0][1])).toBe('Bearer test-access-token')
    expect(authHeaderOf(calls[1][1])).toBe('Bearer rotated-token')
  })

  it('returns the parsed body on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse(200, { role: 'officer' }))

    await expect(apiFetch('/auth/me')).resolves.toEqual({ role: 'officer' })
  })

  it('throws SessionExpiredError when there is no session', async () => {
    mock.__setSession(null)
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    await expect(apiFetch('/auth/me')).rejects.toBeInstanceOf(SessionExpiredError)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('throws SessionExpiredError when the backend rejects the token', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockResponse(401, { detail: 'Token rejected' }),
    )

    await expect(apiFetch('/auth/me')).rejects.toBeInstanceOf(SessionExpiredError)
  })

  it('throws ApiError carrying the status and detail for other failures', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockResponse(403, { detail: 'Requires the officer role or higher.' }),
    )

    await expect(apiFetch('/roster')).rejects.toMatchObject({
      name: 'ApiError',
      status: 403,
      message: 'Requires the officer role or higher.',
    })
  })

  it('falls back to a generic message when the error body is not JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('not json')
      },
    } as unknown as Response)

    await expect(apiFetch('/roster')).rejects.toThrow('Request failed with status 500')
  })

  it('exposes ApiError separately from SessionExpiredError', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse(500, {}))

    await expect(apiFetch('/roster')).rejects.not.toBeInstanceOf(SessionExpiredError)
    await expect(apiFetch('/roster')).rejects.toBeInstanceOf(ApiError)
  })
})
