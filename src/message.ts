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
  status,
}: Pick<
  Inputs,
  | 'messageInput'
  | 'messageCancelled'
  | 'messageSuccess'
  | 'messageFailure'
  | 'messageSkipped'
  | 'messagePath'
  | 'status'
>) {
  let message

  if (status === 'success') {
    if (messageSuccess) {
      message = messageSuccess
    } else if (messagePath?.length) {
      message = await getMessageFromPaths(messagePath)
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

  return message
}

export async function getMessageFromPaths(searchPath: string) {
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
