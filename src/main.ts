import * as core from '@actions/core'
import * as github from '@actions/github'
import {HttpClient} from '@actions/http-client'
import {Endpoints, RequestHeaders, IssuesListCommentsResponseData} from '@octokit/types'

type ListCommitPullsResponseData = Endpoints['GET /repos/:owner/:repo/commits/:commit_sha/pulls']['response']['data']
type CreateIssueCommentResponseData = Endpoints['POST /repos/:owner/:repo/issues/:issue_number/comments']['response']['data']

interface ListCommitPullsParams {
  repoToken: string
  owner: string
  repo: string
  commitSha: string
}

const listCommitPulls = async (
  params: ListCommitPullsParams
): Promise<ListCommitPullsResponseData | null> => {
  const {repoToken, owner, repo, commitSha} = params

  const http = new HttpClient('http-client-add-pr-comment')

  const additionalHeaders: RequestHeaders = {
    accept: 'application/vnd.github.groot-preview+json',
    authorization: `token ${repoToken}`,
  }

  const body = await http.getJson<ListCommitPullsResponseData>(
    `https://api.github.com/repos/${owner}/${repo}/commits/${commitSha}/pulls`,
    additionalHeaders
  )

  return body.result
}

const getIssueNumberFromCommitPullsList = (
  commitPullsList: ListCommitPullsResponseData
): number | null => (commitPullsList.length ? commitPullsList[0].number : null)

interface CreateCommentProxyParams {
  repoToken: string
  body: string
  owner: string
  repo: string
  issueNumber: number
  proxyUrl: string
}

const createCommentProxy = async (
  params: CreateCommentProxyParams
): Promise<CreateIssueCommentResponseData | null> => {
  const {repoToken, owner, repo, issueNumber, body, proxyUrl} = params

  const http = new HttpClient('http-client-add-pr-comment')

  const response = await http.postJson<CreateIssueCommentResponseData>(
    `${proxyUrl}/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
    {body},
    {
      ['temporary-github-token']: repoToken,
    }
  )

  return response.result
}

const isMessagePresent = (
  message: AddPrCommentInputs['message'],
  comments: IssuesListCommentsResponseData,
  login?: string
): boolean => {
  const cleanRe = new RegExp('\\R|\\s', 'g')
  const messageClean = message.replace(cleanRe, '')

  return comments.some(({user, body}) => {
    // If a username is provided we can save on a bit of processing
    if (login && user.login !== login) {
      return false
    }

    return body.replace(cleanRe, '') === messageClean
  })
}

interface AddPrCommentInputs {
  allowRepeats: boolean
  message: string
  proxyUrl?: string
  repoToken?: string
  repoTokenUserLogin?: string
}

const getInputs = (): AddPrCommentInputs => {
  return {
    allowRepeats: Boolean(core.getInput('allow-repeats') === 'true'),
    message: core.getInput('message'),
    proxyUrl: core.getInput('proxy-url').replace(/\/$/, ''),
    repoToken: core.getInput('repo-token') || process.env['GITHUB_TOKEN'],
    repoTokenUserLogin: core.getInput('repo-token-user-login'),
  }
}

const run = async (): Promise<void> => {
  try {
    const {allowRepeats, message, repoToken, repoTokenUserLogin, proxyUrl} = getInputs()

    if (!repoToken) {
      throw new Error(
        'no github token provided, set one with the repo-token input or GITHUB_TOKEN env variable'
      )
    }

    const {
      payload: {pull_request: pullRequest, issue, repository},
      sha: commitSha,
    } = github.context

    if (!repository) {
      core.info('unable to determine repository from request type')
      core.setOutput('comment-created', 'false')
      return
    }

    const {full_name: repoFullName} = repository
    const [owner, repo] = repoFullName!.split('/')

    let issueNumber

    if (issue && issue.number) {
      issueNumber = issue.number
    } else if (pullRequest && pullRequest.number) {
      issueNumber = pullRequest.number
    } else {
      // If this is not a pull request, attempt to find a PR matching the sha
      const commitPullsList = await listCommitPulls({repoToken, owner, repo, commitSha})
      issueNumber = commitPullsList && getIssueNumberFromCommitPullsList(commitPullsList)
    }

    if (!issueNumber) {
      core.info(
        'this action only works on issues and pull_request events or other commits associated with a pull'
      )
      core.setOutput('comment-created', 'false')
      return
    }

    const octokit = github.getOctokit(repoToken)

    let shouldCreateComment = true

    if (!allowRepeats) {
      core.debug('repeat comments are disallowed, checking for existing')

      const {data: comments} = await octokit.issues.listComments({
        owner,
        repo,
        issue_number: issueNumber,
      })

      if (isMessagePresent(message, comments, repoTokenUserLogin)) {
        core.info('the issue already contains an identical message')
        shouldCreateComment = false
      }
    }

    if (shouldCreateComment) {
      if (proxyUrl) {
        await createCommentProxy({
          owner,
          repo,
          issueNumber,
          body: message,
          repoToken,
          proxyUrl,
        })
      } else {
        await octokit.issues.createComment({
          owner,
          repo,
          issue_number: issueNumber,
          body: message,
        })
      }

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
