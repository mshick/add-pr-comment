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
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const comments_1 = require("./comments");
const config_1 = require("./config");
const issues_1 = require("./issues");
const message_1 = require("./message");
const proxy_1 = require("./proxy");
const run = async () => {
    try {
        const { allowRepeats, messagePath, messageInput, messageId, refreshMessagePosition, repoToken, proxyUrl, issue, pullRequestNumber, commitSha, repo, owner, updateOnly, messageCancelled, messageFailure, messageSuccess, messageSkipped, preformatted, status, messageFind, messageReplace, } = await (0, config_1.getInputs)();
        const octokit = github.getOctokit(repoToken);
        let message = await (0, message_1.getMessage)({
            messagePath,
            messageInput,
            messageSkipped,
            messageCancelled,
            messageSuccess,
            messageFailure,
            preformatted,
            status,
        });
        let issueNumber;
        if (issue) {
            issueNumber = issue;
        }
        else if (pullRequestNumber) {
            issueNumber = pullRequestNumber;
        }
        else {
            // If this is not a pull request, attempt to find a PR matching the sha
            issueNumber = await (0, issues_1.getIssueNumberFromCommitPullsList)(octokit, owner, repo, commitSha);
        }
        if (!issueNumber) {
            core.info('no issue number found, use a pull_request event, a pull event, or provide an issue input');
            core.setOutput('comment-created', 'false');
            return;
        }
        let existingComment;
        if (!allowRepeats) {
            core.debug('repeat comments are disallowed, checking for existing');
            existingComment = await (0, comments_1.getExistingComment)(octokit, owner, repo, issueNumber, messageId);
            if (existingComment) {
                core.debug(`existing comment found with id: ${existingComment.id}`);
            }
        }
        // if no existing comment and updateOnly is true, exit
        if (!existingComment && updateOnly) {
            core.info('no existing comment found and update-only is true, exiting');
            core.setOutput('comment-created', 'false');
            return;
        }
        let comment;
        if ((messageFind === null || messageFind === void 0 ? void 0 : messageFind.length) && ((messageReplace === null || messageReplace === void 0 ? void 0 : messageReplace.length) || message) && (existingComment === null || existingComment === void 0 ? void 0 : existingComment.body)) {
            message = (0, message_1.findAndReplaceInMessage)(messageFind, (messageReplace === null || messageReplace === void 0 ? void 0 : messageReplace.length) ? messageReplace : [message], (0, message_1.removeMessageHeader)(existingComment.body));
        }
        if (!message) {
            throw new Error('no message, check your message inputs');
        }
        const body = (0, message_1.addMessageHeader)(messageId, message);
        if (proxyUrl) {
            comment = await (0, proxy_1.createCommentProxy)({
                commentId: existingComment === null || existingComment === void 0 ? void 0 : existingComment.id,
                owner,
                repo,
                issueNumber,
                body,
                repoToken,
                proxyUrl,
            });
            core.setOutput((existingComment === null || existingComment === void 0 ? void 0 : existingComment.id) ? 'comment-updated' : 'comment-created', 'true');
        }
        else if (existingComment === null || existingComment === void 0 ? void 0 : existingComment.id) {
            if (refreshMessagePosition) {
                await (0, comments_1.deleteComment)(octokit, owner, repo, existingComment.id, body);
                comment = await (0, comments_1.createComment)(octokit, owner, repo, issueNumber, body);
            }
            else {
                comment = await (0, comments_1.updateComment)(octokit, owner, repo, existingComment.id, body);
            }
            core.setOutput('comment-updated', 'true');
        }
        else {
            comment = await (0, comments_1.createComment)(octokit, owner, repo, issueNumber, body);
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
        if (process.env.NODE_ENV === 'test') {
            // eslint-disable-next-line no-console
            console.log(err);
        }
        if (err instanceof Error) {
            core.setFailed(err.message);
        }
    }
};
// Don't auto-execute in the test environment
if (process.env['NODE_ENV'] !== 'test') {
    run();
}
exports.default = run;
