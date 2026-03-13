import * as core from '@actions/core'

export interface RetryOptions {
  maxAttempts?: number
  baseDelayMs?: number
}

function isRetryableError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status
    return status === 403 || status === 429
  }
  return false
}

function getRetryAfterMs(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as { response?: { headers?: Record<string, string> } }).response
    const retryAfter = response?.headers?.['retry-after']
    if (retryAfter) {
      const seconds = Number(retryAfter)
      if (!Number.isNaN(seconds) && seconds > 0) {
        return seconds * 1000
      }
    }
  }
  return undefined
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { maxAttempts = 3, baseDelayMs = 1000 } = options

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (attempt < maxAttempts && isRetryableError(error)) {
        const retryAfter = getRetryAfterMs(error)
        const backoff = baseDelayMs * 2 ** (attempt - 1)
        const jitter = Math.random() * baseDelayMs
        const delay = retryAfter ?? Math.round(backoff + jitter)
        core.warning(`API rate limited (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms`)
        await new Promise((resolve) => setTimeout(resolve, delay))
        continue
      }
      throw error
    }
  }

  throw new Error('unreachable')
}
