import { GitHub } from '@actions/github/lib/utils'
import {
  CreateIssueCommentResponseData,
  ExistingIssueComment,
  ExistingIssueCommentResponseData,
} from './types'

export async function getExistingComment(
  octokit: InstanceType<typeof GitHub>,
  owner: string,
  repo: string,
  issueNumber: number,
  messageId: string,
): Promise<ExistingIssueComment | undefined> {
  const parameters = {
    owner,
    repo,
    issue_number: issueNumber,
    per_page: 100,
  }

  let found: ExistingIssueCommentResponseData | undefined

  for await (const comments of octokit.paginate.iterator(
    octokit.rest.issues.listComments,
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
    const { id, body } = found
    return { id, body }
  }

  return
}

export async function updateComment(
  octokit: InstanceType<typeof GitHub>,
  owner: string,
  repo: string,
  existingCommentId: number,
  body: string,
): Promise<CreateIssueCommentResponseData> {
  const updatedComment = await octokit.rest.issues.updateComment({
    comment_id: existingCommentId,
    owner,
    repo,
    body,
  })

  return updatedComment.data
}

export async function deleteComment(
  octokit: InstanceType<typeof GitHub>,
  owner: string,
  repo: string,
  existingCommentId: number,
  body: string,
): Promise<CreateIssueCommentResponseData> {
  const deletedComment = await octokit.rest.issues.deleteComment({
    comment_id: existingCommentId,
    owner,
    repo,
    body,
  })

  return deletedComment.data
}

export async function createComment(
  octokit: InstanceType<typeof GitHub>,
  owner: string,
  repo: string,
  issueNumber: number,
  body: string,
): Promise<CreateIssueCommentResponseData> {
  const createdComment = await octokit.rest.issues.createComment({
    issue_number: issueNumber,
    owner,
    repo,
    body,
  })

  return createdComment.data
}
