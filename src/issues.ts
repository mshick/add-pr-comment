import type { GitHub } from '@actions/github/lib/utils'
import { withRetry } from './retry.js'

export async function getIssueNumberFromCommitPullsList(
  octokit: InstanceType<typeof GitHub>,
  owner: string,
  repo: string,
  commitSha: string,
): Promise<number | null> {
  const commitPullsList = await withRetry(() =>
    octokit.rest.repos.listPullRequestsAssociatedWithCommit({
      owner,
      repo,
      commit_sha: commitSha,
    }),
  )

  return commitPullsList.data.length ? commitPullsList.data?.[0].number : null
}
