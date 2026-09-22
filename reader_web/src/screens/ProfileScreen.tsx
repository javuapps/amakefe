import { useState } from 'react'
import { Link } from 'react-router'
import {
  canonicalPath,
  deleteReaderAccount,
  NotSignedInError,
  storyMeta,
  type ReaderStats,
} from '@amakefe/core'
import { db } from '../db'
import { useAuth } from '../auth'
import { Async, Pill } from '../components/primitives'
import { useSignInPrompt } from '../hooks/useSignInPrompt'
import {
  useCategories,
  useFollowedCategories,
  useReaderStats,
  useSavedStories,
  useSetDisplayName,
  useToggleCategoryFollow,
} from '../hooks/queries'

export function ProfileScreen() {
  const stats = useReaderStats()

  return (
    <div className="flex flex-col gap-[18px] px-5 pt-[calc(16px+env(safe-area-inset-top,0px))] pb-6 lg:mx-auto lg:w-full lg:max-w-[680px] lg:px-6 lg:pt-8 lg:pb-14">
      <Async query={stats} loading={<div className="h-20 animate-pulse rounded-card bg-surface-tint" />}>
        {(data) => <Identity stats={data} />}
      </Async>

      <Async query={stats} loading={<div className="h-[76px] animate-pulse rounded-card bg-surface-tint" />}>
        {(data) => (
          <div className="flex gap-[10px]">
            <Stat value={data.storiesRead} label="Stories read" />
            <Stat value={data.saved} label="Saved" />
            <Stat value={data.topics} label="Topics" />
          </div>
        )}
      </Async>

      <MyTopics />
      <SavedStories />

      <div className="flex flex-col pt-1">
        <Link to="/support?from=profile_row" className="flex items-center justify-between border-t border-line-soft py-[15px] text-sm text-ink">
          Support the community <span className="text-[#a89684]">›</span>
        </Link>
        <Link to="/share" className="flex items-center justify-between border-t border-line-soft py-[15px] text-sm text-ink">
          Share your story <span className="text-[#a89684]">›</span>
        </Link>
        <Link to="/privacy" className="flex items-center justify-between border-t border-line-soft py-[15px] text-sm text-ink">
          Privacy <span className="text-[#a89684]">›</span>
        </Link>
        <Link to="/terms" className="flex items-center justify-between border-t border-line-soft py-[15px] text-sm text-ink">
          Terms of use <span className="text-[#a89684]">›</span>
        </Link>
      </div>

      <DeleteAccount />
    </div>
  )
}

/**
 * Who the reader is here.
 *
 * An email address carries no name, so the reader chooses one and that is what
 * appears beside anything they publish. Their address is never shown — not
 * here, not anywhere — so the only identity on this screen is the name they
 * picked and the initial drawn from it.
 *
 * Signed out, this is an invitation rather than a demand: reading needs no
 * account, and saying so is the point.
 */
function Identity({ stats }: { stats: ReaderStats }) {
  const { session, signOut } = useAuth()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(stats.displayName ?? '')
  const setName = useSetDisplayName()
  const signIn = useSignInPrompt()

  const memberSince = stats.memberSince
    ? new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(stats.memberSince)
    : null

  if (!session) {
    return (
      <div className="flex flex-col gap-3 rounded-card border border-line-card p-4">
        <div>
          <div className="font-display text-[22px] text-ink">Reading as a guest</div>
          <div className="mt-1 text-[12.5px] text-muted">
            Sign in to keep your saved stories and your place, on any phone.
          </div>
        </div>
        <Pill
          variant="ink"
          className="self-start"
          onClick={() => signIn.onError(new NotSignedInError(), 'Sign in to Mindful Moments')}
        >
          Sign in
        </Pill>
        {signIn.node}
      </div>
    )
  }

  const save = () => {
    setName.mutate(draft, { onSuccess: () => setEditing(false) })
  }

  return (
    <div className="flex items-center gap-[14px]">
      <div className="flex size-[62px] shrink-0 items-center justify-center rounded-full bg-surface-warm font-display text-[26px] text-accent">
        {stats.displayName?.charAt(0).toUpperCase() ?? '·'}
      </div>

      {editing ? (
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <input
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && save()}
            maxLength={40}
            placeholder="The name others see"
            className="w-full rounded-tile border border-line-strong bg-surface-raised px-3 py-2 text-sm text-ink outline-none placeholder:text-subtle focus:border-accent"
          />
          <div className="flex items-center gap-3">
            <Pill variant="ink" onClick={save} disabled={setName.isPending}>
              {setName.isPending ? 'Saving…' : 'Save'}
            </Pill>
            <button type="button" onClick={() => setEditing(false)} className="text-xs text-muted">
              Cancel
            </button>
          </div>
          {setName.isError && (
            <p className="text-xs text-accent-deep">That did not save. Try again in a moment.</p>
          )}
        </div>
      ) : (
        <div className="min-w-0">
          <div className="truncate font-display text-[22px] text-ink">
            {stats.displayName ?? 'No name yet'}
          </div>
          <div className="mt-1 text-[12.5px] text-muted">
            {memberSince ? `Since ${memberSince} · ` : ''}
            Your email is never shown
          </div>
          <div className="mt-1 flex items-center gap-4">
            <button
              type="button"
              onClick={() => {
                setDraft(stats.displayName ?? '')
                setEditing(true)
              }}
              className="text-xs text-accent"
            >
              {stats.displayName ? 'Change name' : 'Choose a name'}
            </button>
            <button type="button" onClick={() => void signOut()} className="text-xs text-muted">
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Deleting an account, from inside the app.
 *
 * Meta requires a route a person can actually follow, and the policy page
 * promises this one — so it has to exist and has to work. It asks twice, in
 * place: the first tap only reveals the second, because this cannot be undone
 * and a mis-tap on a phone is easy. No native dialog; the studio's rule about
 * that applies here too.
 */
function DeleteAccount() {
  const { session } = useAuth()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)

  if (!session) return null

  const remove = async () => {
    setBusy(true)
    setFailed(null)
    try {
      await deleteReaderAccount(db)
      // The session is gone with the account; a reload lands on a clean app.
      window.location.assign('/')
    } catch (error) {
      setFailed(error instanceof Error ? error.message : 'That did not work.')
      setBusy(false)
    }
  }

  return (
    <div className="border-t border-line-soft pt-[15px]">
      {confirming ? (
        <div className="flex flex-col gap-3">
          <p className="text-[13px] text-body">
            This removes your account, your saved stories and your reactions, and cannot be undone.{' '}
            <Link to="/data-deletion" className="text-accent">
              What is kept
            </Link>
            .
          </p>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="rounded-full bg-accent-deep px-[18px] py-2 text-sm font-semibold text-[#fff6ea] disabled:opacity-50"
            >
              {busy ? 'Deleting…' : 'Yes, delete it'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={busy}
              className="text-sm text-muted disabled:opacity-50"
            >
              Keep my account
            </button>
          </div>
          {failed && <p className="text-xs text-accent-deep">{failed}</p>}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="text-sm text-accent-deep"
        >
          Delete my account
        </button>
      )}
    </div>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex-1 rounded-xl border border-line-card p-[14px]">
      <div className="font-display text-[22px] text-ink">{value}</div>
      <div className="mt-1 text-[11.5px] text-muted">{label}</div>
    </div>
  )
}

/**
 * The prototype shows followed topics as static chips with no way to add one.
 * Every category is rendered here instead, followed ones filled — otherwise the
 * feature has no entry point anywhere in the app.
 */
function MyTopics() {
  const categories = useCategories()
  const followed = useFollowedCategories()
  const toggle = useToggleCategoryFollow()
  const signIn = useSignInPrompt()

  return (
    <section className="flex flex-col gap-[10px]">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-[19px] text-ink">My topics</h2>
        <span className="text-xs text-muted">Tap to follow</span>
      </div>
      <Async query={categories} loading={<div className="h-9 animate-pulse rounded-full bg-surface-tint" />}>
        {(list) => (
          <div className="flex flex-wrap gap-2">
            {list.map((category) => {
              const active = followed.data?.has(category.slug) ?? false
              return (
                <button
                  key={category.slug}
                  type="button"
                  disabled={toggle.isPending}
                  onClick={() =>
                    toggle.mutate(category.slug, {
                      onError: (error) =>
                        signIn.onError(error, 'Follow this topic?', () =>
                          toggle.mutate(category.slug),
                        ),
                    })
                  }
                  className={`rounded-full px-[14px] py-2 text-[13px] transition-colors ${
                    active
                      ? 'bg-surface-warm text-body'
                      : 'border border-line-card text-subtle hover:border-line-strong'
                  }`}
                >
                  {category.name}
                </button>
              )
            })}
          </div>
        )}
      </Async>
      {signIn.node}
    </section>
  )
}

function SavedStories() {
  const saved = useSavedStories()

  return (
    <section className="flex flex-col">
      <h2 className="pb-[6px] font-display text-[19px] text-ink">Saved stories</h2>
      <Async query={saved} loading={<div className="h-16 animate-pulse rounded-card bg-surface-tint" />}>
        {(stories) =>
          stories.length === 0 ? (
            <p className="text-sm text-muted">
              Nothing saved yet. Tap Save while reading and the story waits for you here.
            </p>
          ) : (
            <>
              {stories.map((story) => (
                <Link
                  key={story.id}
                  to={canonicalPath(story.slug)}
                  className="block border-t border-line-soft py-[13px]"
                >
                  <div className="font-display text-[16.5px] text-ink">{story.title}</div>
                  <div className="mt-1 text-xs text-muted">{storyMeta(story)}</div>
                </Link>
              ))}
            </>
          )
        }
      </Async>
    </section>
  )
}
