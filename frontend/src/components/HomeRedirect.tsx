import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { FullPageMessage } from './FullPageMessage'

/** `/` is a signpost: signed-in users go to the dashboard, everyone else to login. */
export function HomeRedirect() {
  const { status } = useAuth()

  if (status === 'loading') {
    return <FullPageMessage>Loading…</FullPageMessage>
  }

  return <Navigate to={status === 'authenticated' ? '/dashboard' : '/login'} replace />
}
