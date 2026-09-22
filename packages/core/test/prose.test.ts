import { describe, expect, it } from 'vitest'
import {
  canonicalPath,
  partFromSegment,
  docPlainText,
  docText,
  isEmptyDoc,
  normaliseDocPaths,
  readMinutesFor,
  redactDoc,
  redactText,
  scanForIdentifiers,
  textToDoc,
  toStoragePath,
  wordCount,
  type ProseDoc,
} from '../src/index'

/**
 * The most important property here is that `docPlainText` produces one blank
 * line per block. The database derives `body_text` the same way, and the privacy
 * scanner numbers paragraphs off it — if the two ever diverge, the scanner
 * reports "paragraph 6" while pointing at paragraph 5.
 */
describe('document text', () => {
  it('separates blocks with a blank line', () => {
    const doc: ProseDoc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'First.' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Second.' }] },
      ],
    }
    expect(docPlainText(doc)).toBe('First.\n\nSecond.')
  })

  it('joins marked runs without inserting spaces', () => {
    const doc: ProseDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'She was ' },
            { type: 'text', text: 'not', marks: [{ type: 'italic' }] },
            { type: 'text', text: ' ready.' },
          ],
        },
      ],
    }
    expect(docPlainText(doc)).toBe('She was not ready.')
  })

  it('does not double-count a blockquote wrapping a paragraph', () => {
    // The naive jsonpath extraction repeats nested text; this is the regression.
    const doc: ProseDoc = {
      type: 'doc',
      content: [
        {
          type: 'blockquote',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'The week after.' }] }],
        },
      ],
    }
    expect(docPlainText(doc)).toBe('The week after.')
    expect(wordCount(doc)).toBe(3)
  })

  it('includes a figure’s alt text and caption, so the privacy scan sees them', () => {
    const doc: ProseDoc = {
      type: 'doc',
      content: [
        { type: 'image', attrs: { src: 'a.webp', alt: 'A receipt on a table', caption: 'Lusaka' } },
      ],
    }
    expect(docPlainText(doc)).toBe('A receipt on a table Lusaka')
  })

  it('treats a document with no text as empty', () => {
    expect(isEmptyDoc({ type: 'doc', content: [] })).toBe(true)
    expect(isEmptyDoc({ type: 'doc', content: [{ type: 'paragraph' }] })).toBe(true)
    expect(isEmptyDoc(textToDoc('Something.'))).toBe(false)
  })
})

describe('plain prose into a document', () => {
  it('round-trips the shape the seeded stories were migrated with', () => {
    const original =
      'The number was saved under a name that meant nothing to me.\n\n' +
      'I did not confront him.\n\n' +
      'I called it for the first time on a Tuesday.'

    const doc = textToDoc(original)
    expect(doc.content).toHaveLength(3)
    expect(docPlainText(doc)).toBe(original)
  })

  it('drops blank runs rather than making empty paragraphs', () => {
    expect(textToDoc('One.\n\n   \n\nTwo.\n').content).toHaveLength(2)
  })

  it('counts words and estimates a read time', () => {
    const doc = textToDoc(Array.from({ length: 400 }, () => 'word').join(' '))
    expect(wordCount(doc)).toBe(400)
    expect(readMinutesFor(doc)).toBe(2)
    expect(readMinutesFor(textToDoc('short'))).toBe(1)
  })
})

describe('privacy scan over a document', () => {
  it('finds a phone number and names the right paragraph', () => {
    const doc = textToDoc('The first paragraph is fine.\n\nHe said to call 0977 123 456.')
    const finding = scanForIdentifiers(doc).find((f) => f.message.includes('phone number'))
    expect(finding?.level).toBe('danger')
    expect(finding?.paragraph).toBe(2)
  })

  it('reads a figure’s alt text', () => {
    const doc: ProseDoc = {
      type: 'doc',
      content: [{ type: 'image', attrs: { src: 'a.webp', alt: 'Call 0977 123 456' } }],
    }
    expect(scanForIdentifiers(doc).some((f) => f.level === 'danger')).toBe(true)
  })

  it('still accepts plain strings, for the title and the teaser', () => {
    expect(scanForIdentifiers('Reach her on 0966 111 222')[0]!.level).toBe('danger')
  })
})

describe('canonical paths', () => {
  it('gives a single-part story a bare address', () => {
    expect(canonicalPath('the-letter')).toBe('/stories/the-letter')
    expect(canonicalPath('the-letter', { part: 1, isSeries: false })).toBe('/stories/the-letter')
  })

  it('gives each part of a series its own address', () => {
    expect(canonicalPath('the-letter', { part: 3, isSeries: true })).toBe('/stories/the-letter/part-3')
  })

  // The router captures the part segment whole, so this is what turns it back
  // into a number. It round-trips with canonicalPath or every series part 404s.
  it('reads the part back out of the address it wrote', () => {
    for (const part of [1, 2, 7, 12]) {
      const path = canonicalPath('the-letter', { part, isSeries: true })
      expect(partFromSegment(path.split('/').pop())).toBe(part)
    }
  })

  it('answers null for anything that is not a part segment', () => {
    for (const segment of [undefined, '', '3', 'part-', 'part-0', 'part-two', 'parts-2', 'part-2x']) {
      expect(partFromSegment(segment)).toBeNull()
    }
  })
})

describe('image paths never become URLs', () => {
  const url =
    'https://project.supabase.co/storage/v1/object/public/public_media/stories/abc/figures/x.webp'
  const path = 'stories/abc/figures/x.webp'

  it('turns a public URL back into a storage path', () => {
    expect(toStoragePath(url)).toBe(path)
  })

  it('leaves a path alone', () => {
    expect(toStoragePath(path)).toBe(path)
  })

  it('normalises every image in a document before it is saved', () => {
    // The editor shows resolved URLs. A document must never store one — it would
    // pin the story to a single environment.
    const doc: ProseDoc = {
      type: 'doc',
      content: [
        { type: 'image', attrs: { src: url, alt: 'a' } },
        {
          type: 'blockquote',
          content: [{ type: 'image', attrs: { src: url, alt: 'nested' } }],
        },
      ],
    }
    const clean = normaliseDocPaths(doc)
    const srcs: string[] = []
    JSON.stringify(clean, (key, value) => {
      if (key === 'src') srcs.push(value as string)
      return value
    })
    expect(srcs).toEqual([path, path])
  })
})

/**
 * docPlainText must match the SQL cnt_doc_plain_text exactly. The database
 * derives body_text, word_count, read_minutes and the search vector from its
 * copy; this one feeds the privacy scanner and the live word count. If they
 * drift, the scanner names the wrong paragraph and the counts disagree with
 * what the studio shows.
 *
 * These are the cases that caught a real divergence: SQL's btrim() trims spaces
 * but not newlines, so the database was keeping a trailing "\n\n" and counting
 * one word too many.
 */
describe('document text mirrors the SQL function', () => {
  const cases: [string, ProseDoc, string, number][] = [
    [
      'one paragraph',
      textToDoc('She waited until the house was quiet.'),
      'She waited until the house was quiet.',
      7,
    ],
    ['two paragraphs', textToDoc('First.\n\nSecond.'), 'First.\n\nSecond.', 2],
    ['empty doc', { type: 'doc', content: [] }, '', 0],
    ['empty paragraph', { type: 'doc', content: [{ type: 'paragraph' }] }, '', 0],
    [
      'quote nested',
      {
        type: 'doc',
        content: [
          {
            type: 'blockquote',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'The week after.' }] }],
          },
        ],
      },
      'The week after.',
      3,
    ],
  ]

  it.each(cases)('%s', (_label, doc, text, words) => {
    expect(docPlainText(doc)).toBe(text)
    expect(wordCount(doc)).toBe(words)
    // Never a trailing newline — this is what diverged.
    expect(docPlainText(doc)).not.toMatch(/\s$/)
  })
})

describe('redaction', () => {
  const terms = ['Mando', 'Chanda', 'Kabwe']

  // These are the exact cases the SQL harness for 20260921130000 asserts against
  // cnt_redact_text / cnt_redact_doc. The database is what actually protects a
  // contributor; this copy only drives the studio preview, so if the two ever
  // disagree the creator is previewing something readers will not get.
  it('replaces a term with ten asterisks, whatever its length', () => {
    expect(redactText('Mando came home', terms)).toBe('********** came home')
    expect(redactText('a summary from Kabwe', terms)).toBe('a summary from **********')
  })

  it('is case-insensitive', () => {
    expect(redactText('MANDO and mando and Mando', terms)).toBe(
      '********** and ********** and **********',
    )
  })

  it('takes a possessive but not a longer word that starts the same', () => {
    expect(redactText("Chanda's mother", terms)).toBe("**********'s mother")
    expect(redactText('A mandolin played', terms)).toBe('A mandolin played')
    expect(redactText('Mandola Street was quiet', terms)).toBe('Mandola Street was quiet')
  })

  it('leaves the text alone when there are no terms', () => {
    expect(redactText('Mando came home', [])).toBe('Mando came home')
  })

  it('treats a term with regex characters as literal text', () => {
    expect(redactText('call a.b now', ['a.b'])).toBe('call ********** now')
    expect(redactText('call axb now', ['a.b'])).toBe('call axb now')
  })

  it('redacts prose, image alt and caption, but never the image path', () => {
    const doc: ProseDoc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: "Mando said nothing. Chanda's mother watched." }] },
        {
          type: 'image',
          attrs: { src: 'stories/x.webp', alt: 'Mando at the gate', caption: 'Chanda kept the photo' },
        },
      ],
    }
    const out = redactDoc(doc, terms)
    expect(docText(out)).toContain("**********'s mother")
    expect(docText(out)).not.toContain('Mando')
    const image = out.content![1] as { attrs: { src: string; alt: string; caption: string } }
    expect(image.attrs.alt).toBe('********** at the gate')
    expect(image.attrs.caption).toBe('********** kept the photo')
    expect(image.attrs.src).toBe('stories/x.webp')
  })

  it('keeps the document shape so the renderer still walks it', () => {
    const doc: ProseDoc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Mando', marks: [{ type: 'bold' }] }] }],
    }
    const out = redactDoc(doc, terms)
    expect(out.type).toBe('doc')
    expect(out.content).toHaveLength(1)
    expect(docText(out)).toBe('**********\n\n')
  })
})
