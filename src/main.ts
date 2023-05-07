import * as core from '@actions/core'
import * as github from '@actions/github'
import { createComment, deleteComment, getExistingComment, updateComment } from './comments'
import { getInputs } from './config'
import { getIssueNumberFromCommitPullsList } from './issues'
import {
  addMessageHeader,
  findAndReplaceInMessage,
  getMessage,
  removeMessageHeader,
} from './message'
import { createCommentProxy } from './proxy'
import { CreateIssueCommentResponseData, ExistingIssueComment } from './types'

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
      messageFind,
      messageReplace,
    } = await getInputs()

    const octokit = github.getOctokit(repoToken)

    let message = await getMessage({
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

    let existingComment: ExistingIssueComment | undefined

    if (!allowRepeats) {
      core.debug('repeat comments are disallowed, checking for existing')

      existingComment = await getExistingComment(octokit, owner, repo, issueNumber, messageId)

      if (existingComment) {
        core.debug(`existing comment found with id: ${existingComment.id}`)
      }
    }

    // if no existing comment and updateOnly is true, exit
    if (!existingComment && updateOnly) {
      core.info('no existing comment found and update-only is true, exiting')
      core.setOutput('comment-created', 'false')
      return
    }

    let comment: CreateIssueCommentResponseData | null | undefined

    if (messageFind?.length && (messageReplace?.length || message) && existingComment?.body) {
      message = findAndReplaceInMessage(
        messageFind,
        messageReplace?.length ? messageReplace : [message],
        removeMessageHeader(existingComment.body),
      )
    }

    if (!message) {
      throw new Error('no message, check your message inputs')
    }

    const body = addMessageHeader(messageId, message)

    if (proxyUrl) {
      comment = await createCommentProxy({
        commentId: existingComment?.id,
        owner,
        repo,
        issueNumber,
        body,
        repoToken,
        proxyUrl,
      })
      core.setOutput(existingComment?.id ? 'comment-updated' : 'comment-created', 'true')
    } else if (existingComment?.id) {
      if (refreshMessagePosition) {
        await deleteComment(octokit, owner, repo, existingComment.id, body)
        comment = await createComment(octokit, owner, repo, issueNumber, body)
      } else {
        comment = await updateComment(octokit, owner, repo, existingComment.id, body)
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
