import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as core from '@actions/core'
import * as github from '@actions/github'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import apiResponse from './__fixtures__/sample-pulls-api-response.json'
import { run } from './action.js'

const messagePath1Fixture = path.resolve(__dirname, './__fixtures__/message-part-1.txt')
const messagePath1FixturePayload = await fs.readFile(messagePath1Fixture, 'utf-8')
const messagePath2Fixture = path.resolve(__dirname, './__fixtures__/message-part-2.txt')
const messagePathTooLongFixture = path.resolve(__dirname, './__fixtures__/message-too-long.txt')

const repoToken = '12345'
const commitSha = 'abc123'
const simpleMessage = 'hello world'

type WebhookPayload = typeof github.context.payload

type Inputs = {
  [key: string]: string | undefined
  message: string | undefined
  'message-path': string | undefined
  'attach-path'?: string
  'attach-name'?: string
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
  'comment-target'?: string
  'commit-sha'?: string
  'delete-on-status'?: string
  preformatted?: string
  truncate?: string
  'truncate-separator'?: string
  find?: string
  replace?: string
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
  'comment-target': 'pr',
  'commit-sha': '',
  truncate: 'simple',
  status: 'success',
}

const defaultIssueNumber = 1

let inputs = defaultInputs
let issueNumber = defaultIssueNumber
let getCommitPullsResponse: Record<string, unknown>[] | undefined
let getIssueCommentsResponse: Record<string, unknown>[] | undefined
let getCommitCommentsResponse: Record<string, unknown>[] | undefined
let postIssueCommentsResponse = {
  id: 42,
}
const deleteIssueCommentResponse = {}

type MessagePayload = {
  comment_id?: number
  body: string
}

let messagePayload: MessagePayload | undefined

vi.mock('@actions/core')

// @actions/github v9 uses undici's fetch (not globalThis.fetch) via a proxy wrapper.
// MSW v2 intercepts globalThis.fetch but not undici's internal fetch.
// We mock @actions/github to provide an Octokit that uses globalThis.fetch instead.
vi.mock('@actions/github', async (importOriginal) => {
  const original = await importOriginal<typeof import('@actions/github')>()
  const { Octokit } = await import('@octokit/core')
  const { restEndpointMethods } = await import('@octokit/plugin-rest-endpoint-methods')
  const { paginateRest } = await import('@octokit/plugin-paginate-rest')

  // Use a wrapper function to always call the current globalThis.fetch at invocation time,
  // not the one captured at module evaluation time. This ensures MSW's patched fetch is used.
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

const mockUploadArtifact = vi.fn().mockResolvedValue({ id: 9999, size: 1024 })

vi.mock('@actions/artifact', () => ({
  DefaultArtifactClient: class {
    uploadArtifact = mockUploadArtifact
  },
}))

const handlers = [
  http.post(
    `https://api.github.com/repos/:repoUser/:repoName/issues/:issueNumber/comments`,
    async ({ request }) => {
      messagePayload = (await request.json()) as MessagePayload
      return HttpResponse.json(postIssueCommentsResponse)
    },
  ),
  http.patch(
    `https://api.github.com/repos/:repoUser/:repoName/issues/comments/:commentId`,
    async ({ request }) => {
      messagePayload = (await request.json()) as MessagePayload
      return HttpResponse.json(postIssueCommentsResponse)
    },
  ),
  http.delete(`https://api.github.com/repos/:repoUser/:repoName/issues/comments/:commentId`, () => {
    return HttpResponse.json(deleteIssueCommentResponse)
  }),
  http.get(`https://api.github.com/repos/:repoUser/:repoName/issues/:issueNumber/comments`, () => {
    return HttpResponse.json(getIssueCommentsResponse)
  }),
  http.get(`https://api.github.com/repos/:repoUser/:repoName/commits/:commitSha/pulls`, () => {
    return HttpResponse.json(getCommitPullsResponse)
  }),
  http.get('https://api.github.com/repos/:repoUser/:repoName/commits/:sha/comments', () => {
    return HttpResponse.json(getCommitCommentsResponse ?? [])
  }),
  http.post(
    'https://api.github.com/repos/:repoUser/:repoName/commits/:sha/comments',
    async ({ request }) => {
      messagePayload = (await request.json()) as MessagePayload
      return HttpResponse.json(postIssueCommentsResponse)
    },
  ),
  http.patch(
    'https://api.github.com/repos/:repoUser/:repoName/comments/:commentId',
    async ({ request }) => {
      messagePayload = (await request.json()) as MessagePayload
      return HttpResponse.json(postIssueCommentsResponse)
    },
  ),
  http.delete('https://api.github.com/repos/:repoUser/:repoName/comments/:commentId', () => {
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
  inputs = { ...defaultInputs }
  issueNumber = defaultIssueNumber
  messagePayload = undefined
  getCommitCommentsResponse = undefined

  vi.resetModules()

  github.context.sha = commitSha
  github.context.runId = 42

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

function getMultilineInput(name: string, options?: core.InputOptions) {
  const inputs = getInput(name, options)
    .split('\n')
    .filter((x: string) => x !== '')

  if (options && options.trimWhitespace === false) {
    return inputs
  }

  return inputs.map((input: string) => input.trim())
}

function getBooleanInput(name: string, options?: core.InputOptions) {
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

  it('creates a truncated comment with a message-path', async () => {
    inputs.message = undefined
    inputs['message-path'] = messagePathTooLongFixture
    inputs['allow-repeats'] = 'true'

    await expect(run()).resolves.not.toThrow()
    expect(messagePayload?.body).toContain('**This message was truncated.**')
    expect(core.setOutput).toHaveBeenCalledWith('truncated', 'true')
    expect(core.setOutput).toHaveBeenCalledWith('comment-created', 'true')
    expect(core.setOutput).toHaveBeenCalledWith('comment-id', postIssueCommentsResponse.id)
    // Body should be well under the safe limit
    expect(messagePayload?.body.length).toBeLessThanOrEqual(61440)
  })

  it('truncates a direct message that exceeds the safe limit', async () => {
    inputs.message = 'x'.repeat(70000)
    inputs['allow-repeats'] = 'true'

    await expect(run()).resolves.not.toThrow()
    expect(messagePayload?.body).toContain('**This message was truncated.**')
    expect(core.setOutput).toHaveBeenCalledWith('truncated', 'true')
    expect(messagePayload?.body.length).toBeLessThanOrEqual(61440)
  })

  it('truncates with a custom separator', async () => {
    inputs.message = 'x'.repeat(70000)
    inputs['allow-repeats'] = 'true'
    inputs['truncate-separator'] = '```\n\n---'

    await expect(run()).resolves.not.toThrow()
    expect(messagePayload?.body).toContain('\n\n```\n\n---\n**This message was truncated.**')
    expect(core.setOutput).toHaveBeenCalledWith('truncated', 'true')
    expect(messagePayload?.body.length).toBeLessThanOrEqual(61440)
  })

  it('terminates incomplete markdown when truncating', async () => {
    // Message with an unclosed code fence
    inputs.message = `\`\`\`\n${'x'.repeat(70000)}\n\`\`\``
    inputs['allow-repeats'] = 'true'

    await expect(run()).resolves.not.toThrow()
    expect(messagePayload?.body).toContain('**This message was truncated.**')
    const beforeSuffix = messagePayload?.body.split('\n\n---\n**This message was truncated.**')[0]
    // remend + terminateMarkdown should close the open code fence
    const fences = beforeSuffix?.match(/```/g) || []
    expect(fences.length % 2).toBe(0)
  })

  it('does not truncate a message under the safe limit', async () => {
    inputs.message = simpleMessage
    inputs['allow-repeats'] = 'true'

    await expect(run()).resolves.not.toThrow()
    expect(messagePayload?.body).not.toContain('**This message was truncated.**')
    expect(core.setOutput).toHaveBeenCalledWith('truncated', 'false')
  })

  it('truncates with artifact upload in artifact mode', async () => {
    inputs.message = 'x'.repeat(70000)
    inputs.truncate = 'artifact'
    inputs['allow-repeats'] = 'true'

    await expect(run()).resolves.not.toThrow()
    expect(messagePayload?.body).toContain('**This message was truncated.**')
    expect(messagePayload?.body).toContain('Download full message')
    expect(messagePayload?.body).toContain('/artifacts/9999')
    expect(core.setOutput).toHaveBeenCalledWith('truncated', 'true')
    expect(core.setOutput).toHaveBeenCalledWith(
      'truncated-artifact-url',
      expect.stringContaining('/artifacts/9999'),
    )
    expect(messagePayload?.body.length).toBeLessThanOrEqual(61440)
  })

  it('falls back to simple truncation when artifact upload fails', async () => {
    mockUploadArtifact.mockRejectedValueOnce(new Error('Upload failed'))

    inputs.message = 'x'.repeat(70000)
    inputs.truncate = 'artifact'
    inputs['allow-repeats'] = 'true'

    await expect(run()).resolves.not.toThrow()
    expect(messagePayload?.body).toContain('**This message was truncated.**')
    expect(messagePayload?.body).not.toContain('Download full message')
    expect(core.setOutput).toHaveBeenCalledWith('truncated', 'true')
    expect(core.warning).toHaveBeenCalledWith(
      expect.stringContaining('falling back to simple truncation'),
    )
    expect(messagePayload?.body.length).toBeLessThanOrEqual(61440)
  })

  it('supports globs in message paths', async () => {
    inputs.message = undefined
    inputs['message-path'] = `${path.resolve(__dirname)}/__fixtures__/message-part-*.txt`
    inputs['allow-repeats'] = 'true'

    await expect(run()).resolves.not.toThrow()
    expect(
      `<!-- add-pr-comment:add-pr-comment -->\n\n${messagePath1FixturePayload}\n${messagePath1FixturePayload}`,
    ).toEqual(messagePayload?.body)
    expect(core.setOutput).toHaveBeenCalledWith('comment-created', 'true')
    expect(core.setOutput).toHaveBeenCalledWith('comment-id', postIssueCommentsResponse.id)
  })

  it('creates a comment combining message and message-path', async () => {
    inputs.message = 'Header text'
    inputs['message-path'] = messagePath1Fixture
    inputs['allow-repeats'] = 'true'

    await expect(run()).resolves.not.toThrow()
    expect(messagePayload?.body).toContain('Header text')
    expect(messagePayload?.body).toContain(messagePath1FixturePayload)
    expect(core.setOutput).toHaveBeenCalledWith('comment-created', 'true')
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
    process.env.GITHUB_TOKEN = repoToken

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

  it('creates a comment with file attachments', async () => {
    inputs.message = simpleMessage
    inputs['attach-path'] = messagePath1Fixture
    inputs['attach-name'] = 'test-artifact'
    inputs['allow-repeats'] = 'true'

    await expect(run()).resolves.not.toThrow()
    expect(messagePayload?.body).toContain('hello world')
    expect(messagePayload?.body).toContain('**Attachments:**')
    expect(messagePayload?.body).toContain('test-artifact')
    expect(core.setOutput).toHaveBeenCalledWith('comment-created', 'true')
    expect(core.setOutput).toHaveBeenCalledWith(
      'artifact-url',
      expect.stringContaining('/artifacts/9999'),
    )
  })

  it('replaces %NOW% template variables in the message', async () => {
    const originalTZ = process.env.TZ
    process.env.TZ = 'UTC'
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-23T14:32:01.000Z'))

    inputs.message = 'Updated at %NOW:yyyy-MM-dd%'
    inputs['allow-repeats'] = 'true'

    await expect(run()).resolves.not.toThrow()
    expect(messagePayload?.body).toContain('Updated at 2026-04-23')
    expect(core.setOutput).toHaveBeenCalledWith('comment-created', 'true')

    vi.useRealTimers()
    if (originalTZ === undefined) {
      delete process.env.TZ
    } else {
      process.env.TZ = originalTZ
    }
  })

  it('wraps a message in a codeblock if preformatted is true', async () => {
    inputs.message = undefined
    inputs.preformatted = 'true'
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
    inputs.find = 'world'
    inputs.replace = 'mars'

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
    inputs.find = 'hello\nworld'
    inputs.replace = 'goodbye\nmars'

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
    inputs.find = 'hello\nworld'
    inputs.message = 'mars'

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
    inputs.find = 'hello'
    inputs.message = 'h\ne\nl\nl\no'

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
    inputs.find = '<< FILE_CONTENTS >>'
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
    inputs.find = '(o|l)/g'
    inputs.replace = 'YY'

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
    inputs.find = '\n\\[ \\]'
    inputs.replace = '[X]'

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

describe('comment-target validation', () => {
  it('fails with an invalid comment-target value', async () => {
    inputs['comment-target'] = 'invalid'
    inputs.message = simpleMessage

    await run()
    expect(core.setFailed).toHaveBeenCalledWith(
      'Invalid comment-target: "invalid". Must be "pr" or "commit".',
    )
  })
})

describe('commit comments', () => {
  it('creates a commit comment when comment-target is commit', async () => {
    inputs['comment-target'] = 'commit'
    inputs.message = simpleMessage
    inputs['allow-repeats'] = 'true'

    // No pull_request in payload — simulating a push event
    github.context.payload = {
      ...github.context.payload,
      pull_request: undefined,
    } as WebhookPayload

    await expect(run()).resolves.not.toThrow()
    expect(core.setOutput).toHaveBeenCalledWith('comment-created', 'true')
    expect(core.setOutput).toHaveBeenCalledWith('comment-id', postIssueCommentsResponse.id)
  })

  it('updates an existing commit comment with matching message-id', async () => {
    inputs['comment-target'] = 'commit'
    inputs.message = simpleMessage

    github.context.payload = {
      ...github.context.payload,
      pull_request: undefined,
    } as WebhookPayload

    const commentId = 123
    getCommitCommentsResponse = [
      {
        id: commentId,
        body: `<!-- add-pr-comment:${inputs['message-id']} -->\n\nold message`,
      },
    ]
    postIssueCommentsResponse = { id: commentId }

    await run()
    expect(core.setOutput).toHaveBeenCalledWith('comment-updated', 'true')
    expect(core.setOutput).toHaveBeenCalledWith('comment-id', commentId)
  })

  it('does not create a commit comment when update-only is true and none exists', async () => {
    inputs['comment-target'] = 'commit'
    inputs.message = simpleMessage
    inputs['update-only'] = 'true'

    github.context.payload = {
      ...github.context.payload,
      pull_request: undefined,
    } as WebhookPayload

    getCommitCommentsResponse = []

    await run()
    expect(core.setOutput).toHaveBeenCalledWith('comment-created', 'false')
  })

  it('uses commit-sha override when provided', async () => {
    inputs['comment-target'] = 'commit'
    inputs['commit-sha'] = 'custom-sha-456'
    inputs.message = simpleMessage
    inputs['allow-repeats'] = 'true'

    github.context.payload = {
      ...github.context.payload,
      pull_request: undefined,
    } as WebhookPayload

    await expect(run()).resolves.not.toThrow()
    expect(core.setOutput).toHaveBeenCalledWith('comment-created', 'true')
  })

  it('skips proxy for commit target even when proxy-url is set', async () => {
    inputs['comment-target'] = 'commit'
    inputs['proxy-url'] = 'https://proxy.example.com'
    inputs.message = simpleMessage
    inputs['allow-repeats'] = 'true'

    github.context.payload = {
      ...github.context.payload,
      pull_request: undefined,
    } as WebhookPayload

    await expect(run()).resolves.not.toThrow()
    // Should create via API directly, not proxy
    expect(core.setOutput).toHaveBeenCalledWith('comment-created', 'true')
  })

  it('supports find-and-replace on commit comments', async () => {
    inputs['comment-target'] = 'commit'
    inputs.find = 'world'
    inputs.replace = 'mars'

    github.context.payload = {
      ...github.context.payload,
      pull_request: undefined,
    } as WebhookPayload

    const commentId = 123
    getCommitCommentsResponse = [
      {
        id: commentId,
        body: `<!-- add-pr-comment:${inputs['message-id']} -->\n\nhello world`,
      },
    ]
    postIssueCommentsResponse = { id: commentId }

    await run()
    expect(messagePayload?.body).toBe('<!-- add-pr-comment:add-pr-comment -->\n\nhello mars')
    expect(core.setOutput).toHaveBeenCalledWith('comment-updated', 'true')
  })

  it('supports refresh-message-position for commit comments', async () => {
    inputs['comment-target'] = 'commit'
    inputs.message = simpleMessage
    inputs['refresh-message-position'] = 'true'

    github.context.payload = {
      ...github.context.payload,
      pull_request: undefined,
    } as WebhookPayload

    const commentId = 123
    getCommitCommentsResponse = [
      {
        id: commentId,
        body: `<!-- add-pr-comment:${inputs['message-id']} -->\n\nold message`,
      },
    ]
    postIssueCommentsResponse = { id: 42 }

    await run()
    // Delete old + create new = comment-updated (the re-created one)
    expect(core.setOutput).toHaveBeenCalledWith('comment-updated', 'true')
    expect(core.setOutput).toHaveBeenCalledWith('comment-id', 42)
  })
})

describe('delete on status', () => {
  it('can delete comment if status is matching', async () => {
    inputs['delete-on-status'] = 'success'
    inputs.status = 'success'
    inputs.message = 'hello'

    const body = `<!-- add-pr-comment:${inputs['message-id']} -->\n\n[ ] Hello\n[ ] World`

    const commentId = 123

    const replyBody = [
      {
        id: commentId,
        body,
      },
    ]

    getIssueCommentsResponse = replyBody

    await run()

    expect(core.setOutput).toHaveBeenCalledWith('comment-deleted', 'true')
  })

  it('does not delete comment if status is not matching', async () => {
    inputs['delete-on-status'] = 'success'
    inputs.status = 'failure'
    inputs.message = 'hello'

    getIssueCommentsResponse = []

    await run()

    expect(core.setOutput).toHaveBeenCalledWith('comment-created', 'true')
  })
})
