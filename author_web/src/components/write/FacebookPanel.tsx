import { useState } from 'react'
import { Link } from 'react-router'
import { formatDate, partState, type StudioPart, type StudioStory } from '@amakefe/core'
import { Panel } from '../shell'
import { FacebookStatsDrawer } from './FacebookStatsDrawer'
import { useFacebookShare } from './useFacebookShare'
import { useFacebookConnection, useFacebookPostStats, usePublications } from '../../hooks/queries'

/**
 * The part's whole relationship with Facebook, in one card.
 *
 * Everything about the post lives here: whether it has gone, the button that
 * sends it, and how it has done since. Publishing the part is next door — a
 * part can be live without having been posted, and posted without being the
 * thing you came to change, so the two are not the same decision.
 *
 * What was here before — a teaser box, an Open Graph card builder and a preview
 * of a link post — went when the drawer took over composing. The teaser is now
 * written in the drawer itself and kept on the part; the card image was never
 * used by anything, because these go out as photo posts rather than link posts.
 */
export function FacebookPanel({
  story,
  part,
}: {
  story: StudioStory
  part: StudioPart
}) {
  const connection = useFacebookConnection()
  const publications = usePublications(story.id)
  const share = useFacebookShare(story, part)
  const [showDetails, setShowDetails] = useState(false)

  const post = (publications.data ?? []).find(
    (publication) => publication.partId === part.id && publication.channel === 'facebook',
  )
  const connected = connection.data?.isActive ?? false
  const live = partState(part) === 'live'

  return (
    <Panel title="Facebook">
      {!connected ? (
        <p className="text-xs text-muted">
          No Page connected —{' '}
          <Link to="/settings" className="text-accent">
            connect one
          </Link>
          .
        </p>
      ) : post?.status === 'sent' ? (
        <Posted
          publicationId={post.id}
          pageName={connection.data!.pageName}
          sentAt={post.sentAt}
          externalUrl={post.externalUrl}
          onDetails={() => setShowDetails(true)}
        />
      ) : post?.status === 'planned' ? (
        <p className="text-xs text-muted">
          Queued. It goes out with the part and needs nothing further from you.
        </p>
      ) : (
        <>
          <button
            type="button"
            disabled={!live || share.busy}
            onClick={() => share.open({ kind: 'share' })}
            className="w-full rounded-full bg-accent py-2.5 text-sm font-semibold text-[#fff6ea] disabled:opacity-40"
          >
            {post?.status === 'failed' ? 'Try Facebook again' : 'Post it to Facebook'}
          </button>
          <p className="mt-2 text-xs text-muted">
            {!live ? (
              <>Nothing goes out until this part is published.</>
            ) : post?.status === 'failed' ? (
              <span className="text-accent-deep">
                Facebook refused the last attempt. Nothing was posted.
              </span>
            ) : (
              <>Not posted to {connection.data!.pageName} yet.</>
            )}
          </p>
        </>
      )}

      {share.drawer}
      {showDetails && post && (
        <FacebookStatsDrawer
          publicationId={post.id}
          pageName={connection.data?.pageName ?? null}
          onClose={() => setShowDetails(false)}
        />
      )}
    </Panel>
  )
}

/**
 * A post that has gone out: the numbers at a glance, and the way to the rest.
 *
 * The figures come from Graph on open rather than from a column — they change
 * all day, and a stored copy would only ever be a stale one nobody trusts. A
 * refusal is shown quietly: the post itself is fine, it is only the count that
 * could not be fetched.
 */
function Posted({
  publicationId,
  pageName,
  sentAt,
  externalUrl,
  onDetails,
}: {
  publicationId: string
  pageName: string
  sentAt: Date | null
  externalUrl: string | null
  onDetails: () => void
}) {
  const stats = useFacebookPostStats(publicationId)

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted">
        Posted to <span className="font-semibold text-body">{pageName}</span>
        {sentAt ? ` on ${formatDate(sentAt)}` : ''}.
      </p>

      {stats.isPending ? (
        <div className="h-14 animate-pulse rounded-lg bg-surface-tint" />
      ) : stats.data ? (
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Figure label="Reactions" value={stats.data.reactions} />
          <Figure label="Comments" value={stats.data.comments} />
          <Figure label="Shares" value={stats.data.shares} />
          <Figure label="Reach" value={stats.data.impressions} />
        </dl>
      ) : (
        <p className="text-xs text-muted">
          The post is up; its numbers could not be fetched just now.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onDetails}
          className="rounded-full border border-line-strong px-4 py-1.5 text-xs font-semibold text-body"
        >
          Posting details
        </button>
        {externalUrl && (
          <a href={externalUrl} target="_blank" rel="noreferrer" className="text-xs text-accent">
            See it on Facebook →
          </a>
        )}
      </div>
    </div>
  )
}

function Figure({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-lg border border-line-card bg-surface-warm px-2 py-1.5 text-center">
      <dd className="font-display text-[18px] leading-none text-ink">
        {value === null ? <span className="text-muted">&mdash;</span> : value.toLocaleString('en-GB')}
      </dd>
      <dt className="mt-1 text-[10px] uppercase tracking-wider text-muted">{label}</dt>
    </div>
  )
}
