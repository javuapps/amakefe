import { useEffect } from 'react'
import { Link } from 'react-router'
import { formatDate } from '@amakefe/core'
import { Async } from '../shell'
import { useFacebookPostStats } from '../../hooks/queries'

/**
 * How the post is doing on Facebook.
 *
 * The same half-height sheet as the composer, because it is the other half of
 * the same subject: one decides what goes out, this one says what happened to
 * it. The numbers come from Graph on open rather than from a column, since they
 * change all day and a stored copy would only ever be out of date.
 */
export function FacebookStatsDrawer({
  publicationId,
  pageName,
  onClose,
}: {
  publicationId: string
  pageName: string | null
  onClose: () => void
}) {
  const stats = useFacebookPostStats(publicationId)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="drawer-scrim fixed inset-0 z-[55] flex justify-end bg-ink/60"
      role="dialog"
      aria-modal="true"
      aria-label="How the Facebook post is doing"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="drawer-panel flex h-full w-full md:w-1/2 flex-col border-l border-line-card bg-surface shadow-xl">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-line-soft px-6 py-4">
          <div className="min-w-0">
            <h2 className="font-display text-[19px] text-ink">On Facebook</h2>
            <p className="mt-0.5 text-xs text-muted">
              {pageName ? `Posted to ${pageName}.` : 'Posted.'} Numbers come from Facebook now.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-xs text-muted hover:text-ink"
          >
            Close
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <Async
            query={stats}
            loading={<div className="h-28 animate-pulse rounded-lg bg-surface-tint" />}
          >
            {(data) => (
              <div className="flex flex-col gap-5">
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Figure label="Reactions" value={data.reactions} />
                  <Figure label="Comments" value={data.comments} />
                  <Figure label="Shares" value={data.shares} />
                  <Figure label="Reach" value={data.impressions} />
                  <Figure label="Engaged" value={data.engaged} />
                </dl>

                {data.engagementError && (
                  <p className="rounded-lg border border-gold bg-surface-warm px-3 py-2 text-xs text-body">
                    Reactions and comments could not be read. This Page was connected before the
                    app could ask for them, and a token keeps the permissions it was given — so
                    reconnect the Page on{' '}
                    <Link to="/settings" className="text-accent">
                      Settings
                    </Link>{' '}
                    to start counting them. Facebook said: {data.engagementError}
                  </p>
                )}

                {!data.engagementError && (data.impressions === null || data.engaged === null) && (
                  <p className="text-xs text-muted">
                    Facebook has no reach figures for this post yet. They appear once it has been
                    seen a few times.
                  </p>
                )}

                {data.createdTime && (
                  <p className="text-xs text-muted">
                    Went out on {formatDate(new Date(data.createdTime))}.
                  </p>
                )}

                {data.message && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted">What the post says</span>
                    <div className="prose-story max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg border border-line-card bg-surface-warm px-3 py-2 text-[14px]">
                      {data.message}
                    </div>
                  </div>
                )}

                {data.permalinkUrl && (
                  <a
                    href={data.permalinkUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="self-start text-xs text-accent"
                  >
                    Open the post on Facebook &rarr;
                  </a>
                )}
              </div>
            )}
          </Async>
        </div>
      </div>
    </div>
  )
}

function Figure({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-lg border border-line-card bg-surface-warm px-3 py-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 font-display text-[22px] text-ink">
        {value === null ? <span className="text-muted">&mdash;</span> : value.toLocaleString('en-GB')}
      </dd>
    </div>
  )
}
