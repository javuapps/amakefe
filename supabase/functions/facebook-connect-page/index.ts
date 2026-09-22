// facebook-connect-page — finishes the connection when the account runs more
// than one Page and the creator has picked which one.
//
// Adapted from twig's oauth-finalize-meta. The studio only ever saw the Pages'
// names (through `cnt_facebook_pending_pages`); the token for the chosen one is
// read here, server-side, and the pending row is destroyed either way.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const SCOPES = [
  'pages_show_list',
  'pages_manage_posts',
  'pages_read_engagement',
  // Reading back the reactions and comments on our own posts.
  'pages_read_user_content',
]

const log = (step: string, payload: Record<string, unknown> = {}) =>
  console.log(`[facebook-connect-page:${step}] ${JSON.stringify(payload)}`)

const logErr = (step: string, payload: Record<string, unknown> = {}) =>
  console.error(`[facebook-connect-page:${step}:error] ${JSON.stringify(payload)}`)

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '')
  if (!jwt) return json({ error: 'Unauthorized' }, 401)

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const { data: auth, error: authError } = await supabase.auth.getUser(jwt)
  if (authError || !auth.user) return json({ error: 'Unauthorized' }, 401)

  const { data: roles } = await supabase
    .from('usr_roles')
    .select('role')
    .eq('user_id', auth.user.id)
  const editorial = (roles ?? []).some((row) =>
    ['creator', 'editor', 'admin', 'super_admin'].includes(row.role as string),
  )
  if (!editorial) {
    logErr('not_editorial', { user_id: auth.user.id })
    return json({ error: 'That account cannot connect a Page.' }, 403)
  }

  const { pendingId, pageId } = await req.json().catch(() => ({}))
  if (!pendingId || !pageId) return json({ error: 'pendingId and pageId are required' }, 400)

  const { data: pending, error } = await supabase
    .from('cnt_facebook_pending')
    .select('id, pages, expires_at')
    .eq('id', pendingId)
    .single()
  if (error || !pending) {
    logErr('pending_missing', { pending_id: pendingId })
    return json({ error: 'That Page list has expired. Connect again.' }, 410)
  }
  if (new Date(pending.expires_at) <= new Date()) {
    await supabase.from('cnt_facebook_pending').delete().eq('id', pendingId)
    return json({ error: 'That Page list has expired. Connect again.' }, 410)
  }

  type CachedPage = { id: string; name: string; access_token: string; picture_url: string | null }
  const page = (pending.pages as CachedPage[]).find((candidate) => candidate.id === pageId)
  if (!page) {
    logErr('page_not_in_list', { page_id: pageId })
    return json({ error: 'That Page was not among the ones offered.' }, 400)
  }

  try {
    await supabase.from('cnt_facebook_connection').delete().neq('id', crypto.randomUUID())
    const { error: insertError } = await supabase.from('cnt_facebook_connection').insert({
      page_id: page.id,
      page_name: page.name,
      page_avatar_url: page.picture_url,
      access_token: page.access_token,
      scopes: SCOPES,
      is_active: true,
      last_validated_at: new Date().toISOString(),
    })
    if (insertError) throw new Error(insertError.message)

    log('connected', { page_id: page.id, page_name: page.name })
    return json({ pageId: page.id, pageName: page.name })
  } finally {
    // The list holds a token for every Page the account runs. It does not
    // outlive the choice, whether or not the choice succeeded.
    await supabase.from('cnt_facebook_pending').delete().eq('id', pendingId)
  }
})
