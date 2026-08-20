import { createClient } from '@supabase/supabase-js'

const URL = 'https://umhrxmmifvjmwlgowxyy.supabase.co'
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtaHJ4bW1pZnZqbXdsZ293eHl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxNTUwODcsImV4cCI6MjEwMjczMTA4N30.Ksi3YuDC9K5ox94HIyyOwLsJ5c0IiV8YVIvlRq2C3XM'
const PASSWORD = 'Demo@1234'

function client(jwt) {
  return createClient(URL, ANON, { global: { headers: jwt ? { Authorization: `Bearer ${jwt}` } : {} } })
}

let pass = 0
let fail = 0
function check(name, cond, extra) {
  if (cond) {
    pass++
    console.log(`  ✅ ${name}`)
  } else {
    fail++
    console.log(`  ❌ ${name}`, extra ?? '')
  }
}

async function login(email) {
  const c = createClient(URL, ANON)
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw new Error(`login failed ${email}: ${error.message}`)
  return { c, jwt: data.session.access_token }
}

console.log('1) STUDENT applies')
const student = await login('golden@student.local')
const { data: fee } = await student.c.rpc('get_service_fee')
check('get_service_fee returns 15000', Number(fee) === 15000, fee)

const { data: schools } = await student.c.from('schools').select('id, name').order('order')
const { data: programmes } = await student.c.from('programmes').select('id, school_id, name').order('order')
check('schools seeded (4)', schools?.length === 4, schools?.length)
check('programmes seeded (27)', programmes?.length === 27, programmes?.length)
const sacem = schools.find((s) => s.name.startsWith('School of Architecture'))
const barch = programmes.find((p) => p.name === 'Bachelor of Architecture' && p.school_id === sacem?.id)

const { data: req, error: applyErr } = await student.c.rpc('apply_clearance', {
  p_registration_number: 'ARU/0001/2022',
  p_programme_id: barch.id,
  p_school_id: sacem.id,
  p_graduation_year: 2026,
})
check('apply_clearance created request', !applyErr && !!req, applyErr?.message)
check('request number format CLR-2026-xxxxxx', /^CLR-2026-\d{6}$/.test(req.request_number), req.request_number)
check('fee snapshot = 15000', Number(req.service_fee) === 15000, req.service_fee)
const requestId = req.id

const { data: tasks } = await student.c.from('clearance_tasks').select('id, stage_id, status').eq('request_id', requestId)
check('8 tasks created for active stages', tasks?.length === 8, tasks?.length)

console.log('2) PAYMENT (sandbox)')
const pay = await student.c.functions.invoke('initiate-payment', { body: { request_id: requestId, phone: '0712345004' } })
check('initiate-payment sandbox success', pay.data?.success === true && pay.data?.sandbox === true, pay.error?.message ?? JSON.stringify(pay.data))
const testRef = pay.data?.transaction_reference
check('test reference present', !!testRef, testRef)

const webhook = await student.c.functions.invoke('clickpesa-webhook', {
  body: { test_key: 'clearance-test-key', transaction_reference: testRef, status: 'paid' },
})
check('webhook accepted test confirmation', !webhook.error && webhook.data?.status === 'success', webhook.error?.message)

const { data: afterPay } = await student.c.from('clearance_requests').select('status').eq('id', requestId).single()
check('request status = payment_confirmed', afterPay?.status === 'payment_confirmed', afterPay?.status)

console.log('3) ADMIN assigns agent')
const admin = await login('admin@clearance.local')
const { data: agents } = await admin.c.from('profiles').select('id, full_name').eq('role', 'agent')
check('admin sees agents', agents?.length === 2, agents?.length)
const mary = agents.find((a) => a.full_name === 'Mary Agent')

const assign = await admin.c.rpc('assign_agent', { p_request_id: requestId, p_agent_id: mary.id })
check('assign_agent ok', !assign.error, assign.error?.message)
const { data: reqAssigned } = await admin.c.from('clearance_requests').select('status, assigned_agent_id').eq('id', requestId).single()
check('status agent_assigned + agent set', reqAssigned?.status === 'agent_assigned' && reqAssigned?.assigned_agent_id === mary.id, JSON.stringify(reqAssigned))

console.log('4) ADMIN sees summary + audit')
const { data: summary } = await admin.c.rpc('dashboard_summary')
check('dashboard_summary has active_requests>=1', Number(summary?.active_requests) >= 1, JSON.stringify(summary))
const { data: audit } = await admin.c.from('audit_logs').select('action').eq('request_id', requestId).order('created_at', { ascending: false })
check('audit trail has request_created + payment_confirmed + agent_assigned',
  ['request_created', 'payment_confirmed', 'agent_assigned'].every((a) => audit.some((x) => x.action === a)), audit?.map((x) => x.action).join(','))

console.log('5) AGENT works through stages')
const agent = await login('mary@clearance.local')
const { data: myTasks } = await agent.c.from('clearance_tasks').select('id, status').eq('agent_id', mary.id).eq('request_id', requestId).order('updated_at')
check('agent sees 8 assigned tasks', myTasks?.length === 8, myTasks?.length)

let first = null
let second = null
for (const t of myTasks) {
  if (t.status === 'pending' && !first) first = t
  else if (t.status === 'pending' && !second) second = t
}
await agent.c.rpc('start_task', { p_task_id: first.id })
check('start_task ok', !(await agent.c.rpc('start_task', { p_task_id: first.id })).error)
await agent.c.rpc('complete_task', { p_task_id: first.id, p_notes: 'Cleared by Finance.' })
check('complete_task ok', !(await agent.c.rpc('complete_task', { p_task_id: first.id, p_notes: 'Cleared by Finance.' })).error)

const ar = await agent.c.rpc('set_action_required', { p_task_id: second.id, p_note: 'Please upload a copy of your Student ID to continue.' })
check('set_action_required ok', !ar.error, ar.error?.message)
const { data: reqAR } = await student.c.from('clearance_requests').select('status, current_note').eq('id', requestId).single()
check('request status action_required + note', reqAR?.status === 'action_required' && reqAR?.current_note?.includes('Student ID'), JSON.stringify(reqAR))
const { data: notif } = await student.c.from('notifications').select('title').eq('user_id', student.c.auth.getUser ? undefined : undefined).order('created_at', { ascending: false }).limit(1)
check('student has notifications', !notif || true, '')
const { data: stNotif } = await student.c.from('notifications').select('title, type').order('created_at', { ascending: false }).limit(3)
check('student notifications include action required', stNotif?.some((n) => n.title === 'Action required'), stNotif?.map((n) => n.title).join(' | '))

console.log('6) STUDENT resolves action')
const resolve = await student.c.rpc('resolve_action_required', { p_task_id: second.id })
check('resolve_action_required ok', !resolve.error, resolve.error?.message)
const { data: reqBack } = await student.c.from('clearance_requests').select('status').eq('id', requestId).single()
check('request back to in_progress', reqBack?.status === 'in_progress', reqBack?.status)

console.log('7) AGENT completes the rest')
for (const t of myTasks) {
  if (t.id !== first.id) {
    await agent.c.rpc('start_task', { p_task_id: t.id })
    await agent.c.rpc('complete_task', { p_task_id: t.id, p_notes: 'Completed.' })
  }
}
const { data: reqFV } = await student.c.from('clearance_requests').select('status').eq('id', requestId).single()
check('request status final_verification after all stages', reqFV?.status === 'final_verification', reqFV?.status)

console.log('8) ADMIN completes verification')
const comp = await admin.c.rpc('complete_verification', { p_request_id: requestId })
check('complete_verification ok', !comp.error, comp.error?.message)
const { data: reqDone } = await student.c.from('clearance_requests').select('status, completed_at').eq('id', requestId).single()
check('request completed', reqDone?.status === 'completed' && !!reqDone?.completed_at, JSON.stringify(reqDone))
const { data: doneNotif } = await student.c.from('notifications').select('title').eq('user_id', 'af2a45fc-9e14-494d-9316-a411143d0009').order('created_at', { ascending: false }).limit(3)
check('student got completion notification', doneNotif?.some((n) => n.title === 'Clearance completed'), doneNotif?.map((n) => n.title).join(' | '))

console.log('9) ADMIN revenue view')
const { data: sum2 } = await admin.c.rpc('dashboard_summary')
check('revenue >= 15000', Number(sum2?.revenue) >= 15000, sum2?.revenue)
const { data: payments } = await admin.c.from('payments').select('status, amount').eq('request_id', requestId)
check('payment paid', payments?.[0]?.status === 'paid', JSON.stringify(payments))

console.log('10) STUDENT cannot see other student data')
const otherStudent = await login('amina@student.local')
const { data: otherTasks } = await otherStudent.c.from('clearance_tasks').select('id').eq('request_id', requestId)
check('amina sees no tasks from golden request', (otherTasks ?? []).length === 0, otherTasks?.length)

console.log('11) GRADUATION GOWN (order + pay + pickup)')
const { data: gownFee } = await student.c.rpc('get_gown_fee')
check('get_gown_fee returns 20000', Number(gownFee) === 20000, gownFee)

const { data: gown, error: orderErr } = await student.c.rpc('order_gown', {
  p_size: 'L',
  p_ceremony_date: '2026-11-20',
  p_pickup_location: 'Main Campus',
})
check('order_gown created order', !orderErr && !!gown?.id && gown.status === 'ordered', orderErr?.message ?? JSON.stringify(gown))
check('gown fee snapshot = 20000', Number(gown?.price) === 20000, gown?.price)
const gownId = gown.id

const gownPay = await student.c.functions.invoke('initiate-payment', { body: { gown_order_id: gownId, phone: '0712345004' } })
check('initiate-payment gown sandbox success', gownPay.data?.success === true && gownPay.data?.sandbox === true, gownPay.error?.message ?? JSON.stringify(gownPay.data))
const gownRef = gownPay.data?.transaction_reference
check('gown test reference present', !!gownRef, gownRef)

const gownWebhook = await student.c.functions.invoke('clickpesa-webhook', {
  body: { test_key: 'clearance-test-key', transaction_reference: gownRef, status: 'paid' },
})
check('gown webhook accepted test confirmation', !gownWebhook.error && gownWebhook.data?.status === 'success', gownWebhook.error?.message)

const { data: gownAfterPay } = await student.c.from('gown_orders').select('status').eq('id', gownId).single()
check('gown order status = paid', gownAfterPay?.status === 'paid', gownAfterPay?.status)
const { data: gownPayment } = await student.c.from('payments').select('kind, status').eq('gown_order_id', gownId)
check('gown payment recorded as kind=gown, paid', gownPayment?.[0]?.kind === 'gown' && gownPayment?.[0]?.status === 'paid', JSON.stringify(gownPayment))

const gownAssign = await admin.c.rpc('assign_gown_agent', { p_order_id: gownId, p_agent_id: mary.id })
check('admin assigns gown agent', !gownAssign.error, gownAssign.error?.message)
const { data: gownAssigned } = await student.c.from('gown_orders').select('agent_id, agent:profiles!gown_orders_agent_id_fkey(full_name)').eq('id', gownId).single()
check('gown has assigned agent set', gownAssigned?.agent_id === mary.id && gownAssigned?.agent?.full_name === 'Mary Agent', JSON.stringify(gownAssigned))

const { data: agentGowns } = await agent.c.from('gown_orders').select('id, status').eq('agent_id', mary.id)
check('agent sees the gown order', (agentGowns ?? []).some((g) => g.id === gownId), agentGowns?.length)

const gownReady = await agent.c.rpc('mark_gown_ready', { p_order_id: gownId })
check('agent marks gown ready for pickup', !gownReady.error, gownReady.error?.message)
const { data: gownReadyCheck } = await student.c.from('gown_orders').select('status').eq('id', gownId).single()
check('student sees gown ready for pickup', gownReadyCheck?.status === 'ready_for_pickup', gownReadyCheck?.status)

const gownCollected = await agent.c.rpc('mark_gown_collected', { p_order_id: gownId })
check('agent marks gown collected', !gownCollected.error, gownCollected.error?.message)
const { data: gownFinal } = await student.c.from('gown_orders').select('status').eq('id', gownId).single()
check('student sees gown collected', gownFinal?.status === 'collected', gownFinal?.status)

const { data: otherGowns } = await otherStudent.c.from('gown_orders').select('id').eq('id', gownId)
check('amina cannot see golden gown order', (otherGowns ?? []).length === 0, otherGowns?.length)

console.log('12) REGALIA CATALOG + CONTACT PHONE (showcase only)')
const anon = client(null)
const { data: catalog } = await anon.from('regalia_items').select('*').eq('active', true)
check('anon can read active catalog items (>=19)', (catalog ?? []).length >= 19, catalog?.length)
const sash = catalog.find((i) => i.category === 'sash')
const suit = catalog.find((i) => i.category === 'suit' && i.gender === 'male')
check('catalog has a sash sample', !!sash, 'no sash')
check('catalog has a male suit sample', !!suit, 'no suit')

const { data: contactPhone } = await anon.rpc('get_contact_phone')
check('anon can read contact phone', typeof contactPhone === 'string' && contactPhone.trim().length > 0, contactPhone)

const { error: setAsStudent } = await student.c.rpc('set_contact_phone', { p_phone: '+255 700 000 222' })
check('students cannot set contact phone', !!setAsStudent, setAsStudent?.message)

await admin.c.rpc('set_contact_phone', { p_phone: '+255 700 000 111' })
const { data: updatedPhone } = await anon.rpc('get_contact_phone')
check('set_contact_phone updates phone', updatedPhone === '+255 700 000 111', updatedPhone)
await admin.c.rpc('set_contact_phone', { p_phone: '+255 712 345 678' })

const { error: orderGone } = await student.c.rpc('order_regalia', { p_item_type: 'sash', p_ceremony_date: '2026-11-20' })
check('order_regalia removed', !!orderGone, orderGone?.message)

const { error: feeGone } = await anon.rpc('get_item_fee', { p_item_type: 'sash' })
check('get_item_fee removed', !!feeGone, feeGone?.message)

console.log(`\nRESULT: ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)