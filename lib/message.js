"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.findAndReplaceInMessage = exports.removeMessageHeader = exports.addMessageHeader = exports.getMessageFromPath = exports.getMessage = void 0;
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
    if (preformatted) {
        message = `\`\`\`\n${message}\n\`\`\``;
    }
    return message !== null && message !== void 0 ? message : '';
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
function addMessageHeader(messageId, message) {
    return `${messageId}\n\n${message}`;
}
exports.addMessageHeader = addMessageHeader;
function removeMessageHeader(message) {
    return message.split('\n').slice(2).join('\n');
}
exports.removeMessageHeader = removeMessageHeader;
function splitFind(find) {
    const matches = find.match(/\/((i|g|m|s|u|y){1,6})$/);
    if (!matches) {
        return {
            regExp: find,
            modifiers: 'gi',
        };
    }
    const [, modifiers] = matches;
    const regExp = find.replace(modifiers, '').slice(0, -1);
    return {
        regExp,
        modifiers,
    };
}
function findAndReplaceInMessage(find, replace, original) {
    var _a;
    let message = original;
    for (const [i, f] of find.entries()) {
        const { regExp, modifiers } = splitFind(f);
        message = message.replace(new RegExp(regExp, modifiers), (_a = replace[i]) !== null && _a !== void 0 ? _a : replace.join('\n'));
    }
    return message;
}
exports.findAndReplaceInMessage = findAndReplaceInMessage;
