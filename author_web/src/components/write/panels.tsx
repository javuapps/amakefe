import { useEffect, useState } from 'react'
import {
  canonicalPath,
  hasBlockingFinding,
  isSeriesStory,
  partState,
  publicUrl,
  REDACTION,
  redactDoc,
  redactText,
  scanForIdentifiers,
  uploadCover,
  uploadFigure,
  type PrivacyFinding,
  type StudioPart,
  type StudioStory,
} from '@amakefe/core'
import { StoryReading } from '@amakefe/ui'
import portrait from '@amakefe/core/brand/portrait.webp'
import { Panel } from '../shell'
import { db } from '../../db'
import { useCategories, useSavePartMeta, useSaveStoryMetadata } from '../../hooks/queries'

// ---------------------------------------------------------------------------
// Story details
// ---------------------------------------------------------------------------

/**
 * The story: what it is. Title, address, credit, category, shape and summary —
 * nothing about any one part, and nothing about getting it out.
 */
export function StoryDetailsPanel({ story }: { story: StudioStory }) {
  const categories = useCategories()
  const save = useSaveStoryMetadata(story.id)
  const published = story.parts.some((part) => partState(part) === 'live')
  const isSeries = isSeriesStory(story)

  return (
    <Panel
      title="Story details"
      actions={<SaveHint pending={save.isPending} done={save.isSuccess} error={save.error} />}
    >
      <div className="flex flex-col gap-3">
        <Field
          label="Title"
          value={story.title}
          onSave={(title) => save.mutate({ title })}
        />
        <Field
          label="Address"
          value={story.slug}
          disabled={published}
          hint={
            published
              ? 'Locked — this address is already in shared links.'
              : `Readers will find it at ${canonicalPath(story.slug)}`
          }
          onSave={(slug) => save.mutate({ slug })}
        />
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Category</span>
          <select
            value={story.categorySlug ?? ''}
            onChange={(event) => save.mutate({ categorySlug: event.target.value })}
            className="rounded-lg border border-line-card bg-surface px-3 py-2 text-sm text-ink"
          >
            {(categories.data ?? []).map((category) => (
              <option key={category.slug} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        {/* Not every story runs in parts, and calling a single piece "Part 1 of 1"
            would make a whole story look like a fragment. */}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted">Type</span>
          <div className="flex items-center gap-2">
            <select
              value={story.storyType}
              onChange={(event) =>
                save.mutate(
                  event.target.value === 'series'
                    ? { storyType: 'series', plannedPartCount: 3 }
                    : { storyType: 'single', plannedPartCount: null },
                )
              }
              disabled={story.parts.length > 1}
              className="flex-1 rounded-lg border border-line-card bg-surface px-3 py-2 text-sm text-ink disabled:opacity-60"
            >
              <option value="single">One story</option>
              <option value="series">A series</option>
            </select>
            {isSeries && (
              <input
                type="number"
                min={2}
                max={20}
                value={story.plannedPartCount ?? 2}
                onChange={(event) =>
                  save.mutate({ plannedPartCount: Number(event.target.value) })
                }
                aria-label="Planned number of parts"
                className="w-20 rounded-lg border border-line-card bg-surface px-3 py-2 text-sm text-ink"
              />
            )}
          </div>
          {story.parts.length > 1 && (
            <span className="text-xs text-muted">
              This story already has {story.parts.length} parts, so it stays a series.
            </span>
          )}
        </div>

        <Field
          label="Summary"
          value={story.summary}
          multiline
          hint="Also used as the page description when the story is shared."
          counter={160}
          onSave={(summary) => save.mutate({ summary })}
        />
      </div>
    </Panel>
  )
}

/**
 * Her own voice at the end of the part — the one place in a story where she
 * speaks as herself rather than writing someone else's.
 *
 * It belongs to the part, not the story: in a series each instalment ends
 * somewhere different, so what there is to say about it differs too.
 */
export function ThoughtsPanel({ story, part }: { story: StudioStory; part: StudioPart }) {
  const save = useSavePartMeta(story.id)
  const isSeries = isSeriesStory(story)

  return (
    <Panel
      title="Amake Fe’s thoughts"
      actions={<SaveHint pending={save.isPending} done={save.isSuccess} error={save.error} />}
    >
      <Field
        label={isSeries ? `After part ${part.partNumber}` : 'After the story'}
        value={part.creatorNote ?? ''}
        multiline
        hint={
          isSeries
            ? `Optional. Readers see this under your portrait at the end of part ${part.partNumber}.`
            : 'Optional. Readers see this under your portrait at the end of the story.'
        }
        onSave={(creatorNote) =>
          save.mutate({ partId: part.id, creatorNote: creatorNote || null })
        }
      />
    </Panel>
  )
}

/** The story's picture, on its page and in whatever gets shared. */
export function CoverPanel({ story }: { story: StudioStory }) {
  const save = useSaveStoryMetadata(story.id)

  return (
    <Panel
      title="Cover image"
      actions={<SaveHint pending={save.isPending} done={save.isSuccess} error={save.error} />}
    >
      <ImageField
        label="Cover image"
        hint="Shown at the top of the story and on its Facebook card."
        path={story.coverImagePath}
        upload={(file) => uploadCover(db, story.id, file)}
        onPicked={(coverImagePath) => save.mutate({ coverImagePath })}
        onClear={() => save.mutate({ coverImagePath: null })}
      />
    </Panel>
  )
}

/**
 * A part of a series may carry its own picture, shown in place of the cover when
 * that part is read and on the post that announces it. A single story has only
 * the cover, so this is not offered there.
 */
export function PartImagePanel({ story, part }: { story: StudioStory; part: StudioPart }) {
  const save = useSavePartMeta(story.id)

  return (
    <Panel
      title={`Part ${part.partNumber} image`}
      actions={<SaveHint pending={save.isPending} done={save.isSuccess} error={save.error} />}
    >
      <ImageField
        label="Part image"
        hint="Optional. Falls back to the story's cover."
        path={part.thumbnailPath}
        upload={(file) => uploadFigure(db, story.id, file)}
        onPicked={(thumbnailPath) => save.mutate({ partId: part.id, thumbnailPath })}
        onClear={() => save.mutate({ partId: part.id, thumbnailPath: null })}
      />
    </Panel>
  )
}

/**
 * Whether the last change reached the server.
 *
 * These panels save on blur rather than behind a button, which is the studio's
 * habit everywhere — but an edit that vanishes into a field with no
 * acknowledgement reads as an edit that did nothing, and a save that *failed*
 * said nothing at all. This is the acknowledgement.
 */
export function SaveHint({
  pending,
  done,
  error,
}: {
  pending: boolean
  done: boolean
  error: unknown
}) {
  if (pending) return <span className="text-xs text-muted">Saving…</span>
  if (error instanceof Error) {
    return <span className="text-xs text-accent-deep">Not saved — {error.message}</span>
  }
  if (done) return <span className="text-xs text-muted">Saved</span>
  return null
}

export function Field({
  label,
  value,
  onSave,
  multiline = false,
  disabled = false,
  hint,
  counter,
}: {
  label: string
  value: string
  onSave: (value: string) => void
  multiline?: boolean
  disabled?: boolean
  hint?: string
  counter?: number
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])

  const commit = () => {
    if (draft !== value) onSave(draft)
  }

  const className =
    'w-full rounded-lg border border-line-card bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-line-strong disabled:opacity-60'

  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted">{label}</span>
      {multiline ? (
        <textarea
          rows={3}
          value={draft}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          className={`${className} auto-grow resize-y`}
        />
      ) : (
        <input
          value={draft}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          // Enter is what people press to mean "that's it" — without this the
          // change sat in the field until something else happened to take focus.
          onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
          className={className}
        />
      )}
      {(hint || counter) && (
        <span className="flex justify-between text-xs text-muted">
          <span>{hint}</span>
          {counter && (
            <span className={draft.length > counter ? 'text-accent-deep' : ''}>
              {draft.length}/{counter}
            </span>
          )}
        </span>
      )}
    </label>
  )
}

function ImageField({
  label,
  hint,
  path,
  upload,
  onPicked,
  onClear,
}: {
  label: string
  hint: string
  path: string | null
  upload: (file: File) => Promise<string>
  onPicked: (path: string) => void
  onClear: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const url = publicUrl(db, path)

  const pick = async (file: File) => {
    setBusy(true)
    setError(null)
    try {
      onPicked(await upload(file))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not upload that image.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted">{label}</span>
      {url && <img src={url} alt="" className="aspect-[3/2] w-full rounded-lg object-cover" />}
      <div className="flex items-center gap-2">
        <label className="flex-1 cursor-pointer rounded-lg border border-dashed border-line-strong px-3 py-2 text-center text-xs text-muted hover:border-accent">
          {busy ? 'Uploading…' : url ? 'Replace' : 'Add an image'}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void pick(file)
              event.target.value = ''
            }}
          />
        </label>
        {url && (
          <button type="button" onClick={onClear} className="shrink-0 text-xs text-accent-deep">
            Remove
          </button>
        )}
      </div>
      <span className="text-xs text-muted">{hint}</span>
      {error && <span className="text-xs text-accent-deep">{error}</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Privacy, Facebook, Publish
// ---------------------------------------------------------------------------

export function PrivacyPanel({ findings }: { findings: PrivacyFinding[] }) {
  return (
    <Panel title="Privacy check">
      <ul className="flex flex-col gap-2 text-[13px] leading-relaxed">
        {findings.map((finding, index) => (
          <li key={index} className="flex gap-2">
            <span
              className={
                finding.level === 'danger'
                  ? 'text-accent-deep'
                  : finding.level === 'warning'
                    ? 'text-gold'
                    : 'text-green'
              }
              aria-hidden
            >
              ●
            </span>
            <span className="text-body">{finding.message}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted">
        Covers the story text, the title, the summary and the teaser. It looks for phone numbers,
        emails and repeated place names — it cannot tell you whether a story is recognisable to
        someone who was there.
      </p>
    </Panel>
  )
}

/**
 * Words that must not leave the building.
 *
 * She writes the story with the names she was given — that is how the detail
 * survives — and lists them here. The database replaces each one with
 * {@link REDACTION} in everything it publishes: the prose, the part title, her
 * closing words, image descriptions, and the search index. The real names stay in
 * the studio, where only editorial roles can reach them.
 */
export function AnonymisePanel({ story, part }: { story: StudioStory; part: StudioPart }) {
  const save = useSavePartMeta(story.id)
  const [entry, setEntry] = useState('')
  const terms = part.anonymiseTerms

  const commit = (next: string[]) => save.mutate({ partId: part.id, anonymiseTerms: next })

  const add = () => {
    // A comma-separated paste is the fastest way in from a list of names.
    const added = entry
      .split(',')
      .map((term) => term.trim())
      .filter((term) => term && !terms.some((existing) => existing.toLowerCase() === term.toLowerCase()))
    if (added.length) commit([...terms, ...added])
    setEntry('')
  }

  return (
    <Panel title="Names to hide">
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <input
            value={entry}
            onChange={(event) => setEntry(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                add()
              }
            }}
            placeholder="A name, a place, a workplace"
            className="min-w-0 flex-1 rounded-lg border border-line-card bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-line-strong"
          />
          <button
            type="button"
            onClick={add}
            disabled={!entry.trim()}
            className="shrink-0 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-surface-warm disabled:opacity-40"
          >
            Add
          </button>
        </div>

        {terms.length === 0 ? (
          <p className="text-xs text-muted">
            Nothing is being hidden yet. Add a name and it disappears from the story everywhere
            readers can see it.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {terms.map((term) => (
              <li key={term}>
                <button
                  type="button"
                  onClick={() => commit(terms.filter((other) => other !== term))}
                  title={`Stop hiding ${term}`}
                  className="group flex items-center gap-1.5 rounded-full border border-line-card bg-surface-warm px-3 py-1.5 text-xs text-ink"
                >
                  {term}
                  <span className="text-muted group-hover:text-accent-deep" aria-hidden>
                    ×
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-muted">
          Each becomes <span className="font-semibold text-body">{REDACTION}</span> in the published
          story, its title, your thoughts and any image description — and in search, so the name
          cannot be used to find it. Whole words only: hiding &ldquo;Mando&rdquo; leaves
          &ldquo;mandolin&rdquo; alone. The story keeps the real names here in the studio.
        </p>

        {save.error instanceof Error && (
          <p className="text-xs text-accent-deep">{save.error.message}</p>
        )}
      </div>
    </Panel>
  )
}

/** A phone-width preview using the very component the reader renders with. */
export function ReaderPreview({
  story,
  partIndex,
  body,
}: {
  story: StudioStory
  partIndex: number
  body: StudioStory['parts'][number]['body']
}) {
  const part = story.parts[partIndex]
  if (!part) return null

  const isSeries = isSeriesStory(story)
  // Redacted here exactly as the database redacts it on the way out, so the
  // frame shows what a reader gets rather than what she typed.
  const terms = part.anonymiseTerms

  return (
    <div>
      <div className="mb-2 text-xs text-muted">
        As a reader sees it
        {terms.length > 0 && ` · ${terms.length} name${terms.length === 1 ? '' : 's'} hidden`}
      </div>
      {/* A phone is a fixed window onto a long story, so the frame keeps its
          height and the story scrolls inside it — a frame that grew to fit
          showed the whole thing at once, which is the one thing a reader never
          sees. Capped against the viewport so the handset always fits on screen
          whatever the laptop. */}
      <div className="w-[402px] overflow-hidden rounded-[28px] border-[6px] border-ink bg-surface">
        <div className="phone-screen h-[min(874px,calc(100dvh-17rem))] min-h-[420px]">
          <StoryReading
            title={story.title}
            categoryName={story.categorySlug ?? ''}
            publishedAt={part.publishedAt}
            readMinutes={Math.max(1, Math.round(part.wordCount / 200))}
            isSeries={isSeries}
            partNumber={part.partNumber}
            totalPartCount={story.plannedPartCount ?? story.parts.length}
            partTitle={part.title ? redactText(part.title, terms) : part.title}
            body={redactDoc(body, terms)}
            creatorNote={part.creatorNote ? redactText(part.creatorNote, terms) : part.creatorNote}
            coverUrl={publicUrl(db, part.thumbnailPath ?? story.coverImagePath)}
            resolveImage={(src) => publicUrl(db, src)}
            markUrl={portrait}
          />
        </div>
      </div>
    </div>
  )
}

export { scanForIdentifiers, hasBlockingFinding }
