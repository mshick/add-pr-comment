import * as core from '@actions/core'
import * as glob from '@actions/glob'
import fs from 'node:fs/promises'

export async function findFiles(searchPath: string): Promise<string[]> {
  console.log('searchPath', searchPath)

  const searchResults: string[] = []
  const globber = await glob.create(searchPath, {
    followSymbolicLinks: true,
    implicitDescendants: true,
    omitBrokenSymbolicLinks: true,
  })
  console.log('globber')
  const rawSearchResults: string[] = await globber.glob()

  console.log('hihih', rawSearchResults)

  for (const searchResult of rawSearchResults) {
    const fileStats = await fs.stat(searchResult)
    if (!fileStats.isDirectory()) {
      core.debug(`File: ${searchResult} was found using the provided searchPath`)
      searchResults.push(searchResult)
    } else {
      core.debug(`Removing ${searchResult} from rawSearchResults because it is a directory`)
    }
  }

  console.log('after', searchResults)

  return searchResults
}
