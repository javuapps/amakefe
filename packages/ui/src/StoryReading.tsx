import type { ReactNode } from 'react'
import { formatDate, type ProseDoc } from '@amakefe/core'
import { StoryProse } from './StoryProse'

/**
 * The reading surface: everything between the top bar and the engagement row.
 *
 * The reader renders this for real; the studio renders the identical component
 * in a phone-sized frame to preview a draft. Interactive concerns — saving,
 * reacting, related stories — stay with the reader and are passed in as
 * `footer`, so nothing in here needs to know whether it is live or a preview.
 */
export type StoryReadingProps = {
  title: string
  categoryName: string
  publishedAt: Date | null
  readMinutes: number
  isSeries: boolean
  partNumber: number
  totalPartCount: number
  partTitle: string | null
  body: ProseDoc
  /** Her reflection on this part, shown after it. */
  creatorNote?: string | null
  coverUrl?: string | null
  resolveImage?: (src: string) => string | null
  markUrl: string
  footer?: ReactNode
}

export function StoryReading({
  title,
  categoryName,
  publishedAt,
  readMinutes,
  isSeries,
  partNumber,
  totalPartCount,
  partTitle,
  body,
  creatorNote,
  coverUrl,
  resolveImage,
  markUrl,
  footer,
}: StoryReadingProps) {
  return (
    <div className="pb-8">
      {coverUrl && (
        <img
          src={coverUrl}
          alt=""
          className="mb-1 aspect-[3/2] w-full object-cover"
          loading="eager"
        />
      )}

      <header className="px-[22px] pt-[22px]">
        <div className="text-[10px] uppercase tracking-label text-accent">
          {categoryName} · Anonymous story
        </div>
        <h1 className="mt-3 font-display text-[30px] leading-[1.15] text-ink">{title}</h1>
        {/* No byline: the kicker above already says this is an anonymous story,
            and every one of them is written by her. */}
        <p className="mt-3 text-[13px] text-muted">
          {publishedAt && `${formatDate(publishedAt)} · `}
          {readMinutes} min
        </p>

        {/* A single-part story has no progress to show, and saying "Part 1 of 1"
            would make a whole story look like a fragment. */}
        {isSeries && (
          <div className="mt-4 flex items-center gap-[10px]">
            <span className="text-xs font-semibold text-ink">
              Part {partNumber} of {totalPartCount}
            </span>
            <div className="h-[3px] flex-1 overflow-hidden rounded bg-line-soft">
              <div
                className="h-full rounded bg-accent transition-[width] duration-300"
                style={{ width: `${Math.round((partNumber / Math.max(totalPartCount, 1)) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </header>

      <div className="px-[22px] pt-5">
        {partTitle && <h2 className="mb-4 font-display text-xl text-ink">{partTitle}</h2>}
        <StoryProse doc={body} resolveImage={resolveImage} />
      </div>

      {creatorNote && (
        <aside className="mx-[22px] mt-[26px] rounded-card bg-surface-warm p-[18px]">
          <div className="flex items-center gap-[10px]">
            <img src={markUrl} alt="" width={34} height={34} className="shrink-0 rounded-full" />
            <h3 className="font-display text-[17px] text-ink">Amake Fe&rsquo;s thoughts</h3>
          </div>
          <p className="prose-story mt-3 text-[15px]">{creatorNote}</p>
        </aside>
      )}

      {footer}
    </div>
  )
}
