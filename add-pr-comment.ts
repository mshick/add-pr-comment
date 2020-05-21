import * as core from '@actions/core'
import * as github from '@actions/github'
import {HttpClient} from '@actions/http-client'
import {Endpoints, RequestHeaders} from '@octokit/types'
import {Octokit} from '@octokit/rest'

type ListCommitPullsResponse = Endpoints['GET /repos/:owner/:repo/commits/:commit_sha/pulls']['response']

interface AddPrCommentInputs {
  message: string
  repoToken: string
  allowRepeats: boolean
}

interface ListCommitPullsParams {
  repoToken: string
  owner: string
  repo: string
  commitSha: string
}

const listCommitPulls = async (params: ListCommitPullsParams): Promise<ListCommitPullsResponse | null> => {
  const {repoToken, owner, repo, commitSha} = params

  const http = new HttpClient('http-client-add-pr-comment')

  const additionalHeaders: RequestHeaders = {
    accept: 'application/vnd.github.groot-preview+json',
    authorization: `token ${repoToken}`,
  }

  const body = await http.getJson<ListCommitPullsResponse>(
    `https://api.github.com/repos/${owner}/${repo}/commits/${commitSha}/pulls`,
    additionalHeaders,
  )

  return body.result
}

const getIssueNumberFromCommitPullsList = (commitPullsList: ListCommitPullsResponse): number | null =>
  commitPullsList.data && commitPullsList.data.length ? commitPullsList.data[0].number : null

const isMessagePresent = (
  message: AddPrCommentInputs['message'],
  comments: Octokit.IssuesListCommentsResponse,
): boolean => {
  const cleanRe = new RegExp('\\R|\\s', 'g')
  const messageClean = message.replace(cleanRe, '')

  return comments.some(
    ({user, body}) =>
      // First find candidate bot messages to avoid extra processing
      user.login === 'github-actions[bot]' && body.replace(cleanRe, '') === messageClean,
  )
}

const getInputs = (): AddPrCommentInputs => {
  return {
    message: core.getInput('message'),
    repoToken: core.getInput('repo-token'),
    allowRepeats: Boolean(core.getInput('allow-repeats') === 'true'),
  }
}

const run = async (): Promise<void> => {
  try {
    const {message, repoToken, allowRepeats} = getInputs()

    core.debug(`input message: ${message}`)
    core.debug(`input allow-repeats: ${allowRepeats}`)

    const {
      payload: {pull_request: pullRequest, repository},
      sha: commitSha,
    } = github.context

    if (!repository) {
      core.info('unable to determine repository from request type')
      core.setOutput('comment-created', 'false')
      return
    }

    const {full_name: repoFullName} = repository!
    const [owner, repo] = repoFullName!.split('/')

    let issueNumber

    if (pullRequest && pullRequest.number) {
      issueNumber = pullRequest.number
    } else {
      // If this is not a pull request, attempt to find a PR matching the sha
      const commitPullsList = await listCommitPulls({repoToken, owner, repo, commitSha})
      issueNumber = commitPullsList && getIssueNumberFromCommitPullsList(commitPullsList)
    }

    if (!issueNumber) {
      core.info('this action only works on pull_request events or other commits associated with a pull')
      core.setOutput('comment-created', 'false')
      return
    }

    const octokit = new github.GitHub(repoToken)

    let shouldCreateComment = true

    if (!allowRepeats) {
      core.debug('repeat comments are disallowed, checking for existing')

      const {data: comments} = await octokit.issues.listComments({
        owner,
        repo,
        issue_number: issueNumber,
      })

      if (isMessagePresent(message, comments)) {
        core.info('the issue already contains an identical message')
        shouldCreateComment = false
      }
    }

    if (shouldCreateComment) {
      await octokit.issues.createComment({
        owner,
        repo,
        issue_number: issueNumber,
        body: message,
      })

      core.setOutput('comment-created', 'true')
    } else {
      core.setOutput('comment-created', 'false')
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}

// Don't auto-execute in the test environment
if (process.env['NODE_ENV'] !== 'test') {
  run()
}

export default run
