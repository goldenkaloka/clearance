import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !anonKey || anonKey === 'your-anon-key-here') {
  // eslint-disable-next-line no-console
  console.warn(
    'Supabase env vars are not configured. Copy web/.env.example to web/.env and fill in your project keys.',
  )
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})