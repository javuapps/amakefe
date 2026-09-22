/**
 * Story bodies are ProseMirror documents.
 *
 * The node set is deliberately small. Every node here is something the reader
 * must render and the privacy scanner must understand, so each one has to earn
 * its place. **There are no links** — a URL inside an anonymous story is a
 * de-anonymisation vector, so it is not in the schema at all rather than
 * discouraged in a style guide.
 *
 * `docText` mirrors the `cnt_doc_text` SQL function exactly, including the blank
 * line between blocks. The database derives `body_text`, `word_count` and the
 * search vector from its copy; this one feeds the privacy scanner and the word
 * count while the creator is still typing. If the two ever disagree, the
 * scanner would report the wrong paragraph number — hence the shared test.
 */

/** TipTap's mark names. Rendered as <em>/<strong>, but named as the editor names them. */
export type ProseMark = { type: 'italic' | 'bold' }

export type ProseNode =
  | { type: 'text'; text: string; marks?: ProseMark[] }
  | { type: 'paragraph'; content?: ProseNode[] }
  | { type: 'heading'; attrs?: { level?: number }; content?: ProseNode[] }
  | { type: 'blockquote'; content?: ProseNode[] }
  | { type: 'horizontalRule' }
  | { type: 'image'; attrs: { src: string; alt: string; caption?: string | null } }

export type ProseDoc = { type: 'doc'; content?: ProseNode[] }

export const emptyDoc = (): ProseDoc => ({ type: 'doc', content: [] })

export const isEmptyDoc = (doc: ProseDoc): boolean => docPlainText(doc).length === 0

/** Blocks that end with a blank line in the plain-text rendering. */
const BLOCK_BREAK = new Set(['paragraph', 'heading', 'image', 'horizontalRule'])

/**
 * Plain text of a document. Mirrors `public.cnt_doc_text`.
 *
 * `blockquote` deliberately adds no break of its own: the paragraphs inside it
 * already do, and a second one would shift every following paragraph number.
 */
export function docText(node: unknown): string {
  if (node === null || node === undefined) return ''

  if (Array.isArray(node)) {
    return node.map(docText).join('')
  }
  if (typeof node !== 'object') return ''

  const n = node as Record<string, unknown>
  let out = ''

  if (typeof n.text === 'string') out += n.text

  const attrs = n.attrs as Record<string, unknown> | undefined
  // A figure's alt text and caption are real content — the privacy scanner in
  // particular must be able to see them.
  if (attrs && typeof attrs.alt === 'string') out += `${attrs.alt} `
  if (attrs && typeof attrs.caption === 'string') out += `${attrs.caption} `

  if (n.content) out += docText(n.content)

  if (typeof n.type === 'string' && BLOCK_BREAK.has(n.type)) out += '\n\n'

  return out
}

/** The document's text, trimmed — what `body_text` holds. */
export const docPlainText = (doc: ProseDoc): string => docText(doc).trim()

/** Plain prose into a document. Mirrors `public.cnt_text_to_doc`. */
export function textToDoc(body: string): ProseDoc {
  const paragraphs = (body ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)

  return {
    type: 'doc',
    content: paragraphs.map((text) => ({
      type: 'paragraph',
      content: [{ type: 'text', text }],
    })),
  }
}

export const wordCount = (doc: ProseDoc): number => {
  const text = docPlainText(doc)
  return text ? text.split(/\s+/).filter(Boolean).length : 0
}

/**
 * What a redacted term becomes. Ten asterisks whatever the word's length — a
 * mask that tracked length would tell you the name has six letters.
 */
export const REDACTION = '**********'

const ESCAPE = /[.^$*+?()[\]{}|\\-]/g

/**
 * Replaces each term with {@link REDACTION}, case-insensitively and on word
 * boundaries, so "Mando" does not touch "mandolin" but does take "Mando's".
 *
 * **Mirrors `public.cnt_redact_text` exactly.** The database is what actually
 * protects a contributor — this copy exists only so the studio's preview shows
 * the creator what readers will get. If the two disagree she is previewing a
 * lie, so `packages/core/test/prose.test.ts` pins them to the same cases.
 */
export function redactText(text: string, terms: readonly string[]): string {
  let out = text
  for (const raw of terms) {
    const term = raw.trim()
    if (!term) continue
    out = out.replace(new RegExp(`\\b${term.replace(ESCAPE, '\\$&')}\\b`, 'gi'), REDACTION)
  }
  return out
}

/** The same, over a document. Mirrors `public.cnt_redact_doc`. */
export function redactDoc(doc: ProseDoc, terms: readonly string[]): ProseDoc {
  if (terms.length === 0) return doc
  return redactNode(doc as unknown as JsonValue, terms) as unknown as ProseDoc
}

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

/** The three keys that hold prose a reader sees; `src` and the rest are left alone. */
const REDACTED_KEYS = new Set(['text', 'alt', 'caption'])

function redactNode(value: JsonValue, terms: readonly string[]): JsonValue {
  if (Array.isArray(value)) return value.map((item) => redactNode(item, terms))
  if (value === null || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      REDACTED_KEYS.has(key) && typeof child === 'string'
        ? redactText(child, terms)
        : redactNode(child, terms),
    ]),
  )
}

/** Roughly 200 words a minute, which is the pace this prose reads at. */
export const readMinutesFor = (doc: ProseDoc): number =>
  Math.max(1, Math.round(wordCount(doc) / 200))

/**
 * §75's URL shapes. A single-part story is canonically `/stories/<slug>`; a part
 * of a series gets its own address so it can be shared and indexed on its own.
 */
export function canonicalPath(slug: string, options: { part?: number; isSeries?: boolean } = {}): string {
  const { part, isSeries = false } = options
  if (!isSeries || !part || part < 1) return `/stories/${slug}`
  return `/stories/${slug}/part-${part}`
}

/**
 * The inverse of `canonicalPath`, for the router.
 *
 * The part lives in the URL as `part-3`, not as a bare `3`, and a React Router
 * route cannot pick the number out of it: a dynamic segment has to occupy a
 * whole path segment, so `/stories/:slug/part-:part` matches nothing at all and
 * every part of every series answered 404. The route captures the whole segment
 * and this reads the number back out of it, which keeps §75's addresses and the
 * one definition of them in the same file.
 *
 * Anything that is not `part-<n>` returns null and the caller falls back to the
 * first part, the same way an out-of-range number is clamped rather than
 * refused.
 */
export function partFromSegment(segment: string | undefined): number | null {
  const match = /^part-(\d+)$/.exec(segment ?? '')
  if (!match) return null
  const part = Number(match[1])
  return part >= 1 ? part : null
}

export const canonicalUrl = (
  siteUrl: string,
  slug: string,
  options: { part?: number; isSeries?: boolean } = {},
): string => `${siteUrl.replace(/\/$/, '')}${canonicalPath(slug, options)}`
