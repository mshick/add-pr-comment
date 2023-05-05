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
>) {
  let message

  if (status === 'success') {
    if (messageSuccess) {
      message = messageSuccess
    } else if (messagePath) {
      message = await getMessageFromPath(messagePath)
    } else {
      message = messageInput
    }
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
