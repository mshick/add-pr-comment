# Minimize (hide) comments — design

Source: [#197 — Support for hidden comments](https://github.com/mshick/add-pr-comment/issues/197)

## Problem

GitHub lets maintainers hide (minimize) a comment so it collapses as less relevant.
The action has no way to do this. Two use cases:

1. Post a comment that should start collapsed because it is supplementary to other,
   more prominent comments in the PR.
2. Collapse an existing sticky comment when a status change makes it stale (the
   "normal → minimized on status change" variant of `delete-on-status`).

Hiding is not in the GitHub REST API. It is the `minimizeComment` GraphQL mutation,
which takes the comment's **node ID** and a required `classifier`. There is a matching
`unminimizeComment`, which this feature does not need.

## Goals

- Create a comment in a minimized state.
- Minimize (instead of delete) an existing comment when `delete-on-status` matches.
- Let the user choose the minimize reason shown in GitHub's UI.

## Non-goals

- Un-minimizing / toggling view state on later runs (YAGNI — `create-minimized`
  applies only at creation; nothing re-asserts or reverses view state afterward).
- Supporting minimize through the proxy path (fork PRs). Disallowed with a clear error.
- Changing the separate proxy service.

## New inputs

| Input | Values | Default | Effect |
|---|---|---|---|
| `create-minimized` | `true` \| `false` | `false` | Minimize a comment immediately after it is **created** (not on plain updates) |
| `delete-method` | `delete` \| `minimize` | `delete` | When `delete-on-status` matches, delete (current behavior) or minimize the existing comment |
| `minimize-reason` | `outdated` \| `resolved` \| `off-topic` \| `duplicate` \| `spam` \| `abuse` | `outdated` | Classifier applied to any minimize action |

`minimize-reason` is parsed case-insensitively and normalized to the GraphQL
`ReportedContentClassifiers` enum (`off-topic` → `OFF_TOPIC`). Invalid values throw
at config-parse time, matching the existing `truncate` / `comment-target` validation
style in `config.ts`.

## New output

- `comment-minimized` — `"true"` when a comment was minimized this run.

## Config validation (`config.ts`, `types.ts`)

- Parse the three inputs into `Inputs`: `createMinimized: boolean`,
  `deleteMethod: 'delete' | 'minimize'`, `minimizeReason: ReportedContentClassifier`.
- Validate `delete-method ∈ {delete, minimize}` and `minimize-reason` against the
  allowed set; throw `Error` with a descriptive message on mismatch.
- **Proxy fail-fast:** if `proxy-url` is set together with `create-minimized: true`
  **or** `delete-method: minimize`, throw a clear config error — minimize needs write
  permissions the proxy path does not grant.

## Minimize mechanism

`minimizeComment` is keyed by the comment's GraphQL **node ID**. REST responses already
include `node_id`, so:

- `getExisting()` and `create()` adapter methods return `nodeId` alongside `id`
  (and `getExistingComment` / `getExistingCommitComment` are updated to surface
  `node_id`).
- A new `minimize(nodeId, reason)` method is added to `CommentAdapter`, implemented
  once via `octokit.graphql(...)` (wrapped in the existing `withRetry`) and reused by
  both the PR/issue and commit adapters. Commit comments are `Minimizable` too, so both
  paths get minimize for free.

Mutation shape:

```graphql
mutation ($id: ID!, $classifier: ReportedContentClassifiers!) {
  minimizeComment(input: { subjectId: $id, classifier: $classifier }) {
    minimizedComment { isMinimized }
  }
}
```

## Control flow (`action.ts` `manageComment`)

- **delete-on-status branch:** when the status matches and an existing comment is found:
  - `delete-method: minimize` → call `minimize()`, emit `comment-minimized: true`.
  - otherwise → delete as today, emit `comment-deleted: true`.
  - No existing comment → unchanged (skip creating).
- **create / refresh branch:** track whether a new comment node was physically created.
  A new comment is created both in the plain create case and in the
  `refresh-message-position` case (which deletes then recreates). When a new comment is
  created **and** `create-minimized: true`, call `minimize()` on it and emit
  `comment-minimized: true`. This means a `refresh-message-position` recreate stays
  minimized rather than visibly re-appearing. Plain updates (no recreate) never minimize.

## Tests (`action.test.ts`)

Add an MSW handler for the GraphQL endpoint (`POST https://api.github.com/graphql`) and cover:

- `create-minimized: true` → comment created, then mutation fired with the new node ID.
- `delete-method: minimize` + matching `delete-on-status` → existing comment minimized,
  not deleted; `comment-minimized` output set.
- `minimize-reason` default (`OUTDATED`) and an override (e.g. `resolved` → `RESOLVED`,
  `off-topic` → `OFF_TOPIC`) passed through to the mutation.
- `proxy-url` + minimize option → config error thrown.
- `comment-target: commit` + `create-minimized` → commit comment minimized via the same
  mutation.

## Docs

Update `README.md` inputs/outputs table with the three new inputs and the
`comment-minimized` output, including the proxy limitation note.
