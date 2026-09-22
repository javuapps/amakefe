// lenco-reconcile — asks Lenco about payments that went quiet.
//
// A webhook that never arrives is the normal case, not the exceptional one:
// a handset runs out of battery mid-PIN, a callback is lost, a network has a
// bad minute. Without this, those payments sit pending forever — the supporter
// was charged and she is never credited.
//
// It races the webhook by design. `sup_settle_collection` only moves a payment
// out of `pending`, so whichever learns the outcome first wins and the other is
// a no-op.
//
// Two jobs, in order:
//   1. expire the prompts nobody answered, so the list cannot grow forever
//   2. ask about the rest

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const LENCO_BASE_URL = Deno.env.get('LENCO_BASE_URL') ?? 'https://api.lenco.co/access/v2'
const LENCO_API_KEY = Deno.env.get('LENCO_API_KEY') ?? ''

/** Enough to clear a backlog, few enough that one run cannot stall. */
const BATCH = 25

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

const log = (step: string, payload: Record<string, unknown> = {}) =>
  console.log(`[lenco-reconcile:${step}] ${JSON.stringify(payload)}`)

function roleOf(jwt: string): string | null {
  try {
    const payload = jwt.split('.')[1]
    if (!payload) return null
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))).role ?? null
  } catch {
    return null
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  // The scheduler calls as service_role. A person doing it by hand must be an
  // operator — the role claim is read from a token the gateway has already
  // verified, never string-compared against an injected key.
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '')
  if (jwt && roleOf(jwt) !== 'service_role') {
    const { data: auth } = await supabase.auth.getUser(jwt)
    if (!auth?.user) return json({ error: 'Unauthorized' }, 401)
    const { data: roles } = await supabase
      .from('usr_roles')
      .select('role')
      .eq('user_id', auth.user.id)
    const operator = (roles ?? []).some((row) =>
      ['finance', 'super_admin'].includes(row.role as string),
    )
    if (!operator) return json({ error: 'Not permitted' }, 403)
  }

  // A prompt nobody answered is not pending forever.
  const { data: expired } = await supabase
    .from('sup_transactions')
    .update({ status: 'failed', completed_at: new Date().toISOString() })
    .eq('status', 'pending')
    .lt('expires_at', new Date().toISOString())
    .select('internal_reference')

  if (!LENCO_API_KEY) {
    return json({ expired: expired?.length ?? 0, asked: 0, settled: 0, note: 'no provider key' })
  }

  const { data: inflight, error } = await supabase
    .from('sup_transactions')
    .select('internal_reference')
    .eq('status', 'pending')
    .not('internal_reference', 'is', null)
    .order('created_at', { ascending: true })
    .limit(BATCH)
  if (error) return json({ error: error.message }, 500)

  let settled = 0
  const reasons: string[] = []

  for (const row of inflight ?? []) {
    const reference = row.internal_reference as string
    try {
      const response = await fetch(`${LENCO_BASE_URL}/collections/status/${reference}`, {
        headers: { Authorization: `Bearer ${LENCO_API_KEY}` },
      })
      const result = await response.json()
      if (!response.ok || result?.status === false) {
        reasons.push(result?.message ?? `status ${response.status}`)
        continue
      }

      const status = String(result?.data?.status ?? '').toLowerCase()
      // Anything else is still in flight; leave it for the next run rather than
      // settling on an intermediate state.
      if (status !== 'successful' && status !== 'failed') continue

      const { data: changed } = await supabase.rpc('sup_settle_collection', {
        p_reference: reference,
        p_successful: status === 'successful',
        p_provider_reference: result?.data?.lencoReference ?? reference,
        p_raw: result,
      })
      if (changed) settled++
    } catch (cause) {
      reasons.push((cause as Error).message)
    }
  }

  log('done', { expired: expired?.length ?? 0, asked: inflight?.length ?? 0, settled })
  return json({ expired: expired?.length ?? 0, asked: inflight?.length ?? 0, settled, reasons })
})
