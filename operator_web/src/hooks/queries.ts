import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  downloadSettlementReport,
  fetchSettlementAccount,
  fetchSettlementPayments,
  fetchSettlements,
  fetchSupportByPlacement,
  fetchSupportTotals,
  fetchSupportTransactions,
  recordSettlementAccount,
  reconcileCollections,
  settle,
  type Enums,
  type NewSettlementAccount,
} from '@amakefe/core'
import { db } from '../db'

/**
 * Every Supabase call reaches the console through these hooks. No hook
 * re-checks permissions — RLS and `sup_settle` already decided.
 */
export const keys = {
  transactions: (status: Enums<'sup_status'> | 'all') => ['transactions', status] as const,
  totals: ['totals'] as const,
  placements: ['placements'] as const,
  settlements: ['settlements'] as const,
  account: ['account'] as const,
  settlementPayments: (id: string) => ['settlementPayments', id] as const,
}

export const useTransactions = (status: Enums<'sup_status'> | 'all') =>
  useQuery({
    queryKey: keys.transactions(status),
    queryFn: () =>
      fetchSupportTransactions(db, {
        status: status === 'all' ? undefined : status,
        limit: 200,
      }),
  })

export const useTotals = () => useQuery({ queryKey: keys.totals, queryFn: () => fetchSupportTotals(db) })

/** What each ask has brought in. Payments, not people — see the query. */
export const usePlacements = () =>
  useQuery({ queryKey: keys.placements, queryFn: () => fetchSupportByPlacement(db) })

export const useSettlements = () =>
  useQuery({ queryKey: keys.settlements, queryFn: () => fetchSettlements(db) })

export const useAccount = () =>
  useQuery({ queryKey: keys.account, queryFn: () => fetchSettlementAccount(db) })

/** What a settlement covered. Only fetched once its row is opened. */
export const useSettlementPayments = (settlementId: string | null) =>
  useQuery({
    queryKey: keys.settlementPayments(settlementId ?? ''),
    enabled: settlementId !== null,
    queryFn: () => fetchSettlementPayments(db, settlementId!),
  })

/**
 * The PDF. A mutation rather than a query: it is a file leaving the app, not
 * state, and there is nothing to cache when the renderer is deterministic.
 */
export const useDownloadStatement = () =>
  useMutation({
    mutationFn: (settlement: { id: string; reference: string }) =>
      downloadSettlementReport(db, settlement),
  })

/**
 * Everything a payout touches is invalidated together: the ledger rows change
 * settlement status, the totals move and the history gains a row. Refreshing
 * one and not the others is how a console shows money in two places at once.
 */
function useMoneyMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['transactions'] })
      client.invalidateQueries({ queryKey: keys.totals })
      // Reconciling is what moves a collection into `successful`, which is
      // the only status the roll-up counts.
      client.invalidateQueries({ queryKey: keys.placements })
      client.invalidateQueries({ queryKey: keys.settlements })
      client.invalidateQueries({ queryKey: keys.account })
    },
  })
}

export const useReconcile = () => useMoneyMutation(() => reconcileCollections(db))

export const useSettle = () =>
  useMoneyMutation(
    (input: {
      idempotencyKey: string
      accountId: string
      transferReference?: string
      notes?: string
    }) => settle(db, input),
  )

export const useRecordAccount = () =>
  useMoneyMutation((account: NewSettlementAccount) => recordSettlementAccount(db, account))
