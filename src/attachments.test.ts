import { describe, expect, it, vi } from 'vitest'
import { uploadAttachments } from './attachments.js'

vi.mock('@actions/artifact', () => ({
  DefaultArtifactClient: class {
    uploadArtifact = vi.fn().mockResolvedValue({ id: 9999, size: 1024 })
  },
}))

vi.mock('@actions/github', () => ({
  context: {
    runId: 42,
  },
}))

describe('uploadAttachments', () => {
  it('uploads files and returns artifact URL and markdown section', async () => {
    const result = await uploadAttachments({
      files: ['/path/to/report.html'],
      name: 'my-artifact',
      owner: 'foo',
      repo: 'bar',
    })

    expect(result).toEqual({
      url: 'https://github.com/foo/bar/actions/runs/42/artifacts/9999',
      markdown:
        '\n---\n**Attachments:** [my-artifact](https://github.com/foo/bar/actions/runs/42/artifacts/9999)\n',
    })
  })
})
