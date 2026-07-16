import * as core from '@actions/core'

const MIN_SECRET_LENGTH = 4
const REDACTED = '***'

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function parseSecretValues(githubSecretsJson: string | undefined): string[] {
  if (!githubSecretsJson) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(githubSecretsJson)
  } catch {
    core.warning('redact-secrets: github-secrets is not valid JSON, skipping redaction')
    return []
  }

  if (!parsed || typeof parsed !== 'object') return []

  return Object.values(parsed as Record<string, unknown>).filter(
    (value): value is string => typeof value === 'string' && value.length >= MIN_SECRET_LENGTH,
  )
}

export function redactSecretsInMessage(message: string, secretValues: string[]): string {
  if (!message || secretValues.length === 0) return message

  // Longest first so a secret that's a substring of another doesn't leave a partial match behind
  const unique = [...new Set(secretValues)].sort((a, b) => b.length - a.length)
  const pattern = unique.map(escapeRegExp).join('|')

  return message.replace(new RegExp(pattern, 'g'), REDACTED)
}
