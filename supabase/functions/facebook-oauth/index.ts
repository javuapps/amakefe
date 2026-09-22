// facebook-oauth — exchanges the code Meta hands back for a Page access token.
//
// Adapted from twig's oauth-callback. The shape of the exchange is the same —
// short-lived user token, trade it for a long-lived one, list the Pages — but
// this returns to a web studio rather than a mobile deep link, and there is one
// connection for the whole platform rather than one per creator.
//
// Logging follows twig's convention: a structured line per step, prefixed
// `[facebook-oauth:<step>]`, with tokens reduced to a length and a six-character
// prefix. A token in a log is a token that has leaked.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const META_AUTHOR_APP_ID = Deno.env.get('META_AUTHOR_APP_ID') ?? ''
const META_AUTHOR_APP_SECRET = Deno.env.get('META_AUTHOR_APP_SECRET') ?? ''
const STUDIO_URL = Deno.env.get('STUDIO_URL') ?? 'http://localhost:5174'
const GRAPH_VERSION = Deno.env.get('META_GRAPH_VERSION') ?? 'v23.0'

/** What the Page needs for the studio to post a link to it. Nothing more. */
const SCOPES = [
  'pages_show_list',
  'pages_manage_posts',
  'pages_read_engagement',
  // Reading back the reactions and comments on our own posts.
  'pages_read_user_content',
]

const log = (step: string, payload: Record<string, unknown> = {}) =>
  console.log(`[facebook-oauth:${step}] ${JSON.stringify(payload)}`)

const logErr = (step: string, payload: Record<string, unknown> = {}) =>
  console.error(`[facebook-oauth:${step}:error] ${JSON.stringify(payload)}`)

const redact = (token: string | null | undefined) =>
  token ? { length: token.length, prefix: token.slice(0, 6) } : null

function backToStudio(status: string, message: string, pendingId?: string): Response {
  const url = new URL('/settings', STUDIO_URL)
  url.searchParams.set('facebook', status)
  url.searchParams.set('message', message)
  if (pendingId) url.searchParams.set('pending', pendingId)
  log('redirect', { status, message_preview: message.slice(0, 80) })
  return Response.redirect(url.toString(), 302)
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url)
  log('request', { method: req.method, has_code: !!url.searchParams.get('code') })

  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 })

  const errorParam = url.searchParams.get('error')
  if (errorParam) {
    logErr('provider_denied', { error: errorParam })
    return backToStudio(
      'error',
      url.searchParams.get('error_description') || `Authorisation declined: ${errorParam}`,
    )
  }

  const code = url.searchParams.get('code')
  // `state` is the editor's JWT — the only thing tying this redirect back to a
  // signed-in person, since Meta will happily send anyone here with a code.
  const jwt = url.searchParams.get('state') ?? ''
  if (!code || !jwt) {
    logErr('missing_params', { has_code: !!code, jwt_len: jwt.length })
    return backToStudio('error', 'Missing required parameters.')
  }
  if (!META_AUTHOR_APP_ID || !META_AUTHOR_APP_SECRET) {
    logErr('missing_credentials', {})
    return backToStudio('error', 'Meta app credentials are not configured on the server.')
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  const { data: auth, error: authError } = await supabase.auth.getUser(jwt)
  if (authError || !auth.user) {
    logErr('auth_failed', { error: authError?.message })
    return backToStudio('error', 'That sign-in has expired. Sign in and try again.')
  }

  // Connecting the Page that 200,000 people follow is an editorial act, so it
  // is gated the same way publishing is rather than on merely being signed in.
  const { data: roles } = await supabase
    .from('usr_roles')
    .select('role')
    .eq('user_id', auth.user.id)
  const editorial = (roles ?? []).some((row) =>
    ['creator', 'editor', 'admin', 'super_admin'].includes(row.role as string),
  )
  if (!editorial) {
    logErr('not_editorial', { user_id: auth.user.id })
    return backToStudio('error', 'That account cannot connect a Page.')
  }
  log('user_resolved', { user_id: auth.user.id })

  try {
    const redirectUri = `${SUPABASE_URL}/functions/v1/facebook-oauth`

    // 1. The code buys a short-lived user token.
    const shortUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`)
    shortUrl.searchParams.set('client_id', META_AUTHOR_APP_ID)
    shortUrl.searchParams.set('client_secret', META_AUTHOR_APP_SECRET)
    shortUrl.searchParams.set('redirect_uri', redirectUri)
    shortUrl.searchParams.set('code', code)
    const shortRes = await fetch(shortUrl)
    const shortData = await shortRes.json()
    if (!shortRes.ok || shortData.error) {
      logErr('short_token_failed', { status: shortRes.status, body: shortData })
      throw new Error(shortData.error?.message ?? 'Facebook rejected the sign-in.')
    }
    log('short_token_ok', { token: redact(shortData.access_token) })

    // 2. Trade it for one that lasts about sixty days.
    const longUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`)
    longUrl.searchParams.set('grant_type', 'fb_exchange_token')
    longUrl.searchParams.set('client_id', META_AUTHOR_APP_ID)
    longUrl.searchParams.set('client_secret', META_AUTHOR_APP_SECRET)
    longUrl.searchParams.set('fb_exchange_token', shortData.access_token)
    const longRes = await fetch(longUrl)
    const longData = await longRes.json()
    if (!longRes.ok || longData.error) {
      logErr('long_token_failed', { status: longRes.status, body: longData })
      throw new Error(longData.error?.message ?? 'Facebook would not extend the sign-in.')
    }
    const userToken = longData.access_token as string
    log('long_token_ok', { token: redact(userToken), expires_in: longData.expires_in })

    // 3. Which Pages can this person post to?
    const pagesUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/me/accounts`)
    pagesUrl.searchParams.set('fields', 'id,name,access_token,picture{url}')
    pagesUrl.searchParams.set('access_token', userToken)
    const pagesRes = await fetch(pagesUrl)
    const pagesData = await pagesRes.json()
    if (!pagesRes.ok || pagesData.error) {
      logErr('pages_failed', { status: pagesRes.status, body: pagesData })
      throw new Error(pagesData.error?.message ?? 'Could not read your Pages.')
    }

    type Page = { id: string; name: string; access_token: string; picture?: { data?: { url?: string } } }
    const pages: Page[] = pagesData.data ?? []
    log('pages_fetched', { count: pages.length, names: pages.map((p) => p.name) })

    if (pages.length === 0) {
      return backToStudio(
        'error',
        'That account manages no Facebook Pages. Create one, or sign in with the account that runs the Page.',
      )
    }

    // More than one Page is the case worth being careful about: the wrong
    // choice posts a stranger's marriage to the wrong audience. So it is always
    // a deliberate pick rather than a best guess.
    if (pages.length > 1) {
      const { data: pending, error } = await supabase
        .from('cnt_facebook_pending')
        .insert({
          user_token: userToken,
          pages: pages.map((page) => ({
            id: page.id,
            name: page.name,
            access_token: page.access_token,
            picture_url: page.picture?.data?.url ?? null,
          })),
        })
        .select('id')
        .single()
      if (error || !pending) {
        logErr('pending_failed', { message: error?.message })
        throw new Error('Could not hold on to the Page list. Try again.')
      }
      log('pending_stashed', { pending_id: pending.id, count: pages.length })
      return backToStudio('choose', 'Choose the Page to publish to.', pending.id)
    }

    const page = pages[0]
    await connectPage(supabase, page.id, page.name, page.access_token, page.picture?.data?.url ?? null)
    log('connected', { page_id: page.id, page_name: page.name })
    return backToStudio('connected', `Connected to ${page.name}.`)
  } catch (err) {
    const message = (err as Error).message
    logErr('threw', { message })
    return backToStudio('error', message)
  }
})

/** One live connection: the previous Page is forgotten rather than left behind. */
export async function connectPage(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  pageId: string,
  pageName: string,
  pageToken: string,
  avatarUrl: string | null,
) {
  await supabase.from('cnt_facebook_connection').delete().neq('id', crypto.randomUUID())
  const { error } = await supabase.from('cnt_facebook_connection').insert({
    page_id: pageId,
    page_name: pageName,
    page_avatar_url: avatarUrl,
    access_token: pageToken,
    scopes: SCOPES,
    is_active: true,
    last_validated_at: new Date().toISOString(),
  })
  if (error) throw new Error(`Could not save the connection: ${error.message}`)
}
