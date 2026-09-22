import { docPlainText, redactDoc, type ProseDoc } from './models/prose'

/**
 * What goes to Facebook, and how it is built.
 *
 * Everything here redacts first. The body in the database holds the story as it
 * was told — real names and all — and a post assembled from it without
 * `redactDoc` would put every hidden name in front of 200,000 people, which is
 * the exact failure the anonymise feature exists to prevent.
 */
export type FacebookPostMode = 'snippet' | 'full'

/** How much of a part a snippet takes before it stops at the next paragraph. */
const DEFAULT_SHARE = 0.35

/**
 * The opening of a part, in whole paragraphs.
 *
 * Takes paragraphs from the start until it has about `share` of the text, then
 * stops. Paragraph-wise rather than by character count because a teaser cut
 * mid-sentence reads as a broken post rather than as an invitation — and the
 * creator can trim it afterwards, which she cannot do with a sentence that was
 * already chopped.
 */
export function snippetFrom(
  doc: ProseDoc,
  terms: readonly string[] = [],
  share = DEFAULT_SHARE,
): string {
  const text = docPlainText(redactDoc(doc, terms))
  if (!text) return ''

  const paragraphs = text.split('\n\n').filter((paragraph) => paragraph.trim())
  if (paragraphs.length <= 1) return text

  const target = text.length * share
  const taken: string[] = []
  let length = 0

  for (const paragraph of paragraphs) {
    taken.push(paragraph)
    length += paragraph.length
    // Checked after taking, so a part whose first paragraph already exceeds the
    // share still gets a whole one rather than nothing.
    if (length >= target) break
  }

  return taken.join('\n\n')
}

/** Every post ends the same way, whatever else is in it. */
export const READ_MORE = 'Read the full story:'

export function composeFacebookPost(options: {
  mode: FacebookPostMode
  /** What the creator wrote or edited. Used in snippet mode. */
  snippet: string
  /** The part's body. Used in full mode, redacted on the way. */
  body: ProseDoc
  terms: readonly string[]
  link: string
}): string {
  const lead =
    options.mode === 'full'
      ? docPlainText(redactDoc(options.body, options.terms))
      : options.snippet.trim()

  return `${lead}\n\n${READ_MORE}\n${options.link}`
}
