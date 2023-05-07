"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createComment = exports.deleteComment = exports.updateComment = exports.getExistingComment = void 0;
async function getExistingComment(octokit, owner, repo, issueNumber, messageId) {
    const parameters = {
        owner,
        repo,
        issue_number: issueNumber,
        per_page: 100,
    };
    let found;
    for await (const comments of octokit.paginate.iterator(octokit.rest.issues.listComments, parameters)) {
        found = comments.data.find(({ body }) => {
            var _a;
            return ((_a = body === null || body === void 0 ? void 0 : body.search(messageId)) !== null && _a !== void 0 ? _a : -1) > -1;
        });
        if (found) {
            break;
        }
    }
    if (found) {
        const { id, body } = found;
        return { id, body };
    }
    return;
}
exports.getExistingComment = getExistingComment;
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
async function deleteComment(octokit, owner, repo, existingCommentId, body) {
    const deletedComment = await octokit.rest.issues.deleteComment({
        comment_id: existingCommentId,
        owner,
        repo,
        body,
    });
    return deletedComment.data;
}
exports.deleteComment = deleteComment;
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
