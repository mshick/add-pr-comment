"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMessageFromPath = exports.getMessage = void 0;
const promises_1 = __importDefault(require("node:fs/promises"));
const files_1 = require("./files");
async function getMessage({ messageInput, messagePath, messageCancelled, messageSkipped, messageFailure, messageSuccess, preformatted, status, }) {
    let message;
    if (status === 'success' && messageSuccess) {
        message = messageSuccess;
    }
    if (status === 'failure' && messageFailure) {
        message = messageFailure;
    }
    if (status === 'cancelled' && messageCancelled) {
        message = messageCancelled;
    }
    if (status === 'skipped' && messageSkipped) {
        message = messageSkipped;
    }
    if (!message) {
        if (messagePath) {
            message = await getMessageFromPath(messagePath);
        }
        else {
            message = messageInput;
        }
    }
    if (!message) {
        throw new Error('no message, check your message inputs');
    }
    if (preformatted) {
        message = `\`\`\`\n${message}\n\`\`\``;
    }
    return message;
}
exports.getMessage = getMessage;
async function getMessageFromPath(searchPath) {
    let message = '';
    const files = await (0, files_1.findFiles)(searchPath);
    for (const [index, path] of files.entries()) {
        if (index > 0) {
            message += '\n';
        }
        message += await promises_1.default.readFile(path, { encoding: 'utf8' });
    }
    return message;
}
exports.getMessageFromPath = getMessageFromPath;
