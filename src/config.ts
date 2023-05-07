import * as core from '@actions/core'
import * as github from '@actions/github'
import { Inputs } from './types'

export async function getInputs(): Promise<Inputs> {
  const messageIdInput = core.getInput('message-id', { required: false })
  const messageId = messageIdInput === '' ? 'add-pr-comment' : `add-pr-comment:${messageIdInput}`
  const messageInput = core.getInput('message', { required: false })
  const messagePath = core.getInput('message-path', { required: false })
  const messageFind = core.getMultilineInput('find', { required: false })
  const messageReplace = core.getMultilineInput('replace', { required: false })
  const repoOwner = core.getInput('repo-owner', { required: true })
  const repoName = core.getInput('repo-name', { required: true })
  const repoToken = core.getInput('repo-token', { required: true })
  const status = core.getInput('status', { required: true })
  const issue = core.getInput('issue', { required: false })
  const proxyUrl = core.getInput('proxy-url', { required: false }).replace(/\/$/, '')
  const allowRepeats = core.getInput('allow-repeats', { required: true }) === 'true'
  const refreshMessagePosition =
    core.getInput('refresh-message-position', { required: false }) === 'true'
  const updateOnly = core.getInput('update-only', { required: false }) === 'true'
  const preformatted = core.getInput('preformatted', { required: false }) === 'true'

  if (messageInput && messagePath) {
    throw new Error('must specify only one, message or message-path')
  }

  const messageSuccess = core.getInput(`message-success`)
  const messageFailure = core.getInput(`message-failure`)
  const messageCancelled = core.getInput(`message-cancelled`)
  const messageSkipped = core.getInput(`message-skipped`)

  const { payload } = github.context

  return {
    allowRepeats,
    commitSha: github.context.sha,
    issue: issue ? Number(issue) : payload.issue?.number,
    messageInput,
    messageId: `<!-- ${messageId} -->`,
    messageSuccess,
    messageFailure,
    messageCancelled,
    messageSkipped,
    messagePath,
    messageFind,
    messageReplace,
    preformatted,
    proxyUrl,
    pullRequestNumber: payload.pull_request?.number,
    refreshMessagePosition,
    repoToken,
    status,
    owner: repoOwner || payload.repo.owner,
    repo: repoName || payload.repo.repo,
    updateOnly: updateOnly,
  }
}
