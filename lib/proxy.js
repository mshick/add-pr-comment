"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCommentProxy = void 0;
const http_client_1 = require("@actions/http-client");
async function createCommentProxy(params) {
    const { repoToken, owner, repo, issueNumber, body, commentId, proxyUrl } = params;
    const http = new http_client_1.HttpClient('http-client-add-pr-comment');
    const response = await http.postJson(`${proxyUrl}/repos/${owner}/${repo}/issues/${issueNumber}/comments`, { comment_id: commentId, body }, {
        ['temporary-github-token']: repoToken,
    });
    return response.result;
}
exports.createCommentProxy = createCommentProxy;
