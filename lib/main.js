"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
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
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const http_client_1 = require("@actions/http-client");
const promises_1 = __importDefault(require("node:fs/promises"));
const getIssueNumberFromCommitPullsList = (commitPullsList) => (commitPullsList.length ? commitPullsList[0].number : null);
async function createCommentProxy(params) {
    const { repoToken, owner, repo, issueNumber, body, commentId, proxyUrl } = params;
    const http = new http_client_1.HttpClient('http-client-add-pr-comment');
    const response = await http.postJson(`${proxyUrl}/repos/${owner}/${repo}/issues/${issueNumber}/comments`, { comment_id: commentId, body }, {
        ['temporary-github-token']: repoToken,
    });
    return response.result;
}
function getExistingCommentId(comments, messageId) {
    const found = comments.find(({ body }) => {
        var _a;
        return ((_a = body === null || body === void 0 ? void 0 : body.search(messageId)) !== null && _a !== void 0 ? _a : -1) > -1;
    });
    return found === null || found === void 0 ? void 0 : found.id;
}
async function getInputs() {
    var _a;
    const messageId = core.getInput('message-id', { required: false });
    const messageInput = core.getInput('message', { required: false });
    const messagePath = core.getInput('message-path', { required: false });
    const repoToken = core.getInput('repo-token', { required: true });
    const status = core.getInput('status', { required: true });
    const issue = core.getInput('issue', { required: false });
    if (messageInput && messagePath) {
        throw new Error('must specify only one, message or message-path');
    }
    let message;
    if (messagePath) {
        message = await promises_1.default.readFile(messagePath, { encoding: 'utf8' });
    }
    else {
        message = messageInput;
    }
    const messageSuccess = core.getInput(`message-success`);
    const messageFailure = core.getInput(`message-failure`);
    const messageCancelled = core.getInput(`message-cancelled`);
    if (status === 'success' && messageSuccess) {
        message = messageSuccess;
    }
    if (status === 'failure' && messageFailure) {
        message = messageFailure;
    }
    if (status === 'cancelled' && messageCancelled) {
        message = messageCancelled;
    }
    if (!message) {
        throw new Error('no message, check your message inputs');
    }
    const { payload, sha } = github.context;
    return {
        allowRepeats: Boolean(core.getInput('allow-repeats') === 'true'),
        message,
        messageId: messageId === '' ? 'add-pr-comment' : messageId,
        proxyUrl: core.getInput('proxy-url').replace(/\/$/, ''),
        repoToken,
        status,
        issue: issue ? Number(issue) : (_a = payload.issue) === null || _a === void 0 ? void 0 : _a.number,
        pullRequest: payload.pull_request,
        repository: payload.repository,
        commitSha: sha,
    };
}
const run = async () => {
    try {
        const { allowRepeats, message, messageId, repoToken, proxyUrl, issue, repository, pullRequest, commitSha, } = await getInputs();
        const messageIdComment = `<!-- ${messageId} -->`;
        const repoFullName = repository === null || repository === void 0 ? void 0 : repository.full_name;
        if (!repoFullName) {
            core.info('unable to determine repository from request type');
            core.setOutput('comment-created', 'false');
            return;
        }
        const [owner, repo] = repoFullName.split('/');
        const octokit = github.getOctokit(repoToken);
        let issueNumber;
        if (issue) {
            issueNumber = issue;
        }
        else if (pullRequest && pullRequest.number) {
            issueNumber = pullRequest.number;
        }
        else {
            // If this is not a pull request, attempt to find a PR matching the sha
            const commitPullsList = await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
                owner,
                repo,
                commit_sha: commitSha,
            });
            issueNumber = commitPullsList.data && getIssueNumberFromCommitPullsList(commitPullsList.data);
        }
        if (!issueNumber) {
            core.info('no issue number found, use a pull_request event, a pull event, or provide an issue input');
            core.setOutput('comment-created', 'false');
            return;
        }
        let existingCommentId;
        if (!allowRepeats) {
            core.debug('repeat comments are disallowed, checking for existing');
            const { data: comments } = await octokit.rest.issues.listComments({
                owner,
                repo,
                issue_number: issueNumber,
            });
            existingCommentId = getExistingCommentId(comments, messageIdComment);
            if (existingCommentId) {
                core.debug(`existing comment found with id: ${existingCommentId}`);
            }
        }
        let comment;
        const body = `${messageIdComment}\n\n${message}`;
        if (proxyUrl) {
            comment = await createCommentProxy({
                commentId: existingCommentId,
                owner,
                repo,
                issueNumber,
                body,
                repoToken,
                proxyUrl,
            });
            core.setOutput(existingCommentId ? 'comment-updated' : 'comment-created', 'true');
        }
        else if (existingCommentId) {
            const updatedComment = await octokit.rest.issues.updateComment({
                comment_id: existingCommentId,
                owner,
                repo,
                body,
            });
            comment = updatedComment.data;
            core.setOutput('comment-updated', 'true');
        }
        else {
            const createdComment = await octokit.rest.issues.createComment({
                issue_number: issueNumber,
                owner,
                repo,
                body,
            });
            comment = createdComment.data;
            core.setOutput('comment-created', 'true');
        }
        if (comment) {
            core.setOutput('comment-id', comment.id);
        }
        else {
            core.setOutput('comment-created', 'false');
            core.setOutput('comment-updated', 'false');
        }
    }
    catch (err) {
        if (err instanceof Error) {
            core.setFailed(err.message);
        }
        else {
            core.setFailed('unknown failure');
        }
    }
};
// Don't auto-execute in the test environment
if (process.env['NODE_ENV'] !== 'test') {
    run();
}
exports.default = run;
