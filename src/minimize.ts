import type { GitHub } from '@actions/github/lib/utils'
import { withRetry } from './retry.js'
import type { MinimizeReason } from './types.js'

const MINIMIZE_COMMENT_MUTATION = `
  mutation MinimizeComment($id: ID!, $classifier: ReportedContentClassifiers!) {
    minimizeComment(input: { subjectId: $id, classifier: $classifier }) {
      minimizedComment {
        isMinimized
      }
    }
  }
`

export async function minimizeComment(
  octokit: InstanceType<typeof GitHub>,
  nodeId: string,
  classifier: MinimizeReason,
): Promise<void> {
  await withRetry(() =>
    octokit.graphql(MINIMIZE_COMMENT_MUTATION, {
      id: nodeId,
      classifier,
    }),
  )
}
