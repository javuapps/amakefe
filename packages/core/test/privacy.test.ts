import { describe, expect, it } from 'vitest'
import { hasBlockingFinding, scanForIdentifiers } from '../src/index'

const levels = (text: string) => scanForIdentifiers(text).map((f) => f.level)

describe('draft privacy scan', () => {
  it('reports a clean draft as clear', () => {
    const findings = scanForIdentifiers(
      'She arrived two days after I came home from the hospital.\n\nBy the sixth week I had stopped cooking.',
    )
    expect(findings).toHaveLength(1)
    expect(findings[0]!.level).toBe('clear')
    expect(hasBlockingFinding(findings)).toBe(false)
  })

  it('catches a Zambian mobile number and names the paragraph', () => {
    const findings = scanForIdentifiers(
      'The first paragraph is fine.\n\nHe told me to call 0977 123 456 if I needed anything.',
    )
    const phone = findings.find((f) => f.message.includes('phone number'))
    expect(phone?.level).toBe('danger')
    expect(phone?.paragraph).toBe(2)
    expect(hasBlockingFinding(findings)).toBe(true)
  })

  it('catches an international number', () => {
    expect(levels('Reach me on +260 97 712 3456 any time.')).toContain('danger')
  })

  it('catches an email address', () => {
    const findings = scanForIdentifiers('You can write to me at chanda.m@example.co.zm.')
    expect(findings.some((f) => f.message.includes('email'))).toBe(true)
    expect(hasBlockingFinding(findings)).toBe(true)
  })

  it('warns about a named person behind a title', () => {
    const findings = scanForIdentifiers('Pastor Mwansa sat with us for an hour.')
    expect(findings[0]!.level).toBe('warning')
    // A warning is advisory: the creator decides, so it must not block.
    expect(hasBlockingFinding(findings)).toBe(false)
  })

  it('warns when a place name is repeated, not when mentioned once', () => {
    expect(levels('We drove through Kabulonga that evening.')).toEqual(['clear'])

    const findings = scanForIdentifiers(
      'We drove through Kabulonga that evening.\n\nHer sister also lives in Kabulonga.',
    )
    expect(findings.some((f) => f.message.includes('Kabulonga'))).toBe(true)
    expect(findings[0]!.level).toBe('warning')
  })

  it('does not mistake ordinary numbers in prose for a phone number', () => {
    expect(levels('We were married for six years. I was 34 and he was 41.')).toEqual(['clear'])
    expect(levels('I left in 2023 and came back in 2025.')).toEqual(['clear'])
  })

  it('reports every finding, not just the first', () => {
    const findings = scanForIdentifiers(
      'Call 0966 111 222.\n\nOr write to her@example.com.\n\nShe lives in Matero and works in Matero.',
    )
    expect(findings.filter((f) => f.level === 'danger')).toHaveLength(2)
    expect(findings.filter((f) => f.level === 'warning')).toHaveLength(1)
  })
})
