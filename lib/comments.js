"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createComment = exports.updateComment = exports.getExistingCommentId = void 0;
async function getExistingCommentId(octokit, owner, repo, issueNumber, messageId) {
    const comments = await octokit.rest.issues.listComments({
        owner,
        repo,
        issue_number: issueNumber,
    });
    // eslint-disable-next-line no-console
    console.log(comments.headers);
    const found = comments.data.find(({ body }) => {
        var _a;
        return ((_a = body === null || body === void 0 ? void 0 : body.search(messageId)) !== null && _a !== void 0 ? _a : -1) > -1;
    });
    return found === null || found === void 0 ? void 0 : found.id;
}
exports.getExistingCommentId = getExistingCommentId;
async function updateComment(octokit, owner, repo, existingCommentId, body) {
    const updatedComment = await octokit.rest.issues.updateComment({
        comment_id: existingCommentId,
        owner,
        repo,
        body,
    });
    return updatedComment.data;
}
exports.updateComment = updateComment;
async function createComment(octokit, owner, repo, issueNumber, body) {
    const createdComment = await octokit.rest.issues.createComment({
        issue_number: issueNumber,
        owner,
        repo,
        body,
    });
    return createdComment.data;
}
exports.createComment = createComment;
