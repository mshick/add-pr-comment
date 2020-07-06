import * as fs from 'fs'
import * as path from 'path'
import * as core from '@actions/core'
import * as github from '@actions/github'
import {WebhookPayload} from '@actions/github/lib/interfaces'
import nock from 'nock'
import run from '../add-pr-comment'
import apiResponse from '../docs/sample-pulls-api-response.json'

const repoFullName = 'foo/bar'
const repoToken = '12345'
const userLogin = 'github-actions[bot]'
const commitSha = 'abc123'
let issueNumber = 1
const simpleMessage = 'hello world'
const multilineMessage = fs.readFileSync(path.resolve(__dirname, './message-windows.txt')).toString()
const multilineMessageWindows = fs.readFileSync(path.resolve(__dirname, './message-windows.txt')).toString()

const inputs = {
  message: '',
  'repo-token': '',
  'repo-token-user-login': '',
  'allow-repeats': 'false',
}

beforeEach(() => {
  issueNumber = 1
  jest.resetModules()
  jest.spyOn(core, 'getInput').mockImplementation((name: string): string => {
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
  jest.restoreAllMocks()
  expect(nock.pendingMocks()).toEqual([])
  nock.isDone()
  nock.cleanAll()
})

describe('add-pr-comment action', () => {
  it('creates a comment', async () => {
    inputs.message = simpleMessage
    inputs['repo-token'] = repoToken
    inputs['allow-repeats'] = 'true'

    const originalSetOutput = core.setOutput

    jest.spyOn(core, 'setOutput').mockImplementation((key: string, value: string): void => {
      if (key === 'comment-created') {
        expect(value).toBe('true')
      }

      return originalSetOutput(key, value)
    })

    nock('https://api.github.com')
      .post(`/repos/${repoFullName}/issues/${issueNumber}/comments`, ({body}) => body === simpleMessage)
      .reply(200, {
        url: 'https://github.com/#example',
      })

    await expect(run()).resolves.not.toThrow()
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

    const originalSetOutput = core.setOutput

    jest.spyOn(core, 'setOutput').mockImplementation((key: string, value: string): void => {
      if (key === 'comment-created') {
        expect(value).toBe('true')
      }

      return originalSetOutput(key, value)
    })

    issueNumber = apiResponse.result[0].number
    nock('https://api.github.com')
      .get(`/repos/${repoFullName}/commits/${commitSha}/pulls`)
      .reply(200, apiResponse.result)

    nock('https://api.github.com')
      .post(`/repos/${repoFullName}/issues/${issueNumber}/comments`, ({body}) => body === simpleMessage)
      .reply(200, {
        url: 'https://github.com/#example',
      })

    await expect(run()).resolves.not.toThrow()
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

    const originalSetOutput = core.setOutput

    jest.spyOn(core, 'setOutput').mockImplementation((key: string, value: string): void => {
      if (key === 'comment-created') {
        expect(value).toBe('false')
      }

      return originalSetOutput(key, value)
    })

    nock('https://api.github.com').get(`/repos/${repoFullName}/commits/${commitSha}/pulls`).reply(200, [])

    await run()
  })

  it('identifies repeat messages and does not create a comment [user login provided]', async () => {
    inputs.message = simpleMessage
    inputs['repo-token'] = repoToken
    inputs['repo-token-user-login'] = userLogin
    inputs['allow-repeats'] = 'false'

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
    const originalSetOutput = core.setOutput

    jest.spyOn(core, 'setOutput').mockImplementation((key: string, value: string): void => {
      if (key === 'comment-created') {
        expect(value).toBe('false')
      }

      return originalSetOutput(key, value)
    })

    const replyBody = [
      {
        body: simpleMessage,
        user: {
          login: userLogin,
        },
      },
    ]

    nock('https://api.github.com').get(`/repos/${repoFullName}/issues/1/comments`).reply(200, replyBody)

    await run()
  })

  it('matches multiline messages with windows line feeds against api responses with unix linefeeds [no user login provided]', async () => {
    inputs.message = multilineMessageWindows
    inputs['repo-token'] = repoToken
    inputs['allow-repeats'] = 'false'

    const originalSetOutput = core.setOutput

    jest.spyOn(core, 'setOutput').mockImplementation((key: string, value: string): void => {
      if (key === 'comment-created') {
        expect(value).toBe('false')
      }

      return originalSetOutput(key, value)
    })

    const replyBody = [
      {
        body: multilineMessage,
        user: {
          login: userLogin,
        },
      },
    ]

    nock('https://api.github.com').get(`/repos/${repoFullName}/issues/1/comments`).reply(200, replyBody)

    await run()
  })
})
