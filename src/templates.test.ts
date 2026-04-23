import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { replaceTemplateVariables } from './templates.js'

// Lock timezone to UTC so date-fns format() produces deterministic output in any environment
const originalTZ = process.env.TZ
beforeEach(() => {
  process.env.TZ = 'UTC'
})
afterEach(() => {
  if (originalTZ === undefined) {
    delete process.env.TZ
  } else {
    process.env.TZ = originalTZ
  }
})

// Fixed point in time: 2026-04-23T14:32:01 UTC
const FIXED_DATE = new Date('2026-04-23T14:32:01.000Z')

describe('replaceTemplateVariables', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_DATE)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('replaces %NOW% with ISO 8601 datetime', () => {
    const result = replaceTemplateVariables('Updated at %NOW%')
    expect(result).toBe('Updated at 2026-04-23T14:32:01.000Z')
  })

  it('replaces %NOW:yyyy-MM-dd% with formatted date', () => {
    const result = replaceTemplateVariables('Date: %NOW:yyyy-MM-dd%')
    expect(result).toBe('Date: 2026-04-23')
  })

  it('replaces %NOW:HH:mm:ss% with formatted time', () => {
    const result = replaceTemplateVariables('Time: %NOW:HH:mm:ss%')
    expect(result).toBe('Time: 14:32:01')
  })

  it('replaces %NOW:MMM d, yyyy% with human-readable date', () => {
    const result = replaceTemplateVariables('Published: %NOW:MMM d, yyyy%')
    expect(result).toBe('Published: Apr 23, 2026')
  })

  it('replaces multiple %NOW% tokens in one message', () => {
    const result = replaceTemplateVariables('Start: %NOW:yyyy-MM-dd% End: %NOW:HH:mm:ss%')
    expect(result).toBe('Start: 2026-04-23 End: 14:32:01')
  })

  it('returns message unchanged when no %NOW% tokens present', () => {
    const msg = 'Hello world, no tokens here'
    expect(replaceTemplateVariables(msg)).toBe(msg)
  })

  it('handles empty string', () => {
    expect(replaceTemplateVariables('')).toBe('')
  })

  it('leaves unmatched %NOW:% token as-is', () => {
    const result = replaceTemplateVariables('Bad: %NOW:%')
    expect(result).toBe('Bad: %NOW:%')
  })
})
