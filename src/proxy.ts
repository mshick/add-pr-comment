import { HttpClient } from '@actions/http-client'
import { CreateIssueCommentResponseData } from './types'

export interface CreateCommentProxyParams {
  repoToken: string
  commentId?: number
  body: string
  owner: string
  repo: string
  issueNumber: number
  proxyUrl: string
}

export async function createCommentProxy(
  params: CreateCommentProxyParams,
): Promise<CreateIssueCommentResponseData | null> {
  const { repoToken, owner, repo, issueNumber, body, commentId, proxyUrl } = params

  const http = new HttpClient('http-client-add-pr-comment')

  const response = await http.postJson<CreateIssueCommentResponseData>(
    `${proxyUrl}/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
    { comment_id: commentId, body },
    {
      ['temporary-github-token']: repoToken,
    },
  )

  return response.result
}
