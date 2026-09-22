import { useCallback, useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { uploadFigure, type ProseDoc } from '@amakefe/core'
import { db } from '../../db'
import { StoredImage } from './StoredImage'
import { ImageDialog, type ImageDetails } from './ImageDialog'
import { stripPastedImages } from './pastedHtml'

/**
 * The writing surface.
 *
 * The node set is kept to what the schema allows and what the reader renders.
 * Links in particular are switched off: a URL inside an anonymous story is a
 * de-anonymisation vector, so the editor cannot produce one at all rather than
 * relying on anyone remembering not to.
 */
const extensions = [
  StarterKit.configure({
    heading: { levels: [2] },
    link: false,
    codeBlock: false,
    code: false,
    strike: false,
    bulletList: false,
    orderedList: false,
    listItem: false,
  }),
  StoredImage.configure({ inline: false, allowBase64: false }),
]

export function PartEditor({
  storyId,
  initialBody,
  onChange,
}: {
  storyId: string
  initialBody: ProseDoc
  onChange: (doc: ProseDoc) => void
}) {
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const editor = useEditor({
    extensions,
    content: initialBody,
    editorProps: {
      transformPastedHTML: stripPastedImages,
      attributes: {
        class:
          'prose-editor min-h-[520px] w-full rounded-card border border-line-card bg-surface p-6 font-prose text-[16.5px] leading-[1.8] text-ink-soft outline-none focus:border-line-strong',
        'aria-label': 'Story text',
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getJSON() as ProseDoc),
  })

  // The editor is keyed by part id upstream, so this only guards the rare case
  // of the same part's content being replaced (a conflict reload).
  useEffect(() => {
    if (editor && !editor.isDestroyed && editor.isEmpty && (initialBody.content?.length ?? 0) > 0) {
      editor.commands.setContent(initialBody)
    }
  }, [editor, initialBody])

  // Uploaded only once the description is filled in, so cancelling leaves no
  // orphan file in the bucket.
  const insertImage = useCallback(
    async ({ alt, caption }: ImageDetails) => {
      if (!editor || !pendingFile) return
      setUploadError(null)
      setUploading(true)
      try {
        const path = await uploadFigure(db, storyId, pendingFile)
        editor.chain().focus().setImage({ src: path, alt, caption } as never).run()
        setPendingFile(null)
      } catch (error) {
        setUploadError(error instanceof Error ? error.message : 'Could not add that image.')
      } finally {
        setUploading(false)
      }
    },
    [editor, pendingFile, storyId],
  )

  if (!editor) return <div className="h-[560px] animate-pulse rounded-card bg-surface-tint" />

  return (
    <div className="flex flex-col gap-3">
      <Toolbar editor={editor} onPickImage={setPendingFile} />
      <EditorContent editor={editor} />

      {pendingFile && (
        <ImageDialog
          file={pendingFile}
          busy={uploading}
          error={uploadError}
          onInsert={insertImage}
          onCancel={() => {
            setPendingFile(null)
            setUploadError(null)
          }}
        />
      )}
    </div>
  )
}

function Toolbar({
  editor,
  onPickImage,
}: {
  editor: Editor
  onPickImage: (file: File) => void
}) {
  const fileInput = useRef<HTMLInputElement>(null)

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-full border border-line-card bg-surface px-2 py-1.5">
      <Button
        label="Italic"
        hint="⌘I"
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <span className="font-prose italic">I</span>
      </Button>
      <Button
        label="Bold"
        hint="⌘B"
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <span className="font-semibold">B</span>
      </Button>

      <Divider />

      <Button
        label="Section heading"
        active={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <span className="font-display">H</span>
      </Button>
      <Button
        label="Pull quote"
        active={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <span className="font-prose text-[17px]">&rdquo;</span>
      </Button>
      <Button label="Section break" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        <span className="tracking-[0.15em] text-[13px]">⁂</span>
      </Button>

      <Divider />

      <Button label="Add an image" onClick={() => fileInput.current?.click()}>
        <ImageIcon />
      </Button>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onPickImage(file)
          event.target.value = ''
        }}
      />

      <Divider />

      <Button
        label="Undo"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
      >
        <span>↶</span>
      </Button>
      <Button
        label="Redo"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
      >
        <span>↷</span>
      </Button>
    </div>
  )
}

function ImageIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <circle cx="8.5" cy="10" r="1.6" />
      <path d="M21 16l-5-5-5.5 5.5L8 14l-5 5" />
    </svg>
  )
}

const Divider = () => <span className="mx-1 h-5 w-px bg-line-card" aria-hidden />

function Button({
  children,
  label,
  hint,
  active = false,
  disabled = false,
  onClick,
}: {
  children: React.ReactNode
  label: string
  hint?: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={hint ? `${label} (${hint})` : label}
      aria-label={label}
      aria-pressed={active}
      className={`flex size-8 items-center justify-center rounded-full text-[15px] transition-colors disabled:opacity-30 ${
        active ? 'bg-ink text-surface-warm' : 'text-body hover:bg-surface-warm'
      }`}
    >
      {children}
    </button>
  )
}
