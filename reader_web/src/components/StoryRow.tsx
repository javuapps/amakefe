import { Link } from 'react-router'
import { canonicalPath, storyInitial, storyMeta, type StoryCard } from '@amakefe/core'

/**
 * The list row used on Home, Stories and the related rail: a lettered tile, the
 * title in the display serif, and one line of metadata.
 */
export function StoryRow({ story, divider = true }: { story: StoryCard; divider?: boolean }) {
  return (
    <Link
      to={canonicalPath(story.slug)}
      className={`flex items-start gap-[14px] py-[14px] ${divider ? 'border-b border-line-soft' : ''}`}
    >
      <div className="flex size-[54px] shrink-0 items-center justify-center rounded-tile bg-surface-warm font-display text-[19px] text-accent">
        {storyInitial(story)}
      </div>
      <div className="min-w-0">
        <div className="font-display text-[17px] leading-tight text-ink">{story.title}</div>
        <div className="mt-[5px] text-xs text-muted">{storyMeta(story)}</div>
      </div>
    </Link>
  )
}
