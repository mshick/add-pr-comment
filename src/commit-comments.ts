import type { GitHub } from '@actions/github/lib/utils'
import { withRetry } from './retry.js'
import type { CreateCommitCommentResponseData, ExistingCommitComment } from './types.js'

export async function getExistingCommitComment(
  octokit: InstanceType<typeof GitHub>,
  owner: string,
  repo: string,
  commitSha: string,
  messageId: string,
): Promise<ExistingCommitComment | undefined> {
  const parameters = {
    owner,
    repo,
    commit_sha: commitSha,
    per_page: 100,
  }

  let found: { id: number; body?: string | undefined } | undefined

  for await (const comments of octokit.paginate.iterator(
    octokit.rest.repos.listCommentsForCommit,
    parameters,
  )) {
    found = comments.data.find(({ body }) => {
      return (body?.search(messageId) ?? -1) > -1
    })

    if (found) {
      break
    }
  }

  if (found) {
    const { id, body = '' } = found
    return { id, body }
  }

  return
}

export async function createCommitComment(
  octokit: InstanceType<typeof GitHub>,
  owner: string,
  repo: string,
  commitSha: string,
  body: string,
): Promise<CreateCommitCommentResponseData> {
  const createdComment = await withRetry(() =>
    octokit.rest.repos.createCommitComment({
      owner,
      repo,
      commit_sha: commitSha,
      body,
    }),
  )

  return createdComment.data
}

export async function updateCommitComment(
  octokit: InstanceType<typeof GitHub>,
  owner: string,
  repo: string,
  commentId: number,
  body: string,
): Promise<CreateCommitCommentResponseData> {
  const updatedComment = await withRetry(() =>
    octokit.rest.repos.updateCommitComment({
      owner,
      repo,
      comment_id: commentId,
      body,
    }),
  )

  return updatedComment.data
}

export async function deleteCommitComment(
  octokit: InstanceType<typeof GitHub>,
  owner: string,
  repo: string,
  commentId: number,
): Promise<void> {
  await withRetry(() =>
    octokit.rest.repos.deleteCommitComment({
      owner,
      repo,
      comment_id: commentId,
    }),
  )
}
