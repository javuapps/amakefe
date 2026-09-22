import type { ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'

/** The wide-tracked uppercase label above every section in the prototype. */
export function SectionLabel({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'accent' | 'gold' }) {
  const color = tone === 'accent' ? 'text-accent' : tone === 'gold' ? 'text-gold' : 'text-muted'
  return (
    <div className={`text-[10px] uppercase tracking-label ${color}`}>{children}</div>
  )
}

/** The prototype's pill button, filled or outlined. */
export function Pill({
  children,
  onClick,
  variant = 'outline',
  className = '',
  disabled = false,
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'outline' | 'ink' | 'gold' | 'quiet'
  className?: string
  disabled?: boolean
  type?: 'button' | 'submit'
}) {
  const variants = {
    outline: 'border border-ink text-ink hover:bg-ink hover:text-surface-warm',
    ink: 'bg-ink text-surface-warm hover:bg-ink-soft',
    gold: 'bg-gold text-ink hover:bg-surface-warm',
    quiet: 'border border-line-strong text-body hover:bg-surface-warm',
  } as const

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full px-[22px] py-[11px] text-sm font-semibold tracking-[0.06em] transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-card border border-line-card p-[18px] ${className}`}>{children}</div>
  )
}

/**
 * One place to render loading and failure, so no screen invents its own.
 * Loading is a quiet skeleton rather than a spinner — the design is a printed
 * page, and a spinner on every card reads as noise.
 */
export function Async<T>({
  query,
  children,
  loading,
}: {
  query: UseQueryResult<T>
  children: (data: T) => ReactNode
  loading?: ReactNode
}) {
  if (query.isPending) {
    return <>{loading ?? <div className="h-24 animate-pulse rounded-card bg-surface-tint" />}</>
  }
  if (query.isError) {
    return (
      <p className="py-8 text-sm text-muted">
        We could not load this just now. Check your connection and try again.
      </p>
    )
  }
  return <>{children(query.data)}</>
}
