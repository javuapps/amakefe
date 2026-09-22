import { useState } from 'react'
import { Link } from 'react-router'
import { formatCount } from '@amakefe/core'
import { useSupporterCount } from '../hooks/queries'

const AMOUNTS = [10, 25, 50, 100, 250] as const

export function SupportScreen() {
  const [amount, setAmount] = useState<number | 'custom'>(25)
  const [custom, setCustom] = useState('')
  const [monthly, setMonthly] = useState(false)
  const supporters = useSupporterCount()

  const chosen = amount === 'custom' ? Number(custom) || 0 : amount

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

      <button
        type="button"
        onClick={() => setMonthly((on) => !on)}
        className="mt-[14px] flex w-full items-center gap-3 rounded-xl border border-line-card p-[15px] text-left"
      >
        <span
          className={`flex size-5 items-center justify-center rounded-[5px] border-[1.5px] text-xs ${
            monthly ? 'border-accent bg-accent text-surface' : 'border-line-strong'
          }`}
          aria-hidden
        >
          {monthly ? '✓' : ''}
        </span>
        <span className="text-[14.5px] text-ink">Make this a monthly contribution</span>
      </button>

      {/* Payments are not connected. A disabled button that says why beats a
          button that appears to take money and cannot. */}
      <button
        type="button"
        disabled
        className="mt-[18px] w-full rounded-full bg-accent py-4 text-base font-bold text-[#fff6ea] opacity-50"
      >
        {monthly ? `Support ZMW ${chosen} monthly` : `Support with ZMW ${chosen}`}
      </button>
      <p className="pt-3 text-center text-xs text-muted">
        Airtel Money · MTN MoMo · Zamtel Kwacha · Card
      </p>
      <p className="pt-2 text-center text-xs text-accent-deep">
        Mobile money is not connected yet, so this cannot take a payment.
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
