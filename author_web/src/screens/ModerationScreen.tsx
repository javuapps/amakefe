import { formatRelative } from '@amakefe/core'
import { Async, Panel } from '../components/shell'
import { useModerate, useModerationQueue } from '../hooks/queries'

/**
 * Spec §65: automated screening, then a human. The screening half is not built,
 * so this is the human half on its own — every visible comment, reported ones
 * first. Hiding a comment resolves the reports against it; keeping it dismisses
 * them.
 */
export function ModerationScreen() {
  const queue = useModerationQueue()
  const moderate = useModerate()

  return (
    <Async query={queue}>
      {(items) =>
        items.length === 0 ? (
          <Panel>
            <p className="text-sm text-muted">
              Nothing to moderate. Comments appear here as readers post them.
            </p>
          </Panel>
        ) : (
          <div className="flex flex-col gap-4">
            {items.map((item) => (
              <Panel key={item.id}>
                <div className="flex items-start justify-between gap-6">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="flex size-8 items-center justify-center rounded-full bg-surface-warm font-display text-sm text-accent">
                        {item.authorName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-[13px] font-semibold text-ink">{item.authorName}</div>
                        <div className="text-[11px] text-muted">
                          {/* Which kind it is, because "hide" means a different
                              table for each and a moderator should know what
                              they are looking at. */}
                          {item.kind === 'story_comment' ? 'on the story' : 'under the post'}{' '}
                          <span className="text-body">{item.context}</span> ·{' '}
                          {formatRelative(item.createdAt)}
                        </div>
                      </div>
                    </div>
                    <p className="prose-story mt-3 text-[15px]">{item.body}</p>
                    {item.reportCount > 0 && (
                      <p className="mt-2 text-xs text-accent-deep">
                        Reported {item.reportCount}×: {item.reportReasons.join(' · ')}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      disabled={moderate.isPending}
                      onClick={() => moderate.mutate({ kind: item.kind, commentId: item.id, action: 'keep' })}
                      className="rounded-full border border-line-strong px-4 py-1.5 text-xs text-body"
                    >
                      Keep
                    </button>
                    <button
                      type="button"
                      disabled={moderate.isPending}
                      onClick={() => moderate.mutate({ kind: item.kind, commentId: item.id, action: 'hide' })}
                      className="rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-surface-warm"
                    >
                      Hide
                    </button>
                  </div>
                </div>
              </Panel>
            ))}
          </div>
        )
      }
    </Async>
  )
}
