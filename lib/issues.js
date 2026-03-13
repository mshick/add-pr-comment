import { withRetry } from './retry';
export async function getIssueNumberFromCommitPullsList(octokit, owner, repo, commitSha) {
    const commitPullsList = await withRetry(() => octokit.rest.repos.listPullRequestsAssociatedWithCommit({
        owner,
        repo,
        commit_sha: commitSha,
    }));
    return commitPullsList.data.length ? commitPullsList.data?.[0].number : null;
}
