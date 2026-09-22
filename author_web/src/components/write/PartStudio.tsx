import { useEffect, useMemo, useState } from 'react'
import {
  docPlainText,
  emptyDoc,
  hasBlockingFinding,
  isSeriesStory,
  scanForIdentifiers,
  wordCount,
  type ProseDoc,
  type StudioPart,
  type StudioStory,
} from '@amakefe/core'
import { PartEditor } from './PartEditor'
import { FacebookPanel } from './FacebookPanel'
import { PublishPanel } from './PublishPanel'
import {
  AnonymisePanel,
  PartImagePanel,
  PrivacyPanel,
  ReaderPreview,
  ThoughtsPanel,
} from './panels'
import { Tabs } from '../Tabs'
import { describeSaveState, useAutosave } from '../../hooks/useAutosave'
import { useSavePartMeta } from '../../hooks/queries'
import { readDraft, type LocalDraft } from '../../draftStore'

/**
 * Writing one part, full screen.
 *
 * The story's own details — title, address, category, type, summary, cover —
 * are settled on the story page behind this. In here there is exactly one part
 * and nothing to pick between, which is why it takes the whole window.
 *
 * The tabs run left to right in the order the work actually happens: finish the
 * prose and add her closing words, check nothing identifying slipped in, then
 * look at it as a reader will.
 *
 * **Publishing is only here while a part is being created.** Writing a new part
 * runs straight into sending it, so stopping at Preview would leave the job
 * half done. Coming back to an existing part is a different job — the words —
 * and where it goes and what goes with it are then decided on the part's own
 * page, which is also where they can be seen without opening an editor at all.
 */
const WRITING_TABS = ['Thoughts', 'Privacy', 'Preview'] as const
const TABS = [...WRITING_TABS, 'Publish'] as const
type Tab = (typeof TABS)[number]

/** Creating a part runs into publishing it; editing one is only the words. */
export type StudioMode = 'create' | 'edit'

export function PartStudio({
  story,
  partId,
  mode = 'edit',
  onClose,
}: {
  story: StudioStory
  partId: string
  mode?: StudioMode
  onClose: () => void
}) {
  const partIndex = story.parts.findIndex((candidate) => candidate.id === partId)
  const part = story.parts[partIndex]

  // The part can vanish underneath this — deleted in another tab, or the story
  // refetched mid-write. Closing is the honest response.
  useEffect(() => {
    if (!part) onClose()
  }, [part, onClose])
  if (!part) return null

  return (
    <Studio
      key={part.id}
      story={story}
      part={part}
      partIndex={partIndex}
      mode={mode}
      onClose={onClose}
    />
  )
}

function Studio({
  story,
  part,
  partIndex,
  mode,
  onClose,
}: {
  story: StudioStory
  part: StudioPart
  partIndex: number
  mode: StudioMode
  onClose: () => void
}) {
  const tabs = mode === 'create' ? TABS : WRITING_TABS
  const [tab, setTab] = useState<Tab>('Thoughts')
  const [body, setBody] = useState<ProseDoc>(part.body)
  const [recovered, setRecovered] = useState<LocalDraft | null>(null)

  const autosave = useAutosave(part.id, part.updatedAt, part.wordCount > 0)
  const savePartMeta = useSavePartMeta(story.id)

  const isSeries = isSeriesStory(story)
  const label = isSeries ? `Part ${part.partNumber}` : 'The story'

  // A local buffer newer than the server row means the browser closed mid-write.
  // Offer it rather than applying it — silently replacing what is on screen is
  // the one thing worse than losing a draft.
  useEffect(() => {
    let cancelled = false
    void readDraft(part.id).then((draft) => {
      if (cancelled || !draft) return
      if (
        draft.baseUpdatedAt === part.updatedAt &&
        docPlainText(draft.body) !== docPlainText(part.body)
      ) {
        setRecovered(draft)
      }
    })
    return () => {
      cancelled = true
    }
  }, [part.id, part.updatedAt, part.body])

  // Escape closes, as it does for any full-screen surface. The autosave hook
  // flushes on unmount, so nothing is lost on the way out.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const change = (doc: ProseDoc) => {
    setBody(doc)
    autosave.change(doc)
  }

  // Everything that will reach a reader gets scanned, not just the body: the
  // teaser is the text that goes in front of 200,000 people.
  const findings = useMemo(
    () =>
      scanForIdentifiers(
        [story.title, story.summary, part.facebookTeaser ?? '', docPlainText(body)]
          .filter(Boolean)
          .join('\n\n'),
      ),
    [story.title, story.summary, part.facebookTeaser, body],
  )
  const blocked = hasBlockingFinding(findings)
  const warnings = findings.filter((finding) => finding.level === 'warning').length

  return (
    <div className="modal-panel fixed inset-0 z-50 flex flex-col bg-[#fbf7f0]">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-line px-5 py-3 lg:px-8 lg:py-[18px]">
        <div className="min-w-0">
          <div className="text-[10.5px] uppercase tracking-[0.2em] text-muted">{label}</div>
          <h1 className="truncate font-display text-[17px] leading-tight text-ink lg:text-[21px]">
            {story.title}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-3 lg:gap-5">
          <span className="hidden text-xs text-muted sm:inline">
            {wordCount(body)} words
            {describeSaveState(autosave.state) && ` · ${describeSaveState(autosave.state)}`}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-ink px-5 py-2 text-xs font-semibold text-surface-warm"
          >
            Done
          </button>
        </div>
      </header>

      {/* One scroll region, as everywhere else in the studio. */}
      <div className="min-h-0 flex-1 overflow-y-auto p-5 lg:p-8">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="flex min-w-0 flex-col gap-4">
            {recovered && (
              <div className="flex items-center justify-between gap-4 rounded-card border border-gold bg-surface-warm px-4 py-3 text-[13px]">
                <span className="text-body">
                  Unsaved changes from{' '}
                  {new Date(recovered.savedAt).toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  on this device.
                </span>
                <span className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setBody(recovered.body)
                      autosave.change(recovered.body)
                      setRecovered(null)
                    }}
                    className="rounded-full bg-ink px-3 py-1 text-xs font-semibold text-surface-warm"
                  >
                    Keep
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecovered(null)}
                    className="text-xs text-muted"
                  >
                    Discard
                  </button>
                </span>
              </div>
            )}

            {autosave.state.status === 'conflict' && (
              <p className="rounded-lg border border-accent-deep bg-accent-wash px-3 py-2 text-xs text-accent-deep">
                This part was changed somewhere else. Reload the page to see the newer version —
                your text is still here and in this browser&rsquo;s local copy.
              </p>
            )}

            <input
              defaultValue={part.title ?? ''}
              onBlur={(event) =>
                event.target.value !== (part.title ?? '') &&
                savePartMeta.mutate({ partId: part.id, title: event.target.value || null })
              }
              placeholder={isSeries ? `Part ${part.partNumber} title (optional)` : 'Section title (optional)'}
              className="w-full rounded-lg border border-line-card bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-line-strong"
            />

            <PartEditor storyId={story.id} initialBody={part.body ?? emptyDoc()} onChange={change} />
          </div>

          <aside className="flex flex-col gap-3">
            <Tabs
              fill
              value={tab}
              onChange={(label) => setTab(label as Tab)}
              items={tabs.map((name) => ({
                label: name,
                badge:
                  name === 'Privacy' && blocked ? (
                    <span className="text-accent-deep" aria-label="blocked">
                      ●
                    </span>
                  ) : undefined,
              }))}
            />

            {/* A standing line about the privacy check, whichever tab is open —
                it is the thing most worth noticing while writing. */}
            <button
              type="button"
              onClick={() => setTab('Privacy')}
              className="flex shrink-0 items-center gap-2 rounded-full border border-line-card bg-surface px-3 py-1.5 text-left text-xs"
            >
              <span className={blocked ? 'text-accent-deep' : warnings ? 'text-gold' : 'text-green'}>
                ●
              </span>
              <span className="text-muted">
                {blocked
                  ? 'Privacy check found something that must be removed'
                  : warnings
                    ? `${warnings} thing${warnings === 1 ? '' : 's'} to consider`
                    : 'Privacy check is clear'}
              </span>
            </button>

            <div key={tab} className="pb-2">
              {tab === 'Thoughts' && <ThoughtsPanel story={story} part={part} />}
              {tab === 'Privacy' && (
                <div className="flex flex-col gap-3">
                  <AnonymisePanel story={story} part={part} />
                  <PrivacyPanel findings={findings} />
                </div>
              )}
              {tab === 'Preview' && (
                <ReaderPreview story={story} partIndex={partIndex} body={body} />
              )}
              {tab === 'Publish' && mode === 'create' && (
                // What goes out with the part, then the button that sends it:
                // the picture, the teaser it appears in, and Publish itself.
                <div className="flex flex-col gap-3">
                  {isSeries && <PartImagePanel story={story} part={part} />}
                  <PublishPanel story={story} part={part} privacyBlocked={blocked} />
                  <FacebookPanel story={story} part={part} />
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
