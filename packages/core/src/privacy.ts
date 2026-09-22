import { docPlainText, type ProseDoc } from './models/prose'

/**
 * Draft privacy scan.
 *
 * Spec §25 imagines AI editorial assistance. This is the deterministic half of
 * it, and it is the half that matters most: a phone number or an email address
 * left in a story is the single worst thing that can go wrong in this product,
 * and catching it needs a regular expression, not a model.
 *
 * It is advisory. Nothing here blocks publishing — the creator decides. What it
 * must never do is claim a draft is clean when it is not, so the patterns lean
 * towards flagging.
 */

export type PrivacyFindingLevel = 'danger' | 'warning' | 'clear'

export type PrivacyFinding = {
  level: PrivacyFindingLevel
  message: string
  /** 1-based paragraph number, when the finding sits in one. */
  paragraph?: number
  /** The matched text, so the creator can find it. */
  excerpt?: string
}

/** Zambian mobile numbers, international forms, and bare runs of digits. */
const PHONE = /(?:\+?26\d[\s-]?)?(?:0?9[5-7]\d)[\s-]?\d{3}[\s-]?\d{3,4}|\+\d[\d\s-]{8,}\d/g
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]{2,}/g

/**
 * Titles that in this community almost always precede a real person's name.
 * Deliberately narrow — flagging every capitalised word would train the creator
 * to ignore the panel.
 */
const NAMED_PERSON = /\b(?:Mr|Mrs|Ms|Dr|Pastor|Bishop|Reverend|Apostle|Prophet)\.?\s+[A-Z][a-z]+/g

/** Places specific enough to identify a household in Lusaka or the Copperbelt. */
const PLACES = [
  'Kabulonga', 'Woodlands', 'Chelston', 'Chilenje', 'Matero', 'Chawama',
  'Kalingalinga', 'Olympia', 'Roma', 'Avondale', 'Ibex Hill', 'Rhodes Park',
  'Riverside', 'Parklands', 'Kansenshi', 'Nkana', 'Itimpi',
]

const paragraphsOf = (text: string) =>
  text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)

/**
 * Accepts either a document or plain text, so the same scan covers the story
 * body, the title, the summary and the Facebook teaser — the teaser especially,
 * since that is the text that reaches 200,000 people.
 *
 * Paragraph numbers line up with the document's blocks because docPlainText
 * puts a blank line between them, the same as the `body_text` column.
 */
export function scanForIdentifiers(input: string | ProseDoc): PrivacyFinding[] {
  const text = typeof input === 'string' ? input : docPlainText(input)
  const findings: PrivacyFinding[] = []
  const paragraphs = paragraphsOf(text)

  paragraphs.forEach((paragraph, index) => {
    const number = index + 1

    for (const match of paragraph.match(PHONE) ?? []) {
      findings.push({
        level: 'danger',
        message: `A phone number appears in paragraph ${number}. Remove it before publishing.`,
        paragraph: number,
        excerpt: match.trim(),
      })
    }

    for (const match of paragraph.match(EMAIL) ?? []) {
      findings.push({
        level: 'danger',
        message: `An email address appears in paragraph ${number}. Remove it before publishing.`,
        paragraph: number,
        excerpt: match,
      })
    }

    for (const match of paragraph.match(NAMED_PERSON) ?? []) {
      findings.push({
        level: 'warning',
        message: `A named person appears in paragraph ${number}. Change the name if it could identify anyone.`,
        paragraph: number,
        excerpt: match,
      })
    }
  })

  // Place names are counted across the whole draft: one mention is colour, two
  // or more starts to narrow down where someone lives.
  for (const place of PLACES) {
    const count = text.split(new RegExp(`\\b${place}\\b`, 'gi')).length - 1
    if (count >= 2) {
      findings.push({
        level: 'warning',
        message: `“${place}” appears ${count} times. Consider changing it — a repeated place name narrows down who this is.`,
        excerpt: place,
      })
    }
  }

  if (findings.length === 0) {
    findings.push({
      level: 'clear',
      message: 'No phone numbers, email addresses or identifying place names found.',
    })
  }

  return findings
}

export const hasBlockingFinding = (findings: PrivacyFinding[]): boolean =>
  findings.some((finding) => finding.level === 'danger')
