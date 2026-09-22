import { Fragment, type ReactNode } from 'react'
import type { ProseDoc, ProseMark, ProseNode } from '@amakefe/core'

/**
 * Renders a story document.
 *
 * Used by the reader for the real thing and by the studio for the preview, so
 * the two cannot drift — which is the whole reason this package exists.
 *
 * It walks the node types the schema allows and ignores anything else. There is
 * no `dangerouslySetInnerHTML` anywhere, so a malformed or hostile document can
 * produce wrong-looking output but never script execution.
 */
export function StoryProse({
  doc,
  resolveImage,
}: {
  doc: ProseDoc
  /** Turns a stored path into a URL. Absent in previews of unsaved figures. */
  resolveImage?: (src: string) => string | null
}) {
  const blocks = doc.content ?? []
  return (
    <>
      {blocks.map((node, index) => (
        <Block key={index} node={node} resolveImage={resolveImage} />
      ))}
    </>
  )
}

function Block({
  node,
  resolveImage,
}: {
  node: ProseNode
  resolveImage?: (src: string) => string | null
}): ReactNode {
  switch (node.type) {
    case 'paragraph':
      return <p className="prose-story mb-[17px] last:mb-0"><Inline content={node.content} /></p>

    case 'heading':
      return (
        <h2 className="mt-7 mb-4 font-display text-[21px] leading-snug text-ink">
          <Inline content={node.content} />
        </h2>
      )

    // A pull quote, not a citation: Lora italic against a terracotta rule, which
    // is the treatment the design uses for a line lifted out of the prose.
    case 'blockquote':
      return (
        <blockquote className="my-6 border-l-2 border-accent pl-4 font-prose text-[17px] leading-relaxed text-body italic">
          {(node.content ?? []).map((child, index) => (
            <Block key={index} node={child} resolveImage={resolveImage} />
          ))}
        </blockquote>
      )

    // An asterism rather than a rule — the page is a printed page, and a grey
    // line across it reads like a web divider.
    case 'horizontalRule':
      return (
        <div aria-hidden className="my-8 text-center text-[18px] tracking-[0.5em] text-muted">
          ⁂
        </div>
      )

    case 'image': {
      const src = resolveImage ? resolveImage(node.attrs.src) : node.attrs.src
      if (!src) return null
      return (
        <figure className="my-6">
          <img
            src={src}
            alt={node.attrs.alt}
            className="w-full rounded-card"
            loading="lazy"
            decoding="async"
          />
          {node.attrs.caption && (
            <figcaption className="mt-2 text-center text-xs text-muted">
              {node.attrs.caption}
            </figcaption>
          )}
        </figure>
      )
    }

    case 'text':
      return <Inline content={[node]} />

    default:
      return null
  }
}

function Inline({ content }: { content?: ProseNode[] }): ReactNode {
  if (!content) return null
  return (
    <>
      {content.map((node, index) => {
        if (node.type !== 'text') {
          return <Block key={index} node={node} />
        }
        return <Fragment key={index}>{applyMarks(node.text, node.marks)}</Fragment>
      })}
    </>
  )
}

function applyMarks(text: string, marks?: ProseMark[]): ReactNode {
  let out: ReactNode = text
  for (const mark of marks ?? []) {
    if (mark.type === 'italic') out = <em>{out}</em>
    if (mark.type === 'bold') out = <strong className="font-semibold">{out}</strong>
  }
  return out
}
