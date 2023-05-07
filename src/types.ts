import { Endpoints } from '@octokit/types'

export interface Inputs {
  allowRepeats: boolean
  attachPath?: string[]
  commitSha: string
  issue?: number
  messageInput?: string
  messageId: string
  messagePath?: string
  messageFind?: string[]
  messageReplace?: string[]
  messageSuccess?: string
  messageFailure?: string
  messageCancelled?: string
  messageSkipped?: string
  preformatted: boolean
  proxyUrl?: string
  pullRequestNumber?: number
  refreshMessagePosition: boolean
  repo: string
  repoToken: string
  status: string
  owner: string
  updateOnly: boolean
}

export type CreateIssueCommentResponseData =
  Endpoints['POST /repos/{owner}/{repo}/issues/{issue_number}/comments']['response']['data']

export type ExistingIssueCommentResponseData =
  Endpoints['GET /repos/{owner}/{repo}/issues/{issue_number}/comments']['response']['data'][0]

export type ExistingIssueComment = Pick<ExistingIssueCommentResponseData, 'id' | 'body'>
