import * as core from '@actions/core'
import { describe, expect, it, vi } from 'vitest'
import { parseSecretValues, redactSecretsInMessage } from './redact.js'

vi.mock('@actions/core')

describe('parseSecretValues', () => {
  it('returns an empty array when input is undefined or empty', () => {
    expect(parseSecretValues(undefined)).toEqual([])
    expect(parseSecretValues('')).toEqual([])
  })

  it('extracts string values from a JSON object', () => {
    const json = JSON.stringify({ NPM_TOKEN: 'abc12345', GITHUB_TOKEN: 'ghs_deadbeef' })
    expect(parseSecretValues(json)).toEqual(['abc12345', 'ghs_deadbeef'])
  })

  it('filters out values shorter than the minimum secret length', () => {
    const json = JSON.stringify({ SHORT: 'abc', LONG: 'longenough' })
    expect(parseSecretValues(json)).toEqual(['longenough'])
  })

  it('filters out non-string values', () => {
    const json = JSON.stringify({ NUM: 12345678, BOOL: true, STR: 'abcdefgh' })
    expect(parseSecretValues(json)).toEqual(['abcdefgh'])
  })

  it('warns and returns an empty array on invalid JSON', () => {
    expect(parseSecretValues('not json')).toEqual([])
    expect(core.warning).toHaveBeenCalledWith(expect.stringContaining('not valid JSON'))
  })

  it('returns an empty array when the parsed value is not an object', () => {
    expect(parseSecretValues('"just a string"')).toEqual([])
    expect(parseSecretValues('42')).toEqual([])
    expect(parseSecretValues('null')).toEqual([])
  })
})

describe('redactSecretsInMessage', () => {
  it('returns the message unchanged when there are no secret values', () => {
    expect(redactSecretsInMessage('hello world', [])).toBe('hello world')
  })

  it('returns the message unchanged when it is empty', () => {
    expect(redactSecretsInMessage('', ['secretvalue'])).toBe('')
  })

  it('redacts a single occurrence of a secret value', () => {
    const result = redactSecretsInMessage('token: ghs_deadbeef here', ['ghs_deadbeef'])
    expect(result).toBe('token: *** here')
  })

  it('redacts multiple occurrences of the same secret value', () => {
    const result = redactSecretsInMessage('a=ghs_deadbeef b=ghs_deadbeef', ['ghs_deadbeef'])
    expect(result).toBe('a=*** b=***')
  })

  it('redacts multiple distinct secret values', () => {
    const result = redactSecretsInMessage('npm=abc12345 gh=ghs_deadbeef', [
      'abc12345',
      'ghs_deadbeef',
    ])
    expect(result).toBe('npm=*** gh=***')
  })

  it('prefers the longest match when one secret value is a substring of another', () => {
    const result = redactSecretsInMessage('value: abc12345extra', ['abc12345', 'abc12345extra'])
    expect(result).toBe('value: ***')
  })

  it('escapes regex special characters in secret values', () => {
    const result = redactSecretsInMessage('key: a.b+c$d(e)', ['a.b+c$d(e)'])
    expect(result).toBe('key: ***')
  })

  it('leaves text untouched when no secret values match', () => {
    const result = redactSecretsInMessage('nothing sensitive here', ['unrelatedsecret'])
    expect(result).toBe('nothing sensitive here')
  })
})
