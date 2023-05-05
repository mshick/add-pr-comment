import * as core from '@actions/core'
import * as github from '@actions/github'
import {
  CreateIssueCommentResponseData,
  createComment,
  deleteComment,
  getExistingCommentId,
  updateComment,
} from './comments'
import { getInputs } from './config'
import { getIssueNumberFromCommitPullsList } from './issues'
import { getMessage } from './message'
import { createCommentProxy } from './proxy'

const run = async (): Promise<void> => {
  try {
    const {
      allowRepeats,
      messagePath,
      messageInput,
      messageId,
      refreshMessagePosition,
      repoToken,
      proxyUrl,
      issue,
      pullRequestNumber,
      commitSha,
      repo,
      owner,
      updateOnly,
      messageCancelled,
      messageFailure,
      messageSuccess,
      messageSkipped,
      preformatted,
      status,
    } = await getInputs()

    const octokit = github.getOctokit(repoToken)

    const message = await getMessage({
      messagePath,
      messageInput,
      messageSkipped,
      messageCancelled,
      messageSuccess,
      messageFailure,
      preformatted,
      status,
    })

    let issueNumber

    if (issue) {
      issueNumber = issue
    } else if (pullRequestNumber) {
      issueNumber = pullRequestNumber
    } else {
      // If this is not a pull request, attempt to find a PR matching the sha
      issueNumber = await getIssueNumberFromCommitPullsList(octokit, owner, repo, commitSha)
    }

    if (!issueNumber) {
      core.info(
        'no issue number found, use a pull_request event, a pull event, or provide an issue input',
      )
      core.setOutput('comment-created', 'false')
      return
    }

    let existingCommentId

    if (!allowRepeats) {
      core.debug('repeat comments are disallowed, checking for existing')

      existingCommentId = await getExistingCommentId(octokit, owner, repo, issueNumber, messageId)

      if (existingCommentId) {
        core.debug(`existing comment found with id: ${existingCommentId}`)
      }
    }

    // if no existing comment and updateOnly is true, exit
    if (!existingCommentId && updateOnly) {
      core.info('no existing comment found and update-only is true, exiting')
      core.setOutput('comment-created', 'false')
      return
    }

    let comment: CreateIssueCommentResponseData | null | undefined

    const body = `${messageId}\n\n${message}`

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
      if (refreshMessagePosition) {
        await deleteComment(octokit, owner, repo, existingCommentId, body)
        comment = await createComment(octokit, owner, repo, issueNumber, body)
      } else {
        comment = await updateComment(octokit, owner, repo, existingCommentId, body)
      }
      core.setOutput('comment-updated', 'true')
    } else {
      comment = await createComment(octokit, owner, repo, issueNumber, body)
      core.setOutput('comment-created', 'true')
    }

    if (comment) {
      core.setOutput('comment-id', comment.id)
    } else {
      core.setOutput('comment-created', 'false')
      core.setOutput('comment-updated', 'false')
    }
  } catch (err) {
    if (process.env.NODE_ENV === 'test') {
      // eslint-disable-next-line no-console
      console.log(err)
    }

    if (err instanceof Error) {
      core.setFailed(err.message)
    }
  }
}

// Don't auto-execute in the test environment
if (process.env['NODE_ENV'] !== 'test') {
  run()
}

export default run
