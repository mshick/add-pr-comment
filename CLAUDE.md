# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A GitHub Action that adds comments to pull requests. Supports sticky comments (auto-update), status-based message overrides, file-based messages, find-and-replace on existing comments, and proxy support for fork-based PRs.

## Commands

```bash
npm run build          # bundle with Rollup into dist/index.js
npm test               # vitest run
npm run watch          # vitest (watch mode)
npm run lint           # eslint src/
npm run format:check   # prettier --check .
npm run format:write   # prettier --write .
npm run clean          # rm -rf node_modules dist coverage package-lock.json
```

The build bundles TypeScript directly into `dist/index.js` using Rollup for GitHub Actions runtime (Node24).

## Architecture

Entry point is `src/main.ts` which orchestrates:
1. Parse inputs (`config.ts`) from GitHub Actions context
2. Resolve message content (`message.ts`) — from input string, file glob, or status override
3. Look up issue/PR number (`issues.ts`) — from event context or commit
4. Manage comments (`comments.ts`) — create, update, or delete via GitHub API
5. Optionally use proxy (`proxy.ts`) for fork-based PRs that lack write permissions

Type definitions are in `types.ts`. File globbing is in `files.ts`.

Tests are in `src/action.test.ts` using Vitest with MSW (Mock Service Worker) for HTTP mocking against the GitHub API. Test fixtures (message files, sample JSON responses) live in `src/__fixtures__/`.

## Code Style

- Strict TypeScript (ES2022 target, NodeNext module resolution)
- ESLint with TypeScript recommended + Prettier integration
- Prettier: single quotes, no semicolons, trailing commas, 100 char width
- `console` usage is banned in source (use `@actions/core` logging instead)
- `noUnusedLocals` and `noUnusedParameters` enforced

## Release Process

Uses release-please on the `main` branch with conventional commits. PR titles and the first commit on a branch must use conventional commit syntax (e.g., `feat: add new feature`, `fix: resolve bug`). Subsequent commits should use plain descriptive messages without the conventional commit prefix.
