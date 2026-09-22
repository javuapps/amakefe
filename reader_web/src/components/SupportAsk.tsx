import { Suspense, lazy, useState } from 'react'
import { Link } from 'react-router'
import { SUPPORT_AMOUNTS, supporterLine, type SupportPlacement } from '@amakefe/core'
import { useSupporterCount } from '../hooks/queries'

/**
 * Ask for support, wherever a reader has just finished something.
 *
 * The same block in a 272px rail beside Stories and in a 680px column under a
 * community post, which is why it carries **no `lg:` class at all**: it
 * renders at two very different widths and a viewport query cannot tell them
 * apart. Width belongs to whoever places it. The amounts are pills that size
 * to their own text rather than a grid, for the same reason — three buttons
 * stretched across a wide column read as a form.
 *
 * `placement` is where this copy of the ask is, and it travels with the money:
 * through the sheet, into `lenco-collect`, onto the row. It says where the
 * button was and can say nothing about who pressed it.
 *
 * The three amounts are the first three of the ladder the Support screen
 * offers — one ladder in the product, in `@amakefe/core`, rather than one per
 * surface. Anyone who wants a different figure gets there through the link,
 * which carries the placement with it so the ask still gets the credit.
 */

// Only ever needed after a tap, and `HomeScreen` is eagerly imported and pulls
// `PostDetail` in with it — so importing the sheet at the top of this file
// would put the whole payment flow in the entry chunk.
const SupportSheet = lazy(() =>
  import('./SupportSheet').then((module) => ({ default: module.SupportSheet })),
)

export function SupportAsk({ placement }: { placement: SupportPlacement }) {
  const [giving, setGiving] = useState<number | null>(null)
  const supporters = useSupporterCount()

  return (
    <div className="rounded-card bg-surface-warm p-[18px]">
      <h3 className="font-display text-[17px] text-ink">Support the Community</h3>
      <p className="mt-[6px] text-[13.5px] leading-relaxed text-body">
        If these stories have helped you, you can support the work behind them. Every story stays
        free to read.
      </p>

      <div className="mt-[14px] flex flex-wrap gap-2">
        {SUPPORT_AMOUNTS.slice(0, 3).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setGiving(value * 100)}
            className="rounded-full border-[1.5px] border-accent px-[14px] py-[7px] text-[13px] font-semibold text-accent transition-colors hover:bg-accent-wash"
          >
            ZMW {value}
          </button>
        ))}
      </div>

      <Link
        to={`/support?from=${placement}`}
        className="mt-[10px] inline-block text-xs text-accent underline-offset-2 hover:underline"
      >
        Another amount
      </Link>

      {/* The one honest piece of social proof the product already computes:
          one public number that names nobody. */}
      {supporters.data ? (
        <p className="mt-3 text-xs text-muted">
          {supporterLine(supporters.data)}
        </p>
      ) : null}

      {giving !== null && (
        <Suspense fallback={null}>
          <SupportSheet
            amountMinor={giving}
            placement={placement}
            onClose={() => setGiving(null)}
          />
        </Suspense>
      )}
    </div>
  )
}
