import { GitHub } from '@actions/github/lib/utils'

export async function getIssueNumberFromCommitPullsList(
  octokit: InstanceType<typeof GitHub>,
  owner: string,
  repo: string,
  commitSha: string,
): Promise<number | null> {
  const commitPullsList = await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
    owner,
    repo,
    commit_sha: commitSha,
  })

  return commitPullsList.data.length ? commitPullsList.data?.[0].number : null
}
