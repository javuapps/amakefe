import { describe, expect, it } from 'vitest'
import { createDb, docPlainText, fetchCategories, fetchFeed, fetchStory, isSeries } from '../src/index'

/**
 * The product's central promise is that reading needs no account. This test hits
 * the real project with nothing but the publishable key and no session, so a
 * change that quietly puts content behind auth fails here.
 *
 * Skipped when SUPABASE_URL / SUPABASE_KEY are absent, so it does not break an
 * offline run.
 */
const url = process.env.SUPABASE_URL ?? 'https://rubukvxtiezyfxzqacsi.supabase.co'
const key = process.env.SUPABASE_KEY ?? 'sb_publishable_duXTls5l0OX4gtP2FFZSGg_0vbdMFWt'

// These hit the network, so a blip should not read as a broken build. A genuine
// regression still fails all three attempts.
describe('anonymous reading', { retry: 2 }, () => {
  const db = createDb(url, key)

  it('returns published stories with no session at all', async () => {
    const { data } = await db.auth.getSession()
    expect(data.session).toBeNull()

    const stories = await fetchFeed(db)
    expect(stories.length).toBeGreaterThan(0)
    for (const story of stories) {
      expect(story.title).toBeTruthy()
      expect(story.publishedAt.getTime()).toBeLessThanOrEqual(Date.now())
      // Nothing that could name anyone comes back with a story card.
      expect(Object.keys(story)).not.toContain('authorAlias')
    }
  })

  it('returns the categories that drive the filter chips', async () => {
    const categories = await fetchCategories(db)
    expect(categories.map((c) => c.slug)).toContain('trust')
  })

  it('opens a story with its published parts', async () => {
    const story = await fetchStory(db, 'the-number-i-kept-calling')
    expect(story.card.title).toBe('The Number I Kept Calling')
    expect(story.parts.length).toBeGreaterThan(0)
    expect(docPlainText(story.parts[0]!.body)).toContain('receipt')
    // Her closing words belong to the part now, not to the story.
    expect(story.parts.at(-1)!.creatorNote).toBeTruthy()
    // A serialised story still running: fewer published parts than planned.
    expect(isSeries(story.card)).toBe(true)
    expect(story.card.partCount).toBeLessThan(story.card.totalPartCount)
  })

  it('cannot reach the parts table at all', async () => {
    // The table holds the story as it was told — real names included, so that
    // the creator can write from what she was given. Readers get the redacted
    // projection instead, and must not be able to go round it.
    const { data } = await db.from('cnt_story_parts').select('body')
    expect(data ?? []).toHaveLength(0)
  })

  it('never exposes an unpublished part', async () => {
    // There is no status column: a part is public exactly while its own publish
    // time has passed, and a story is public exactly while one of its parts is.
    const { data: parts } = await db.from('cnt_public_parts').select('published_at')
    expect(parts?.length).toBeGreaterThan(0)
    expect(
      parts?.every((row) => row.published_at !== null && new Date(row.published_at) <= new Date()),
    ).toBe(true)

    const { data: cards } = await db.from('cnt_story_cards').select('part_count')
    expect(cards?.every((row) => (row.part_count ?? 0) > 0)).toBe(true)
  })
})
