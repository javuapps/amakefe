import { describe, expect, it } from 'vitest'
import {
  COMMISSION_RATE_BPS,
  commissionMinor,
  internationalPhone,
  localPhone,
  netMinor,
  operatorForPhone,
  walletProblem,
} from '../src/support'

describe('the commission', () => {
  it('takes a fifth of what was given', () => {
    expect(commissionMinor(5000)).toBe(1000)
    expect(netMinor(5000)).toBe(4000)
  })

  it('always leaves exactly what was paid, however it rounds', () => {
    // 3.33 splits 0.67 / 2.66 — the net is the remainder, never its own sum.
    for (const amount of [1, 7, 333, 999, 1234, 5001, 99999]) {
      expect(commissionMinor(amount) + netMinor(amount)).toBe(amount)
    }
  })

  it('rounds half up, as the SQL does', () => {
    // 25 ngwee at 20% is exactly 5; 27 is 5.4 down to 5; 28 is 5.6 up to 6.
    expect(commissionMinor(25)).toBe(5)
    expect(commissionMinor(27)).toBe(5)
    expect(commissionMinor(28)).toBe(6)
  })

  it('is twenty percent', () => {
    expect(COMMISSION_RATE_BPS).toBe(2000)
  })
})

describe('Zambian mobile numbers', () => {
  it('reaches the same international form from every way of writing one', () => {
    for (const written of ['0977000111', '260977000111', '+260 977 000 111', '977000111']) {
      expect(internationalPhone(written)).toBe('260977000111')
      expect(localPhone(written)).toBe('0977000111')
    }
  })

  it('reads the network off the prefix', () => {
    expect(operatorForPhone('0966123456')).toBe('mtn')
    expect(operatorForPhone('260966123456')).toBe('mtn')
    expect(operatorForPhone('0977123456')).toBe('airtel')
    expect(operatorForPhone('0955123456')).toBe('zamtel')
  })

  it('guesses nothing about a prefix it does not know', () => {
    expect(operatorForPhone('0911123456')).toBeNull()
  })
})

describe('what to say when the network is wrong', () => {
  it('names both networks the way the buttons do', () => {
    expect(walletProblem('mtn', '0977000111')).toBe(
      '0977000111 is on Airtel Money, not MTN MoMo.',
    )
  })

  it('says nothing when the number matches', () => {
    expect(walletProblem('airtel', '0977000111')).toBeNull()
  })

  it('catches a number that is not Zambian at all', () => {
    expect(walletProblem('mtn', '123')).toMatch(/does not look like/)
  })
})
