// facebook-post-stats — what a post has done since it went out.
//
// The studio cannot ask Graph directly: the Page token is readable only by the
// service role, and putting it in the browser would hand the whole Page to
// anyone with the publishable key. So the studio asks for a publication's id
// and gets numbers back, never a token.
//
// Read-only. It writes nothing except the connection's health when Meta says
// the token has stopped working, which is the same signal `facebook-post`
// records and for the same reason.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const GRAPH_VERSION = Deno.env.get('META_GRAPH_VERSION') ?? 'v23.0'

const logErr = (step: string, payload: Record<string, unknown> = {}) =>
  console.error(`[facebook-post-stats:${step}:error] ${JSON.stringify(payload)}`)

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

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  // Numbers about the Page are editorial business, so unlike the poster this
  // has no service-role path: a person asks, and that person must be editorial.
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '')
  if (!jwt) return json({ error: 'Unauthorized' }, 401)
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

  const { publicationId } = await req.json().catch(() => ({}))
  if (!publicationId) return json({ error: 'publicationId is required' }, 400)

  const { data: publication } = await supabase
    .from('cnt_publications')
    .select('id, external_id, external_url, sent_at, status')
    .eq('id', publicationId)
    .eq('channel', 'facebook')
    .maybeSingle()

  if (!publication?.external_id) {
    return json({ error: 'That post has not gone out yet.' }, 409)
  }

  const { data: connection } = await supabase
    .from('cnt_facebook_connection')
    .select('page_id, access_token')
    .eq('is_active', true)
    .maybeSingle()

  if (!connection) return json({ error: 'No Facebook Page is connected.' }, 409)

  const base = `https://graph.facebook.com/${GRAPH_VERSION}/${publication.external_id}`
  const token = connection.access_token

  // Three calls, deliberately separate, because they need different permissions
  // and Graph refuses a whole request when any one field is not allowed.
  //
  //   the post itself   pages_read_engagement
  //   reactions/comments pages_read_user_content — these are other people's
  //                      content on our post, which engagement does not cover
  //   insights          absent entirely until a post has been seen
  //
  // Asking for everything at once meant one missing permission returned `(#10)`
  // and the card showed nothing at all, when the date, the link and the share
  // count were all available. Each group now fails on its own.
  try {
    const res = await fetch(
      `${base}?fields=permalink_url,created_time,message,shares&access_token=${encodeURIComponent(token)}`,
    )
    const post = await res.json()

    if (!res.ok || post.error) {
      const reason = post?.error?.message ?? `Facebook returned ${res.status}`
      logErr('fetch_failed', { publication_id: publicationId, reason })
      if (post?.error?.code === 190) {
        await supabase
          .from('cnt_facebook_connection')
          .update({ is_active: false, last_error: reason })
          .eq('page_id', connection.page_id)
      }
      return json({ error: reason }, 502)
    }

    // Null rather than 0 when they cannot be read: a post with no reactions and
    // a post we are not allowed to count are not the same thing, and showing
    // "0" for the second would be a lie the creator might act on.
    let reactions: number | null = null
    let comments: number | null = null
    let engagementError: string | null = null
    try {
      const engagementRes = await fetch(
        `${base}?fields=reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0)` +
          `&access_token=${encodeURIComponent(token)}`,
      )
      const engagement = await engagementRes.json()
      if (engagementRes.ok && !engagement.error) {
        reactions = engagement.reactions?.summary?.total_count ?? 0
        comments = engagement.comments?.summary?.total_count ?? 0
      } else {
        engagementError = engagement?.error?.message ?? null
        logErr('engagement_refused', { publication_id: publicationId, reason: engagementError })
      }
    } catch {
      // Left null; the post's own details still go back.
    }

    let impressions: number | null = null
    let engaged: number | null = null
    try {
      const insightsRes = await fetch(
        `${base}/insights?metric=post_impressions,post_engaged_users&access_token=${encodeURIComponent(token)}`,
      )
      const insights = await insightsRes.json()
      if (insightsRes.ok && !insights.error) {
        for (const metric of insights.data ?? []) {
          const value = metric?.values?.[0]?.value ?? null
          if (metric.name === 'post_impressions') impressions = value
          if (metric.name === 'post_engaged_users') engaged = value
        }
      }
    } catch {
      // Insights are a bonus; the counts above are the point.
    }

    return json({
      externalId: publication.external_id,
      permalinkUrl: post.permalink_url ?? publication.external_url,
      createdTime: post.created_time ?? publication.sent_at,
      message: post.message ?? null,
      reactions,
      comments,
      shares: post.shares?.count ?? 0,
      impressions,
      engaged,
      engagementError,
    })
  } catch (err) {
    const reason = (err as Error).message
    logErr('threw', { publication_id: publicationId, reason })
    return json({ error: reason }, 500)
  }
})
