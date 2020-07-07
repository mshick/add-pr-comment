"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const http_client_1 = require("@actions/http-client");
const listCommitPulls = async (params) => {
    const { repoToken, owner, repo, commitSha } = params;
    const http = new http_client_1.HttpClient('http-client-add-pr-comment');
    const additionalHeaders = {
        accept: 'application/vnd.github.groot-preview+json',
        authorization: `token ${repoToken}`,
    };
    const body = await http.getJson(`https://api.github.com/repos/${owner}/${repo}/commits/${commitSha}/pulls`, additionalHeaders);
    return body.result;
};
const getIssueNumberFromCommitPullsList = (commitPullsList) => (commitPullsList.length ? commitPullsList[0].number : null);
const createCommentProxy = async (params) => {
    const { repoToken, owner, repo, issueNumber, body, proxyUrl } = params;
    const http = new http_client_1.HttpClient('http-client-add-pr-comment');
    const response = await http.postJson(`${proxyUrl}/repos/${owner}/${repo}/issues/${issueNumber}/comments`, { body }, {
        ['temporary-github-token']: repoToken,
    });
    return response.result;
};
const isMessagePresent = (message, comments, login) => {
    const cleanRe = new RegExp('\\R|\\s', 'g');
    const messageClean = message.replace(cleanRe, '');
    return comments.some(({ user, body }) => {
        // If a username is provided we can save on a bit of processing
        if (login && user.login !== login) {
            return false;
        }
        return body.replace(cleanRe, '') === messageClean;
    });
};
const getInputs = () => {
    return {
        allowRepeats: Boolean(core.getInput('allow-repeats') === 'true'),
        message: core.getInput('message'),
        proxyUrl: core.getInput('proxy-url').replace(/\/$/, ''),
        repoToken: core.getInput('repo-token') || process.env['GITHUB_TOKEN'],
        repoTokenUserLogin: core.getInput('repo-token-user-login'),
    };
};
const run = async () => {
    try {
        const { allowRepeats, message, repoToken, repoTokenUserLogin, proxyUrl } = getInputs();
        if (!repoToken) {
            throw new Error('no github token provided, set one with the repo-token input or GITHUB_TOKEN env variable');
        }
        const { payload: { pull_request: pullRequest, repository }, sha: commitSha, } = github.context;
        if (!repository) {
            core.info('unable to determine repository from request type');
            core.setOutput('comment-created', 'false');
            return;
        }
        const { full_name: repoFullName } = repository;
        const [owner, repo] = repoFullName.split('/');
        let issueNumber;
        if (pullRequest && pullRequest.number) {
            issueNumber = pullRequest.number;
        }
        else {
            // If this is not a pull request, attempt to find a PR matching the sha
            const commitPullsList = await listCommitPulls({ repoToken, owner, repo, commitSha });
            issueNumber = commitPullsList && getIssueNumberFromCommitPullsList(commitPullsList);
        }
        if (!issueNumber) {
            core.info('this action only works on pull_request events or other commits associated with a pull');
            core.setOutput('comment-created', 'false');
            return;
        }
        const octokit = github.getOctokit(repoToken);
        let shouldCreateComment = true;
        if (!allowRepeats) {
            core.debug('repeat comments are disallowed, checking for existing');
            const { data: comments } = await octokit.issues.listComments({
                owner,
                repo,
                issue_number: issueNumber,
            });
            if (isMessagePresent(message, comments, repoTokenUserLogin)) {
                core.info('the issue already contains an identical message');
                shouldCreateComment = false;
            }
        }
        if (shouldCreateComment) {
            if (proxyUrl) {
                await createCommentProxy({
                    owner,
                    repo,
                    issueNumber,
                    body: message,
                    repoToken,
                    proxyUrl,
                });
            }
            else {
                await octokit.issues.createComment({
                    owner,
                    repo,
                    issue_number: issueNumber,
                    body: message,
                });
            }
            core.setOutput('comment-created', 'true');
        }
        else {
            core.setOutput('comment-created', 'false');
        }
    }
    catch (error) {
        core.setFailed(error.message);
    }
};
// Don't auto-execute in the test environment
if (process.env['NODE_ENV'] !== 'test') {
    run();
}
exports.default = run;
