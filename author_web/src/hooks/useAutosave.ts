import { useCallback, useEffect, useRef, useState } from 'react'
import { ConcurrentEditError, docPlainText, savePartBody, type ProseDoc } from '@amakefe/core'
import { db } from '../db'
import { clearDraft, writeDraft } from '../draftStore'

export type SaveState =
  | { status: 'idle'; savedAt: Date | null }
  | { status: 'saving' }
  | { status: 'error'; message: string }
  | { status: 'conflict' }

const IDLE_DELAY = 1500
const MAX_DELAY = 20000

/**
 * Saves a part while it is being written.
 *
 * Debounced to 1.5s of stillness, but forced through every 20 seconds so that
 * continuous typing still reaches the server, and flushed on anything that
 * looks like leaving: switching part, hiding the tab, closing the window.
 *
 * Every keystroke also lands in IndexedDB, which is what actually protects
 * against the browser dying — the network save is best-effort by comparison.
 *
 * **It will not blank a part that had words in it.** An editor that remounts
 * can emit an empty document before its content is restored, and the unmount
 * flush then writes that emptiness over the story — which is exactly how a
 * part was lost once, when a new export in the editor's module broke Fast
 * Refresh and Vite remounted it mid-write. Nothing downstream wants an empty
 * part either: publishing refuses one. So emptiness is simply never saved over
 * content, and a writer clearing the page to start again saves the moment they
 * type the first word of the replacement.
 */
export function useAutosave(partId: string, serverUpdatedAt: string, hadContent: boolean) {
  const [state, setState] = useState<SaveState>({ status: 'idle', savedAt: null })

  const pending = useRef<ProseDoc | null>(null)
  const updatedAt = useRef(serverUpdatedAt)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const maxTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    updatedAt.current = serverUpdatedAt
  }, [serverUpdatedAt])

  const clearTimers = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current)
    if (maxTimer.current) clearTimeout(maxTimer.current)
    idleTimer.current = null
    maxTimer.current = null
  }

  const flush = useCallback(async () => {
    const body = pending.current
    if (!body) return
    pending.current = null
    clearTimers()

    setState({ status: 'saving' })
    try {
      updatedAt.current = await savePartBody(db, partId, body, updatedAt.current)
      await clearDraft(partId)
      setState({ status: 'idle', savedAt: new Date() })
    } catch (error) {
      if (error instanceof ConcurrentEditError) {
        // Another editor saved. Say so rather than overwriting their work.
        setState({ status: 'conflict' })
        return
      }
      setState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Could not save.',
      })
    }
  }, [partId])

  // Seeded from the part as it arrived, then latched: once this editor has held
  // words, an empty document from it is a fault rather than an intention.
  const hasHadContent = useRef(hadContent)

  const change = useCallback(
    (body: ProseDoc) => {
      const empty = docPlainText(body).trim() === ''
      if (!empty) hasHadContent.current = true
      else if (hasHadContent.current) return

      pending.current = body
      void writeDraft(partId, {
        body,
        savedAt: Date.now(),
        baseUpdatedAt: updatedAt.current,
      })

      if (idleTimer.current) clearTimeout(idleTimer.current)
      idleTimer.current = setTimeout(() => void flush(), IDLE_DELAY)
      // Someone writing without pause would otherwise never trigger the idle
      // save, so cap the gap.
      if (!maxTimer.current) {
        maxTimer.current = setTimeout(() => void flush(), MAX_DELAY)
      }
    },
    [flush, partId],
  )

  // Flush on the way out, in every sense.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flush()
    }
    const onUnload = () => {
      if (pending.current) void flush()
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('beforeunload', onUnload)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('beforeunload', onUnload)
      void flush()
      clearTimers()
    }
  }, [flush])

  return { state, change, flush, hasPending: () => pending.current !== null }
}

export function describeSaveState(state: SaveState): string {
  switch (state.status) {
    case 'saving':
      return 'Saving…'
    case 'error':
      return 'Not saved — retrying'
    case 'conflict':
      return 'Changed elsewhere'
    case 'idle':
      return state.savedAt
        ? `Saved ${state.savedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
        : ''
  }
}
