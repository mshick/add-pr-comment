import * as core from '@actions/core'
import * as github from '@actions/github'
import { uploadAttachments } from './attachments.js'
import { createComment, deleteComment, getExistingComment, updateComment } from './comments.js'
import {
  createCommitComment,
  deleteCommitComment,
  getExistingCommitComment,
  updateCommitComment,
} from './commit-comments.js'
import { getInputs } from './config.js'
import { findFiles } from './files.js'
import { getIssueNumberFromCommitPullsList } from './issues.js'
import {
  addMessageHeader,
  findAndReplaceInMessage,
  getMessage,
  removeMessageHeader,
  truncateMessage,
} from './message.js'
import { minimizeComment } from './minimize.js'
import { createCommentProxy } from './proxy.js'
import { replaceTemplateVariables } from './templates.js'
import type { MinimizeReason } from './types.js'

interface CommentAdapter {
  getExisting(): Promise<{ id: number; nodeId: string; body?: string } | undefined>
  create(body: string): Promise<{ id: number; nodeId: string }>
  update(id: number, body: string): Promise<{ id: number; nodeId: string }>
  delete(id: number): Promise<void>
  minimize(nodeId: string, reason: MinimizeReason): Promise<void>
}

interface ManageCommentOptions {
  allowRepeats: boolean
  updateOnly: boolean
  refreshMessagePosition: boolean
  deleteOnStatus?: string
  status: string
  messageId: string
  messageFind?: string[]
  messageReplace?: string[]
  message: string | undefined
  templateVariables: boolean
  createMinimized: boolean
  deleteMethod: 'delete' | 'minimize'
  minimizeReason: MinimizeReason
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
    deleteOnStatus,
    status,
    messageId,
    messageFind,
    messageReplace,
    templateVariables,
    createMinimized,
    deleteMethod,
    minimizeReason,
  } = options

  let existingComment: { id: number; nodeId: string; body?: string } | undefined

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

  if (deleteOnStatus && deleteOnStatus === status) {
    if (existingComment) {
      if (deleteMethod === 'minimize') {
        core.info('minimizing existing comment because delete-on-status matched')
        await adapter.minimize(existingComment.nodeId, minimizeReason)
        core.setOutput('comment-minimized', 'true')
      } else {
        core.info('deleting existing comment because delete-on-status matched')
        await adapter.delete(existingComment.id)
        core.setOutput('comment-deleted', 'true')
      }
    } else {
      core.info('skipping creating comment because delete-on-status matched')
      core.setOutput('comment-created', 'false')
    }
    return
  }

  if (messageFind?.length && (messageReplace?.length || message) && existingComment?.body) {
    message = findAndReplaceInMessage(
      messageFind,
      messageReplace?.length ? messageReplace : [message!],
      removeMessageHeader(existingComment.body),
    )
  }

  if (!message) {
    throw new Error('no message, check your message inputs')
  }

  if (templateVariables) {
    message = replaceTemplateVariables(message)
  }

  const body = addMessageHeader(messageId, message)

  let comment: { id: number; nodeId: string } | null | undefined
  let created = false

  if (existingComment?.id) {
    if (refreshMessagePosition) {
      await adapter.delete(existingComment.id)
      comment = await adapter.create(body)
      created = true
    } else {
      comment = await adapter.update(existingComment.id, body)
    }
    core.setOutput('comment-updated', 'true')
  } else {
    comment = await adapter.create(body)
    created = true
    core.setOutput('comment-created', 'true')
  }

  if (comment) {
    core.setOutput('comment-id', comment.id)
    if (created && createMinimized) {
      await adapter.minimize(comment.nodeId, minimizeReason)
      core.setOutput('comment-minimized', 'true')
    }
  } else {
    core.setOutput('comment-created', 'false')
    core.setOutput('comment-updated', 'false')
  }
}

export const run = async (): Promise<void> => {
  try {
    const {
      allowRepeats,
      attachName,
      attachPath,
      attachText,
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
      deleteOnStatus,
      createMinimized,
      deleteMethod,
      minimizeReason,
      messageCancelled,
      messageFailure,
      messageSuccess,
      messageSkipped,
      preformatted,
      templateVariables,
      status,
      messageFind,
      messageReplace,
      truncate,
      truncateSeparator,
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

    if (attachPath) {
      const files = await findFiles(attachPath)
      if (files.length) {
        const attachment = await uploadAttachments({
          files,
          name: attachName,
          owner,
          repo,
          text: attachText,
        })
        message = (message ?? '') + attachment.markdown
        core.setOutput('artifact-url', attachment.url)
      }
    }

    const headerLength = messageId.length + 2 // messageId + '\n\n' from addMessageHeader

    if (message) {
      const truncateResult = await truncateMessage(
        message,
        truncate,
        headerLength,
        messageId,
        truncateSeparator,
      )
      message = truncateResult.message
      core.setOutput('truncated', truncateResult.truncated ? 'true' : 'false')
      if (truncateResult.artifactUrl) {
        core.setOutput('truncated-artifact-url', truncateResult.artifactUrl)
      }
    } else {
      core.setOutput('truncated', 'false')
    }

    const commentOptions: ManageCommentOptions = {
      allowRepeats,
      updateOnly,
      refreshMessagePosition,
      deleteOnStatus,
      status,
      messageId,
      messageFind,
      messageReplace,
      message,
      templateVariables,
      createMinimized,
      deleteMethod,
      minimizeReason,
    }

    if (commentTarget === 'commit') {
      await manageComment(
        {
          getExisting: async () => {
            const existing = await getExistingCommitComment(
              octokit,
              owner,
              repo,
              commitSha,
              messageId,
            )
            return existing
              ? { id: existing.id, nodeId: existing.node_id, body: existing.body }
              : undefined
          },
          create: async (body) => {
            const c = await createCommitComment(octokit, owner, repo, commitSha, body)
            return { id: c.id, nodeId: c.node_id }
          },
          update: async (id, body) => {
            const c = await updateCommitComment(octokit, owner, repo, id, body)
            return { id: c.id, nodeId: c.node_id }
          },
          delete: (id) => deleteCommitComment(octokit, owner, repo, id),
          minimize: (nodeId, reason) => minimizeComment(octokit, nodeId, reason),
        },
        commentOptions,
      )
      return
    }

    // --- PR/issue comment path ---

    let issueNumber: number | undefined | null

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
      if (createMinimized || deleteMethod === 'minimize') {
        throw new Error(
          'create-minimized and delete-method: minimize are not supported with proxy-url, which is used for fork PRs that lack the write permissions minimize requires.',
        )
      }

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

      if (deleteOnStatus && deleteOnStatus === status) {
        if (existingComment) {
          core.warning(
            'delete-on-status matched but deleting comments is not supported when using a proxy; leaving the existing comment in place',
          )
          core.setOutput('comment-created', 'false')
          core.setOutput('comment-updated', 'false')
        } else {
          core.info('skipping creating comment because delete-on-status matched')
          core.setOutput('comment-created', 'false')
        }
        return
      }

      let msg = message

      if (messageFind?.length && (messageReplace?.length || msg) && existingComment?.body) {
        msg = findAndReplaceInMessage(
          messageFind,
          messageReplace?.length ? messageReplace : [msg!],
          removeMessageHeader(existingComment.body),
        )
      }

      if (!msg) {
        throw new Error('no message, check your message inputs')
      }

      if (templateVariables) {
        msg = replaceTemplateVariables(msg)
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
        getExisting: async () => {
          const existing = await getExistingComment(octokit, owner, repo, issueNumber, messageId)
          return existing
            ? { id: existing.id, nodeId: existing.node_id, body: existing.body ?? undefined }
            : undefined
        },
        create: async (body) => {
          const c = await createComment(octokit, owner, repo, issueNumber, body)
          return { id: c.id, nodeId: c.node_id }
        },
        update: async (id, body) => {
          const c = await updateComment(octokit, owner, repo, id, body)
          return { id: c.id, nodeId: c.node_id }
        },
        delete: async (id) => {
          await deleteComment(octokit, owner, repo, id)
        },
        minimize: (nodeId, reason) => minimizeComment(octokit, nodeId, reason),
      },
      commentOptions,
    )
  } catch (err) {
    core.setFailed(err instanceof Error ? err.message : JSON.stringify(err))
  }
}
