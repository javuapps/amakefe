// lenco-webhook — Lenco tells us what became of a collection.
//
// Named for the provider, as lenco-collect and lenco-reconcile are: all three
// speak Lenco's API directly, and a second provider would get its own set
// rather than a branch inside these.
//
// This one matters most, because its URL lives in Lenco's dashboard rather
// than in this repository. Renaming it later costs a window of callbacks that
// 404 while payments quietly stop settling.
//
// Ported from cora_bot's PaymentWebhookHandler, whose order of operations is
// the whole design:
//
//   1. read the raw bytes, capped
//   2. verify the signature against those exact bytes, before decoding
//   3. record the callback either way, verdict included
//   4. only then act on it
//
// Step 3 is why a rejected callback is stored rather than dropped. "A webhook
// arrived and was refused" and "no webhook ever arrived" look identical from
// every other screen and are very different problems, and a burst of
// rejections is what an attempt to forge settlements looks like.
//
// There is deliberately no path where an unconfigured secret means accept. The
// reference implementations return true when the secret is empty "for
// development", which in production is an endpoint that marks any payment
// settled for anyone who finds the URL. A payment callback is an instruction to
// bank money; unsigned, it is an instruction from nobody.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const WEBHOOK_SECRET = Deno.env.get('LENCO_WEBHOOK_SECRET') ?? ''

/** Callbacks are small; anything larger is a bug or an attempt to exhaust memory. */
const MAX_BODY_BYTES = 1 << 20

const SIGNATURE_HEADER = 'x-lenco-signature'

const log = (step: string, payload: Record<string, unknown> = {}) =>
  console.log(`[lenco-webhook:${step}] ${JSON.stringify(payload)}`)

/** HMAC-SHA256 over the exact bytes received, hex, compared in constant time. */
async function signatureValid(raw: Uint8Array, header: string | null): Promise<boolean> {
  if (!WEBHOOK_SECRET || !header) return false

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const expected = new Uint8Array(await crypto.subtle.sign('HMAC', key, raw))

  const got = hexToBytes(header.trim())
  if (!got || got.length !== expected.length) return false

  // Constant time, and on the decoded bytes rather than the strings, so a
  // difference in case or encoding is not mistaken for a difference in value.
  let difference = 0
  for (let i = 0; i < expected.length; i++) difference |= expected[i] ^ got[i]
  return difference === 0
}

function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0 || /[^0-9a-fA-F]/.test(hex)) return null
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16)
  return out
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const raw = new Uint8Array(await req.arrayBuffer())
  if (raw.byteLength > MAX_BODY_BYTES) {
    return new Response('Too large', { status: 413 })
  }
  const text = new TextDecoder().decode(raw)

  const valid = await signatureValid(raw, req.headers.get(SIGNATURE_HEADER))

  // Parsed regardless of the verdict, so a rejected callback is still stored
  // against the payment it claims to be about.
  let parsed: Record<string, unknown> | null = null
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = null
  }
  const data = (parsed?.data ?? {}) as Record<string, unknown>
  const reference = (data.reference ?? null) as string | null
  const event = (parsed?.event ?? null) as string | null

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  const { data: recorded } = await supabase
    .from('sup_webhook_events')
    .insert({
      provider: 'lenco',
      event,
      reference,
      signature_valid: valid,
      raw_body: text,
      headers: Object.fromEntries(req.headers),
    })
    .select('id')
    .single()

  if (!valid) {
    log('rejected', { reference, hint: 'confirm LENCO_WEBHOOK_SECRET matches the provider' })
    return new Response('Unauthorized', { status: 401 })
  }

  const finish = async (note: string) => {
    if (recorded?.id) {
      await supabase
        .from('sup_webhook_events')
        .update({ processed_at: new Date().toISOString(), process_error: note || null })
        .eq('id', recorded.id)
    }
  }

  if (!reference) {
    // Acknowledged, not retried: a callback with nothing to match will never
    // match however many times it is sent.
    await finish('callback carries no reference')
    return new Response('ok', { status: 200 })
  }

  const status = String(data.status ?? '').toLowerCase()
  if (status !== 'successful' && status !== 'failed') {
    // Still in flight. Acknowledge and wait for the outcome rather than
    // settling on an intermediate state.
    log('interim', { reference, status })
    await finish('')
    return new Response('ok', { status: 200 })
  }

  const { data: changed, error } = await supabase.rpc('sup_settle_collection', {
    p_reference: reference,
    p_successful: status === 'successful',
    p_provider_reference: (data.lencoReference ?? data.reference ?? null) as string | null,
    p_raw: parsed,
  })

  if (error) {
    log('settle_failed', { reference, message: error.message })
    await finish(error.message)
    // 500 so the provider retries: this one may well work next time.
    return new Response('error', { status: 500 })
  }

  // `changed` is false when the reconciler got there first, which is expected
  // rather than wrong — whichever learns the outcome first wins.
  log('settled', { reference, status, changed })
  await finish('')
  return new Response('ok', { status: 200 })
})
