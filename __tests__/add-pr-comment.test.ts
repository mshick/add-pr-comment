import * as core from '@actions/core'
import * as github from '@actions/github'
import { WebhookPayload } from '@actions/github/lib/interfaces'
import { rest } from 'msw'
import { setupServer } from 'msw/node'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import run from '../src/main'
import apiResponse from './sample-pulls-api-response.json'

const repoFullName = 'foo/bar'
const repoToken = '12345'
const userLogin = 'github-actions[bot]'
const commitSha = 'abc123'
const simpleMessage = 'hello world'
const multilineMessage = fs
  .readFileSync(path.resolve(__dirname, './message-windows.txt'))
  .toString()
const multilineMessageWindows = fs
  .readFileSync(path.resolve(__dirname, './message-windows.txt'))
  .toString()

const inputs = {
  message: '',
  'repo-token': '',
  'repo-token-user-login': '',
  'allow-repeats': 'false',
}

let issueNumber = 1
let getCommitPullsResponse
let getIssueCommentsResponse
const postIssueCommentsResponse = {
  id: 42,
}

vi.mock('@actions/core')

export const handlers = [
  rest.post(
    `https://api.github.com/repos/${repoFullName}/issues/:issueNumber/comments`,
    (req, res, ctx) => {
      return res(ctx.status(200), ctx.json(postIssueCommentsResponse))
    },
  ),
  rest.get(
    `https://api.github.com/repos/${repoFullName}/issues/:issueNumber/comments`,
    (req, res, ctx) => {
      return res(ctx.status(200), ctx.json(getIssueCommentsResponse))
    },
  ),
  rest.get(
    `https://api.github.com/repos/${repoFullName}/commits/:commitSha/pulls`,
    (req, res, ctx) => {
      return res(ctx.status(200), ctx.json(getCommitPullsResponse))
    },
  ),
]

const server = setupServer(...handlers)

describe('add-pr-comment action', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
  afterAll(() => server.close())

  beforeEach(() => {
    issueNumber = 1
    vi.resetModules()

    github.context.sha = commitSha

    // https://developer.github.com/webhooks/event-payloads/#issues
    github.context.payload = {
      pull_request: {
        number: issueNumber,
      },
      repository: {
        full_name: repoFullName,
        name: 'bar',
        owner: {
          login: 'bar',
        },
      },
    } as WebhookPayload
  })

  afterEach(() => {
    vi.clearAllMocks()
    server.resetHandlers()
  })

  vi.mocked(core.getInput).mockImplementation((name: string) => {
    switch (name) {
      case 'message':
        return inputs.message
      case 'repo-token':
        return inputs['repo-token']
      case 'allow-repeats':
        return inputs['allow-repeats']
      default:
        return ''
    }
  })

  it('creates a comment', async () => {
    inputs.message = simpleMessage
    inputs['repo-token'] = repoToken
    inputs['allow-repeats'] = 'true'

    await expect(run()).resolves.not.toThrow()
    expect(core.setOutput).toHaveBeenCalledWith('comment-created', 'true')
    expect(core.setOutput).toHaveBeenCalledWith('comment-id', postIssueCommentsResponse.id)
  })

  it('creates a comment in an existing PR', async () => {
    process.env['GITHUB_TOKEN'] = repoToken

    inputs.message = simpleMessage
    inputs['repo-token'] = repoToken
    inputs['allow-repeats'] = 'true'

    github.context.payload = {
      ...github.context.payload,
      pull_request: {
        number: 0,
      },
    } as WebhookPayload

    issueNumber = apiResponse.result[0].number

    getCommitPullsResponse = apiResponse.result

    await expect(run()).resolves.not.toThrow()
    expect(core.setOutput).toHaveBeenCalledWith('comment-created', 'true')
  })

  it('safely exits when no issue can be found [using GITHUB_TOKEN in env]', async () => {
    process.env['GITHUB_TOKEN'] = repoToken

    inputs.message = simpleMessage
    inputs['allow-repeats'] = 'true'

    github.context.payload = {
      ...github.context.payload,
      pull_request: {
        number: 0,
      },
    } as WebhookPayload

    getCommitPullsResponse = []

    await run()
    expect(core.setOutput).toHaveBeenCalledWith('comment-created', 'false')
  })

  it('identifies repeat messages and does not create a comment [user login provided]', async () => {
    inputs.message = simpleMessage
    inputs['repo-token'] = repoToken
    inputs['repo-token-user-login'] = userLogin
    inputs['allow-repeats'] = 'false'

    const replyBody = [
      {
        body: simpleMessage,
        user: {
          login: userLogin,
        },
      },
    ]

    getIssueCommentsResponse = replyBody

    await run()

    expect(core.setOutput).toHaveBeenCalledWith('comment-created', 'false')
  })

  it('matches multiline messages with windows line feeds against api responses with unix linefeeds [no user login provided]', async () => {
    inputs.message = multilineMessageWindows
    inputs['repo-token'] = repoToken
    inputs['allow-repeats'] = 'false'

    const replyBody = [
      {
        body: multilineMessage,
        user: {
          login: userLogin,
        },
      },
    ]

    getIssueCommentsResponse = replyBody

    await run()
    expect(core.setOutput).toHaveBeenCalledWith('comment-created', 'false')
  })
})
