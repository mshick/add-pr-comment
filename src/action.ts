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

interface CommentAdapter {
  getExisting(): Promise<{ id: number; body?: string } | undefined>
  create(body: string): Promise<{ id: number }>
  update(id: number, body: string): Promise<{ id: number }>
  delete(id: number): Promise<void>
}

interface ManageCommentOptions {
  allowRepeats: boolean
  updateOnly: boolean
  refreshMessagePosition: boolean
  messageId: string
  messageFind?: string[]
  messageReplace?: string[]
  message: string | undefined
}

async function manageComment(
  adapter: CommentAdapter,
  options: ManageCommentOptions,
): Promise<void> {
  let { message } = options
  const {
    allowRepeats,
    updateOnly,
    refreshMessagePosition,
    messageId,
    messageFind,
    messageReplace,
  } = options

  let existingComment: { id: number; body?: string } | undefined

  if (!allowRepeats) {
    core.debug('repeat comments are disallowed, checking for existing')
    existingComment = await adapter.getExisting()

    if (existingComment) {
      core.debug(`existing comment found with id: ${existingComment.id}`)
    }
  }

  if (!existingComment && updateOnly) {
    core.info('no existing comment found and update-only is true, exiting')
    core.setOutput('comment-created', 'false')
    return
  }

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

  let comment: { id: number } | null | undefined

  if (existingComment?.id) {
    if (refreshMessagePosition) {
      await adapter.delete(existingComment.id)
      comment = await adapter.create(body)
    } else {
      comment = await adapter.update(existingComment.id, body)
    }
    core.setOutput('comment-updated', 'true')
  } else {
    comment = await adapter.create(body)
    core.setOutput('comment-created', 'true')
  }

  if (comment) {
    core.setOutput('comment-id', comment.id)
  } else {
    core.setOutput('comment-created', 'false')
    core.setOutput('comment-updated', 'false')
  }
}

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

    const commentOptions: ManageCommentOptions = {
      allowRepeats,
      updateOnly,
      refreshMessagePosition,
      messageId,
      messageFind,
      messageReplace,
      message,
    }

    if (commentTarget === 'commit') {
      await manageComment(
        {
          getExisting: () => getExistingCommitComment(octokit, owner, repo, commitSha, messageId),
          create: (body) => createCommitComment(octokit, owner, repo, commitSha, body),
          update: (id, body) => updateCommitComment(octokit, owner, repo, id, body),
          delete: (id) => deleteCommitComment(octokit, owner, repo, id),
        },
        commentOptions,
      )
      return
    }

    // --- PR/issue comment path ---

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

    if (proxyUrl) {
      // Proxy has its own create/update flow, so it's handled separately
      let existingComment: { id: number; body?: string } | undefined

      if (!allowRepeats) {
        existingComment = await getExistingComment(octokit, owner, repo, issueNumber, messageId)
      }

      if (!existingComment && updateOnly) {
        core.info('no existing comment found and update-only is true, exiting')
        core.setOutput('comment-created', 'false')
        return
      }

      let msg = message

      if (messageFind?.length && (messageReplace?.length || msg) && existingComment?.body) {
        msg = findAndReplaceInMessage(
          messageFind,
          messageReplace?.length ? messageReplace : [msg],
          removeMessageHeader(existingComment.body),
        )
      }

      if (!msg) {
        throw new Error('no message, check your message inputs')
      }

      const body = addMessageHeader(messageId, msg)

      const comment = await createCommentProxy({
        commentId: existingComment?.id,
        owner,
        repo,
        issueNumber,
        body,
        repoToken,
        proxyUrl,
      })
      core.setOutput(existingComment?.id ? 'comment-updated' : 'comment-created', 'true')

      if (comment) {
        core.setOutput('comment-id', comment.id)
      } else {
        core.setOutput('comment-created', 'false')
        core.setOutput('comment-updated', 'false')
      }

      return
    }

    await manageComment(
      {
        getExisting: () => getExistingComment(octokit, owner, repo, issueNumber, messageId),
        create: (body) => createComment(octokit, owner, repo, issueNumber, body),
        update: (id, body) => updateComment(octokit, owner, repo, id, body),
        delete: async (id) => {
          await deleteComment(octokit, owner, repo, id, '')
        },
      },
      commentOptions,
    )
  } catch (err) {
    core.setFailed(err instanceof Error ? err.message : JSON.stringify(err))
  }
}
