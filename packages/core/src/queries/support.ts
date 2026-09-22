import type { Db } from '../supabase'
import type { Enums, Tables } from '../database.types'
import { networkName, type Operator } from '../support'

/**
 * Supporting the community.
 *
 * Every `sup_` call in the system lives here. Starting a payment is the one
 * place the reader talks to an Edge Function rather than to Postgres, because
 * the row is written by the service role — a client that could insert its own
 * payment row could write its own amount.
 */

/** How many people support the community — the only figure `sup_` exposes publicly. */
export async function fetchSupporterCount(db: Db): Promise<number> {
  const { data, error } = await db.rpc('sup_supporter_count')
  if (error) throw error
  return data ?? 0
}

export type CollectionRequest = {
  amountMinor: number
  operator: Operator
  phone: string
  /** What to call them on the receipt. Optional — giving needs no name. */
  name?: string
}

/**
 * Prompts the supporter's handset.
 *
 * Returns as soon as the network has been asked, which is long before anyone
 * has approved anything: mobile money is a conversation with a phone in
 * someone's hand. The reference it hands back is how the screen follows it.
 *
 * Errors carry the function's own sentence — "0977000111 is on Airtel Money,
 * not MTN MoMo." — because those are the ones worth showing.
 */
export async function startCollection(db: Db, request: CollectionRequest): Promise<string> {
  const { data, error } = await db.functions.invoke<{ reference?: string; error?: string }>(
    'lenco-collect',
    { body: request },
  )

  // A non-2xx answer arrives as an error with the body unread, so the sentence
  // the function wrote is inside it rather than in `data`.
  if (error) {
    const body = await readErrorBody(error)
    throw new Error(body ?? 'That did not reach the payment service.')
  }
  if (!data?.reference) throw new Error(data?.error ?? 'That payment could not be started.')
  return data.reference
}

async function readErrorBody(error: unknown): Promise<string | null> {
  const response = (error as { context?: Response }).context
  if (!(response instanceof Response)) return null
  const body = await response.json().catch(() => null)
  return typeof body?.error === 'string' ? body.error : null
}

export type CollectionStatus = {
  status: Enums<'sup_status'>
  amountMinor: number
  operator: Operator | null
  completedAt: Date | null
}

/**
 * Where a payment has got to.
 *
 * Keyed on the reference rather than on the reader, because a supporter need
 * not be signed in — see `sup_collection_status`, which is what makes that
 * safe. Null while the row cannot be found, which on a fresh reference means
 * the insert has not landed rather than that it failed.
 */
export async function fetchCollectionStatus(
  db: Db,
  reference: string,
): Promise<CollectionStatus | null> {
  const { data, error } = await db.rpc('sup_collection_status', { p_reference: reference })
  if (error) throw error

  const row = data?.[0]
  if (!row) return null
  return {
    status: row.status,
    amountMinor: row.amount_minor,
    operator: (row.operator as Operator | null) ?? null,
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
  }
}

// ---------------------------------------------------------------------------
// The ledger, as staff and operators read it
// ---------------------------------------------------------------------------

export type SupportTransaction = {
  id: string
  amountMinor: number
  commissionMinor: number
  netMinor: number
  currency: string
  provider: string
  operator: Operator | null
  payerMobile: string | null
  payerName: string | null
  reference: string | null
  status: Enums<'sup_status'>
  settlementStatus: Enums<'sup_settlement_status'>
  createdAt: Date
  completedAt: Date | null
}

const toTransaction = (row: Tables<'sup_transactions'>): SupportTransaction => ({
  id: row.id,
  amountMinor: row.amount_minor,
  commissionMinor: row.commission_minor,
  // Generated from the two columns above and never actually null; Postgres
  // reports generated columns as nullable because it cannot prove otherwise.
  netMinor: row.net_minor ?? 0,
  currency: row.currency,
  provider: row.provider,
  operator: (row.operator as Operator | null) ?? null,
  payerMobile: row.payer_mobile,
  payerName: row.payer_name,
  reference: row.internal_reference,
  status: row.status,
  settlementStatus: row.settlement_status,
  createdAt: new Date(row.created_at),
  completedAt: row.completed_at ? new Date(row.completed_at) : null,
})

/**
 * Payments, newest first. RLS decides the scope: a supporter sees their own,
 * staff and operators see all of them.
 */
export async function fetchSupportTransactions(
  db: Db,
  options: { status?: Enums<'sup_status'>; limit?: number } = {},
): Promise<SupportTransaction[]> {
  let query = db
    .from('sup_transactions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(options.limit ?? 50)
  if (options.status) query = query.eq('status', options.status)

  const { data, error } = await query
  if (error) throw error
  return data.map(toTransaction)
}

/** The money as both sides read it — what came in, what is owed, what was paid. */
export type SupportTotals = {
  supporters: number
  collectedMinor: number
  commissionMinor: number
  netMinor: number
  awaitingMinor: number
  awaitingCount: number
  settledMinor: number
}

export async function fetchSupportTotals(db: Db): Promise<SupportTotals> {
  const { data, error } = await db.rpc('sup_totals')
  if (error) throw error

  const row = data?.[0]
  return {
    supporters: row?.supporters ?? 0,
    collectedMinor: row?.collected_minor ?? 0,
    commissionMinor: row?.commission_minor ?? 0,
    netMinor: row?.net_minor ?? 0,
    awaitingMinor: row?.awaiting_minor ?? 0,
    awaitingCount: row?.awaiting_count ?? 0,
    settledMinor: row?.settled_minor ?? 0,
  }
}

export type Settlement = {
  id: string
  reference: string
  periodFrom: Date
  periodTo: Date
  paymentCount: number
  grossMinor: number
  commissionMinor: number
  netMinor: number
  /** Where it was paid, as it stood on the day — the row is a statement. */
  accountName: string
  accountKind: Enums<'sup_account_kind'>
  destination: string
  transferReference: string | null
  notes: string | null
  settledAt: Date
}

const toSettlement = (row: Tables<'sup_settlements'>): Settlement => ({
  id: row.id,
  reference: row.reference,
  periodFrom: new Date(row.period_from),
  periodTo: new Date(row.period_to),
  paymentCount: row.payment_count,
  grossMinor: row.gross_minor,
  commissionMinor: row.commission_minor,
  netMinor: row.net_minor,
  accountName: row.account_name,
  accountKind: row.account_kind,
  // The network's proper name, not the enum value: the statement says
  // "Airtel Money" and a screen beside it saying "airtel" reads as a different
  // system describing the same payout.
  destination:
    row.account_kind === 'bank'
      ? [row.bank_name, row.account_number].filter(Boolean).join(' · ')
      : [
          row.mobile_operator ? networkName(row.mobile_operator as Operator) : null,
          row.mobile_number,
        ]
          .filter(Boolean)
          .join(' · '),
  transferReference: row.transfer_reference,
  notes: row.notes,
  settledAt: new Date(row.settled_at),
})

/** Payouts, newest first. Staff read them; only operators can create one. */
export async function fetchSettlements(db: Db, limit = 24): Promise<Settlement[]> {
  const { data, error } = await db
    .from('sup_settlements')
    .select('*')
    .order('settled_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data.map(toSettlement)
}

export type SettlementAccount = {
  id: string
  kind: Enums<'sup_account_kind'>
  accountName: string
  bankName: string | null
  branch: string | null
  accountNumber: string | null
  mobileOperator: string | null
  mobileNumber: string | null
  createdAt: Date
}

const toAccount = (row: Tables<'sup_settlement_accounts'>): SettlementAccount => ({
  id: row.id,
  kind: row.kind,
  accountName: row.account_name,
  bankName: row.bank_name,
  branch: row.branch,
  accountNumber: row.account_number,
  mobileOperator: row.mobile_operator,
  mobileNumber: row.mobile_number,
  createdAt: new Date(row.created_at),
})

/** Where she is paid, or null while no operator has recorded an account. */
export async function fetchSettlementAccount(db: Db): Promise<SettlementAccount | null> {
  const { data, error } = await db
    .from('sup_settlement_accounts')
    .select('*')
    .is('retired_at', null)
    .maybeSingle()
  if (error) throw error
  return data ? toAccount(data) : null
}

// ---------------------------------------------------------------------------
// The operator's writes
// ---------------------------------------------------------------------------

export type NewSettlementAccount = {
  kind: Enums<'sup_account_kind'>
  accountName: string
  bankName?: string | null
  branch?: string | null
  accountNumber?: string | null
  mobileOperator?: Operator | null
  mobileNumber?: string | null
}

/**
 * Records where she is paid, retiring whatever was there.
 *
 * A unique index allows one live account, so the old row must be retired in the
 * same breath. It is retired rather than edited because every settlement names
 * the account it actually paid, and a statement already issued must not be
 * rewritten by next month's details.
 */
export async function recordSettlementAccount(
  db: Db,
  account: NewSettlementAccount,
): Promise<void> {
  const { error: retireError } = await db
    .from('sup_settlement_accounts')
    .update({ retired_at: new Date().toISOString() })
    .is('retired_at', null)
  if (retireError) throw retireError

  const { error } = await db.from('sup_settlement_accounts').insert({
    kind: account.kind,
    account_name: account.accountName,
    bank_name: account.bankName ?? null,
    branch: account.branch ?? null,
    account_number: account.accountNumber ?? null,
    mobile_operator: account.mobileOperator ?? null,
    mobile_number: account.mobileNumber ?? null,
  })
  if (error) throw error
}

/**
 * Banks a payout covering everything currently owed.
 *
 * The idempotency key is minted by the caller before the form opens, so the
 * same confirmation sent twice — a double click, a retried request — returns
 * the settlement it already created rather than recording a second payout for
 * one transfer.
 */
export async function settle(
  db: Db,
  input: { idempotencyKey: string; accountId: string; transferReference?: string; notes?: string },
): Promise<string> {
  const { data, error } = await db.rpc('sup_settle', {
    p_idempotency_key: input.idempotencyKey,
    p_account_id: input.accountId,
    p_transfer_reference: input.transferReference?.trim() || undefined,
    p_notes: input.notes?.trim() || undefined,
  })
  if (error) throw error
  return data
}

/** Asks the provider about everything still in flight. Operators only. */
export async function reconcileCollections(
  db: Db,
): Promise<{ asked: number; settled: number; expired: number; reasons: string[] }> {
  const { data, error } = await db.functions.invoke<{
    asked?: number
    settled?: number
    expired?: number
    reasons?: string[]
  }>('lenco-reconcile', { body: {} })
  if (error) throw error
  return {
    asked: data?.asked ?? 0,
    settled: data?.settled ?? 0,
    expired: data?.expired ?? 0,
    reasons: data?.reasons ?? [],
  }
}

// ---------------------------------------------------------------------------
// A settlement's statement
// ---------------------------------------------------------------------------

/** The payments a settlement covered, in the order they cleared. */
export async function fetchSettlementPayments(
  db: Db,
  settlementId: string,
): Promise<SupportTransaction[]> {
  const { data, error } = await db
    .from('sup_transactions')
    .select('*')
    .eq('settlement_id', settlementId)
    .order('completed_at', { ascending: true })
  if (error) throw error
  return data.map(toTransaction)
}

/**
 * The settlement's PDF statement.
 *
 * Rendered by the `settlement-report` Edge Function, which both applications
 * call — so the operator who recorded the payout and the creator who received
 * it hold the same file, down to the byte. The alternative, a renderer in each
 * app, is two programs that agree until one of them is changed.
 */
export async function fetchSettlementReport(db: Db, settlementId: string): Promise<Blob> {
  const { data, error } = await db.functions.invoke<Blob>('settlement-report', {
    body: { settlementId },
  })
  if (error) throw new Error('That statement could not be produced.')
  if (!data) throw new Error('That statement came back empty.')
  return data
}

/**
 * Hands the statement to the browser as a file.
 *
 * The one DOM-touching helper here, alongside `storage.ts`'s use of
 * `OffscreenCanvas`: core is free of *frameworks*, not of the platform.
 *
 * The object URL is revoked on the next frame rather than immediately: Safari
 * has not started the download when `click()` returns, and revoking in the same
 * tick cancels it.
 */
export async function downloadSettlementReport(
  db: Db,
  settlement: Pick<Settlement, 'id' | 'reference'>,
): Promise<void> {
  const blob = await fetchSettlementReport(db, settlement.id)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `settlement-${settlement.reference}.pdf`
  document.body.append(link)
  link.click()
  link.remove()
  requestAnimationFrame(() => URL.revokeObjectURL(url))
}
