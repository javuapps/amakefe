import { useState } from 'react'
import { Link } from 'react-router'
import { formatCount } from '@amakefe/core'
import { useSupporterCount } from '../hooks/queries'
import { SupportSheet } from '../components/SupportSheet'

const AMOUNTS = [10, 25, 50, 100, 250] as const

/** The floor the Edge Function enforces, so the screen can say so first. */
const MIN_KWACHA = 5

export function SupportScreen() {
  const [amount, setAmount] = useState<number | 'custom'>(25)
  const [custom, setCustom] = useState('')
  const [giving, setGiving] = useState<number | null>(null)
  const supporters = useSupporterCount()

  const chosen = amount === 'custom' ? Number(custom) || 0 : amount
  const tooSmall = chosen < MIN_KWACHA

  return (
    <div className="flex flex-col px-[22px] pt-[calc(16px+env(safe-area-inset-top,0px))] pb-8">
      <Link to="/" className="text-sm text-body">
        ← Back
      </Link>

      <h1 className="mt-6 font-display text-[30px] leading-[1.15] text-ink">
        Support the Community
      </h1>
      <p className="prose-story mt-3 text-[15.5px]">
        If these stories, conversations and advice have helped you, you can support the work behind
        the community. Every story stays free to read.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-[10px]">
        {AMOUNTS.map((value) => (
          <AmountTile
            key={value}
            label={`ZMW ${value}`}
            active={amount === value}
            onClick={() => setAmount(value)}
          />
        ))}
        <AmountTile
          label="Custom"
          active={amount === 'custom'}
          onClick={() => setAmount('custom')}
        />
      </div>

      {amount === 'custom' && (
        <input
          autoFocus
          inputMode="numeric"
          value={custom}
          onChange={(event) => setCustom(event.target.value.replace(/\D/g, ''))}
          placeholder="Amount in ZMW"
          aria-label="Custom amount in ZMW"
          className="mt-[10px] w-full rounded-xl border border-line-card bg-surface-raised px-4 py-3 text-sm text-ink outline-none placeholder:text-subtle focus:border-accent"
        />
      )}

      {/* Monthly giving stays on the screen and says why it cannot be taken.
          Mobile money here is a one-off prompt to a handset; a standing order
          needs a mandate none of the three networks offer us yet, and a
          checkbox that quietly took one payment would be a lie on a receipt. */}
      <div className="mt-[14px] flex w-full items-center gap-3 rounded-xl border border-line-card p-[15px]">
        <span
          className="flex size-5 items-center justify-center rounded-[5px] border-[1.5px] border-line-strong"
          aria-hidden
        />
        <span className="text-[14.5px] text-muted">
          Monthly contributions are not possible on mobile money yet
        </span>
      </div>

      <button
        type="button"
        onClick={() => setGiving(chosen * 100)}
        disabled={tooSmall}
        className="mt-[18px] w-full rounded-full bg-accent py-4 text-base font-bold text-[#fff6ea] disabled:opacity-40"
      >
        {tooSmall ? 'Choose an amount' : `Support with ZMW ${chosen}`}
      </button>
      <p className="pt-3 text-center text-xs text-muted">
        Airtel Money · MTN MoMo · Zamtel Kwacha
      </p>

      <div className="mt-[26px] rounded-card bg-surface-warm p-[18px]">
        <h2 className="font-display text-[18px] text-ink">
          {supporters.data
            ? `${formatCount(supporters.data)} people support this community`
            : 'Be the first to support this community'}
        </h2>
        <p className="mt-[6px] text-[13.5px] leading-relaxed text-body">
          Their support pays for the phone calls, the data, the editing, and keeps every story free.
        </p>
      </div>

      {giving !== null && (
        <SupportSheet amountMinor={giving} onClose={() => setGiving(null)} />
      )}
    </div>
  )
}

function AmountTile({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border-[1.5px] py-4 text-center text-[15px] font-semibold transition-colors ${
        active ? 'border-accent bg-accent-wash text-accent' : 'border-line-card text-ink'
      }`}
    >
      {label}
    </button>
  )
}
