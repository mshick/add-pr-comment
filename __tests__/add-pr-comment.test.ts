import * as core from '@actions/core'
import * as github from '@actions/github'
import { WebhookPayload } from '@actions/github/lib/interfaces'
import { rest } from 'msw'
import { setupServer } from 'msw/node'
import * as path from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import run from '../src/main'
import apiResponse from './sample-pulls-api-response.json'

const repoFullName = 'foo/bar'
const repoToken = '12345'
const commitSha = 'abc123'
const simpleMessage = 'hello world'

type Inputs = {
  message: string | undefined
  'message-path': string | undefined
  'repo-token': string
  'message-id': string
  'allow-repeats': string
  'message-success'?: string
  'message-failure'?: string
  'message-cancelled'?: string
  status?: 'success' | 'failure' | 'cancelled'
}

const inputs: Inputs = {
  message: '',
  'message-path': undefined,
  'repo-token': '',
  'message-id': 'add-pr-comment',
  'allow-repeats': 'false',
}

let issueNumber = 1
let getCommitPullsResponse
let getIssueCommentsResponse
let postIssueCommentsResponse = {
  id: 42,
}

type MessagePayload = {
  comment_id?: number
  body: string
}

let messagePayload: MessagePayload | undefined

vi.mock('@actions/core')

export const handlers = [
  rest.post(
    `https://api.github.com/repos/${repoFullName}/issues/:issueNumber/comments`,
    async (req, res, ctx) => {
      messagePayload = await req.json<MessagePayload>()
      return res(ctx.status(200), ctx.json(postIssueCommentsResponse))
    },
  ),
  rest.patch(
    `https://api.github.com/repos/${repoFullName}/issues/comments/:commentId`,
    async (req, res, ctx) => {
      messagePayload = await req.json<MessagePayload>()
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

  vi.mocked(core.getInput).mockImplementation((name: string, options?: core.InputOptions) => {
    const value = inputs[name] ?? ''

    if (options?.required && value === undefined) {
      throw new Error(`${name} is required`)
    }

    return value
  })

  it('creates a comment with message text', async () => {
    inputs.message = simpleMessage
    inputs['repo-token'] = repoToken
    inputs['allow-repeats'] = 'true'

    await expect(run()).resolves.not.toThrow()
    expect(core.setOutput).toHaveBeenCalledWith('comment-created', 'true')
    expect(core.setOutput).toHaveBeenCalledWith('comment-id', postIssueCommentsResponse.id)
  })

  it('creates a comment with a message-path', async () => {
    inputs.message = undefined
    inputs['message-path'] = path.resolve(__dirname, './message.txt')
    inputs['repo-token'] = repoToken
    inputs['allow-repeats'] = 'true'

    await expect(run()).resolves.not.toThrow()
    expect(core.setOutput).toHaveBeenCalledWith('comment-created', 'true')
    expect(core.setOutput).toHaveBeenCalledWith('comment-id', postIssueCommentsResponse.id)
  })

  it('fails when both message and message-path are defined', async () => {
    inputs.message = 'foobar'
    inputs['message-path'] = path.resolve(__dirname, './message.txt')
    inputs['repo-token'] = repoToken

    await expect(run()).resolves.not.toThrow()
    expect(core.setFailed).toHaveBeenCalledWith('must specify only one, message or message-path')
  })

  it('creates a comment in an existing PR', async () => {
    process.env['GITHUB_TOKEN'] = repoToken

    inputs.message = simpleMessage
    inputs['message-path'] = undefined
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
    inputs['message-path'] = undefined
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

  it('creates a message when the message id does not exist', async () => {
    inputs.message = simpleMessage
    inputs['message-path'] = undefined
    inputs['repo-token'] = repoToken
    inputs['allow-repeats'] = 'false'
    inputs['message-id'] = 'custom-id'

    const replyBody = [
      {
        body: `<!-- some-other-id -->\n\n${simpleMessage}`,
      },
    ]

    getIssueCommentsResponse = replyBody

    await run()

    expect(core.setOutput).toHaveBeenCalledWith('comment-created', 'true')
  })

  it('identifies an existing message by id and updates it', async () => {
    inputs.message = simpleMessage
    inputs['message-path'] = undefined
    inputs['repo-token'] = repoToken
    inputs['allow-repeats'] = 'false'

    const commentId = 123

    const replyBody = [
      {
        id: commentId,
        body: `<!-- add-pr-comment:${inputs['message-id']} -->\n\n${simpleMessage}`,
      },
    ]

    getIssueCommentsResponse = replyBody
    postIssueCommentsResponse = {
      id: commentId,
    }

    await run()

    expect(core.setOutput).toHaveBeenCalledWith('comment-updated', 'true')
    expect(core.setOutput).toHaveBeenCalledWith('comment-id', commentId)
  })

  it('overrides the default message with a success message on success', async () => {
    inputs.message = simpleMessage
    inputs['message-path'] = undefined
    inputs['repo-token'] = repoToken
    inputs['allow-repeats'] = 'false'
    inputs['message-success'] = '666'
    inputs.status = 'success'

    const commentId = 123

    getIssueCommentsResponse = [
      {
        id: commentId,
      },
    ]
    postIssueCommentsResponse = {
      id: commentId,
    }

    await run()
    expect(messagePayload?.body).toContain('666')
  })

  it('overrides the default message with a failure message on failure', async () => {
    inputs.message = simpleMessage
    inputs['message-path'] = undefined
    inputs['repo-token'] = repoToken
    inputs['allow-repeats'] = 'false'
    inputs['message-failure'] = '666'
    inputs.status = 'failure'

    const commentId = 123

    getIssueCommentsResponse = [
      {
        id: commentId,
      },
    ]
    postIssueCommentsResponse = {
      id: commentId,
    }

    await run()
    expect(messagePayload?.body).toContain('666')
  })

  it('overrides the default message with a cancelled message on cancelled', async () => {
    inputs.message = simpleMessage
    inputs['message-path'] = undefined
    inputs['repo-token'] = repoToken
    inputs['allow-repeats'] = 'false'
    inputs['message-cancelled'] = '666'
    inputs.status = 'cancelled'

    const commentId = 123

    getIssueCommentsResponse = [
      {
        id: commentId,
      },
    ]
    postIssueCommentsResponse = {
      id: commentId,
    }

    await run()
    expect(messagePayload?.body).toContain('666')
  })
})
