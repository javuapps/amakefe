import { clear, del, get, set } from 'idb-keyval'
import type { ProseDoc } from '@amakefe/core'

/**
 * A local copy of whatever is being typed, kept in IndexedDB.
 *
 * Autosave covers a flaky connection; this covers the browser closing, the
 * laptop sleeping, or the power going — all of which are ordinary here. On
 * opening a part, a local buffer newer than the server's row is offered back
 * rather than silently applied.
 *
 * This is a deliberate exception to the studio's "cache nothing" rule in
 * vite.config.ts: the service worker caches no API responses because unpublished
 * work should not sit on disk. A draft the author is actively writing is the one
 * thing worth that trade, so the store is cleared on sign-out.
 */

const key = (partId: string) => `draft:${partId}`

export type LocalDraft = {
  body: ProseDoc
  savedAt: number
  /** The server's updated_at when this buffer was written, for comparison. */
  baseUpdatedAt: string
}

export const readDraft = (partId: string): Promise<LocalDraft | undefined> =>
  get<LocalDraft>(key(partId)).catch(() => undefined)

export const writeDraft = (partId: string, draft: LocalDraft): Promise<void> =>
  set(key(partId), draft).catch(() => undefined)

export const clearDraft = (partId: string): Promise<void> =>
  del(key(partId)).catch(() => undefined)

/** Called on sign-out: nothing of the creator's work is left on a shared machine. */
export const clearAllDrafts = (): Promise<void> => clear().catch(() => undefined)
