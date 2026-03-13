# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A GitHub Action that adds comments to pull requests. Supports sticky comments (auto-update), status-based message overrides, file-based messages, find-and-replace on existing comments, and proxy support for fork-based PRs.

## Commands

```bash
npm run build     # del-cli dist && tsc && ncc build --source-map
npm test          # vitest run
npm run watch     # vitest (watch mode)
npm run lint      # eslint src/
npm run clean     # rm -rf node_modules dist package-lock.json __tests__/runner/**/*
```

The build compiles TypeScript to `lib/` then bundles with `@vercel/ncc` into `dist/index.js` for GitHub Actions runtime (Node24).

## Architecture

Entry point is `src/main.ts` which orchestrates:
1. Parse inputs (`config.ts`) from GitHub Actions context
2. Resolve message content (`message.ts`) — from input string, file glob, or status override
3. Look up issue/PR number (`issues.ts`) — from event context or commit
4. Manage comments (`comments.ts`) — create, update, or delete via GitHub API
5. Optionally use proxy (`proxy.ts`) for fork-based PRs that lack write permissions

Type definitions are in `types.ts`. File globbing is in `files.ts`.

Tests are in `__tests__/add-pr-comment.test.ts` using Vitest with MSW (Mock Service Worker) for HTTP mocking against the GitHub API. Test fixtures (message files, sample JSON responses) live alongside the test file.

## Code Style

- Strict TypeScript (ES2022 target, bundler module resolution)
- ESLint with TypeScript recommended + Prettier integration
- Prettier: single quotes, no semicolons, trailing commas, 100 char width
- `console` usage is banned in source (use `@actions/core` logging instead)
- `noUnusedLocals` and `noUnusedParameters` enforced

## Release Process

Uses release-please on the `master` branch with conventional commits. The `npm run prepare` script auto-builds and stages `lib/` and `dist/` for commits.
