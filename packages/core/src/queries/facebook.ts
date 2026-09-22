import type { Db } from '../supabase'

/**
 * The Facebook Page connection, as the studio is allowed to see it.
 *
 * The Page access token is deliberately absent from every type in this file.
 * It lives in `cnt_facebook_connection`, a table with row-level security on and
 * no policy at all, so no client role can read it — only the Edge Functions,
 * which hold the service-role key. What the studio needs is the Page's name and
 * whether it still works, and that is all it gets.
 */
export type FacebookConnection = {
  pageId: string
  pageName: string
  pageAvatarUrl: string | null
  isActive: boolean
  connectedAt: Date
  lastValidatedAt: Date | null
  lastError: string | null
}

export async function fetchFacebookConnection(db: Db): Promise<FacebookConnection | null> {
  const { data, error } = await db.rpc('cnt_facebook_status')
  if (error) throw error
  const row = data?.[0]
  if (!row) return null
  return {
    pageId: row.page_id,
    pageName: row.page_name,
    pageAvatarUrl: row.page_avatar_url,
    isActive: row.is_active,
    connectedAt: new Date(row.connected_at),
    lastValidatedAt: row.last_validated_at ? new Date(row.last_validated_at) : null,
    lastError: row.last_error,
  }
}

export type PendingPage = { pageId: string; pageName: string; pageAvatarUrl: string | null }

/** The Pages offered after sign-in, by name. Their tokens never leave the server. */
export async function fetchPendingPages(db: Db, pendingId: string): Promise<PendingPage[]> {
  const { data, error } = await db.rpc('cnt_facebook_pending_pages', { p_pending_id: pendingId })
  if (error) throw error
  return (data ?? []).map((row) => ({
    pageId: row.page_id,
    pageName: row.page_name,
    pageAvatarUrl: row.page_avatar_url,
  }))
}

/**
 * Where Meta's sign-in starts.
 *
 * `state` carries the editor's access token, which is what lets the callback
 * prove a signed-in editor began this — Meta will send anyone to that URL with
 * a code otherwise.
 */
export function facebookAuthUrl(options: {
  appId: string
  supabaseUrl: string
  accessToken: string
  graphVersion?: string
}): string {
  const url = new URL(`https://www.facebook.com/${options.graphVersion ?? 'v23.0'}/dialog/oauth`)
  url.searchParams.set('client_id', options.appId)
  url.searchParams.set('redirect_uri', `${options.supabaseUrl}/functions/v1/facebook-oauth`)
  url.searchParams.set('state', options.accessToken)
  // pages_read_user_content is what lets the studio read back the reactions
  // and comments on its own posts: those are user-generated content, and
  // pages_read_engagement does not cover them. A token's scopes are frozen
  // when it is minted, so adding a permission in the Meta dashboard changes
  // nothing until the Page is connected again.
  url.searchParams.set(
    'scope',
    'pages_show_list,pages_manage_posts,pages_read_engagement,pages_read_user_content',
  )
  url.searchParams.set('response_type', 'code')
  return url.toString()
}

/** Finishes a connection when the account runs more than one Page. */
export async function connectFacebookPage(
  db: Db,
  pendingId: string,
  pageId: string,
): Promise<void> {
  const { error } = await db.functions.invoke('facebook-connect-page', {
    body: { pendingId, pageId },
  })
  if (error) throw error
}

export async function disconnectFacebook(db: Db): Promise<void> {
  const { error } = await db.rpc('cnt_facebook_disconnect')
  if (error) throw error
}

/**
 * Sends one planned post immediately.
 *
 * The same Edge Function drains the queue on a schedule; handing it a single id
 * is what "Post now" does, so there is one code path that talks to Graph rather
 * than a second one that drifts from it.
 */
export async function postPublicationNow(db: Db, publicationId: string): Promise<void> {
  const { data, error } = await db.functions.invoke<{
    sent: number
    failed: number
    considered: number
    reasons?: string[]
  }>('facebook-post', { body: { publicationId } })
  if (error) throw error
  if (!data) throw new Error('No answer from the sender.')

  if (data.failed > 0) {
    // Facebook's own words, not a paraphrase: "Malformed access token" tells
    // the creator to reconnect, where "it failed" tells her nothing.
    throw new Error(data.reasons?.[0] ?? 'Facebook refused the post.')
  }
  if (data.sent === 0) {
    throw new Error('That post was not waiting to be sent. Reload and try again.')
  }
}

/**
 * What a post has done since it went out.
 *
 * Fetched live from Graph rather than stored: these numbers change every hour,
 * and a copy in Postgres would only ever be a stale one nobody trusts.
 */
export type FacebookPostStats = {
  externalId: string
  permalinkUrl: string | null
  createdTime: string | null
  message: string | null
  /**
   * Null when the counts could not be read, not zero.
   *
   * Reactions and comments are other people's content on the post, so they
   * need `pages_read_user_content`. A token minted without it comes back
   * refused, and a post with no reactions is not the same thing as one we are
   * not allowed to count — showing 0 for the second would be a lie.
   */
  reactions: number | null
  comments: number | null
  shares: number
  /** Null when Meta has no insights for the post yet — a new post has none. */
  impressions: number | null
  engaged: number | null
  /** Facebook's own words when the counts were refused, for the studio to show. */
  engagementError: string | null
}

export async function fetchFacebookPostStats(
  db: Db,
  publicationId: string,
): Promise<FacebookPostStats> {
  const { data, error } = await db.functions.invoke<FacebookPostStats & { error?: string }>(
    'facebook-post-stats',
    { body: { publicationId } },
  )
  if (error) throw error
  if (!data) throw new Error('No answer from Facebook.')
  if (data.error) throw new Error(data.error)
  return data
}
