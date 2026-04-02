import { describe, expect, it } from 'vitest'
import { truncateMessage } from './message.js'

describe('truncateMessage', () => {
  it('does not truncate messages under the budget', async () => {
    const result = await truncateMessage('short message', 'simple', 50)
    expect(result.truncated).toBe(false)
    expect(result.message).toBe('short message')
  })

  it('uses custom truncate-separator in simple mode', async () => {
    const longMessage = 'x'.repeat(70000)
    const separator = '```\n\n---'

    const result = await truncateMessage(longMessage, 'simple', 50, undefined, separator)

    expect(result.truncated).toBe(true)
    // Should use the custom separator, not the default
    expect(result.message).toContain('\n\n```\n\n---\n**This message was truncated.**')
  })

  it('uses default separator when none provided', async () => {
    const longMessage = 'x'.repeat(70000)

    const result = await truncateMessage(longMessage, 'simple', 50)

    expect(result.truncated).toBe(true)
    expect(result.message).toContain('\n\n---\n**This message was truncated.**')
  })

  it('terminates incomplete markdown after truncation', async () => {
    // Message with an open code fence that will be cut mid-block
    const longMessage = `\`\`\`\n${'x'.repeat(70000)}\n\`\`\``

    const result = await truncateMessage(longMessage, 'simple', 50)

    expect(result.truncated).toBe(true)
    // remend should close the open code fence before the suffix
    const beforeSuffix = result.message.split('\n\n---\n**This message was truncated.**')[0]
    // Count code fences - should be even (each opened fence is closed)
    const fences = beforeSuffix.match(/```/g) || []
    expect(fences.length % 2).toBe(0)
  })

  it('terminates incomplete bold markdown after truncation', async () => {
    // Message with unclosed bold that gets cut
    const longMessage = `**bold text that is very long ${'x'.repeat(70000)}`

    const result = await truncateMessage(longMessage, 'simple', 50)

    expect(result.truncated).toBe(true)
    const beforeSuffix = result.message.split('\n\n---\n**This message was truncated.**')[0]
    // remend should close the bold
    const boldMarkers = beforeSuffix.match(/\*\*/g) || []
    expect(boldMarkers.length % 2).toBe(0)
  })
})
