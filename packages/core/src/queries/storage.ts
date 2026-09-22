import type { Db } from '../supabase'

/**
 * Media.
 *
 * One bucket: `public_media`, holding cover images and the figures inside a
 * story. There was a second, `source_media`, for voice notes and call
 * recordings — it went when the platform stopped touching source material at
 * all. §54 asks for private source audio to be kept apart from public media;
 * not holding it is the stronger version of that.
 */

export const PUBLIC_BUCKET = 'public_media'

/** Longest edge of an uploaded image. Large enough for a cover, small enough to send. */
const MAX_EDGE = 1600

/**
 * Re-encodes to WebP at a sane size before upload. Two things fall out of this
 * besides the file being smaller: EXIF is dropped, and every image in the
 * library ends up in one format.
 */
export async function prepareImage(file: Blob, maxEdge = MAX_EDGE): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = new OffscreenCanvas(width, height)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not prepare the image in this browser.')
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  return canvas.convertToBlob({ type: 'image/webp', quality: 0.86 })
}

export const publicUrl = (db: Db, path: string | null): string | null =>
  path ? db.storage.from(PUBLIC_BUCKET).getPublicUrl(path).data.publicUrl : null

const PUBLIC_PREFIX = `/storage/v1/object/public/${PUBLIC_BUCKET}/`

/**
 * The inverse of publicUrl.
 *
 * A document stores storage paths, never URLs — a URL would pin the document to
 * one environment. The editor has to show a real URL, so anything that comes
 * back from it is normalised here before being saved.
 */
export function toStoragePath(value: string): string {
  const index = value.indexOf(PUBLIC_PREFIX)
  return index === -1 ? value : value.slice(index + PUBLIC_PREFIX.length)
}

/**
 * Walks a document and rewrites any image src that arrived as a URL back to a
 * path. Belt and braces: the editor is supposed to keep paths in its attributes,
 * and this makes it impossible for a mistake there to reach the database.
 */
export function normaliseDocPaths<T>(doc: T): T {
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk)
    if (!node || typeof node !== 'object') return node

    const record = node as Record<string, unknown>
    const next: Record<string, unknown> = { ...record }

    if (record.type === 'image' && record.attrs && typeof record.attrs === 'object') {
      const attrs = record.attrs as Record<string, unknown>
      if (typeof attrs.src === 'string') {
        next.attrs = { ...attrs, src: toStoragePath(attrs.src) }
      }
    }
    if (record.content) next.content = walk(record.content)
    return next
  }
  return walk(doc) as T
}

async function upload(db: Db, path: string, blob: Blob): Promise<string> {
  const { error } = await db.storage
    .from(PUBLIC_BUCKET)
    .upload(path, blob, { contentType: 'image/webp', upsert: true })
  if (error) throw error
  return path
}

export async function uploadCover(db: Db, storyId: string, file: Blob): Promise<string> {
  return upload(db, `stories/${storyId}/cover.webp`, await prepareImage(file))
}

/** A figure inside the prose. Named uniquely so replacing one never breaks another. */
export async function uploadFigure(db: Db, storyId: string, file: Blob): Promise<string> {
  const name = crypto.randomUUID()
  return upload(db, `stories/${storyId}/figures/${name}.webp`, await prepareImage(file))
}
