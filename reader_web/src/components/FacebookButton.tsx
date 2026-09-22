/**
 * "Continue with Facebook", as Meta requires it.
 *
 * The colour, the mark and the wording are brand assets, not design decisions:
 * Meta's platform rules ask for the button unaltered, so this is deliberately
 * the one control in the app that does not follow the product's palette. The
 * blue is quarantined as `--color-facebook` in tokens.css for the same reason.
 *
 * Note the label. Facebook's own "Continue as <Name>" appears inside *their*
 * flow, for someone already signed in to Facebook who has authorised the app
 * before; it is not something this button can render for a first-time visitor.
 */
export function FacebookButton({
  onClick,
  busy = false,
}: {
  onClick: () => void
  busy?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="flex w-full items-center justify-center gap-3 rounded-full bg-facebook px-5 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-facebook-dark disabled:opacity-60"
    >
      <svg viewBox="0 0 24 24" aria-hidden className="size-5 shrink-0 fill-current">
        <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07Z" />
      </svg>
      {busy ? 'Opening Facebook…' : 'Continue with Facebook'}
    </button>
  )
}
