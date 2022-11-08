import * as core from '@actions/core'
import * as github from '@actions/github'
import fs from 'node:fs/promises'

interface Inputs {
  allowRepeats: boolean
  message?: string
  messageId: string
  messagePath?: string
  messageSuccess?: string
  messageFailure?: string
  messageCancelled?: string
  proxyUrl?: string
  repoToken: string
  status?: string
  issue?: number
  commitSha: string
  pullRequestNumber?: number
  repo: string
  owner: string
}

export async function getInputs(): Promise<Inputs> {
  const messageIdInput = core.getInput('message-id', { required: false })
  const messageId = messageIdInput === '' ? 'add-pr-comment' : `add-pr-comment:${messageIdInput}`
  const messageInput = core.getInput('message', { required: false })
  const messagePath = core.getInput('message-path', { required: false })
  const repoToken = core.getInput('repo-token', { required: true })
  const status = core.getInput('status', { required: true })
  const issue = core.getInput('issue', { required: false })
  const proxyUrl = core.getInput('proxy-url', { required: false }).replace(/\/$/, '')
  const allowRepeats = core.getInput('allow-repeats', { required: true }) === 'true'

  if (messageInput && messagePath) {
    throw new Error('must specify only one, message or message-path')
  }

  let message

  if (messagePath) {
    message = await fs.readFile(messagePath, { encoding: 'utf8' })
  } else {
    message = messageInput
  }

  const messageSuccess = core.getInput(`message-success`)
  const messageFailure = core.getInput(`message-failure`)
  const messageCancelled = core.getInput(`message-cancelled`)

  if (status === 'success' && messageSuccess) {
    message = messageSuccess
  }

  if (status === 'failure' && messageFailure) {
    message = messageFailure
  }

  if (status === 'cancelled' && messageCancelled) {
    message = messageCancelled
  }

  if (!message) {
    throw new Error('no message, check your message inputs')
  }

  const { payload } = github.context

  const repoFullName = payload.repository?.full_name

  if (!repoFullName) {
    throw new Error('unable to determine repository from request type')
  }

  const [owner, repo] = repoFullName.split('/')

  return {
    allowRepeats,
    message,
    messageId: `<!-- ${messageId} -->`,
    proxyUrl,
    repoToken,
    status,
    issue: issue ? Number(issue) : payload.issue?.number,
    pullRequestNumber: payload.pull_request?.number,
    commitSha: github.context.sha,
    owner,
    repo,
  }
}
