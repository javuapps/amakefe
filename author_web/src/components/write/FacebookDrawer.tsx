import { useEffect, useMemo, useState } from 'react'
import {
  canonicalUrl,
  composeFacebookPost,
  isSeriesStory,
  publicUrl,
  READ_MORE,
  redactText,
  snippetFrom,
  type FacebookPostMode,
  type StudioPart,
  type StudioStory,
} from '@amakefe/core'
import { Tabs } from '../Tabs'
import { formatWhen } from '../DateTimeField'
import { db } from '../../db'

const SITE_URL = import.meta.env.VITE_PUBLIC_SITE_URL ?? 'https://mindfulmoments.example'

/**
 * What goes to Facebook, decided at the moment of publishing.
 *
 * It opens on Publish rather than sitting in a tab of its own, because the post
 * and the part going live are one act: a story published without its Facebook
 * post reaches nobody, and the audience is entirely on Facebook.
 *
 * A half-height sheet rather than a full-screen one — the part is still behind
 * it, and this is a decision about the part, not a departure from it.
 */
export type FacebookDrawerIntent =
  | { kind: 'publish' }
  | { kind: 'schedule'; at: Date }
  /** The part is already live — only the post is missing. */
  | { kind: 'share' }

export function FacebookDrawer({
  story,
  part,
  intent,
  onClose,
  onConfirm,
  busy,
  error,
}: {
  story: StudioStory
  part: StudioPart
  intent: FacebookDrawerIntent
  onClose: () => void
  onConfirm: (post: {
    message: string
    link: string
    imageUrl: string | null
    mode: FacebookPostMode
    /** Kept on the part, so a retry starts from what she wrote, not the body. */
    snippet: string
  }) => void
  busy: boolean
  error: string | null
}) {
  const [mode, setMode] = useState<FacebookPostMode>('snippet')

  const link = canonicalUrl(SITE_URL, story.slug, {
    part: part.partNumber,
    isSeries: isSeriesStory(story),
  })
  const imageUrl = publicUrl(db, part.thumbnailPath ?? story.coverImagePath)

  // Her own teaser if she wrote one; otherwise the opening of the part, which
  // is a better start than a blank box and is hers to trim.
  const [snippet, setSnippet] = useState(
    () => part.facebookTeaser?.trim() || snippetFrom(part.body, part.anonymiseTerms),
  )

  const message = useMemo(
    () =>
      composeFacebookPost({
        mode,
        snippet: redactText(snippet, part.anonymiseTerms),
        body: part.body,
        terms: part.anonymiseTerms,
        link,
      }),
    [mode, snippet, part.body, part.anonymiseTerms, link],
  )

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  const scheduled = intent.kind === 'schedule'

  return (
    <div
      className="drawer-scrim fixed inset-0 z-[55] flex justify-end bg-ink/60"
      role="dialog"
      aria-modal="true"
      aria-label="What goes to Facebook"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose()
      }}
    >
      <div className="drawer-panel flex h-full w-full md:w-1/2 flex-col border-l border-line-card bg-surface shadow-xl">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-line-soft px-6 py-4">
          <div className="min-w-0">
            <h2 className="font-display text-[19px] text-ink">What goes to Facebook</h2>
            <p className="mt-0.5 text-xs text-muted">
              {intent.kind === 'schedule'
                ? `Sent when the part goes out, ${formatWhen(intent.at)}.`
                : intent.kind === 'share'
                  ? 'This part is already live. The post goes out now.'
                  : 'Sent as soon as the part is live.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="shrink-0 text-xs text-muted hover:text-ink disabled:opacity-40"
          >
            Cancel
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <div className="flex flex-col gap-5">
            <div className="flex min-w-0 flex-col gap-3">
              <Tabs
                value={mode === 'snippet' ? 'A snippet' : 'The whole part'}
                onChange={(label) => setMode(label === 'A snippet' ? 'snippet' : 'full')}
                items={[{ label: 'A snippet' }, { label: 'The whole part' }]}
              />

              {mode === 'snippet' ? (
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-muted">
                    The opening of the part, to trim as you like
                  </span>
                  <textarea
                    value={snippet}
                    onChange={(event) => setSnippet(event.target.value)}
                    rows={8}
                    className="prose-story w-full rounded-lg border border-line-card bg-surface px-3 py-2 text-[14px] text-ink outline-none focus:border-line-strong"
                  />
                </label>
              ) : (
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted">
                    The whole part, as readers will see it
                  </span>
                  <div className="prose-story max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg border border-line-card bg-surface-warm px-3 py-2 text-[14px]">
                    {message.replace(`\n\n${READ_MORE}\n${link}`, '')}
                  </div>
                </div>
              )}

              {/* The link is not editable: it is the story's own address, and a
                  post that points somewhere else is a post nobody can follow. */}
              <div className="rounded-lg border border-dashed border-line-card px-3 py-2">
                <div className="text-xs text-muted">Always appended</div>
                <div className="mt-1 whitespace-pre-wrap text-[13px] text-body">
                  {READ_MORE}
                  {'\n'}
                  {link}
                </div>
              </div>

              <p className="flex flex-wrap items-center gap-x-4 text-xs text-muted">
                <span>{message.length.toLocaleString('en-GB')} characters</span>
                {part.anonymiseTerms.length > 0 && (
                  <span>
                    {part.anonymiseTerms.length}{' '}
                    {part.anonymiseTerms.length === 1 ? 'name' : 'names'} hidden
                  </span>
                )}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs text-muted">The picture on the post</span>
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt=""
                  className="aspect-[3/2] w-full max-w-[260px] rounded-lg object-cover"
                />
              ) : (
                <p className="rounded-lg border border-gold bg-surface-warm px-3 py-2 text-xs text-body">
                  Neither this part nor the story has a picture, so the post will go out as plain
                  text with the link.
                </p>
              )}
            </div>
          </div>
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-line-soft px-6 py-4">
          <p className="min-w-0 text-xs text-accent-deep">{error}</p>
          <button
            type="button"
            disabled={busy || (mode === 'snippet' && !snippet.trim())}
            onClick={() => onConfirm({ message, link, imageUrl, mode, snippet })}
            className="shrink-0 rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-[#fff6ea] disabled:opacity-40"
          >
            {busy
              ? scheduled
                ? 'Scheduling…'
                : 'Posting…'
              : scheduled
                ? 'Schedule the post'
                : 'Post to Facebook'}
          </button>
        </footer>
      </div>
    </div>
  )
}
