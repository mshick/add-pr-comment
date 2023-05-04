import * as core from '@actions/core'
import * as glob from '@actions/glob'
import fs from 'node:fs/promises'

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

function getDefaultGlobOptions(): glob.GlobOptions {
  return {
    followSymbolicLinks: true,
    implicitDescendants: true,
    omitBrokenSymbolicLinks: true,
  }
}

export async function findFiles(
  searchPath: string,
  globOptions?: glob.GlobOptions,
): Promise<string[]> {
  const searchResults: string[] = []
  const globber = await glob.create(searchPath, globOptions || getDefaultGlobOptions())
  const rawSearchResults: string[] = await globber.glob()

  for (const searchResult of rawSearchResults) {
    const fileStats = await fs.stat(searchResult)
    if (!fileStats.isDirectory()) {
      core.debug(`File: ${searchResult} was found using the provided searchPath`)
      searchResults.push(searchResult)
    } else {
      core.debug(`Removing ${searchResult} from rawSearchResults because it is a directory`)
    }
  }

  return searchResults
}
