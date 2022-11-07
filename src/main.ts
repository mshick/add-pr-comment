import * as core from '@actions/core'
import * as github from '@actions/github'
import { HttpClient } from '@actions/http-client'
import { Endpoints } from '@octokit/types'
import fs from 'node:fs/promises'

type ListCommitPullsResponseData =
  Endpoints['GET /repos/{owner}/{repo}/commits/{commit_sha}/pulls']['response']['data']
type CreateIssueCommentResponseData =
  Endpoints['POST /repos/{owner}/{repo}/issues/{issue_number}/comments']['response']['data']
type IssuesListCommentsResponseData =
  Endpoints['GET /repos/{owner}/{repo}/issues/comments']['response']['data']

const getIssueNumberFromCommitPullsList = (
  commitPullsList: ListCommitPullsResponseData,
): number | null => (commitPullsList.length ? commitPullsList[0].number : null)

interface CreateCommentProxyParams {
  repoToken: string
  commentId?: number
  body: string
  owner: string
  repo: string
  issueNumber: number
  proxyUrl: string
}

async function createCommentProxy(
  params: CreateCommentProxyParams,
): Promise<CreateIssueCommentResponseData | null> {
  const { repoToken, owner, repo, issueNumber, body, commentId, proxyUrl } = params

  const http = new HttpClient('http-client-add-pr-comment')

  const response = await http.postJson<CreateIssueCommentResponseData>(
    `${proxyUrl}/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
    { comment_id: commentId, body },
    {
      ['temporary-github-token']: repoToken,
    },
  )

  return response.result
}

function getExistingCommentId(
  comments: IssuesListCommentsResponseData,
  messageId: string,
): number | undefined {
  const found = comments.find(({ body }) => {
    return (body?.search(messageId) ?? -1) > -1
  })

  return found?.id
}

interface AddPrCommentInputs {
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
}

async function getInputs(): Promise<AddPrCommentInputs> {
  const messageId = core.getInput('message-id')
  const messageInput = core.getInput('message')
  const messagePath = core.getInput('message-path')
  const repoToken = core.getInput('repo-token') || process.env['GITHUB_TOKEN']
  const status = core.getInput('status')

  if (!repoToken) {
    throw new Error(
      'no github token provided, set one with the repo-token input or GITHUB_TOKEN env variable',
    )
  }

  if (messageInput && messagePath) {
    throw new Error('must specify only one, message or message-path')
  }

  let message

  if (messagePath) {
    message = await fs.readFile(messagePath, { encoding: 'utf8' })
  } else {
    message = messageInput
  }

  if (status) {
    const statusMessage = core.getInput(`message-${status}`)
    if (statusMessage) {
      message = statusMessage
    }
  }

  if (!message) {
    throw new Error('no message, check your message inputs')
  }

  return {
    allowRepeats: Boolean(core.getInput('allow-repeats') === 'true'),
    message,
    messageId: messageId === '' ? 'add-pr-comment' : messageId,
    proxyUrl: core.getInput('proxy-url').replace(/\/$/, ''),
    repoToken,
    status,
  }
}

const run = async (): Promise<void> => {
  try {
    const { allowRepeats, message, messageId, repoToken, proxyUrl } = await getInputs()
    const messageIdComment = `<!-- ${messageId} -->`

    const {
      payload: { pull_request: pullRequest, issue, repository },
      sha: commitSha,
    } = github.context

    if (!repository) {
      core.info('unable to determine repository from request type')
      core.setOutput('comment-created', 'false')
      return
    }

    const { full_name: repoFullName } = repository

    if (!repoFullName) {
      core.info('repository is missing a full_name property... weird')
      core.setOutput('comment-created', 'false')
      return
    }

    const [owner, repo] = repoFullName.split('/')
    const octokit = github.getOctokit(repoToken)

    let issueNumber

    if (issue && issue.number) {
      issueNumber = issue.number
    } else if (pullRequest && pullRequest.number) {
      issueNumber = pullRequest.number
    } else {
      // If this is not a pull request, attempt to find a PR matching the sha
      const commitPullsList = await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
        owner,
        repo,
        commit_sha: commitSha,
      })
      issueNumber = commitPullsList.data && getIssueNumberFromCommitPullsList(commitPullsList.data)
    }

    if (!issueNumber) {
      core.info(
        'this action only works on issues and pull_request events or other commits associated with a pull',
      )
      core.setOutput('comment-created', 'false')
      return
    }

    let existingCommentId

    if (!allowRepeats) {
      core.debug('repeat comments are disallowed, checking for existing')

      const { data: comments } = await octokit.rest.issues.listComments({
        owner,
        repo,
        issue_number: issueNumber,
      })

      existingCommentId = getExistingCommentId(comments, messageIdComment)

      if (existingCommentId) {
        core.debug(`existing comment found with id: ${existingCommentId}`)
      }
    }

    let comment: CreateIssueCommentResponseData | null | undefined
    const body = `${messageIdComment}\n\n${message}`

    if (proxyUrl) {
      comment = await createCommentProxy({
        commentId: existingCommentId,
        owner,
        repo,
        issueNumber,
        body,
        repoToken,
        proxyUrl,
      })
      core.setOutput(existingCommentId ? 'comment-updated' : 'comment-created', 'true')
    } else if (existingCommentId) {
      const updatedComment = await octokit.rest.issues.updateComment({
        comment_id: existingCommentId,
        owner,
        repo,
        body,
      })
      comment = updatedComment.data
      core.setOutput('comment-updated', 'true')
    } else {
      const createdComment = await octokit.rest.issues.createComment({
        issue_number: issueNumber,
        owner,
        repo,
        body,
      })
      comment = createdComment.data
      core.setOutput('comment-created', 'true')
    }

    if (comment) {
      core.setOutput('comment-id', comment.id)
    } else {
      core.setOutput('comment-created', 'false')
      core.setOutput('comment-updated', 'false')
    }
  } catch (err) {
    if (err instanceof Error) {
      core.setFailed(err.message)
    } else {
      core.setFailed('unknown failure')
    }
  }
}

// Don't auto-execute in the test environment
if (process.env['NODE_ENV'] !== 'test') {
  run()
}

export default run
