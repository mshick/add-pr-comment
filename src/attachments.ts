import { DefaultArtifactClient } from '@actions/artifact'
import * as github from '@actions/github'
import path from 'node:path'

interface UploadAttachmentsOptions {
  files: string[]
  name: string
  owner: string
  repo: string
}

interface UploadAttachmentsResult {
  url: string
  markdown: string
}

export async function uploadAttachments({
  files,
  name,
  owner,
  repo,
}: UploadAttachmentsOptions): Promise<UploadAttachmentsResult> {
  const client = new DefaultArtifactClient()
  const rootDirectory = path.resolve(commonDirectory(files))
  const { id } = await client.uploadArtifact(name, files, rootDirectory)

  if (!id) {
    throw new Error('Artifact upload failed — no artifact ID returned')
  }

  const url = `https://github.com/${owner}/${repo}/actions/runs/${github.context.runId}/artifacts/${id}`
  const markdown = `\n---\n**Attachments:** [${name}](${url})\n`

  return { url, markdown }
}

function commonDirectory(files: string[]): string {
  if (files.length === 1) {
    return path.dirname(files[0])
  }

  const dirs = files.map((f) => path.dirname(f).split(path.sep))
  const common: string[] = []
  for (let i = 0; i < dirs[0].length; i++) {
    if (dirs.every((d) => d[i] === dirs[0][i])) {
      common.push(dirs[0][i])
    } else {
      break
    }
  }

  return common.join(path.sep) || '/'
}
