import * as core from '@actions/core'
import * as github from '@actions/github'
import {WebhookPayload} from '@actions/github/lib/interfaces'
import run from '../add-pr-comment'

beforeEach(() => {
  jest.resetModules()
  jest.spyOn(core, 'getInput').mockImplementation((name: string): string => {
    switch (name) {
      case 'message':
        return 'hello world'
      case 'repo-token':
        return '12345'
      case 'allow-repeats':
        return 'false'
      default:
        return ''
    }
  })

  // https://developer.github.com/webhooks/event-payloads/#issues
  github.context.payload = {
    action: 'created',
    issue: {
      number: 1,
    },
    comment: {
      id: 1,
      user: {
        login: 'monalisa',
      },
      body: 'Honk',
    },
  } as WebhookPayload
})

describe('add-pr-comment action', () => {
  it('runs', async () => {
    await expect(run()).resolves.not.toThrow()
  })
})
