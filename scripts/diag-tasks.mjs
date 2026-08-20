import { createClient } from '@supabase/supabase-js'

const URL = 'https://umhrxmmifvjmwlgowxyy.supabase.co'
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtaHJ4bW1pZnZqbXdsZ293eHl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxNTUwODcsImV4cCI6MjEwMjczMTA4N30.Ksi3YuDC9K5ox94HIyyOwLsJ5c0IiV8YVIvlRq2C3XM'
const PASSWORD = 'Demo@1234'
const c = createClient(URL, ANON)
const { data, error } = await c.auth.signInWithPassword({ email: 'admin@clearance.local', password: PASSWORD })
const admin = createClient(URL, ANON, { global: { headers: { Authorization: `Bearer ${data.session.access_token}` } } })

const unfixed = await admin.from('profiles').select('*, requests:clearance_requests(id, request_number, status)').eq('role', 'student').order('created_at', { ascending: false })
console.log('UNFIXED:', unfixed.error ? `ERR ${unfixed.error.message}` : `${unfixed.data?.length} rows`)
const fixed = await admin.from('profiles').select('*, requests:clearance_requests!clearance_requests_student_user_id_fkey(id, request_number, status)').eq('role', 'student').order('created_at', { ascending: false })
console.log('FIXED:', fixed.error ? `ERR ${fixed.error.message}` : `${fixed.data?.length} rows`, fixed.data?.map((s) => s.full_name).join(', '))