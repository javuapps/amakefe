import Image from '@tiptap/extension-image'
import { publicUrl, toStoragePath } from '@amakefe/core'
import { db } from '../../db'

/**
 * The image node stores a **storage path**, not a URL.
 *
 * Paths are what belong in a document: they survive moving between environments
 * and they are what the reader resolves. But a path in `src` is a relative URL
 * to the browser, so the editor showed every inserted image as broken.
 *
 * This extension resolves the path to a public URL when rendering into the
 * editor's DOM, and converts it back on the way in, so the document itself never
 * gains an environment-specific URL.
 */
export const StoredImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      src: {
        default: null,
        // Stored as a path; shown as a URL.
        renderHTML: (attributes: Record<string, unknown>) => ({
          src: publicUrl(db, attributes.src as string | null) ?? '',
        }),
        parseHTML: (element: HTMLElement) => toStoragePath(element.getAttribute('src') ?? ''),
      },
      alt: {
        default: '',
        parseHTML: (element: HTMLElement) => element.getAttribute('alt') ?? '',
      },
      caption: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-caption'),
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes.caption ? { 'data-caption': String(attributes.caption) } : {},
      },
    }
  },
})
