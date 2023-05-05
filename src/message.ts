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

  console.log('a', { message, messagePath })

  if (status === 'success') {
    console.log('aaa')
    if (messageSuccess) {
      console.log('bbb')
      message = messageSuccess
    } else if (messagePath) {
      console.log('ccc')
      message = await getMessageFromPath(messagePath)
      console.log('ddd', message)
    } else {
      message = messageInput
    }
  }

  console.log('b', { message })

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

  console.log({ message })

  return message
}

export async function getMessageFromPath(searchPath: string) {
  let message = ''

  console.log('hey')

  const files = await findFiles(searchPath)

  console.log({ files })

  for (const [index, path] of files.entries()) {
    if (index > 0) {
      message += '\n'
    }

    message += await fs.readFile(path, { encoding: 'utf8' })
  }

  return message
}
