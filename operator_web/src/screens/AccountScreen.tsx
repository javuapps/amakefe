import { useState } from 'react'
import {
  OPERATORS,
  formatDate,
  networkName,
  type Enums,
  type NewSettlementAccount,
  type Operator,
} from '@amakefe/core'
import { Async, Panel } from '../components/shell'
import { useAccount, useRecordAccount } from '../hooks/queries'

/**
 * Where the creator is paid — recorded here and nowhere else.
 *
 * Letting the party that receives the money choose where it goes is the classic
 * way money ends up somewhere else, so the studio can read this and cannot
 * write it. Changing it retires the old row rather than editing it: every
 * settlement already issued names the account it actually paid.
 */
export function AccountScreen() {
  const account = useAccount()
  const [editing, setEditing] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <Panel
        title="Current account"
        actions={
          <button
            type="button"
            onClick={() => setEditing((on) => !on)}
            className="rounded-full border border-line-strong px-3 py-1 text-xs text-ink"
          >
            {editing ? 'Cancel' : account.data ? 'Change it' : 'Add an account'}
          </button>
        }
      >
        <Async query={account}>
          {(data) =>
            data ? (
              <div className="text-sm text-body">
                <p className="text-ink">{data.accountName}</p>
                <p className="mt-1">
                  {data.kind === 'bank'
                    ? [data.bankName, data.branch, data.accountNumber].filter(Boolean).join(' · ')
                    : [
                        data.mobileOperator ? networkName(data.mobileOperator as Operator) : null,
                        data.mobileNumber,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                </p>
                <p className="mt-3 text-xs text-muted">Recorded {formatDate(data.createdAt)}</p>
              </div>
            ) : (
              <p className="text-sm text-body">
                No account recorded. Settlements cannot be made until there is one.
              </p>
            )
          }
        </Async>
      </Panel>

      {editing && <AccountForm onDone={() => setEditing(false)} />}
    </div>
  )
}

function AccountForm({ onDone }: { onDone: () => void }) {
  const [kind, setKind] = useState<Enums<'sup_account_kind'>>('bank')
  const [accountName, setAccountName] = useState('')
  const [bankName, setBankName] = useState('')
  const [branch, setBranch] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [mobileOperator, setMobileOperator] = useState<Operator>('mtn')
  const [mobileNumber, setMobileNumber] = useState('')
  const record = useRecordAccount()

  const complete =
    accountName.trim().length > 0 &&
    (kind === 'bank'
      ? bankName.trim().length > 0 && accountNumber.trim().length > 0
      : mobileNumber.trim().length > 0)

  const submit = () => {
    const account: NewSettlementAccount =
      kind === 'bank'
        ? { kind, accountName: accountName.trim(), bankName, branch, accountNumber }
        : { kind, accountName: accountName.trim(), mobileOperator, mobileNumber }
    record.mutate(account, { onSuccess: onDone })
  }

  return (
    <Panel title="Record a new account">
      <p className="text-sm text-body">
        This retires whatever is there now. Settlements already recorded keep the details they were
        paid to.
      </p>

      <div className="mt-4 flex gap-2">
        {(['bank', 'mobile_money'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setKind(value)}
            className={`rounded-full border-[1.5px] px-4 py-1.5 text-xs transition-colors ${
              kind === value ? 'border-accent bg-accent-wash text-accent' : 'border-line-card text-ink'
            }`}
          >
            {value === 'bank' ? 'Bank account' : 'Mobile money'}
          </button>
        ))}
      </div>

      <div className="mt-4 grid max-w-xl grid-cols-2 gap-4">
        <Field label="Account name" value={accountName} onChange={setAccountName} wide />

        {kind === 'bank' ? (
          <>
            <Field label="Bank" value={bankName} onChange={setBankName} />
            <Field label="Branch" value={branch} onChange={setBranch} />
            <Field label="Account number" value={accountNumber} onChange={setAccountNumber} wide />
          </>
        ) : (
          <>
            <div>
              <div className="text-xs text-muted">Network</div>
              <div className="mt-1 flex gap-2">
                {OPERATORS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMobileOperator(value)}
                    className={`rounded-full border-[1.5px] px-3 py-1.5 text-xs transition-colors ${
                      mobileOperator === value
                        ? 'border-accent bg-accent-wash text-accent'
                        : 'border-line-card text-ink'
                    }`}
                  >
                    {networkName(value)}
                  </button>
                ))}
              </div>
            </div>
            <Field label="Mobile number" value={mobileNumber} onChange={setMobileNumber} />
          </>
        )}
      </div>

      {record.isError && (
        <p className="mt-3 text-xs text-accent-deep">
          {record.error instanceof Error ? record.error.message : 'That did not save.'}
        </p>
      )}

      <div className="mt-5 flex gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={!complete || record.isPending}
          className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-surface-warm disabled:opacity-40"
        >
          {record.isPending ? 'Saving…' : 'Record this account'}
        </button>
        <button
          type="button"
          onClick={onDone}
          disabled={record.isPending}
          className="rounded-full px-4 py-2 text-sm text-muted disabled:opacity-40"
        >
          Cancel
        </button>
      </div>
    </Panel>
  )

}

const field =
  'w-full rounded-tile border border-line-strong bg-surface-raised px-3 py-2 text-sm text-ink outline-none focus:border-accent'

/**
 * Defined at module scope, not inside the form. A component declared during a
 * render is a new type on every render, so React unmounts and remounts the
 * input — and the field loses focus after each keystroke.
 */
function Field({
  label,
  value,
  onChange,
  wide = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  wide?: boolean
}) {
  return (
    <label className={wide ? 'col-span-2' : undefined}>
      <span className="text-xs text-muted">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${field} mt-1`}
      />
    </label>
  )
}
