import * as github from '@actions/github'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createCommitComment,
  deleteCommitComment,
  getExistingCommitComment,
  updateCommitComment,
} from './commit-comments.js'

const repoToken = '12345'
const owner = 'foo'
const repo = 'bar'
const commitSha = 'abc123'
const messageId = '<!-- add-pr-comment:test -->'

// Use the same Octokit mock pattern as action.test.ts
vi.mock('@actions/github', async (importOriginal) => {
  const original = await importOriginal<typeof import('@actions/github')>()
  const { Octokit } = await import('@octokit/core')
  const { restEndpointMethods } = await import('@octokit/plugin-rest-endpoint-methods')
  const { paginateRest } = await import('@octokit/plugin-paginate-rest')

  const fetchWrapper: typeof globalThis.fetch = (...args) => globalThis.fetch(...args)

  const TestGitHub = Octokit.plugin(restEndpointMethods, paginateRest).defaults({
    baseUrl: 'https://api.github.com',
    request: {
      fetch: fetchWrapper,
    },
  })

  return {
    ...original,
    getOctokit: (token: string, options?: Record<string, unknown>, ...plugins: any[]) => {
      const GitHubWithPlugins = plugins.length ? TestGitHub.plugin(...plugins) : TestGitHub
      return new GitHubWithPlugins({ auth: `token ${token}`, ...options })
    },
  }
})

let getCommitCommentsResponse: Record<string, unknown>[] | undefined
let postCommitCommentResponse = { id: 42 }
let messagePayload: { body: string } | undefined

const handlers = [
  http.get('https://api.github.com/repos/:owner/:repo/commits/:sha/comments', () => {
    return HttpResponse.json(getCommitCommentsResponse ?? [])
  }),
  http.post(
    'https://api.github.com/repos/:owner/:repo/commits/:sha/comments',
    async ({ request }) => {
      messagePayload = (await request.json()) as { body: string }
      return HttpResponse.json(postCommitCommentResponse)
    },
  ),
  http.patch(
    'https://api.github.com/repos/:owner/:repo/comments/:commentId',
    async ({ request }) => {
      messagePayload = (await request.json()) as { body: string }
      return HttpResponse.json(postCommitCommentResponse)
    },
  ),
  http.delete('https://api.github.com/repos/:owner/:repo/comments/:commentId', async () => {
    return new HttpResponse(null, { status: 204 })
  }),
]

const server = setupServer(...handlers)

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  server.listen({ onUnhandledRequest: 'error' })
})
afterAll(() => server.close())

beforeEach(() => {
  getCommitCommentsResponse = undefined
  messagePayload = undefined
  postCommitCommentResponse = { id: 42 }
})
afterEach(() => {
  vi.clearAllMocks()
  server.resetHandlers()
})

describe('commit-comments', () => {
  it('getExistingCommitComment returns undefined when no match', async () => {
    const octokit = github.getOctokit(repoToken)
    getCommitCommentsResponse = [{ id: 1, body: 'unrelated comment' }]
    const result = await getExistingCommitComment(octokit, owner, repo, commitSha, messageId)
    expect(result).toBeUndefined()
  })

  it('getExistingCommitComment finds a matching comment', async () => {
    const octokit = github.getOctokit(repoToken)
    getCommitCommentsResponse = [{ id: 99, body: `${messageId}\n\nhello` }]
    const result = await getExistingCommitComment(octokit, owner, repo, commitSha, messageId)
    expect(result).toEqual({ id: 99, body: `${messageId}\n\nhello` })
  })

  it('createCommitComment creates a comment', async () => {
    const octokit = github.getOctokit(repoToken)
    const result = await createCommitComment(octokit, owner, repo, commitSha, 'test body')
    expect(result.id).toBe(42)
    expect(messagePayload?.body).toBe('test body')
  })

  it('updateCommitComment updates a comment', async () => {
    const octokit = github.getOctokit(repoToken)
    const result = await updateCommitComment(octokit, owner, repo, 99, 'updated body')
    expect(result.id).toBe(42)
    expect(messagePayload?.body).toBe('updated body')
  })

  it('deleteCommitComment deletes a comment', async () => {
    const octokit = github.getOctokit(repoToken)
    await expect(deleteCommitComment(octokit, owner, repo, 99)).resolves.not.toThrow()
  })
})
