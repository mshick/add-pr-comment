import * as core from '@actions/core'
import * as github from '@actions/github'
import { WebhookPayload } from '@actions/github/lib/interfaces'
import { rest } from 'msw'
import { setupServer } from 'msw/node'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import run from '../src/main'
import apiResponse from './sample-pulls-api-response.json'

const messagePath1Fixture = path.resolve(__dirname, './message-part-1.txt')
const messagePath1FixturePayload = await fs.readFile(messagePath1Fixture, 'utf-8')
const messagePath2Fixture = path.resolve(__dirname, './message-part-2.txt')

const repoToken = '12345'
const commitSha = 'abc123'
const simpleMessage = 'hello world'

type Inputs = {
  message: string | undefined
  'message-path': string | undefined
  'repo-owner': string
  'repo-name': string
  'repo-token': string
  'message-id': string
  'allow-repeats': string
  'message-pattern'?: string
  'message-success'?: string
  'message-failure'?: string
  'message-cancelled'?: string
  'message-skipped'?: string
  'update-only'?: string
  preformatted?: string
  status?: 'success' | 'failure' | 'cancelled' | 'skipped'
}

const defaultInputs: Inputs = {
  message: '',
  'message-path': undefined,
  'repo-owner': 'foo',
  'repo-name': 'bar',
  'repo-token': repoToken,
  'message-id': 'add-pr-comment',
  'allow-repeats': 'false',
  status: 'success',
}

const defaultIssueNumber = 1

let inputs = defaultInputs
let issueNumber = defaultIssueNumber
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

const handlers = [
  rest.post(
    `https://api.github.com/repos/:repoUser/:repoName/issues/:issueNumber/comments`,
    async (req, res, ctx) => {
      messagePayload = await req.json<MessagePayload>()
      return res(ctx.status(200), ctx.json(postIssueCommentsResponse))
    },
  ),
  rest.patch(
    `https://api.github.com/repos/:repoUser/:repoName/issues/comments/:commentId`,
    async (req, res, ctx) => {
      messagePayload = await req.json<MessagePayload>()
      return res(ctx.status(200), ctx.json(postIssueCommentsResponse))
    },
  ),
  rest.get(
    `https://api.github.com/repos/:repoUser/:repoName/issues/:issueNumber/comments`,
    (req, res, ctx) => {
      return res(ctx.status(200), ctx.json(getIssueCommentsResponse))
    },
  ),
  rest.get(
    `https://api.github.com/repos/:repoUser/:repoName/commits/:commitSha/pulls`,
    (req, res, ctx) => {
      return res(ctx.status(200), ctx.json(getCommitPullsResponse))
    },
  ),
]

const server = setupServer(...handlers)

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  server.listen({ onUnhandledRequest: 'error' })
})
afterAll(() => server.close())

beforeEach(() => {
  inputs = { ...defaultInputs }
  issueNumber = defaultIssueNumber
  messagePayload = undefined

  vi.resetModules()

  github.context.sha = commitSha

  // https://developer.github.com/webhooks/event-payloads/#issues
  github.context.payload = {
    pull_request: {
      number: issueNumber,
    },
    repository: {
      full_name: `${inputs['repo-owner']}/${inputs['repo-name']}`,
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

const getInput = (name: string, options?: core.InputOptions) => {
  const value = inputs[name] ?? ''

  if (options?.required && value === undefined) {
    throw new Error(`${name} is required`)
  }

  return value
}

function getMultilineInput(name, options) {
  const inputs = getInput(name, options)
    .split('\n')
    .filter((x) => x !== '')

  if (options && options.trimWhitespace === false) {
    return inputs
  }

  return inputs.map((input) => input.trim())
}

function getBooleanInput(name, options) {
  const trueValue = ['true', 'True', 'TRUE']
  const falseValue = ['false', 'False', 'FALSE']
  const val = getInput(name, options)
  if (trueValue.includes(val)) return true
  if (falseValue.includes(val)) return false
  throw new TypeError(
    `Input does not meet YAML 1.2 "Core Schema" specification: ${name}\n` +
      `Support boolean input list: \`true | True | TRUE | false | False | FALSE\``,
  )
}

vi.mocked(core.getInput).mockImplementation(getInput)
vi.mocked(core.getMultilineInput).mockImplementation(getMultilineInput)
vi.mocked(core.getBooleanInput).mockImplementation(getBooleanInput)

describe('add-pr-comment action', () => {
  it('creates a comment with message text', async () => {
    inputs.message = simpleMessage
    inputs['allow-repeats'] = 'true'

    await expect(run()).resolves.not.toThrow()
    expect(core.setOutput).toHaveBeenCalledWith('comment-created', 'true')
    expect(core.setOutput).toHaveBeenCalledWith('comment-id', postIssueCommentsResponse.id)
  })

  it('creates a comment with a message-path', async () => {
    inputs.message = undefined
    inputs['message-path'] = messagePath1Fixture
    inputs['allow-repeats'] = 'true'

    await expect(run()).resolves.not.toThrow()
    expect(`<!-- add-pr-comment:add-pr-comment -->\n\n${messagePath1FixturePayload}`).toEqual(
      messagePayload?.body,
    )
    expect(core.setOutput).toHaveBeenCalledWith('comment-created', 'true')
    expect(core.setOutput).toHaveBeenCalledWith('comment-id', postIssueCommentsResponse.id)
  })

  it('creates a comment with multiple message-paths concatenated', async () => {
    inputs.message = undefined
    inputs['message-path'] = `${messagePath1Fixture}\n${messagePath2Fixture}`
    inputs['allow-repeats'] = 'true'

    await expect(run()).resolves.not.toThrow()
    expect(
      `<!-- add-pr-comment:add-pr-comment -->\n\n${messagePath1FixturePayload}\n${messagePath1FixturePayload}`,
    ).toEqual(messagePayload?.body)
    expect(core.setOutput).toHaveBeenCalledWith('comment-created', 'true')
    expect(core.setOutput).toHaveBeenCalledWith('comment-id', postIssueCommentsResponse.id)
  })

  it('supports globs in message paths', async () => {
    inputs.message = undefined
    inputs['message-path'] = `${path.resolve(__dirname)}/message-part-*.txt`
    inputs['allow-repeats'] = 'true'

    await expect(run()).resolves.not.toThrow()
    expect(
      `<!-- add-pr-comment:add-pr-comment -->\n\n${messagePath1FixturePayload}\n${messagePath1FixturePayload}`,
    ).toEqual(messagePayload?.body)
    expect(core.setOutput).toHaveBeenCalledWith('comment-created', 'true')
    expect(core.setOutput).toHaveBeenCalledWith('comment-id', postIssueCommentsResponse.id)
  })

  it('fails when both message and message-path are defined', async () => {
    inputs.message = 'foobar'
    inputs['message-path'] = messagePath1Fixture

    await expect(run()).resolves.not.toThrow()
    expect(core.setFailed).toHaveBeenCalledWith('must specify only one, message or message-path')
  })

  it('creates a comment in an existing PR', async () => {
    inputs.message = simpleMessage
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

  it('does not create a comment when updateOnly is true and no existing comment is found', async () => {
    inputs.message = simpleMessage
    inputs['allow-repeats'] = 'true'
    inputs['update-only'] = 'true'

    await expect(run()).resolves.not.toThrow()
    expect(core.setOutput).toHaveBeenCalledWith('comment-created', 'false')
  })

  it('creates a comment in another repo', async () => {
    inputs.message = simpleMessage
    inputs['repo-owner'] = 'my-owner'
    inputs['repo-name'] = 'my-repo'
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
    expect(core.setOutput).toHaveBeenCalledWith('comment-id', postIssueCommentsResponse.id)
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

  it('creates a message when the message id does not exist', async () => {
    inputs.message = simpleMessage

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

  it('overrides the default message with a skipped message on skipped', async () => {
    inputs.message = simpleMessage

    inputs['message-skipped'] = '666'
    inputs.status = 'skipped'

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

  it('wraps a message in a codeblock if preformatted is true', async () => {
    inputs.message = undefined
    inputs['preformatted'] = 'true'
    inputs['message-path'] = messagePath1Fixture

    await expect(run()).resolves.not.toThrow()
    expect(
      `<!-- add-pr-comment:add-pr-comment -->\n\n\`\`\`\n${messagePath1FixturePayload}\n\`\`\``,
    ).toEqual(messagePayload?.body)
    expect(core.setOutput).toHaveBeenCalledWith('comment-created', 'true')
    expect(core.setOutput).toHaveBeenCalledWith('comment-id', postIssueCommentsResponse.id)
  })
})

describe('find and replace', () => {
  it('can find and replace text in an existing comment', async () => {
    inputs['find'] = 'world'
    inputs['replace'] = 'mars'

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

    expect(`<!-- add-pr-comment:add-pr-comment -->\n\nhello mars`).toEqual(messagePayload?.body)
    expect(core.setOutput).toHaveBeenCalledWith('comment-updated', 'true')
    expect(core.setOutput).toHaveBeenCalledWith('comment-id', commentId)
  })

  it('can multiple find and replace text in an existing comment', async () => {
    inputs['find'] = 'hello\nworld'
    inputs['replace'] = 'goodbye\nmars'

    const body = `<!-- add-pr-comment:${inputs['message-id']} -->\n\nhello\nworld`

    const commentId = 123

    const replyBody = [
      {
        id: commentId,
        body,
      },
    ]

    getIssueCommentsResponse = replyBody
    postIssueCommentsResponse = {
      id: commentId,
    }

    await run()

    expect(`<!-- add-pr-comment:add-pr-comment -->\n\ngoodbye\nmars`).toEqual(messagePayload?.body)
    expect(core.setOutput).toHaveBeenCalledWith('comment-updated', 'true')
    expect(core.setOutput).toHaveBeenCalledWith('comment-id', commentId)
  })

  it('can multiple find and replace text using a message', async () => {
    inputs['find'] = 'hello\nworld'
    inputs['message'] = 'mars'

    const body = `<!-- add-pr-comment:${inputs['message-id']} -->\n\nhello\nworld`

    const commentId = 123

    const replyBody = [
      {
        id: commentId,
        body,
      },
    ]

    getIssueCommentsResponse = replyBody
    postIssueCommentsResponse = {
      id: commentId,
    }

    await run()

    expect(`<!-- add-pr-comment:add-pr-comment -->\n\nmars\nmars`).toEqual(messagePayload?.body)
    expect(core.setOutput).toHaveBeenCalledWith('comment-updated', 'true')
    expect(core.setOutput).toHaveBeenCalledWith('comment-id', commentId)
  })

  it('can multiple find and replace a single pattern with a multiline replacement', async () => {
    inputs['find'] = 'hello'
    inputs['message'] = 'h\ne\nl\nl\no'

    const body = `<!-- add-pr-comment:${inputs['message-id']} -->\n\nhello\nworld`

    const commentId = 123

    const replyBody = [
      {
        id: commentId,
        body,
      },
    ]

    getIssueCommentsResponse = replyBody
    postIssueCommentsResponse = {
      id: commentId,
    }

    await run()

    expect(`<!-- add-pr-comment:add-pr-comment -->\n\nh\ne\nl\nl\no\nworld`).toEqual(
      messagePayload?.body,
    )
    expect(core.setOutput).toHaveBeenCalledWith('comment-updated', 'true')
    expect(core.setOutput).toHaveBeenCalledWith('comment-id', commentId)
  })

  it('can multiple find and replace text using a message-path', async () => {
    inputs['find'] = '<< FILE_CONTENTS >>'
    inputs['message-path'] = messagePath1Fixture

    const body = `<!-- add-pr-comment:${inputs['message-id']} -->\n\nhello\n<< FILE_CONTENTS >>\nworld`

    const commentId = 123

    const replyBody = [
      {
        id: commentId,
        body,
      },
    ]

    getIssueCommentsResponse = replyBody
    postIssueCommentsResponse = {
      id: commentId,
    }

    await run()

    expect(
      `<!-- add-pr-comment:add-pr-comment -->\n\nhello\n${messagePath1FixturePayload}\nworld`,
    ).toEqual(messagePayload?.body)
    expect(core.setOutput).toHaveBeenCalledWith('comment-updated', 'true')
    expect(core.setOutput).toHaveBeenCalledWith('comment-id', commentId)
  })

  it('can find and replace patterns and use alternative modifiers', async () => {
    inputs['find'] = '(o|l)/g'
    inputs['replace'] = 'YY'

    const body = `<!-- add-pr-comment:${inputs['message-id']} -->\n\nHELLO\nworld`

    const commentId = 123

    const replyBody = [
      {
        id: commentId,
        body,
      },
    ]

    getIssueCommentsResponse = replyBody
    postIssueCommentsResponse = {
      id: commentId,
    }

    await run()

    expect(`<!-- add-pr-comment:add-pr-comment -->\n\nHELLO\nwYYrYYd`).toEqual(messagePayload?.body)
    expect(core.setOutput).toHaveBeenCalledWith('comment-updated', 'true')
    expect(core.setOutput).toHaveBeenCalledWith('comment-id', commentId)
  })

  it('can check some boxes with find and replace', async () => {
    inputs['find'] = '\n\\[ \\]'
    inputs['replace'] = '[X]'

    const body = `<!-- add-pr-comment:${inputs['message-id']} -->\n\n[ ] Hello\n[ ] World`

    const commentId = 123

    const replyBody = [
      {
        id: commentId,
        body,
      },
    ]

    getIssueCommentsResponse = replyBody
    postIssueCommentsResponse = {
      id: commentId,
    }

    await run()

    expect(`<!-- add-pr-comment:add-pr-comment -->\n\n[X] Hello\n[X] World`).toEqual(
      messagePayload?.body,
    )
    expect(core.setOutput).toHaveBeenCalledWith('comment-updated', 'true')
    expect(core.setOutput).toHaveBeenCalledWith('comment-id', commentId)
  })
})
