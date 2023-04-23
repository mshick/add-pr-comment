import * as core from '@actions/core'
import fs from 'node:fs/promises'

export function getInputAsArray(name: string, options?: core.InputOptions): string[] {
  return core
    .getInput(name, options)
    .split('\n')
    .map((s) => s.replace(/^!\s+/, '!').trim())
    .filter((x) => x !== '')
}

export async function getMessageFromPaths(paths: string[]) {
  let message = ''

  for (const [index, path] of paths.entries()) {
    if (index > 0) {
      message += '\n'
    }

    message += await fs.readFile(path, { encoding: 'utf8' })
  }

  return message
}
