import { createContext, use, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { useCategories, useCreateStory } from '../hooks/queries'

/**
 * Starting a story.
 *
 * A full-screen dialog rather than a page: beginning a story is a moment, not a
 * destination, and it can be reached from the sidebar, from the story list and
 * from an empty studio without any of them navigating away first.
 *
 * It asks only what decides the story's shape — title, summary, one story or a
 * series, and how many parts a series is expected to run to — plus the category
 * it files under. Everything else is edited later, beside the writing.
 *
 * There is nothing here about who the story came from. Readers know every story
 * is hers, written from something someone told her, so a byline would either
 * repeat that or invent a persona.
 */

const NewStoryContext = createContext<(() => void) | null>(null)

export const useNewStory = () => {
  const open = use(NewStoryContext)
  if (!open) throw new Error('useNewStory outside NewStoryProvider')
  return open
}

export function NewStoryProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <NewStoryContext value={() => setOpen(true)}>
      {children}
      {open && <NewStoryDialog onClose={() => setOpen(false)} />}
    </NewStoryContext>
  )
}

function NewStoryDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const categories = useCategories()
  const create = useCreateStory()

  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [storyType, setStoryType] = useState<'single' | 'series'>('single')
  const [plannedParts, setPlannedParts] = useState(3)
  const [categorySlug, setCategorySlug] = useState('')

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const id = await create.mutateAsync({
      title: title.trim(),
      summary: summary.trim(),
      storyType,
      plannedPartCount: storyType === 'series' ? plannedParts : null,
      categorySlug: categorySlug || categories.data?.[0]?.slug || null,
    })
    onClose()
    navigate(`/stories/${id}`)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#fbf7f0]">
      <header className="flex shrink-0 items-center justify-between border-b border-line px-8 py-[22px]">
        <div>
          <h1 className="font-display text-[23px] leading-tight text-ink">Start a story</h1>
          <p className="mt-[3px] text-[13px] text-muted">
            What it is called, and whether it runs in parts
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-sm text-muted hover:text-ink">
          Cancel
        </button>
      </header>

      <form onSubmit={submit} className="min-h-0 flex-1 overflow-y-auto p-8">
        <div className="mx-auto flex max-w-xl flex-col gap-5">
          <Labelled label="Title" hint="Required. It becomes the story's address, so it is worth getting right.">
            <input
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="The Number I Kept Calling"
              className={`${inputClass} font-display text-lg`}
            />
          </Labelled>

          <Labelled label="Summary" hint="Optional. One or two lines, also used when the story is shared.">
            <textarea
              rows={2}
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              className={`${inputClass} auto-grow resize-y`}
            />
          </Labelled>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-xs text-muted">Type</legend>
            <div className="grid grid-cols-2 gap-3">
              <TypeCard
                selected={storyType === 'single'}
                onSelect={() => setStoryType('single')}
                title="One story"
                description="Told in a single piece."
              />
              <TypeCard
                selected={storyType === 'series'}
                onSelect={() => setStoryType('series')}
                title="A series"
                description="Released in parts, one at a time."
              />
            </div>
            {storyType === 'series' && (
              <label className="mt-1 flex items-center gap-3 text-[13px] text-body">
                How many parts do you expect?
                <input
                  type="number"
                  min={2}
                  max={20}
                  value={plannedParts}
                  onChange={(event) => setPlannedParts(Number(event.target.value))}
                  className="w-20 rounded-lg border border-line-card bg-surface px-3 py-2 text-sm text-ink"
                />
                <span className="text-xs text-muted">An estimate — it can change.</span>
              </label>
            )}
          </fieldset>

          <Labelled label="Category" hint="Where it sits in the reader's Stories tab.">
            <select
              value={categorySlug}
              onChange={(event) => setCategorySlug(event.target.value)}
              className={inputClass}
            >
              {(categories.data ?? []).map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </select>
          </Labelled>

          <div className="flex items-center gap-4 pt-1">
            <button
              type="submit"
              disabled={!title.trim() || create.isPending}
              className="rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-surface-warm disabled:opacity-40"
            >
              {create.isPending ? 'Creating…' : 'Start writing'}
            </button>
            {create.error instanceof Error && (
              <p className="text-xs text-accent-deep">{create.error.message}</p>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}

const inputClass =
  'w-full rounded-lg border border-line-card bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-line-strong'

function TypeCard({
  selected,
  onSelect,
  title,
  description,
}: {
  selected: boolean
  onSelect: () => void
  title: string
  description: string
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`rounded-card border px-4 py-3 text-left transition-colors ${
        selected ? 'border-ink bg-surface-warm' : 'border-line-card bg-surface hover:border-line-strong'
      }`}
    >
      <span className="block text-sm font-semibold text-ink">{title}</span>
      <span className="mt-0.5 block text-xs text-muted">{description}</span>
    </button>
  )
}

function Labelled({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  )
}
