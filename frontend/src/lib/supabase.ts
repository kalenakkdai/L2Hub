import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `${name} is not set. Copy frontend/.env.example to frontend/.env and fill it in.`,
    )
  }
  return value
}

// Anything VITE_-prefixed is compiled into the browser bundle. A secret key
// here would be readable by every visitor, so refuse to start rather than
// ship one by accident.
function rejectSecretKey(key: string): string {
  if (key.startsWith('sb_secret_') || key.includes('service_role')) {
    throw new Error(
      'VITE_SUPABASE_PUBLISHABLE_KEY looks like a secret key. Use the publishable key (sb_publishable_...); secret keys must never reach the browser.',
    )
  }
  return key
}

export const supabase = createClient(
  required('VITE_SUPABASE_URL', url),
  rejectSecretKey(required('VITE_SUPABASE_PUBLISHABLE_KEY', publishableKey)),
  {
    auth: {
      // The client owns the session: it persists to storage and refreshes the
      // access token on its own. Nothing else in the app stores a copy.
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)
