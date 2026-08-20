import { createClient } from '@supabase/supabase-js'

const URL = 'https://umhrxmmifvjmwlgowxyy.supabase.co'
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtaHJ4bW1pZnZqbXdsZ293eHl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxNTUwODcsImV4cCI6MjEwMjczMTA4N30.Ksi3YuDC9K5ox94HIyyOwLsJ5c0IiV8YVIvlRq2C3XM'
const PASSWORD = 'Demo@1234'

let pass = 0
let fail = 0
function check(name, cond, extra) {
  if (cond) { pass++; console.log(`  ✅ ${name}`) }
  else { fail++; console.log(`  ❌ ${name}`, extra ?? '') }
}

async function login(email) {
  const c = createClient(URL, ANON)
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw new Error(`login failed ${email}: ${error.message}`)
  return c
}

console.log('1) SIGN-UP is always a student (even if attacker injects role=admin)')
const anon = createClient(URL, ANON)
const rand = Date.now().toString(36)
const { data: su, error: suErr } = await anon.auth.signUp({
  email: `attacker_${rand}@test.local`,
  password: PASSWORD,
  options: { data: { full_name: 'Sneaky User', phone: '0712999001', role: 'admin' } },
})
check('signUp request accepted', !suErr, suErr?.message)
const uid = su.user?.id
if (uid) {
  await new Promise((r) => setTimeout(r, 1500))
  const admin = await login('admin@clearance.local')
  const { data: prof } = await admin.from('profiles').select('role').eq('id', uid).single()
  check('injected role=admin ignored, profile is student', prof?.role === 'student', prof?.role)
}

console.log('2) NON-ADMIN cannot change roles')
const amina = await login('amina@student.local')
const golden = await login('golden@student.local')
const me = (await createClient(URL, ANON).auth.getUser()) // placeholder
const { data: goldenProf } = await (await login('admin@clearance.local')).from('profiles').select('id').eq('email', 'golden@student.local').single()
const { error: blockErr } = await amina.rpc('update_user_role', { p_user_id: goldenProf.id, p_role: 'admin' })
check('student calling update_user_role is rejected', !!blockErr, blockErr?.message)

console.log('3) ADMIN can change roles and audit trail is written')
const admin = await login('admin@clearance.local')
const r1 = await admin.rpc('update_user_role', { p_user_id: goldenProf.id, p_role: 'agent' })
check('promote golden -> agent ok', !r1.error, r1.error?.message)
const { data: p1 } = await admin.from('profiles').select('role').eq('id', goldenProf.id).single()
check('golden now agent', p1?.role === 'agent', p1?.role)
const r2 = await admin.rpc('update_user_role', { p_user_id: goldenProf.id, p_role: 'student' })
check('demote golden back to student ok', !r2.error, r2.error?.message)
const { data: audit } = await admin.from('audit_logs').select('action, metadata').eq('action', 'user_role_changed').order('created_at', { ascending: false }).limit(2)
check('audit trail records role changes', audit?.length === 2 && audit.every((a) => a.metadata?.target_user_id === goldenProf.id), JSON.stringify(audit))

console.log('4) INVALID role rejected')
const r3 = await admin.rpc('update_user_role', { p_user_id: goldenProf.id, p_role: 'superadmin' })
check('invalid role raises error', !!r3.error, r3.error?.message)

console.log(`\nRESULT: ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)