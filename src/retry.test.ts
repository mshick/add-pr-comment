import { describe, expect, it, vi } from 'vitest'
import { withRetry } from './retry.js'

vi.mock('@actions/core')

describe('withRetry', () => {
  it('returns result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries on 429 and succeeds', async () => {
    const error = Object.assign(new Error('rate limit'), { status: 429 })
    const fn = vi.fn().mockRejectedValueOnce(error).mockResolvedValue('ok')
    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('retries on 403 and succeeds', async () => {
    const error = Object.assign(new Error('forbidden'), { status: 403 })
    const fn = vi.fn().mockRejectedValueOnce(error).mockResolvedValue('ok')
    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('throws after exhausting all retry attempts', async () => {
    const error = Object.assign(new Error('rate limit'), { status: 429 })
    const fn = vi.fn().mockRejectedValue(error)
    await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 })).rejects.toThrow('rate limit')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('does not retry non-rate-limit errors', async () => {
    const error = Object.assign(new Error('not found'), { status: 404 })
    const fn = vi.fn().mockRejectedValue(error)
    await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 })).rejects.toThrow('not found')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('does not retry errors without a status', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('network failure'))
    await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 })).rejects.toThrow(
      'network failure',
    )
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('respects Retry-After header from response', async () => {
    const error = Object.assign(new Error('rate limit'), {
      status: 429,
      response: { headers: { 'retry-after': '1' } },
    })
    const fn = vi.fn().mockRejectedValueOnce(error).mockResolvedValue('ok')
    const start = Date.now()
    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 })
    const elapsed = Date.now() - start
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
    // Retry-After of 1 second = 1000ms. Allow some slack.
    expect(elapsed).toBeGreaterThanOrEqual(900)
  })
})
