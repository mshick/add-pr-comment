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
exports.getInputs = void 0;
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
async function getInputs() {
    var _a, _b;
    const messageIdInput = core.getInput('message-id', { required: false });
    const messageId = messageIdInput === '' ? 'add-pr-comment' : `add-pr-comment:${messageIdInput}`;
    const messageInput = core.getInput('message', { required: false });
    const messagePath = core.getInput('message-path', { required: false });
    const messageFind = core.getMultilineInput('find', { required: false });
    const messageReplace = core.getMultilineInput('replace', { required: false });
    const repoOwner = core.getInput('repo-owner', { required: true });
    const repoName = core.getInput('repo-name', { required: true });
    const repoToken = core.getInput('repo-token', { required: true });
    const status = core.getInput('status', { required: true });
    const issue = core.getInput('issue', { required: false });
    const proxyUrl = core.getInput('proxy-url', { required: false }).replace(/\/$/, '');
    const allowRepeats = core.getInput('allow-repeats', { required: true }) === 'true';
    const refreshMessagePosition = core.getInput('refresh-message-position', { required: false }) === 'true';
    const updateOnly = core.getInput('update-only', { required: false }) === 'true';
    const preformatted = core.getInput('preformatted', { required: false }) === 'true';
    if (messageInput && messagePath) {
        throw new Error('must specify only one, message or message-path');
    }
    const messageSuccess = core.getInput(`message-success`);
    const messageFailure = core.getInput(`message-failure`);
    const messageCancelled = core.getInput(`message-cancelled`);
    const messageSkipped = core.getInput(`message-skipped`);
    const { payload } = github.context;
    return {
        allowRepeats,
        commitSha: github.context.sha,
        issue: issue ? Number(issue) : (_a = payload.issue) === null || _a === void 0 ? void 0 : _a.number,
        messageInput,
        messageId: `<!-- ${messageId} -->`,
        messageSuccess,
        messageFailure,
        messageCancelled,
        messageSkipped,
        messagePath,
        messageFind,
        messageReplace,
        preformatted,
        proxyUrl,
        pullRequestNumber: (_b = payload.pull_request) === null || _b === void 0 ? void 0 : _b.number,
        refreshMessagePosition,
        repoToken,
        status,
        owner: repoOwner || payload.repo.owner,
        repo: repoName || payload.repo.repo,
        updateOnly: updateOnly,
    };
}
exports.getInputs = getInputs;
