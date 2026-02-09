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

export interface CreateIssueCommentResponseData {
  id: number
  body?: string
  [key: string]: any
}

export interface ExistingIssueComment {
  id: number
  body?: string
}
