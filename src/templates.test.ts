import { describe, expect, it, vi } from 'vitest'
import { replaceTemplateVariables } from './templates.js'

// Fix time for deterministic tests
const FIXED_DATE = new Date('2026-04-23T14:32:01.000-04:00')

describe('replaceTemplateVariables', () => {
  it('replaces %NOW% with ISO 8601 datetime', () => {
    vi.setSystemTime(FIXED_DATE)
    const result = replaceTemplateVariables('Updated at %NOW%')
    expect(result).toBe(`Updated at ${FIXED_DATE.toISOString()}`)
    vi.useRealTimers()
  })

  it('replaces %NOW:yyyy-MM-dd% with formatted date', () => {
    vi.setSystemTime(FIXED_DATE)
    const result = replaceTemplateVariables('Date: %NOW:yyyy-MM-dd%')
    expect(result).toBe('Date: 2026-04-23')
    vi.useRealTimers()
  })

  it('replaces %NOW:HH:mm:ss% with formatted time', () => {
    vi.setSystemTime(FIXED_DATE)
    const result = replaceTemplateVariables('Time: %NOW:HH:mm:ss%')
    expect(result).toBe('Time: 14:32:01')
    vi.useRealTimers()
  })

  it('replaces %NOW:MMM d, yyyy% with human-readable date', () => {
    vi.setSystemTime(FIXED_DATE)
    const result = replaceTemplateVariables('Published: %NOW:MMM d, yyyy%')
    expect(result).toBe('Published: Apr 23, 2026')
    vi.useRealTimers()
  })

  it('replaces multiple %NOW% tokens in one message', () => {
    vi.setSystemTime(FIXED_DATE)
    const result = replaceTemplateVariables('Start: %NOW:yyyy-MM-dd% End: %NOW:HH:mm:ss%')
    expect(result).toBe('Start: 2026-04-23 End: 14:32:01')
    vi.useRealTimers()
  })

  it('returns message unchanged when no %NOW% tokens present', () => {
    const msg = 'Hello world, no tokens here'
    expect(replaceTemplateVariables(msg)).toBe(msg)
  })

  it('handles empty string', () => {
    expect(replaceTemplateVariables('')).toBe('')
  })

  it('warns and leaves token on invalid format string', () => {
    vi.setSystemTime(FIXED_DATE)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // An empty format (just colons) should be treated as invalid
    const result = replaceTemplateVariables('Bad: %NOW:%')
    expect(result).toBe('Bad: %NOW:%')
    warnSpy.mockRestore()
    vi.useRealTimers()
  })
})
