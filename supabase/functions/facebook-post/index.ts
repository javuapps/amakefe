// facebook-post — sends the planned Facebook posts that are due.
//
// This is the part that does *not* come from twig. twig posts video Reels, a
// three-step start/upload/finish against `/{page-id}/video_reels`.
//
// What goes out here is the story's own picture with the text as its caption:
// `POST /{page-id}/photos` with `url` and `caption`. A link post would have been
// simpler, but its card is whatever Facebook's crawler scrapes from the link —
// which is nothing at all until the reader is deployed somewhere the crawler can
// reach. A photo carries the image regardless. With no image it falls back to
// `/{page-id}/feed`.
//
// Called with no body it drains the queue — that is the cron path, for parts
// scheduled to go out later. Called with `{ publicationId }` it sends that one
// and waits, which is what pressing Publish does: a refusal from Facebook is
// something the writer should see while she can still act on it.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const GRAPH_VERSION = Deno.env.get('META_GRAPH_VERSION') ?? 'v23.0'

/**
 * The caller's role, read from the JWT the gateway has already verified.
 *
 * This deliberately does not string-compare the bearer token against
 * SUPABASE_SERVICE_ROLE_KEY. That comparison assumes the scheduler holds a
 * byte-identical copy of whatever the platform injects here, and it silently
 * stopped being true — the cron sent a valid service_role key from Vault and
 * was answered 401, which would have failed every scheduled post while the
 * Publish button kept working.
 *
 * Reading the claim is safe because `verify_jwt` is on for this function: the
 * gateway rejects any token this project did not sign before we ever run, so a
 * payload that arrives here has had its signature checked.
 */
function roleOf(jwt: string): string | null {
  try {
    const payload = jwt.split('.')[1]
    if (!payload) return null
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/')
    const json = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
    return (JSON.parse(json).role as string) ?? null
  } catch {
    return null
  }
}

const log = (step: string, payload: Record<string, unknown> = {}) =>
  console.log(`[facebook-post:${step}] ${JSON.stringify(payload)}`)

const logErr = (step: string, payload: Record<string, unknown> = {}) =>
  console.error(`[facebook-post:${step}:error] ${JSON.stringify(payload)}`)

// The studio calls this from the browser, which means a cross-origin preflight
// before every request. Without an answer to the OPTIONS the call fails before
// it arrives, and the caller sees a network error with nothing in the logs.
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

type Payload = {
  message?: string
  link?: string
  /** A public https URL, not a storage path — Facebook fetches it itself. */
  imageUrl?: string
  mode?: 'snippet' | 'full'
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const body = await req.json().catch(() => ({}))
  const publicationId: string | undefined = body?.publicationId

  // The scheduler calls as `service_role` and has no user behind it. Anyone
  // else is a person, and a person must be editorial.
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '')
  if (jwt && roleOf(jwt) !== 'service_role') {
    const { data: auth } = await supabase.auth.getUser(jwt)
    if (!auth?.user) return json({ error: 'Unauthorized' }, 401)
    const { data: roles } = await supabase
      .from('usr_roles')
      .select('role')
      .eq('user_id', auth.user.id)
    const editorial = (roles ?? []).some((row) =>
      ['creator', 'editor', 'admin', 'super_admin'].includes(row.role as string),
    )
    if (!editorial) return json({ error: 'Not permitted' }, 403)
  }

  const { data: connection } = await supabase
    .from('cnt_facebook_connection')
    .select('page_id, access_token')
    .eq('is_active', true)
    .maybeSingle()

  if (!connection) {
    logErr('not_connected', {})
    return json({ error: 'No Facebook Page is connected.' }, 409)
  }

  // One row by id, or everything whose part has gone live. The queue gate is
  // `cnt_facebook_due()`, which reads the part's own published_at rather than a
  // copy of it on the publication — see 20260921180000.
  let due: { id: string; payload: unknown }[] | null = null

  if (publicationId) {
    const { data, error } = await supabase
      .from('cnt_publications')
      .select('id, payload')
      .eq('id', publicationId)
      .eq('channel', 'facebook')
      .eq('status', 'planned')
      .limit(1)
    if (error) {
      logErr('query_failed', { message: error.message })
      return json({ error: error.message }, 500)
    }
    due = data
  } else {
    const { data, error } = await supabase.rpc('cnt_facebook_due')
    if (error) {
      logErr('query_failed', { message: error.message })
      return json({ error: error.message }, 500)
    }
    due = data
  }

  log('due', { count: due?.length ?? 0, single: !!publicationId })

  let sent = 0
  let failed = 0
  // Facebook's own words travel back to the caller: "Malformed access token" is
  // something the creator can act on, "it failed" is not.
  const reasons: string[] = []

  for (const publication of due ?? []) {
    const payload = (publication.payload ?? {}) as Payload
    const message = (payload.message ?? '').trim()
    const link = payload.link

    if (!message || !link) {
      const reason = 'The frozen post has no message or no link.'
      await fail(supabase, publication.id, reason)
      reasons.push(reason)
      failed++
      continue
    }

    try {
      // A photo post carries the part's own picture. The alternative — a link
      // post whose card Facebook scrapes from the link — renders nothing at all
      // until the reader is deployed somewhere Facebook's crawler can reach.
      const asPhoto = Boolean(payload.imageUrl)
      const form = asPhoto
        ? new URLSearchParams({
            url: payload.imageUrl!,
            caption: message,
            access_token: connection.access_token,
          })
        : new URLSearchParams({ message, link, access_token: connection.access_token })

      const endpoint = asPhoto ? 'photos' : 'feed'
      const res = await fetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/${connection.page_id}/${endpoint}`,
        { method: 'POST', body: form },
      )
      const data = await res.json()

      if (!res.ok || data.error) {
        const reason = data?.error?.message ?? `Facebook returned ${res.status}`
        logErr('post_failed', { publication_id: publication.id, reason })
        await fail(supabase, publication.id, reason)
        // A token Meta has stopped honouring is worth recording against the
        // connection, so the studio can say "reconnect" rather than repeating
        // the same failure on every future post.
        if (data?.error?.code === 190) {
          await supabase
            .from('cnt_facebook_connection')
            .update({ is_active: false, last_error: reason })
            .eq('page_id', connection.page_id)
        }
        reasons.push(reason)
        failed++
        continue
      }

      // A feed post answers with `<page-id>_<post-id>`, which is its permalink
      // path. A photo answers with the photo's own id and the post id beside
      // it; the post is the thing worth linking to.
      const externalId = (data.post_id ?? data.id) as string
      await supabase
        .from('cnt_publications')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          external_id: externalId,
          external_url: `https://www.facebook.com/${externalId}`,
          error: null,
        })
        .eq('id', publication.id)

      log('posted', { publication_id: publication.id, external_id: externalId })
      sent++
    } catch (err) {
      const reason = (err as Error).message
      logErr('threw', { publication_id: publication.id, reason })
      await fail(supabase, publication.id, reason)
      reasons.push(reason)
      failed++
    }
  }

  if (sent > 0) {
    await supabase
      .from('cnt_facebook_connection')
      .update({ last_validated_at: new Date().toISOString(), last_error: null })
      .eq('page_id', connection.page_id)
  }

  return json({ sent, failed, considered: due?.length ?? 0, reasons })
})

/**
 * A failure is recorded, not retried in place: the row stays `failed` with the
 * reason on it, so the studio can show what Facebook actually said instead of
 * the post quietly disappearing.
 */
async function fail(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  publicationId: string,
  reason: string,
) {
  await supabase
    .from('cnt_publications')
    .update({ status: 'failed', error: reason })
    .eq('id', publicationId)
}
