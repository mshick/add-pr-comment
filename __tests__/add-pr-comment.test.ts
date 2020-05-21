import * as fs from 'fs'
import * as path from 'path'
import * as core from '@actions/core'
import * as github from '@actions/github'
import {WebhookPayload} from '@actions/github/lib/interfaces'
import nock from 'nock'
import run from '../add-pr-comment'

const repoFullName = 'foo/bar'
const repoToken = '12345'
const simpleMessage = 'hello world'
const multilineMessage = fs.readFileSync(path.resolve(__dirname, './message-windows.txt')).toString()
const multilineMessageWindows = fs.readFileSync(path.resolve(__dirname, './message-windows.txt')).toString()

const inputs = {
  message: '',
  'repo-token': '',
  'allow-repeats': 'false',
}

beforeEach(() => {
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

  // https://developer.github.com/webhooks/event-payloads/#issues
  github.context.payload = {
    pull_request: {
      number: 1,
    },
    repository: {
      full_name: repoFullName,
      name: 'bar',
      owner: {
        login: 'bar',
      },
    },
    sha: 'abc123',
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
      .post(`/repos/${repoFullName}/issues/1/comments`, ({body}) => body === simpleMessage)
      .reply(200, {
        url: 'https://github.com/#example',
      })

    await expect(run()).resolves.not.toThrow()
  })

  it('identifies repeat messages and does not create a comment', async () => {
    inputs.message = simpleMessage
    inputs['repo-token'] = repoToken
    inputs['allow-repeats'] = 'false'

    const originalSetOutput = core.setOutput

    jest.spyOn(core, 'setOutput').mockImplementation((key: string, value: string): void => {
      if (key === 'comment-created') {
        expect(value).toBe('false')
      }

      return originalSetOutput(key, value)
    })

    nock('https://api.github.com')
      .get(`/repos/${repoFullName}/issues/1/comments`)
      .reply(200, [
        {
          body: simpleMessage,
          user: {
            login: 'github-actions[bot]',
          },
        },
      ])

    await run()
  })

  it('matches multiline messages with windows line feeds against api responses with unix linefeeds', async () => {
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

    nock('https://api.github.com')
      .get(`/repos/${repoFullName}/issues/1/comments`)
      .reply(200, [
        {
          body: multilineMessage,
          user: {
            login: 'github-actions[bot]',
          },
        },
      ])

    await run()
  })
})
