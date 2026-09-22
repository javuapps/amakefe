// lenco-collect — takes a supporter's mobile money payment.
//
// Named for the provider and for Lenco's own word for it: a collection, at
// /collections/mobile-money. All three payment functions are named this way,
// because all three speak Lenco's API directly and a second provider would get
// its own set rather than a branch inside these.
//
// Adapted from ginni's Lenco adapter. The rails are the same three Zambian
// networks, and every rule below is there because ginni learned it from a real
// refusal.
//
// The row is written BEFORE the money moves. A collection the provider accepted
// but we never recorded is money that arrived with nothing to attach it to, and
// the reconciler needs a row to ask about.
//
// The amount is never taken from the client's word for what it costs. The
// client sends what the supporter chose; the commission and the net are worked
// out here, in the database's own function, so the figure on the ledger cannot
// be argued with by whoever called this. The one thing that can differ from the
// ledger is what Lenco is *asked* for — see PAYMENT_TEST_AMOUNT_ZMW below.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const LENCO_BASE_URL = Deno.env.get('LENCO_BASE_URL') ?? 'https://api.lenco.co/access/v2'
const LENCO_API_KEY = Deno.env.get('LENCO_API_KEY') ?? ''

const PUBLIC_URL = Deno.env.get('SUPABASE_URL') ?? ''

/**
 * Replaces the amount sent to Lenco, in **kwacha**, so the live integration can
 * be exercised against real credentials without moving real money. Adapted from
 * ginni's `PAYMENT_TEST_AMOUNT_ZMW`, same name and same units.
 *
 * It changes ONLY what the provider is asked to collect. The ledger row, the
 * commission and the net all keep the real amount, so while this is set the
 * books say one thing and the bank says another — which is the point during a
 * test and a disaster once there are supporters.
 *
 * Zero, negative, or unset means off, which is the only value a live deployment
 * has. `Number(undefined)` is NaN and NaN > 0 is false, so a typo is off too: a
 * setting that fails open to collecting K1 would be the worst possible failure
 * of this feature.
 */
const TEST_AMOUNT_ZMW = Number(Deno.env.get('PAYMENT_TEST_AMOUNT_ZMW') ?? '0')

/** What a supporter may give, in ngwee. Below the floor is a fee, not support. */
const MIN_MINOR = 500
const MAX_MINOR = 10_000_00

/** A prompt nobody answers is not pending forever. */
const EXPIRES_AFTER_MINUTES = 15

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
  console.log(`[lenco-collect:${step}] ${JSON.stringify(payload)}`)

// The same rules as packages/core/src/support.ts, which the reader uses to tell
// a supporter what is wrong before they submit. These two must move together —
// an Edge Function cannot import the workspace package, and the client's
// validation is a courtesy while this one is the one that counts.
const digitsOf = (phone: string) => phone.replace(/\D/g, '')

function internationalPhone(phone: string): string {
  const digits = digitsOf(phone)
  if (digits.startsWith('260')) return digits
  if (digits.startsWith('0')) return `260${digits.slice(1)}`
  if (digits.length === 9) return `260${digits}`
  return digits
}

function localPhone(phone: string): string {
  const digits = digitsOf(phone)
  if (digits.startsWith('260')) return `0${digits.slice(3)}`
  if (digits.startsWith('0')) return digits
  if (digits.length === 9) return `0${digits}`
  return digits
}

function operatorForPhone(phone: string): string | null {
  // Deliberately identical in shape to core's: the local form, first three
  // digits. Written any other way — off the international form, with different
  // offsets — it is one slice index away from silently matching nothing, which
  // is how this copy was wrong the first time it was written.
  const local = localPhone(phone)
  if (local.length < 3) return null
  switch (local.slice(0, 3)) {
    case '096':
    case '076':
      return 'mtn'
    case '097':
    case '077':
      return 'airtel'
    case '095':
    case '075':
      return 'zamtel'
    default:
      return null
  }
}

/** What Lenco is asked for, which is not always what the supporter is giving. */
function amountForProvider(reference: string, amountMinor: number): number {
  if (!(TEST_AMOUNT_ZMW > 0)) return amountMinor

  // Said on every collection, not once at deploy: someone reading the logs to
  // find out why a K50 contribution banked K1 should meet this on the line for
  // that payment, not have to know it was configured weeks ago.
  log('TEST-AMOUNT-ACTIVE', {
    reference,
    realAmountMinor: amountMinor,
    collectingZmw: TEST_AMOUNT_ZMW,
    note: 'the ledger keeps the real amount; only the provider request is replaced',
  })
  return Math.round(TEST_AMOUNT_ZMW * 100)
}

const NETWORK_NAME: Record<string, string> = {
  mtn: 'MTN MoMo',
  airtel: 'Airtel Money',
  zamtel: 'Zamtel Kwacha',
}

/**
 * The places the ask appears, kept in step with `public.sup_placement` and
 * with SUPPORT_PLACEMENTS in packages/core by hand — an Edge Function cannot
 * import the workspace package, which is why the phone helpers above are
 * copied too. The three move together.
 *
 * Anything unrecognised is recorded as null rather than refused. This column
 * says where a button was; a label an old cached client got wrong must never
 * be the reason a payment does not happen.
 */
const PLACEMENTS = new Set([
  'support_screen',
  'home_card',
  'profile_row',
  'story_end',
  'community_post',
  'stories_rail',
  'community_rail',
])

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  // A supporter may be signed in or not — giving has never required an account.
  // When they are, the payment is attached to them so it shows on their profile.
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '')
  let userId: string | null = null
  if (jwt && jwt !== SERVICE_ROLE_KEY) {
    const { data: auth } = await supabase.auth.getUser(jwt)
    userId = auth?.user?.id ?? null
  }

  const body = await req.json().catch(() => ({}))
  const amountMinor = Number(body?.amountMinor)
  const operator: string = String(body?.operator ?? '')
  const phone: string = String(body?.phone ?? '')
  const payerName: string | null = body?.name ? String(body.name) : null
  const placementSent = String(body?.placement ?? '')
  const placement = PLACEMENTS.has(placementSent) ? placementSent : null

  if (!Number.isInteger(amountMinor) || amountMinor < MIN_MINOR || amountMinor > MAX_MINOR) {
    return json({ error: 'That amount cannot be taken.' }, 400)
  }
  if (!NETWORK_NAME[operator]) {
    return json({ error: 'Choose a mobile money network.' }, 400)
  }

  const msisdn = internationalPhone(phone)
  if (msisdn.length !== 12) {
    return json({ error: `${phone.trim()} does not look like a Zambian mobile number.` }, 400)
  }

  // Someone who picks MTN and types an Airtel number would otherwise get an
  // opaque refusal from the provider. Here it can be a sentence on a screen.
  const detected = operatorForPhone(msisdn)
  if (detected && detected !== operator) {
    return json(
      {
        error: `${localPhone(msisdn)} is on ${NETWORK_NAME[detected]}, not ${NETWORK_NAME[operator]}.`,
      },
      400,
    )
  }

  if (!LENCO_API_KEY) {
    return json({ error: 'Payments are not configured yet.' }, 503)
  }

  // Ours, generated before the money moves, so the payment is traceable from
  // either end even if the provider never hears of it.
  const reference = `SUP-${crypto.randomUUID().replaceAll('-', '').slice(0, 18).toUpperCase()}`

  const { data: commission, error: commissionError } = await supabase.rpc('sup_commission_minor', {
    p_amount_minor: amountMinor,
    p_rate_bps: 2000,
  })
  if (commissionError) {
    return json({ error: commissionError.message }, 500)
  }

  const { data: row, error: insertError } = await supabase
    .from('sup_transactions')
    .insert({
      user_id: userId,
      amount_minor: amountMinor,
      commission_rate_bps: 2000,
      commission_minor: commission,
      provider: 'lenco',
      operator,
      payer_mobile: msisdn,
      payer_name: payerName,
      placement,
      internal_reference: reference,
      status: 'pending',
      expires_at: new Date(Date.now() + EXPIRES_AFTER_MINUTES * 60_000).toISOString(),
    })
    .select('id')
    .single()
  if (insertError) {
    return json({ error: insertError.message }, 500)
  }

  try {
    const response = await fetch(`${LENCO_BASE_URL}/collections/mobile-money`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LENCO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reference,
        operator,
        // Major units, which is the one place the amount leaves our vocabulary.
        // Built from the integer rather than a float: money that goes through
        // binary floating point comes back wrong eventually.
        amount: Number((amountForProvider(reference, amountMinor) / 100).toFixed(2)),
        phone: msisdn,
        callbackUrl: `${PUBLIC_URL}/functions/v1/lenco-webhook`,
      }),
    })
    const result = await response.json()

    if (!response.ok || result?.status === false) {
      const reason = result?.message ?? `The payment service returned ${response.status}`
      await supabase
        .from('sup_transactions')
        .update({ status: 'failed', raw_provider_json: result, completed_at: new Date().toISOString() })
        .eq('id', row.id)
      log('refused', { reference, reason })
      return json({ error: reason }, 502)
    }

    await supabase
      .from('sup_transactions')
      .update({
        provider_reference: result?.data?.lencoReference ?? result?.data?.reference ?? reference,
        raw_provider_json: result,
      })
      .eq('id', row.id)

    log('started', { reference, operator })
    // Nothing is settled yet: the handset has been prompted and the webhook or
    // the reconciler will say what happened.
    return json({ reference, status: 'pending' })
  } catch (error) {
    const reason = (error as Error).message
    await supabase
      .from('sup_transactions')
      .update({ status: 'failed', raw_provider_json: { error: reason } })
      .eq('id', row.id)
    log('threw', { reference, reason })
    return json({ error: 'That did not reach the payment service.' }, 502)
  }
})
