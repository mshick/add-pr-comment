import fs from 'node:fs/promises'
import { findFiles } from './files'
import { Inputs } from './types'

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
  let message

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
    if (messagePath) {
      message = await getMessageFromPath(messagePath)
    } else {
      message = messageInput
    }
  }

  if (!message) {
    throw new Error('no message, check your message inputs')
  }

  if (preformatted) {
    message = `\`\`\`\n${message}\n\`\`\``
  }

  return message
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

export function findAndReplaceInMessage(
  pattern: string,
  replacement: string,
  original: string,
): string {
  return original.replace(new RegExp(pattern), replacement)
}
