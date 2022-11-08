"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIssueNumberFromCommitPullsList = void 0;
async function getIssueNumberFromCommitPullsList(octokit, owner, repo, commitSha) {
    var _a;
    const commitPullsList = await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
        owner,
        repo,
        commit_sha: commitSha,
    });
    return commitPullsList.data.length ? (_a = commitPullsList.data) === null || _a === void 0 ? void 0 : _a[0].number : null;
}
exports.getIssueNumberFromCommitPullsList = getIssueNumberFromCommitPullsList;
