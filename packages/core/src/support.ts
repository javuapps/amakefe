/**
 * Supporting the community: the money, and the networks it moves on.
 *
 * Pure functions, shared by the reader, the operator console and the Edge
 * Functions that talk to the provider — so what a supporter is told they will
 * pay, what the ledger records, and what the provider is asked for are all one
 * calculation rather than three that agree until they do not.
 *
 * The phone and operator handling is adapted from ginni's Lenco adapter, where
 * each rule was learned from a real refusal.
 */

/** The platform's commission, in basis points. 20%, for tech and operations. */
export const COMMISSION_RATE_BPS = 2000

/**
 * The commission on an amount, in whole ngwee, rounded half up.
 *
 * Integer arithmetic throughout: a percentage of money held as a float is how a
 * ledger stops balancing. Mirrors `sup_commission_minor` in SQL exactly, and
 * `packages/core/test/support.test.ts` pins both to the same cases.
 *
 * The two cannot drift even in principle at this rate: a fifth of a whole
 * number of ngwee has a fractional part of .0, .2, .4, .6 or .8 and never .5,
 * so the one place JavaScript and Postgres could round differently is
 * unreachable. Change the rate and that stops being true.
 */
export function commissionMinor(amountMinor: number, rateBps = COMMISSION_RATE_BPS): number {
  return Math.round((amountMinor * rateBps) / 10000)
}

/** What the creator is settled: whatever is left. Never computed separately. */
export function netMinor(amountMinor: number, rateBps = COMMISSION_RATE_BPS): number {
  return amountMinor - commissionMinor(amountMinor, rateBps)
}

/** ZMW, from ngwee. */
export const formatKwacha = (minor: number): string =>
  `ZMW ${(minor / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// ---------------------------------------------------------------------------
// The networks
// ---------------------------------------------------------------------------

export const OPERATORS = ['mtn', 'airtel', 'zamtel'] as const
export type Operator = (typeof OPERATORS)[number]

/** What the network is called on a screen. */
export function networkName(operator: Operator): string {
  switch (operator) {
    case 'mtn':
      return 'MTN MoMo'
    case 'airtel':
      return 'Airtel Money'
    case 'zamtel':
      return 'Zamtel Kwacha'
  }
}

const digitsOf = (phone: string): string => phone.replace(/\D/g, '')

/** 260XXXXXXXXX — what the provider wants when collecting. */
export function internationalPhone(phone: string): string {
  const digits = digitsOf(phone)
  if (digits.startsWith('260')) return digits
  if (digits.startsWith('0')) return `260${digits.slice(1)}`
  // Nine digits is the national number without its leading zero.
  if (digits.length === 9) return `260${digits}`
  return digits
}

/** 0XXXXXXXXX — what a person recognises, and what the resolve endpoint wants. */
export function localPhone(phone: string): string {
  const digits = digitsOf(phone)
  if (digits.startsWith('260')) return `0${digits.slice(3)}`
  if (digits.startsWith('0')) return digits
  if (digits.length === 9) return `0${digits}`
  return digits
}

/**
 * The network a number belongs to, or null.
 *
 * Zambian prefixes are allocated per network, so a number carries its operator.
 * Null for anything unrecognised rather than a guess — ranges change, and a
 * wrong guess here blocks a payment that would have worked.
 */
export function operatorForPhone(phone: string): Operator | null {
  const local = localPhone(phone)
  if (local.length < 3) return null

  switch (local.slice(0, 3)) {
    case '096':
    case '076':
      return 'mtn'
    case '097':
    case '077':
      return 'airtel'
    case '095':
    case '075':
      return 'zamtel'
    default:
      return null
  }
}

/** A Zambian mobile number is twelve digits once it carries its country code. */
export function isZambianMobile(phone: string): boolean {
  return internationalPhone(phone).length === 12
}

/**
 * Why this number cannot be charged on this network, if it cannot.
 *
 * Someone who picks MTN and types an Airtel number otherwise gets an opaque
 * refusal from the provider. Caught here it is a sentence on a screen — and it
 * is written as one, in the names on the buttons they just tapped rather than
 * in the provider's vocabulary.
 *
 * "is on X, not Y" rather than "is an X number" because the article changes
 * with the network, and a sentence assembled from parts cannot know which.
 */
export function walletProblem(operator: Operator, phone: string): string | null {
  if (!isZambianMobile(phone)) {
    return `${phone.trim()} does not look like a Zambian mobile number.`
  }
  const detected = operatorForPhone(phone)
  if (detected && detected !== operator) {
    return `${localPhone(phone)} is on ${networkName(detected)}, not ${networkName(operator)}.`
  }
  return null
}
