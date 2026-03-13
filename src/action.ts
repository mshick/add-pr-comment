import * as core from '@actions/core'
import * as github from '@actions/github'
import { createComment, deleteComment, getExistingComment, updateComment } from './comments.js'
import {
  createCommitComment,
  deleteCommitComment,
  getExistingCommitComment,
  updateCommitComment,
} from './commit-comments.js'
import { getInputs } from './config.js'
import { getIssueNumberFromCommitPullsList } from './issues.js'
import {
  addMessageHeader,
  findAndReplaceInMessage,
  getMessage,
  removeMessageHeader,
} from './message.js'
import { createCommentProxy } from './proxy.js'
import type {
  CreateCommitCommentResponseData,
  CreateIssueCommentResponseData,
  ExistingCommitComment,
  ExistingIssueComment,
} from './types.js'

export const run = async (): Promise<void> => {
  try {
    const {
      allowRepeats,
      commentTarget,
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

    if (commentTarget === 'commit') {
      // --- Commit comment path ---

      let existingComment: ExistingCommitComment | undefined

      if (!allowRepeats) {
        core.debug('repeat comments are disallowed, checking for existing commit comment')
        existingComment = await getExistingCommitComment(octokit, owner, repo, commitSha, messageId)

        if (existingComment) {
          core.debug(`existing commit comment found with id: ${existingComment.id}`)
        }
      }

      if (!existingComment && updateOnly) {
        core.info('no existing commit comment found and update-only is true, exiting')
        core.setOutput('comment-created', 'false')
        return
      }

      let comment: CreateCommitCommentResponseData | null | undefined

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

      if (existingComment?.id) {
        if (refreshMessagePosition) {
          await deleteCommitComment(octokit, owner, repo, existingComment.id)
          comment = await createCommitComment(octokit, owner, repo, commitSha, body)
        } else {
          comment = await updateCommitComment(octokit, owner, repo, existingComment.id, body)
        }
        core.setOutput('comment-updated', 'true')
      } else {
        comment = await createCommitComment(octokit, owner, repo, commitSha, body)
        core.setOutput('comment-created', 'true')
      }

      if (comment) {
        core.setOutput('comment-id', comment.id)
      } else {
        core.setOutput('comment-created', 'false')
        core.setOutput('comment-updated', 'false')
      }

      return
    }

    // --- PR/issue comment path (existing code, unchanged) ---

    let issueNumber: number | undefined

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
    core.setFailed(err instanceof Error ? err.message : JSON.stringify(err))
  }
}
