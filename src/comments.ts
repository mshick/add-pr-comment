import { GitHub } from '@actions/github/lib/utils'
import { Endpoints } from '@octokit/types'

export type CreateIssueCommentResponseData =
  Endpoints['POST /repos/{owner}/{repo}/issues/{issue_number}/comments']['response']['data']

export async function getExistingCommentId(
  octokit: InstanceType<typeof GitHub>,
  owner: string,
  repo: string,
  issueNumber: number,
  messageId: string,
): Promise<number | undefined> {
  const comments = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: issueNumber,
  })

  const found = comments.data.find(({ body }) => {
    return (body?.search(messageId) ?? -1) > -1
  })

  return found?.id
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
