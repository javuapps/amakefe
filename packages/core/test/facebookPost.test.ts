import { describe, expect, it } from 'vitest'
import {
  composeFacebookPost,
  READ_MORE,
  REDACTION,
  snippetFrom,
  textToDoc,
  type ProseDoc,
} from '../src/index'

/**
 * A Facebook post is the one piece of this product that reaches 200,000 people
 * at once. Two properties matter more than anything else here: it never cuts a
 * sentence in half, and it never carries a name the creator hid.
 */
const part = (...paragraphs: string[]): ProseDoc => textToDoc(paragraphs.join('\n\n'))

describe('snippetFrom', () => {
  const six = part(
    'She left the number on the table and said nothing at all.',
    'I did not ask about it for three days, which is longer than I have ever waited.',
    'When I did ask, he said it belonged to a man at work.',
    'The man at work did not exist, and we both knew it by then.',
    'My mother told me to say nothing and wait, so I waited.',
    'I am still waiting, and that is the part nobody warns you about.',
  )

  it('takes whole paragraphs, never part of one', () => {
    const snippet = snippetFrom(six)
    for (const paragraph of snippet.split('\n\n')) {
      expect(paragraph).toMatch(/[.?!]$/)
    }
  })

  it('takes roughly the share asked for and stops', () => {
    const whole = snippetFrom(six, [], 1)
    const snippet = snippetFrom(six, [], 0.35)
    expect(snippet.length).toBeLessThan(whole.length)
    expect(snippet.length / whole.length).toBeGreaterThan(0.2)
    expect(snippet.length / whole.length).toBeLessThan(0.6)
  })

  it('hides the names the creator hid', () => {
    const snippet = snippetFrom(part('Mando left the number on the table.', 'Nothing else.'), [
      'Mando',
    ])
    expect(snippet).toContain(REDACTION)
    expect(snippet).not.toContain('Mando')
  })

  it('gives a whole paragraph even when the first one is already long', () => {
    const long = part('A'.repeat(900) + '.', 'Short one.')
    expect(snippetFrom(long, [], 0.1)).toBe('A'.repeat(900) + '.')
  })

  it('returns the only paragraph a one-paragraph part has', () => {
    expect(snippetFrom(part('Just this.'))).toBe('Just this.')
  })

  it('returns nothing for an empty part rather than throwing', () => {
    expect(snippetFrom(textToDoc(''))).toBe('')
  })
})

describe('composeFacebookPost', () => {
  const body = part('Mando came home late.', 'Nobody said anything about it.')
  const link = 'http://localhost:5173/stories/the-letter/part-2'

  it('ends every post with the link, whatever the mode', () => {
    for (const mode of ['snippet', 'full'] as const) {
      const post = composeFacebookPost({ mode, snippet: 'A hook.', body, terms: [], link })
      expect(post.endsWith(`${READ_MORE}\n${link}`)).toBe(true)
    }
  })

  it('uses what she wrote in snippet mode', () => {
    const post = composeFacebookPost({
      mode: 'snippet',
      snippet: '  A hook, with space around it.  ',
      body,
      terms: [],
      link,
    })
    expect(post).toBe(`A hook, with space around it.\n\n${READ_MORE}\n${link}`)
  })

  it('redacts the whole part in full mode', () => {
    const post = composeFacebookPost({ mode: 'full', snippet: '', body, terms: ['Mando'], link })
    expect(post).toContain(REDACTION)
    expect(post).not.toContain('Mando')
    expect(post).toContain('Nobody said anything about it.')
  })
})
