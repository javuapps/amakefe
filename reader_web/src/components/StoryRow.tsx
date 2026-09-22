import { Link } from 'react-router'
import { canonicalPath, publicUrl, storyInitial, storyMeta, type StoryCard } from '@amakefe/core'
import { db } from '../db'

/**
 * The list row used on Home, Stories and the related rail: the story's cover,
 * the title in the display serif, and one line of metadata.
 *
 * **The picture falls back to the lettered tile**, the same way a part's
 * thumbnail falls back to the story's cover and then to its number in the
 * studio. The prototype draws only the letter, and for a while that was the
 * whole design — but most stories now carry a picture, and a list of initials
 * beside three photographs reads as images failing to load rather than as a
 * choice. The letter stays for the stories with nothing, which is what makes
 * it worth keeping.
 *
 * `coverPath`, not `coverImagePath`: the view already resolves a story with no
 * cover of its own to its first part's picture, so this does not have to know
 * that rule or fetch a part to apply it.
 */
export function StoryRow({ story, divider = true }: { story: StoryCard; divider?: boolean }) {
  const cover = publicUrl(db, story.coverPath)

  return (
    <Link
      to={canonicalPath(story.slug)}
      className={`flex items-start gap-[14px] py-[14px] ${divider ? 'border-b border-line-soft' : ''}`}
    >
      {cover ? (
        <img
          src={cover}
          alt=""
          width={54}
          height={54}
          loading="lazy"
          className="size-[54px] shrink-0 rounded-tile object-cover"
        />
      ) : (
        <div className="flex size-[54px] shrink-0 items-center justify-center rounded-tile bg-surface-warm font-display text-[19px] text-accent">
          {storyInitial(story)}
        </div>
      )}
      <div className="min-w-0">
        <div className="font-display text-[17px] leading-tight text-ink">{story.title}</div>
        <div className="mt-[5px] text-xs text-muted">{storyMeta(story)}</div>
      </div>
    </Link>
  )
}
