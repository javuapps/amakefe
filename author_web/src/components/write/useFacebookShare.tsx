import { useState, type ReactNode } from 'react'
import type { StudioPart, StudioStory } from '@amakefe/core'
import { FacebookDrawer, type FacebookDrawerIntent } from './FacebookDrawer'
import {
  usePlanPublication,
  usePostNow,
  usePublishPart,
  useSavePartMeta,
  useSchedulePart,
} from '../../hooks/queries'

/**
 * Composing and sending the Facebook post, wherever that is asked for.
 *
 * The studio's Publish tab and the part page both need it: one publishes and
 * posts in a single act, the other posts a part that is already live. The act
 * is the same either way, so it is written once here rather than twice.
 */
export function useFacebookShare(
  story: StudioStory,
  part: StudioPart,
): {
  open: (intent: FacebookDrawerIntent) => void
  busy: boolean
  drawer: ReactNode
} {
  const publish = usePublishPart(story.id)
  const schedule = useSchedulePart()
  const plan = usePlanPublication(story.id)
  const postNow = usePostNow(story.id)
  const savePart = useSavePartMeta(story.id)

  const [intent, setIntent] = useState<FacebookDrawerIntent | null>(null)
  const [error, setError] = useState<string | null>(null)

  const busy = publish.isPending || schedule.isPending || plan.isPending || postNow.isPending

  /**
   * The part goes live first, then the post goes out.
   *
   * The other order puts a Facebook post in front of a story nobody can open.
   * If Facebook then refuses, the part stays live and the refusal is shown in
   * the drawer — a promotion that failed is not a reason to unpublish a story.
   */
  const confirm = async (post: {
    message: string
    link: string
    imageUrl: string | null
    mode: string
    snippet: string
  }) => {
    setError(null)
    try {
      // What she wrote in the drawer is kept on the part. The payload alone
      // would lose it: a retry reopens the drawer, and without this it would
      // prefill from the body again and throw away her wording.
      if (post.mode === 'snippet' && post.snippet.trim() !== (part.facebookTeaser ?? '')) {
        savePart.mutate({ partId: part.id, facebookTeaser: post.snippet.trim() || null })
      }

      // A share is for a part that is already live: the post is the only thing
      // missing, so publishing again would only rewrite its publication date.
      if (intent?.kind === 'schedule') {
        await schedule.mutateAsync({ partId: part.id, at: intent.at })
      } else if (intent?.kind === 'publish') {
        await publish.mutateAsync({ partId: part.id, publish: true })
      }

      const publicationId = await plan.mutateAsync({
        partId: part.id,
        channel: 'facebook',
        scheduledFor: intent?.kind === 'schedule' ? intent.at : null,
        payload: {
          message: post.message,
          link: post.link,
          imageUrl: post.imageUrl,
          mode: post.mode,
        },
      })

      // A scheduled post waits for the part's own publish time and the cron
      // sends it. Everything else goes now, while she is here to see it work.
      if (intent?.kind !== 'schedule') await postNow.mutateAsync(publicationId)

      setIntent(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That did not work.')
    }
  }

  return {
    open: setIntent,
    busy,
    drawer: intent && (
      <FacebookDrawer
        story={story}
        part={part}
        intent={intent}
        busy={busy}
        error={error}
        onClose={() => setIntent(null)}
        onConfirm={confirm}
      />
    ),
  }
}
