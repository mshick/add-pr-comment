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
exports.getInputs = void 0;
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const promises_1 = __importDefault(require("node:fs/promises"));
async function getInputs() {
    var _a, _b, _c;
    const messageIdInput = core.getInput('message-id', { required: false });
    const messageId = messageIdInput === '' ? 'add-pr-comment' : `add-pr-comment:${messageIdInput}`;
    const messageInput = core.getInput('message', { required: false });
    const messagePath = core.getInput('message-path', { required: false });
    const repoToken = core.getInput('repo-token', { required: true });
    const status = core.getInput('status', { required: true });
    const issue = core.getInput('issue', { required: false });
    const proxyUrl = core.getInput('proxy-url', { required: false }).replace(/\/$/, '');
    const allowRepeats = core.getInput('allow-repeats', { required: true }) === 'true';
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
    const { payload } = github.context;
    const repoFullName = (_a = payload.repository) === null || _a === void 0 ? void 0 : _a.full_name;
    if (!repoFullName) {
        throw new Error('unable to determine repository from request type');
    }
    const [owner, repo] = repoFullName.split('/');
    return {
        allowRepeats,
        message,
        messageId: `<!-- ${messageId} -->`,
        proxyUrl,
        repoToken,
        status,
        issue: issue ? Number(issue) : (_b = payload.issue) === null || _b === void 0 ? void 0 : _b.number,
        pullRequestNumber: (_c = payload.pull_request) === null || _c === void 0 ? void 0 : _c.number,
        commitSha: github.context.sha,
        owner,
        repo,
    };
}
exports.getInputs = getInputs;
