import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { DefaultArtifactClient } from '@actions/artifact'
import * as core from '@actions/core'
import * as github from '@actions/github'
import remend, { isWithinCodeBlock, isWithinMathBlock } from 'remend'
import { findFiles } from './files.js'
import type { Inputs } from './types.js'

const MAX_COMMENT_LENGTH = 65536
const TRUNCATION_BUFFER = 4096
const SAFE_BODY_LENGTH = MAX_COMMENT_LENGTH - TRUNCATION_BUFFER

const DEFAULT_SEPARATOR = '---'

function terminateMarkdown(text: string): string {
  let result = remend(text)
  const end = result.length - 1
  if (isWithinCodeBlock(result, end)) {
    result += '\n```'
  }
  if (isWithinMathBlock(result, end)) {
    result += '\n$$'
  }
  return result
}

function simpleSuffix(separator: string) {
  return `\n\n${separator}\n**This message was truncated.**`
}

function artifactSuffix(url: string, separator: string) {
  return `\n\n${separator}\n**This message was truncated.** [Download full message](${url})`
}

export interface TruncateResult {
  message: string
  truncated: boolean
  artifactUrl?: string
}

export async function truncateMessage(
  message: string,
  mode: 'artifact' | 'simple',
  headerLength: number,
  messageId?: string,
  truncateSeparator?: string,
): Promise<TruncateResult> {
  const budget = SAFE_BODY_LENGTH - headerLength
  const separator = truncateSeparator || DEFAULT_SEPARATOR

  if (message.length <= budget) {
    return { message, truncated: false }
  }

  core.warning(`Message length ${message.length} exceeds safe limit ${budget}, truncating`)

  if (mode === 'simple') {
    const suffix = simpleSuffix(separator)
    const cut = terminateMarkdown(message.substring(0, budget - suffix.length))
    const truncated = cut + suffix
    return { message: truncated, truncated: true }
  }

  // artifact mode: upload full message, truncate comment with link
  try {
    const tmpDir = process.env.RUNNER_TEMP || os.tmpdir()
    const tmpFile = path.join(tmpDir, 'truncated-message.txt')
    await fs.writeFile(tmpFile, message, 'utf8')

    const client = new DefaultArtifactClient()
    const safeName = messageId ? messageId.replace(/[^a-zA-Z0-9-]/g, '-') : 'message'
    const artifactName = `full-comment-${safeName}`
    const { id } = await client.uploadArtifact(artifactName, [tmpFile], tmpDir)

    if (!id) {
      throw new Error('No artifact ID returned')
    }

    const { repo, owner } = github.context.repo
    const artifactUrl = `https://github.com/${owner}/${repo}/actions/runs/${github.context.runId}/artifacts/${id}`

    const suffix = artifactSuffix(artifactUrl, separator)
    const cut = terminateMarkdown(message.substring(0, budget - suffix.length))
    const truncated = cut + suffix

    return { message: truncated, truncated: true, artifactUrl }
  } catch {
    core.warning('Failed to upload truncated message artifact, falling back to simple truncation')
    const suffix = simpleSuffix(separator)
    const cut = terminateMarkdown(message.substring(0, budget - suffix.length))
    const truncated = cut + suffix
    return { message: truncated, truncated: true }
  }
}

export async function getMessage({
  messageInput,
  messagePath,
  messageCancelled,
  messageSkipped,
  messageFailure,
  messageSuccess,
  preformatted,
  status,
}: Pick<
  Inputs,
  | 'messageInput'
  | 'messageCancelled'
  | 'messageSuccess'
  | 'messageFailure'
  | 'messageSkipped'
  | 'messagePath'
  | 'preformatted'
  | 'status'
>): Promise<string> {
  let message: string | undefined

  if (status === 'success' && messageSuccess) {
    message = messageSuccess
  }

  if (status === 'failure' && messageFailure) {
    message = messageFailure
  }

  if (status === 'cancelled' && messageCancelled) {
    message = messageCancelled
  }

  if (status === 'skipped' && messageSkipped) {
    message = messageSkipped
  }

  if (!message) {
    const parts: string[] = []
    if (messageInput) parts.push(messageInput)
    if (messagePath) parts.push(await getMessageFromPath(messagePath))
    message = parts.length ? parts.join('\n') : undefined
  }

  if (preformatted) {
    message = `\`\`\`\n${message}\n\`\`\``
  }

  return message ?? ''
}

export async function getMessageFromPath(searchPath: string) {
  let message = ''

  const files = await findFiles(searchPath)

  for (const [index, path] of files.entries()) {
    if (index > 0) {
      message += '\n'
    }

    message += await fs.readFile(path, { encoding: 'utf8' })
  }

  return message
}

export function addMessageHeader(messageId: string, message: string) {
  return `${messageId}\n\n${message}`
}

export function removeMessageHeader(message: string) {
  return message.split('\n').slice(2).join('\n')
}

function splitFind(find: string) {
  const matches = find.match(/\/((i|g|m|s|u|y){1,6})$/)

  if (!matches) {
    return {
      regExp: find,
      modifiers: 'gi',
    }
  }

  const [, modifiers] = matches
  const regExp = find.replace(modifiers, '').slice(0, -1)

  return {
    regExp,
    modifiers,
  }
}

export function findAndReplaceInMessage(
  find: string[],
  replace: string[],
  original: string,
): string {
  let message = original

  for (const [i, f] of find.entries()) {
    const { regExp, modifiers } = splitFind(f)
    message = message.replace(new RegExp(regExp, modifiers), replace[i] ?? replace.join('\n'))
  }

  return message
}
