/**
 * Pasted `<img>` tags become their alt text.
 *
 * She writes on Facebook and pastes into here, and Facebook renders every emoji
 * as an image — `<img alt="🌿">` — so a pasted paragraph arrived as a row of
 * broken pictures with the emoji beside each one. Taking the alt text puts the
 * character back where the picture was.
 *
 * Dropping the image itself is not a workaround, it is the rule. `image.src`
 * holds a path in our own bucket, never a URL; a remote one renders nothing
 * here and, worse, would survive into a published anonymous story as a request
 * to someone else's server on every reader's behalf — handing that server each
 * reader's address. That is the same de-anonymisation vector links are switched
 * off for. An image belongs to a story only once it has been uploaded, which is
 * what the toolbar's image button is for.
 *
 * This lives in its own module rather than beside the editor component on
 * purpose: a second export in a file that exports a component breaks React Fast
 * Refresh, and Vite then remounts the editor mid-write. See the note on
 * `useAutosave`.
 */
export function stripPastedImages(html: string): string {
  const parsed = new DOMParser().parseFromString(html, 'text/html')
  for (const image of parsed.querySelectorAll('img')) {
    image.replaceWith(parsed.createTextNode(image.getAttribute('alt') ?? ''))
  }
  return parsed.body.innerHTML
}
