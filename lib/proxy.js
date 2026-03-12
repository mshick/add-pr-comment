import { HttpClient } from '@actions/http-client';
export async function createCommentProxy(params) {
    const { repoToken, owner, repo, issueNumber, body, commentId, proxyUrl } = params;
    const http = new HttpClient('http-client-add-pr-comment');
    const response = await http.postJson(`${proxyUrl}/repos/${owner}/${repo}/issues/${issueNumber}/comments`, { comment_id: commentId, body }, {
        ['temporary-github-token']: repoToken,
    });
    return response.result;
}
