import { useState } from 'react'
import { Link } from 'react-router'
import {
  canonicalPath,
  formatDate,
  isSeriesStory,
  partState,
  type StudioPart,
  type StudioStory,
} from '@amakefe/core'
import { Panel } from '../shell'
import { useConfirm } from '../ConfirmDialog'
import { DateTimeField, formatWhen } from '../DateTimeField'
import { useFacebookShare } from './useFacebookShare'
import { useFacebookConnection, usePublishPart, useSchedulePart } from '../../hooks/queries'

const SITE_URL = import.meta.env.VITE_PUBLIC_SITE_URL

/**
 * Getting a part out, and saying where it has got to.
 *
 * It lives on the part's own page and on the studio's Publish tab while a part
 * is being created — the two places a decision about sending is actually made.
 * Editing an existing part does not show it: once a part exists, when it goes
 * out and what goes with it are decisions about the part, not about the prose.
 *
 * There is publish and unpublish and nothing else. A part is on the site or it
 * is not, so a list of statuses to choose between would only be a way of being
 * wrong about which one means visible.
 */
export function PublishPanel({
  story,
  part,
  privacyBlocked,
}: {
  story: StudioStory
  part: StudioPart
  privacyBlocked: boolean
}) {
  const publish = usePublishPart(story.id)
  const schedule = useSchedulePart()
  const connection = useFacebookConnection()
  const share = useFacebookShare(story, part)
  const confirm = useConfirm()

  const state = partState(part)
  const label = isSeriesStory(story) ? `Part ${part.partNumber}` : 'This story'
  const empty = part.wordCount === 0
  const readerUrl = `${SITE_URL ?? ''}${canonicalPath(story.slug, {
    part: part.partNumber,
    isSeries: isSeriesStory(story),
  })}`

  const [when, setWhen] = useState<Date | null>(part.publishedAt)
  const moved = when != null && when.getTime() !== (part.publishedAt?.getTime() ?? 0)

  const connected = connection.data?.isActive ?? false
  const [toFacebook, setToFacebook] = useState(true)

  // The privacy check blocks a schedule as firmly as it blocks a publish: a
  // phone number left in a story is no less published for going out on Tuesday.
  const blocked = privacyBlocked || empty
  const busy = publish.isPending || schedule.isPending || share.busy
  const error = publish.error ?? schedule.error
  const withFacebook = toFacebook && connected

  const facebookSwitch = (
    <div className="mt-4 flex items-start gap-3 border-t border-line-soft pt-3">
      <button
        type="button"
        role="switch"
        aria-checked={toFacebook && connected}
        disabled={!connected}
        onClick={() => setToFacebook((was) => !was)}
        className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full px-0.5 transition-colors disabled:opacity-40 ${
          toFacebook && connected ? 'bg-accent' : 'bg-line-strong'
        }`}
      >
        <span
          className={`size-4 rounded-full bg-surface transition-transform ${
            toFacebook && connected ? 'translate-x-4' : ''
          }`}
        />
      </button>
      <div className="min-w-0 text-xs">
        <div className="text-body">Post to Facebook</div>
        {connected ? (
          <div className="text-muted">{connection.data!.pageName}</div>
        ) : (
          <div className="text-muted">
            No Page connected —{' '}
            <Link to="/settings" className="text-accent">
              connect one
            </Link>
            .
          </div>
        )}
      </div>
    </div>
  )

  /**
   * The composer is rendered once, outside the three state branches.
   *
   * Publishing moves the panel from `draft` to `live`, and a drawer rendered
   * inside the draft branch unmounts at exactly that moment — which is one
   * instant before Facebook answers. The refusal then had nowhere to appear.
   */

  if (state === 'live') {
    return (
      <Panel title="Publish">
        <p className="text-[13px] text-body">
          {label} went out on {formatDate(part.publishedAt!)}.
        </p>
        <a
          href={readerUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-xs text-accent"
        >
          Open it as a reader →
        </a>
        <button
          type="button"
          onClick={async () => {
            const ok = await confirm({
              title: `Unpublish ${label.toLowerCase()}?`,
              body: 'It comes off the site straight away, and links already shared will stop working. Anything already on Facebook stays up.',
              confirmLabel: 'Unpublish',
              tone: 'danger',
            })
            if (ok) publish.mutate({ partId: part.id, publish: false })
          }}
          disabled={busy}
          className="mt-3 w-full rounded-full border border-line-strong py-2.5 text-sm font-semibold text-body disabled:opacity-40"
        >
          {busy ? 'Working…' : 'Unpublish'}
        </button>

        {error instanceof Error && <p className="mt-2 text-xs text-accent-deep">{error.message}</p>}
        {share.drawer}
      </Panel>
    )
  }

  if (state === 'scheduled') {
    return (
      <Panel title="Publish">
        <p className="text-[13px] text-body">
          {label} goes out{' '}
          <span className="font-semibold text-gold">{formatWhen(part.publishedAt!)}</span>.
        </p>

        <div className="mt-3 flex flex-col gap-2">
          <DateTimeField value={when} onChange={setWhen} />
          <button
            type="button"
            disabled={!moved || busy || blocked}
            onClick={() =>
              when &&
              (withFacebook
                ? share.open({ kind: 'schedule', at: when })
                : schedule.mutate({ partId: part.id, at: when }))
            }
            className="w-full rounded-full bg-ink py-2.5 text-sm font-semibold text-surface-warm disabled:opacity-40"
          >
            {schedule.isPending ? 'Moving…' : moved ? 'Move it' : 'Scheduled'}
          </button>
        </div>

        <div className="mt-3 flex flex-col gap-2 border-t border-line-soft pt-3">
          <button
            type="button"
            disabled={busy || blocked}
            onClick={() =>
              withFacebook
                ? share.open({ kind: 'publish' })
                : publish.mutate({ partId: part.id, publish: true })
            }
            className="w-full rounded-full bg-accent py-2 text-xs font-semibold text-[#fff6ea] disabled:opacity-40"
          >
            Publish it now instead
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              const ok = await confirm({
                title: `Cancel the schedule for ${label.toLowerCase()}?`,
                body: 'It goes back to waiting, and will not go out until you give it a new time.',
                confirmLabel: 'Cancel the schedule',
                tone: 'danger',
              })
              if (ok) schedule.mutate({ partId: part.id, at: null })
            }}
            className="text-xs text-accent-deep disabled:opacity-40"
          >
            Cancel the schedule
          </button>
        </div>

        {facebookSwitch}
        {error instanceof Error && <p className="mt-2 text-xs text-accent-deep">{error.message}</p>}
        {share.drawer}
      </Panel>
    )
  }

  return (
    <Panel title="Publish">
      <button
        type="button"
        onClick={() =>
          withFacebook
            ? share.open({ kind: 'publish' })
            : publish.mutate({ partId: part.id, publish: true })
        }
        disabled={blocked || busy}
        className="w-full rounded-full bg-accent py-2.5 text-sm font-semibold text-[#fff6ea] disabled:opacity-40"
      >
        {publish.isPending ? 'Publishing…' : `Publish ${label.toLowerCase()} now`}
      </button>

      <div className="mt-4 border-t border-line-soft pt-4">
        <div className="text-xs text-muted">Or give it a time and let it go out on its own.</div>
        <div className="mt-2 flex flex-col gap-2">
          <DateTimeField value={when} onChange={setWhen} />
          <button
            type="button"
            disabled={!when || blocked || busy}
            onClick={() =>
              when &&
              (withFacebook
                ? share.open({ kind: 'schedule', at: when })
                : schedule.mutate({ partId: part.id, at: when }))
            }
            className="w-full rounded-full border border-line-strong py-2 text-xs font-semibold text-body disabled:opacity-40"
          >
            {schedule.isPending ? 'Scheduling…' : 'Schedule it'}
          </button>
        </div>
      </div>

      {facebookSwitch}

      {empty && <p className="mt-3 text-xs text-muted">Nothing written here yet.</p>}
      {privacyBlocked && (
        <p className="mt-3 text-xs text-accent-deep">
          The privacy check found a phone number or email. Remove it before this goes anywhere,
          now or later.
        </p>
      )}
      {error instanceof Error && <p className="mt-2 text-xs text-accent-deep">{error.message}</p>}
      {share.drawer}
    </Panel>
  )
}
