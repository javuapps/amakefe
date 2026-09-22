import { Suspense, useCallback, useState } from 'react'
import { Link, useParams } from 'react-router'
import {
  canonicalPath,
  formatDate,
  isSeriesStory,
  partState,
  publicUrl,
  storyPublishedAt,
  type StudioPart,
  type StudioStory,
} from '@amakefe/core'
import { StoryProse } from '@amakefe/ui'
import { Async, BackLink, Panel } from '../components/shell'
import { useConfirm } from '../components/ConfirmDialog'
import { Menu } from '../components/Menu'
import { CoverPanel, StoryDetailsPanel } from '../components/write/panels'
import { PartStudio } from '../components/write/lazyPartStudio'
import type { StudioMode } from '../components/write/PartStudio'
import { db } from '../db'
import {
  useAddPart,
  useDeletePart,
  usePublishPart,
  useRefreshStory,
  useSaveStoryMetadata,
  useStudioStory,
} from '../hooks/queries'

/**
 * One story: what it is, and the parts inside it.
 *
 * Clicking a part opens its own page. The studio is still launched from here for
 * a part just added, and from the row's menu — lazily, so opening a story to
 * look at its parts does not pull in an editor.
 */
const SITE_URL = import.meta.env.VITE_PUBLIC_SITE_URL

export function StoryDetailScreen() {
  const { storyId } = useParams()
  const story = useStudioStory(storyId)
  const refreshStory = useRefreshStory(storyId)
  // A part just added opens straight on Publish; one opened to be reworked
  // opens on the words alone.
  const [editing, setEditing] = useState<{ partId: string; mode: StudioMode } | null>(null)

  // The studio wrote straight to the server; pick up what it left behind.
  const closeStudio = useCallback(() => {
    setEditing(null)
    refreshStory()
  }, [refreshStory])

  return (
    <Async query={story}>
      {(data) => (
        <div className="flex flex-col gap-5">
          <Header story={data} />

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
            <PartsPanel
              story={data}
              onEdit={(partId) => setEditing({ partId, mode: 'edit' })}
              onCreated={(partId) => setEditing({ partId, mode: 'create' })}
            />
            <div className="flex flex-col gap-5">
              <StoryDetailsPanel story={data} />
              <CoverPanel story={data} />
            </div>
          </div>

          {editing && (
            <Suspense fallback={<div className="fixed inset-0 z-50 bg-[#fbf7f0]" />}>
              <PartStudio
                story={data}
                partId={editing.partId}
                mode={editing.mode}
                onClose={closeStudio}
              />
            </Suspense>
          )}
        </div>
      )}
    </Async>
  )
}

function Header({ story }: { story: StudioStory }) {
  const debut = storyPublishedAt(story)
  const live = story.parts.some((part) => partState(part) === 'live')

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col items-start">
        <BackLink to="/stories">All stories</BackLink>
        <h2 className="mt-3 font-display text-[26px] leading-tight text-ink">{story.title}</h2>
        <p className="mt-1 text-[13px] text-muted">
          {story.categorySlug} ·{' '}
          {isSeriesStory(story)
            ? `Series of ${story.plannedPartCount ?? story.parts.length}`
            : 'One story'}
          {debut && ` · started ${formatDate(debut)}`}
        </p>
      </div>
      {live && (
        <a
          href={`${SITE_URL ?? ''}${canonicalPath(story.slug)}`}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 rounded-full border border-line-strong px-4 py-1.5 text-xs text-body"
        >
          Open as a reader →
        </a>
      )}
    </div>
  )
}

function PartsPanel({
  story,
  onEdit,
  onCreated,
}: {
  story: StudioStory
  onEdit: (partId: string) => void
  onCreated: (partId: string) => void
}) {
  const addPart = useAddPart(story.id)
  const saveStory = useSaveStoryMetadata(story.id)
  const isSeries = isSeriesStory(story)

  return (
    <Panel
      title={isSeries ? 'Parts' : 'The story'}
      actions={
        isSeries ? (
          <button
            type="button"
            disabled={addPart.isPending}
            onClick={() =>
              addPart.mutate(story.parts.length + 1, { onSuccess: (part) => onCreated(part.id) })
            }
            className="rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-surface-warm disabled:opacity-40"
          >
            {addPart.isPending ? 'Adding…' : '+ Add part'}
          </button>
        ) : (
          <div className="flex items-center gap-4">
            {/* A single story has exactly one part; a second one only exists
                once it has been made a series, which the database enforces. */}
            <button
              type="button"
              onClick={() => saveStory.mutate({ storyType: 'series', plannedPartCount: 2 })}
              className="text-xs text-accent"
            >
              Make this a series
            </button>
            {/* A single story is still a story with one part, so it has the
                same part page as any other — which is where publishing, the
                picture and the Facebook post live. Without a way in, a one
                story could be written and never sent. */}
            {story.parts[0]!.wordCount > 0 && (
              <Link
                to={`/stories/${story.id}/parts/${story.parts[0]!.id}`}
                className="rounded-full border border-line-strong px-4 py-1.5 text-xs font-semibold text-body"
              >
                Details
              </Link>
            )}
            <button
              type="button"
              onClick={() => onEdit(story.parts[0]!.id)}
              className="rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-surface-warm"
            >
              {story.parts[0]!.wordCount > 0 ? 'Edit' : 'Write'}
            </button>
          </div>
        )
      }
    >
      {isSeries ? (
        <div className="flex flex-col">
          {story.parts.map((part) => (
            <PartRow key={part.id} story={story} part={part} onEdit={onEdit} />
          ))}
        </div>
      ) : (
        // A single story has one part and nothing to choose between, so a row
        // that opens it is just a lid on the thing you came to read. Show it.
        <SingleStory part={story.parts[0]!} onEdit={onEdit} />
      )}
      {addPart.error instanceof Error && (
        <p className="mt-3 text-xs text-accent-deep">{addPart.error.message}</p>
      )}
    </Panel>
  )
}

function SingleStory({
  part,
  onEdit,
}: {
  part: StudioPart
  onEdit: (partId: string) => void
}) {
  const state = partState(part)

  if (part.wordCount === 0) {
    return (
      <div className="py-6 text-center">
        <p className="text-sm text-body">Nothing written yet.</p>
        <button
          type="button"
          onClick={() => onEdit(part.id)}
          className="mt-3 rounded-full bg-ink px-5 py-2 text-xs font-semibold text-surface-warm"
        >
          Write the story
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-center gap-2 text-xs text-muted">
        <span
          className={
            state === 'live' ? 'text-green' : state === 'scheduled' ? 'text-gold' : 'text-muted'
          }
          aria-hidden
        >
          ●
        </span>
        {part.wordCount} words ·{' '}
        {state === 'live'
          ? `published ${formatDate(part.publishedAt!)}`
          : state === 'scheduled'
            ? `scheduled ${formatDate(part.publishedAt!)}`
            : 'draft'}
      </p>

      {/* As written, real names and all — this is the working copy, not the
          reader's. The phone frame in the studio is where she checks what
          actually goes out. */}
      <article className="max-w-prose">
        {part.title && <h3 className="mb-4 font-display text-xl text-ink">{part.title}</h3>}
        <StoryProse doc={part.body} resolveImage={(src) => publicUrl(db, src)} />
      </article>
    </div>
  )
}

function PartRow({
  story,
  part,
  onEdit,
}: {
  story: StudioStory
  part: StudioPart
  onEdit: (partId: string) => void
}) {
  const deletePart = useDeletePart(story.id)
  const publish = usePublishPart(story.id)
  const confirm = useConfirm()
  const state = partState(part)
  const live = state !== 'draft'
  const canDelete = story.parts.length > 1 && state === 'draft'

  const remove = async () => {
    const ok = await confirm({
      title: `Delete part ${part.partNumber}?`,
      body: 'It has not been published, so no reader has seen it. This cannot be undone.',
      confirmLabel: 'Delete part',
      tone: 'danger',
    })
    if (ok) deletePart.mutate(part.id)
  }

  const unpublish = async () => {
    const ok = await confirm({
      title: `Unpublish part ${part.partNumber}?`,
      body: 'It comes off the site straight away, and links already shared will stop working.',
      confirmLabel: 'Unpublish',
      tone: 'danger',
    })
    if (ok) publish.mutate({ partId: part.id, publish: false })
  }

  return (
    <div className="flex items-center gap-4 border-t border-line-soft py-4 first:border-0 first:pt-0">
      <Link to={`/stories/${story.id}/parts/${part.id}`} className="shrink-0">
        <PartThumbnail story={story} part={part} />
      </Link>

      <Link to={`/stories/${story.id}/parts/${part.id}`} className="group min-w-0 flex-1">
        <span className="text-[14px] font-semibold text-ink group-hover:text-accent-deep">
          Part {part.partNumber}
        </span>
        {part.title && <span className="ml-2 text-[13px] text-body">{part.title}</span>}
        <span className="mt-0.5 block text-xs text-muted">
          {part.wordCount > 0 ? `${part.wordCount.toLocaleString('en-GB')} words` : 'Nothing written yet'}
          {' · '}
          {state === 'live'
            ? `published ${formatDate(part.publishedAt!)}`
            : state === 'scheduled'
              ? `scheduled ${formatDate(part.publishedAt!)}`
              : 'draft'}
        </span>
      </Link>

      <span
        className={`shrink-0 text-xs ${
          state === 'live' ? 'text-green' : state === 'scheduled' ? 'text-gold' : 'text-muted'
        }`}
        aria-hidden
      >
        ●
      </span>

      <Menu
        items={[
          { label: 'Edit', onSelect: () => onEdit(part.id) },
          // Publishing lives in the studio, where the Facebook post that goes
          // with it is decided. What stays here is corrective.
          ...(live
            ? [
                {
                  label: state === 'scheduled' ? 'Cancel the schedule' : 'Unpublish',
                  onSelect: unpublish,
                },
              ]
            : []),
          {
            label: 'Delete',
            onSelect: remove,
            tone: 'danger',
            disabled: !canDelete,
            hint: live
              ? 'Unpublish it first'
              : story.parts.length === 1
                ? 'A series keeps at least one part'
                : undefined,
          },
        ]}
      />
    </div>
  )
}

/**
 * A part can carry its own picture; otherwise it shows the story's cover, and
 * failing that its number — the same falling-back the reader does when it
 * decides what to put at the top of the page.
 */
function PartThumbnail({ story, part }: { story: StudioStory; part: StudioPart }) {
  const url = publicUrl(db, part.thumbnailPath ?? story.coverImagePath)

  if (url) {
    return (
      <img src={url} alt="" className="aspect-[3/2] w-[92px] shrink-0 rounded-lg object-cover" />
    )
  }
  return (
    <div
      aria-hidden
      className="flex aspect-[3/2] w-[92px] shrink-0 items-center justify-center rounded-lg bg-surface-warm font-display text-[18px] text-line-strong"
    >
      {part.partNumber}
    </div>
  )
}
