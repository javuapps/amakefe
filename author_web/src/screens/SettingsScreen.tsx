import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { facebookAuthUrl, formatDate, type FacebookConnection } from '@amakefe/core'
import { useAuth } from '../auth'
import { Async, Panel } from '../components/shell'
import { useConfirm } from '../components/ConfirmDialog'
import {
  useConnectFacebookPage,
  useDisconnectFacebook,
  useEditorName,
  useFacebookConnection,
  usePendingPages,
  useSaveEditorName,
} from '../hooks/queries'
import { db } from '../db'

const META_AUTHOR_APP_ID = import.meta.env.VITE_META_AUTHOR_APP_ID
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

/**
 * The Page the studio publishes to.
 *
 * Connecting is an OAuth round trip: the studio sends the editor to Meta, the
 * `facebook-oauth` Edge Function takes the code Meta hands back, and everyone
 * returns here with `?facebook=…`. When the account runs more than one Page the
 * function stops and asks, because the wrong choice posts a stranger's marriage
 * to the wrong audience.
 */
export function SettingsScreen() {
  const [params, setParams] = useSearchParams()
  const connection = useFacebookConnection()

  const outcome = params.get('facebook')
  const pendingId = params.get('pending')
  const message = params.get('message')

  const clear = () => setParams(new URLSearchParams(), { replace: true })

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <YourAccount />

      {outcome === 'error' && message && (
        <Panel>
          <p className="text-[13px] text-accent-deep">{message}</p>
          <button type="button" onClick={clear} className="mt-2 text-xs text-muted">
            Dismiss
          </button>
        </Panel>
      )}

      {outcome === 'choose' && pendingId ? (
        <PagePicker pendingId={pendingId} onDone={clear} />
      ) : (
        <Async query={connection}>
          {(data) => (data ? <Connected connection={data} /> : <NotConnected />)}
        </Async>
      )}
    </div>
  )
}

function NotConnected() {
  const configured = Boolean(META_AUTHOR_APP_ID)

  const connect = async () => {
    const { data } = await db.auth.getSession()
    const token = data.session?.access_token
    if (!token) return
    window.location.href = facebookAuthUrl({
      appId: META_AUTHOR_APP_ID!,
      supabaseUrl: SUPABASE_URL,
      accessToken: token,
    })
  }

  return (
    <Panel title="Facebook">
      <p className="text-[13px] leading-relaxed text-body">
        Connect the Page and the studio can post a story&rsquo;s teaser and link to it — the same
        post you would write by hand, sent when the part goes out.
      </p>

      {configured ? (
        <button
          type="button"
          onClick={connect}
          className="mt-4 rounded-full bg-ink px-5 py-2 text-xs font-semibold text-surface-warm"
        >
          Connect a Page
        </button>
      ) : (
        <p className="mt-4 rounded-lg border border-gold bg-surface-warm px-3 py-2 text-xs text-body">
          <span className="font-semibold">Not configured yet.</span> The Meta app id is missing —
          set <code>VITE_META_AUTHOR_APP_ID</code> for the studio, and <code>META_AUTHOR_APP_ID</code>,{' '}
          <code>META_AUTHOR_APP_SECRET</code> and <code>STUDIO_URL</code> as Edge Function secrets.
        </p>
      )}

      <p className="mt-3 text-xs text-muted">
        You will be asked for permission to see your Pages and post to them. Nothing is read from
        the Page, and nothing posts without you planning it first.
      </p>
    </Panel>
  )
}

function Connected({ connection }: { connection: FacebookConnection }) {
  const disconnect = useDisconnectFacebook()
  const confirm = useConfirm()

  const drop = async () => {
    const ok = await confirm({
      title: `Disconnect ${connection.pageName}?`,
      body: 'The studio stops being able to post there. Anything already posted stays up.',
      confirmLabel: 'Disconnect',
      tone: 'danger',
    })
    if (ok) disconnect.mutate()
  }

  return (
    <Panel title="Facebook">
      <div className="flex items-start gap-4">
        {connection.pageAvatarUrl ? (
          <img
            src={connection.pageAvatarUrl}
            alt=""
            className="size-12 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div
            aria-hidden
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-warm font-display text-lg text-line-strong"
          >
            {connection.pageName.charAt(0)}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="font-display text-[19px] text-ink">{connection.pageName}</div>
          <p className="mt-1 flex items-center gap-2 text-xs text-muted">
            <span className={connection.isActive ? 'text-green' : 'text-accent-deep'} aria-hidden>
              ●
            </span>
            {connection.isActive ? 'Connected' : 'Needs reconnecting'} ·{' '}
            {formatDate(connection.connectedAt)}
          </p>
        </div>

        <button
          type="button"
          onClick={drop}
          disabled={disconnect.isPending}
          className="shrink-0 text-xs text-accent-deep disabled:opacity-40"
        >
          Disconnect
        </button>
      </div>

      {connection.lastError && (
        <p className="mt-4 rounded-lg border border-accent-deep bg-accent-wash px-3 py-2 text-xs text-accent-deep">
          Facebook last said: {connection.lastError}
        </p>
      )}

      <p className="mt-4 border-t border-line-soft pt-3 text-xs text-muted">
        Posts go out with the part. Publishing a part sends its post straight away; scheduling one
        holds the post until the part goes live, and it is sent then.
      </p>
    </Panel>
  )
}

function PagePicker({ pendingId, onDone }: { pendingId: string; onDone: () => void }) {
  const pages = usePendingPages(pendingId)
  const connect = useConnectFacebookPage()

  return (
    <Panel title="Which Page?">
      <p className="text-[13px] text-body">
        That account runs more than one. Pick the one the stories should go to.
      </p>

      <Async query={pages} loading={<div className="mt-4 h-20 animate-pulse rounded-lg bg-surface-tint" />}>
        {(list) =>
          list.length === 0 ? (
            <p className="mt-4 text-[13px] text-muted">
              That list has expired. Start the connection again.
            </p>
          ) : (
            <ul className="mt-4 flex flex-col">
              {list.map((page) => (
                <li
                  key={page.pageId}
                  className="flex items-center gap-3 border-t border-line-soft py-3 first:border-0 first:pt-0"
                >
                  {page.pageAvatarUrl ? (
                    <img src={page.pageAvatarUrl} alt="" className="size-9 rounded-full object-cover" />
                  ) : (
                    <div
                      aria-hidden
                      className="flex size-9 items-center justify-center rounded-full bg-surface-warm text-sm text-line-strong"
                    >
                      {page.pageName.charAt(0)}
                    </div>
                  )}
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                    {page.pageName}
                  </span>
                  <button
                    type="button"
                    disabled={connect.isPending}
                    onClick={() =>
                      connect.mutate(
                        { pendingId, pageId: page.pageId },
                        { onSuccess: onDone },
                      )
                    }
                    className="shrink-0 rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-surface-warm disabled:opacity-40"
                  >
                    Use this one
                  </button>
                </li>
              ))}
            </ul>
          )
        }
      </Async>

      {connect.error instanceof Error && (
        <p className="mt-3 text-xs text-accent-deep">{connect.error.message}</p>
      )}
    </Panel>
  )
}

/**
 * The editor's own name, which is the only thing `edt_editors` holds.
 *
 * It is here rather than behind an administrator because a name is chrome:
 * stories carry no byline, so it reaches nothing a reader ever sees — it names
 * the person to themselves and to whoever else opens the studio. The type and
 * the role, which decide what this account can actually do, are not editable
 * from any app at all.
 *
 * Accounts made from now on arrive with a name from `sec_provision_account`.
 * This exists because the studio's first account predates that, and the old
 * schema had nowhere to record one.
 */
function YourAccount() {
  const { session } = useAuth()
  const editor = useEditorName()
  const save = useSaveEditorName()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')

  // Seeded once the query lands, and not on every render — a controlled field
  // reset from server state mid-edit throws away what is being typed.
  useEffect(() => {
    if (!editor.data) return
    setFirstName(editor.data.firstName)
    setLastName(editor.data.lastName)
  }, [editor.data])

  const changed =
    firstName.trim() !== (editor.data?.firstName ?? '') ||
    lastName.trim() !== (editor.data?.lastName ?? '')
  const complete = firstName.trim().length > 0 && lastName.trim().length > 0

  const field =
    'w-full rounded-tile border border-line-strong bg-surface-raised px-3 py-2 text-sm text-ink outline-none focus:border-accent'

  return (
    <Panel title="Your account">
      <Async query={editor}>
        {(saved) => (
          <>
            {!saved && (
              <p className="mb-4 text-sm text-body">
                This account has no name recorded. It is shown in the studio and nowhere else.
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="text-xs text-muted">First name</span>
                <input
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  className={`${field} mt-1`}
                />
              </label>
              <label>
                <span className="text-xs text-muted">Last name</span>
                <input
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  className={`${field} mt-1`}
                />
              </label>
            </div>

            <p className="mt-3 text-xs text-muted">
              Signed in as {session?.user.email}. Changing the address, or what this account may
              do, is an administrator&rsquo;s job.
            </p>

            {save.isError && (
              <p className="mt-3 text-xs text-accent-deep">
                {save.error instanceof Error ? save.error.message : 'That did not save.'}
              </p>
            )}

            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => save.mutate({ firstName, lastName })}
                disabled={!complete || !changed || save.isPending}
                className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-surface-warm disabled:opacity-40"
              >
                {save.isPending ? 'Saving…' : 'Save'}
              </button>
              {!changed && saved && <span className="text-xs text-muted">Saved</span>}
            </div>
          </>
        )}
      </Async>
    </Panel>
  )
}
