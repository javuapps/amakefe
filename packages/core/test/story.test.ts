import { describe, expect, it } from 'vitest'
import {
  formatCount,
  formatDate,
  formatRelative,
  isSeries,
  partsLabel,
  resumePoint,
  storyInitial,
  storyMeta,
  type StoryCard,
} from '../src/index'

const card = (overrides: Partial<StoryCard> = {}): StoryCard => ({
  id: 'id',
  slug: 'slug',
  title: 'A Quiet Room',
  summary: 'summary',
  categorySlug: 'trust',
  categoryName: 'Trust',
  storyType: 'single',
  publishedAt: new Date('2026-09-18T00:00:00Z'),
  likeCount: 0,
  coverImagePath: null,
  partCount: 1,
  totalPartCount: 1,
  readMinutes: 7,
  ...overrides,
})

describe('story cards', () => {
  it('reads a single-part story as a read time, not a part count', () => {
    expect(partsLabel(card())).toBe('7 min read')
    expect(isSeries(card())).toBe(false)
  })

  it('shows how far a running series has got', () => {
    expect(partsLabel(card({ storyType: 'series', partCount: 3, totalPartCount: 5 }))).toBe('3 of 5 parts')
  })

  it('shows the length of a finished series', () => {
    expect(partsLabel(card({ storyType: 'series', partCount: 5, totalPartCount: 5 }))).toBe('5 parts')
  })

  it('builds the metadata line without a byline', () => {
    // Every story is written by her from something someone told her, so there is
    // no author to credit — only what the reader can act on.
    expect(storyMeta(card({ storyType: 'series', partCount: 5, totalPartCount: 5 }))).toBe(
      'Trust · 5 parts',
    )
    expect(storyMeta(card())).toBe('Trust · 7 min read')
  })

  it('skips a leading article when picking the cover initial', () => {
    expect(storyInitial(card({ title: 'The Number I Kept Calling' }))).toBe('N')
    expect(storyInitial(card({ title: 'My Mother-in-Law Moved In' }))).toBe('M')
    expect(storyInitial(card({ title: 'Nothing Prepared Me' }))).toBe('P')
    expect(storyInitial(card({ title: 'Twins' }))).toBe('T')
  })
})

describe('resume point', () => {
  const series = card({ storyType: 'series', partCount: 3, totalPartCount: 5 })

  it('starts at part one for a reader who has not begun', () => {
    expect(resumePoint(series, null)).toEqual({ nextPart: 1, progress: 0, resuming: false })
  })

  it('offers the part after the one they finished', () => {
    expect(resumePoint(series, 1)).toMatchObject({ nextPart: 2, resuming: true })
    expect(resumePoint(series, 1).progress).toBeCloseTo(0.2)
  })

  it('never offers a part that has not been published yet', () => {
    // Three parts are out of a planned five; finishing part three must not
    // advertise a part four that does not exist.
    expect(resumePoint(series, 3).nextPart).toBe(3)
  })

  it('caps progress at the full bar when a series is complete', () => {
    const done = card({ storyType: 'series', partCount: 5, totalPartCount: 5 })
    expect(resumePoint(done, 5)).toEqual({ nextPart: 5, progress: 1, resuming: true })
  })
})

describe('formatting', () => {
  it('writes dates the way the design does', () => {
    expect(formatDate(new Date('2026-09-18T10:00:00Z'))).toBe('18 September 2026')
  })

  it('writes relative times for creator posts and answers', () => {
    const now = new Date('2026-09-20T12:00:00Z')
    expect(formatRelative(new Date('2026-09-20T10:00:00Z'), now)).toBe('2 hours ago')
    expect(formatRelative(new Date('2026-09-18T12:00:00Z'), now)).toBe('2 days ago')
    expect(formatRelative(new Date('2026-09-20T11:59:50Z'), now)).toBe('just now')
  })

  it('separates thousands in counts', () => {
    expect(formatCount(2413)).toBe('2,413')
  })
})
