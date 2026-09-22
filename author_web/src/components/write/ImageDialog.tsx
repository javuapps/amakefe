import { useEffect, useState } from 'react'

/**
 * Describing an image before it goes in.
 *
 * The description is required — a story that reaches someone using a screen
 * reader should not have a hole in it where a picture was. The caption is
 * optional and appears under the image for everyone.
 *
 * The file is not uploaded until Insert, so cancelling leaves nothing behind.
 */
export type ImageDetails = { alt: string; caption: string | null }

export function ImageDialog({
  file,
  busy,
  error,
  onInsert,
  onCancel,
}: {
  file: File
  busy: boolean
  error: string | null
  onInsert: (details: ImageDetails) => void
  onCancel: () => void
}) {
  const [alt, setAlt] = useState('')
  const [caption, setCaption] = useState('')
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [busy, onCancel])

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!alt.trim()) return
    onInsert({ alt: alt.trim(), caption: caption.trim() || null })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Add an image"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel()
      }}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-card border border-line-card bg-surface p-5 shadow-xl"
      >
        <h2 className="font-display text-[19px] text-ink">Add an image</h2>

        {preview && (
          <img
            src={preview}
            alt=""
            className="mt-4 max-h-56 w-full rounded-lg object-contain"
          />
        )}

        <label className="mt-4 flex flex-col gap-1">
          <span className="text-xs text-muted">
            Describe it <span className="text-accent-deep">·</span> required
          </span>
          <input
            autoFocus
            value={alt}
            onChange={(event) => setAlt(event.target.value)}
            placeholder="A receipt folded on a kitchen table"
            className="w-full rounded-lg border border-line-card bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-line-strong"
          />
          <span className="text-xs text-muted">
            Read aloud to anyone who cannot see the image.
          </span>
        </label>

        <label className="mt-3 flex flex-col gap-1">
          <span className="text-xs text-muted">Caption · optional</span>
          <input
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            className="w-full rounded-lg border border-line-card bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-line-strong"
          />
          <span className="text-xs text-muted">Shown under the image in the story.</span>
        </label>

        {error && <p className="mt-3 text-xs text-accent-deep">{error}</p>}

        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="text-xs text-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !alt.trim()}
            className="rounded-full bg-ink px-5 py-2 text-xs font-semibold text-surface-warm disabled:opacity-40"
          >
            {busy ? 'Adding…' : 'Insert image'}
          </button>
        </div>
      </form>
    </div>
  )
}
