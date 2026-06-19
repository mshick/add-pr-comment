# Minimize (hide) comments — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the action create comments in a minimized (collapsed) state and minimize—instead of delete—an existing comment when `delete-on-status` matches.

**Architecture:** Hiding a comment is the `minimizeComment` GraphQL mutation (keyed by the comment's `node_id`, with a required classifier). A new `minimize()` capability is added to the shared `CommentAdapter` and implemented once in `src/minimize.ts`, reused by both the PR/issue and commit paths. Three new inputs (`create-minimized`, `delete-method`, `minimize-reason`) drive it, with a new `comment-minimized` output. Minimize is disallowed on the proxy (fork-PR) path, which lacks the required write permissions.

**Tech Stack:** TypeScript (ES2022, NodeNext), `@actions/core`/`@actions/github` (Octokit), Vitest + MSW, Biome, Rollup.

Spec: [docs/superpowers/specs/2026-06-18-minimize-comments-design.md](../specs/2026-06-18-minimize-comments-design.md)

---

## File Structure

- `action.yml` — declare 3 new inputs + 1 new output.
- `src/types.ts` — `MinimizeReason` type; extend `Inputs`; add `node_id` to existing-comment Picks.
- `src/config.ts` — parse + validate the new inputs (incl. classifier normalization).
- `src/minimize.ts` (new) — single `minimizeComment(octokit, nodeId, classifier)` GraphQL helper.
- `src/comments.ts` / `src/commit-comments.ts` — surface `node_id` from the "get existing" lookups.
- `src/action.ts` — extend `CommentAdapter` with `minimize()`, map `node_id`→`nodeId` in the adapter lambdas, wire the control flow, add the proxy guard.
- `src/action.test.ts` — GraphQL MSW handler + behavior/validation tests.
- `README.md` — document the new inputs/output.

---

### Task 1: Inputs, types, and config validation

**Goal:** Parse and validate `create-minimized`, `delete-method`, and `minimize-reason`, expose them on `Inputs`, and declare them in `action.yml`. No behavior change yet beyond config-time validation errors.

**Files:**
- Modify: `src/types.ts`
- Modify: `src/config.ts`
- Modify: `action.yml`
- Test: `src/action.test.ts`

**Acceptance Criteria:**
- [ ] `Inputs` has `createMinimized: boolean`, `deleteMethod: 'delete' | 'minimize'`, `minimizeReason: MinimizeReason`.
- [ ] Invalid `delete-method` throws a clear error; invalid `minimize-reason` throws a clear error.
- [ ] `minimize-reason` accepts case-insensitive, hyphenated input (`off-topic` → `OFF_TOPIC`); default is `OUTDATED`.
- [ ] `action.yml` declares the three inputs (with defaults) and the `comment-minimized` output.

**Verify:** `npm test -- src/action.test.ts -t "minimize"` → new config-validation tests pass; `npm run check` clean.

**Steps:**

- [ ] **Step 1: Write the failing config-validation tests**

Add this `describe` block to the end of `src/action.test.ts`:

```ts
describe('minimize config validation', () => {
  it('fails with an invalid delete-method value', async () => {
    inputs['delete-method'] = 'archive'
    inputs.message = simpleMessage

    await run()
    expect(core.setFailed).toHaveBeenCalledWith(
      'Invalid delete-method: "archive". Must be "delete" or "minimize".',
    )
  })

  it('fails with an invalid minimize-reason value', async () => {
    inputs['minimize-reason'] = 'whatever'
    inputs.message = simpleMessage

    await run()
    expect(core.setFailed).toHaveBeenCalledWith(
      'Invalid minimize-reason: "whatever". Must be one of: outdated, resolved, off-topic, duplicate, spam, abuse.',
    )
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/action.test.ts -t "minimize config validation"`
Expected: FAIL — no validation exists yet, so `core.setFailed` is not called with these messages (a comment gets created instead).

- [ ] **Step 3: Add the `MinimizeReason` type and extend `Inputs` in `src/types.ts`**

Add near the top of `src/types.ts` (after the import):

```ts
export type MinimizeReason = 'ABUSE' | 'DUPLICATE' | 'OFF_TOPIC' | 'OUTDATED' | 'RESOLVED' | 'SPAM'
```

Add these three fields to the `Inputs` interface (place them next to `deleteOnStatus`):

```ts
  createMinimized: boolean
  deleteMethod: 'delete' | 'minimize'
  minimizeReason: MinimizeReason
```

- [ ] **Step 4: Parse and validate in `src/config.ts`**

Update the type import at the top:

```ts
import type { Inputs, MinimizeReason } from './types.js'
```

Add this module-level helper above `getInputs` (after the imports):

```ts
const MINIMIZE_REASONS = ['ABUSE', 'DUPLICATE', 'OFF_TOPIC', 'OUTDATED', 'RESOLVED', 'SPAM'] as const

function normalizeMinimizeReason(input: string): MinimizeReason {
  const normalized = input.trim().toUpperCase().replace(/-/g, '_')
  if (!(MINIMIZE_REASONS as readonly string[]).includes(normalized)) {
    throw new Error(
      `Invalid minimize-reason: "${input}". Must be one of: outdated, resolved, off-topic, duplicate, spam, abuse.`,
    )
  }
  return normalized as MinimizeReason
}
```

Inside `getInputs`, after the `deleteOnStatus` line, add:

```ts
  const createMinimized = core.getInput('create-minimized', { required: false }) === 'true'

  const deleteMethodInput = core.getInput('delete-method', { required: false }) || 'delete'
  if (deleteMethodInput !== 'delete' && deleteMethodInput !== 'minimize') {
    throw new Error(`Invalid delete-method: "${deleteMethodInput}". Must be "delete" or "minimize".`)
  }
  const deleteMethod = deleteMethodInput as 'delete' | 'minimize'

  const minimizeReasonInput = core.getInput('minimize-reason', { required: false }) || 'outdated'
  const minimizeReason = normalizeMinimizeReason(minimizeReasonInput)
```

Add the three fields to the returned object (next to `deleteOnStatus`):

```ts
    createMinimized,
    deleteMethod,
    minimizeReason,
```

- [ ] **Step 5: Declare inputs + output in `action.yml`**

Add after the `delete-on-status` input block:

```yaml
  create-minimized:
    description: "Minimize (collapse) the comment immediately after it is created. Applies only on creation, not updates. Not supported with proxy-url."
    default: "false"
    required: false
  delete-method:
    description: 'What to do when delete-on-status matches. "delete" (default) removes the comment, "minimize" collapses it. Not supported with proxy-url.'
    default: "delete"
    required: false
  minimize-reason:
    description: 'Reason shown when a comment is minimized. One of: outdated (default), resolved, off-topic, duplicate, spam, abuse.'
    default: "outdated"
    required: false
```

Add to the `outputs:` block (after `comment-updated`):

```yaml
  comment-minimized:
    description: "Whether a comment was minimized."
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- src/action.test.ts -t "minimize config validation"`
Expected: PASS (both tests).

- [ ] **Step 7: Lint**

Run: `npm run check`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/types.ts src/config.ts action.yml src/action.test.ts
git commit -m "feat: add create-minimized, delete-method, and minimize-reason inputs"
```

---

### Task 2: Minimize primitive + `node_id` plumbing

**Goal:** Add the `minimizeComment` GraphQL helper and surface each comment's `node_id` through the "get existing" lookups, so the control flow in Task 3 has a node ID to minimize. No user-visible behavior change yet.

**Files:**
- Create: `src/minimize.ts`
- Modify: `src/comments.ts`
- Modify: `src/commit-comments.ts`
- Modify: `src/types.ts`
- Test: `src/action.test.ts` (add GraphQL MSW handler so later tasks' tests can run; verify existing suite stays green)

**Acceptance Criteria:**
- [ ] `minimizeComment(octokit, nodeId, classifier)` posts the `minimizeComment` mutation via `octokit.graphql`, wrapped in `withRetry`.
- [ ] `getExistingComment` and `getExistingCommitComment` return `node_id` alongside `id`/`body`.
- [ ] A GraphQL MSW handler exists and records the request; the full existing test suite still passes.

**Verify:** `npm test` → all existing tests pass; `npm run check` clean.

**Steps:**

- [ ] **Step 1: Create `src/minimize.ts`**

```ts
import type { GitHub } from '@actions/github/lib/utils'
import { withRetry } from './retry.js'
import type { MinimizeReason } from './types.js'

const MINIMIZE_COMMENT_MUTATION = `
  mutation MinimizeComment($id: ID!, $classifier: ReportedContentClassifiers!) {
    minimizeComment(input: { subjectId: $id, classifier: $classifier }) {
      minimizedComment {
        isMinimized
      }
    }
  }
`

export async function minimizeComment(
  octokit: InstanceType<typeof GitHub>,
  nodeId: string,
  classifier: MinimizeReason,
): Promise<void> {
  await withRetry(() =>
    octokit.graphql(MINIMIZE_COMMENT_MUTATION, {
      id: nodeId,
      classifier,
    }),
  )
}
```

- [ ] **Step 2: Surface `node_id` from the existing-comment Picks in `src/types.ts`**

Change the two `Pick` aliases to include `node_id`:

```ts
export type ExistingIssueComment = Pick<ExistingIssueCommentResponseData, 'id' | 'body' | 'node_id'>
```

```ts
export type ExistingCommitComment = Pick<ExistingCommitCommentResponseData, 'id' | 'body' | 'node_id'>
```

- [ ] **Step 3: Return `node_id` from `getExistingComment` in `src/comments.ts`**

Replace the trailing `if (found) { ... }` block in `getExistingComment` with:

```ts
  if (found) {
    const { id, body, node_id } = found
    return { id, body, node_id }
  }

  return
```

- [ ] **Step 4: Return `node_id` from `getExistingCommitComment` in `src/commit-comments.ts`**

Widen the `found` declaration to include `node_id`:

```ts
  let found: { id: number; body?: string | undefined; node_id: string } | undefined
```

Replace the trailing `if (found) { ... }` block with:

```ts
  if (found) {
    const { id, body = '', node_id } = found
    return { id, body, node_id }
  }

  return
```

- [ ] **Step 5: Add a GraphQL MSW handler and a capture variable in `src/action.test.ts`**

Add a module-level capture variable next to the other `let` response vars (after `let messagePayload`):

```ts
let graphqlPayload: { query: string; variables: Record<string, unknown> } | undefined
```

Reset it in `beforeEach` (next to `messagePayload = undefined`):

```ts
  graphqlPayload = undefined
```

Add this handler to the `handlers` array (e.g. after the last `http.delete` handler):

```ts
  http.post('https://api.github.com/graphql', async ({ request }) => {
    graphqlPayload = (await request.json()) as {
      query: string
      variables: Record<string, unknown>
    }
    return HttpResponse.json({
      data: { minimizeComment: { minimizedComment: { isMinimized: true } } },
    })
  }),
```

Also broaden the `postIssueCommentsResponse` declaration so tests can attach a `node_id` (it is reassigned by several tests):

```ts
let postIssueCommentsResponse: { id: number; node_id?: string } = {
  id: 42,
  node_id: 'NODE_42',
}
```

- [ ] **Step 6: Run the full suite to confirm nothing regressed**

Run: `npm test`
Expected: PASS — `node_id` is now threaded but unused; the GraphQL handler is registered but only hit once minimize is wired in Task 3.

- [ ] **Step 7: Lint**

Run: `npm run check`
Expected: no errors. (If Biome flags the unused `graphqlPayload`, that is resolved in Task 3 when assertions reference it; if it errors now, add a temporary `expect(graphqlPayload).toBeUndefined()` is NOT needed — Biome does not flag module-level `let` reassigned in handlers.)

- [ ] **Step 8: Commit**

```bash
git add src/minimize.ts src/comments.ts src/commit-comments.ts src/types.ts src/action.test.ts
git commit -m "feat: add minimizeComment helper and thread node_id through lookups"
```

---

### Task 3: Wire minimize into the control flow

**Goal:** Use the new inputs — minimize on creation when `create-minimized` is set (including the `refresh-message-position` recreate), minimize instead of delete when `delete-method: minimize` and `delete-on-status` matches, emit `comment-minimized`, and reject minimize on the proxy path.

**Files:**
- Modify: `src/action.ts`
- Test: `src/action.test.ts`

**Acceptance Criteria:**
- [ ] `CommentAdapter` has `minimize(nodeId, reason)`; PR and commit adapters implement it and return `nodeId` from `getExisting`/`create`/`update`.
- [ ] `create-minimized: true` minimizes a newly created comment (and a `refresh-message-position` recreate) and sets `comment-minimized: true`; plain updates never minimize.
- [ ] `delete-method: minimize` + matching `delete-on-status` minimizes the existing comment instead of deleting it.
- [ ] The classifier from `minimize-reason` reaches the mutation (`OUTDATED` default, override mapped, e.g. `OFF_TOPIC`).
- [ ] `proxy-url` combined with `create-minimized` or `delete-method: minimize` fails with a clear error; commit target (which ignores the proxy) still minimizes.

**Verify:** `npm test -- src/action.test.ts -t "minimize comments"` → all new behavior tests pass; `npm test` full suite green; `npm run check` clean.

**Steps:**

- [ ] **Step 1: Write the failing behavior tests**

Add this `describe` block to `src/action.test.ts`:

```ts
describe('minimize comments', () => {
  it('minimizes a comment after creating it when create-minimized is true', async () => {
    inputs.message = simpleMessage
    inputs['create-minimized'] = 'true'
    inputs['allow-repeats'] = 'true'
    postIssueCommentsResponse = { id: 42, node_id: 'NODE_42' }

    await run()

    expect(core.setOutput).toHaveBeenCalledWith('comment-created', 'true')
    expect(core.setOutput).toHaveBeenCalledWith('comment-minimized', 'true')
    expect(graphqlPayload?.variables).toMatchObject({ id: 'NODE_42', classifier: 'OUTDATED' })
  })

  it('does not minimize when updating an existing comment', async () => {
    inputs.message = simpleMessage
    inputs['create-minimized'] = 'true'
    const commentId = 123
    getIssueCommentsResponse = [
      {
        id: commentId,
        node_id: 'NODE_123',
        body: `<!-- add-pr-comment:${inputs['message-id']} -->\n\nold`,
      },
    ]
    postIssueCommentsResponse = { id: commentId, node_id: 'NODE_123' }

    await run()

    expect(core.setOutput).toHaveBeenCalledWith('comment-updated', 'true')
    expect(core.setOutput).not.toHaveBeenCalledWith('comment-minimized', 'true')
    expect(graphqlPayload).toBeUndefined()
  })

  it('minimizes instead of deleting when delete-method is minimize and status matches', async () => {
    inputs['delete-on-status'] = 'success'
    inputs.status = 'success'
    inputs['delete-method'] = 'minimize'
    inputs.message = 'hello'
    const commentId = 123
    getIssueCommentsResponse = [
      {
        id: commentId,
        node_id: 'NODE_123',
        body: `<!-- add-pr-comment:${inputs['message-id']} -->\n\nhi`,
      },
    ]

    await run()

    expect(core.setOutput).toHaveBeenCalledWith('comment-minimized', 'true')
    expect(core.setOutput).not.toHaveBeenCalledWith('comment-deleted', 'true')
    expect(graphqlPayload?.variables).toMatchObject({ id: 'NODE_123', classifier: 'OUTDATED' })
  })

  it('passes a custom minimize-reason classifier', async () => {
    inputs.message = simpleMessage
    inputs['create-minimized'] = 'true'
    inputs['minimize-reason'] = 'off-topic'
    inputs['allow-repeats'] = 'true'
    postIssueCommentsResponse = { id: 42, node_id: 'NODE_42' }

    await run()

    expect(graphqlPayload?.variables).toMatchObject({ classifier: 'OFF_TOPIC' })
  })

  it('fails when create-minimized is combined with proxy-url', async () => {
    inputs.message = simpleMessage
    inputs['create-minimized'] = 'true'
    inputs['proxy-url'] = 'https://proxy.example.com'
    getIssueCommentsResponse = []

    await run()

    expect(core.setFailed).toHaveBeenCalledWith(
      'create-minimized and delete-method: minimize are not supported with proxy-url, which is used for fork PRs that lack the write permissions minimize requires.',
    )
  })

  it('minimizes a commit comment when create-minimized is true', async () => {
    inputs['comment-target'] = 'commit'
    inputs.message = simpleMessage
    inputs['create-minimized'] = 'true'
    inputs['allow-repeats'] = 'true'
    github.context.payload = {
      ...github.context.payload,
      pull_request: undefined,
    } as WebhookPayload
    postIssueCommentsResponse = { id: 42, node_id: 'COMMIT_NODE_42' }

    await run()

    expect(core.setOutput).toHaveBeenCalledWith('comment-minimized', 'true')
    expect(graphqlPayload?.variables).toMatchObject({ id: 'COMMIT_NODE_42' })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/action.test.ts -t "minimize comments"`
Expected: FAIL — `comment-minimized` is never set, minimize is never called, and the proxy guard does not exist yet.

- [ ] **Step 3: Import the minimize helper and `MinimizeReason` in `src/action.ts`**

Add to the imports:

```ts
import { minimizeComment } from './minimize.js'
import type { MinimizeReason } from './types.js'
```

(If a `type` import already exists for `./types.js`, merge `MinimizeReason` into it.)

- [ ] **Step 4: Extend `CommentAdapter` and `ManageCommentOptions`**

Replace the `CommentAdapter` interface with:

```ts
interface CommentAdapter {
  getExisting(): Promise<{ id: number; nodeId: string; body?: string } | undefined>
  create(body: string): Promise<{ id: number; nodeId: string }>
  update(id: number, body: string): Promise<{ id: number; nodeId: string }>
  delete(id: number): Promise<void>
  minimize(nodeId: string, reason: MinimizeReason): Promise<void>
}
```

Add three fields to `ManageCommentOptions`:

```ts
  createMinimized: boolean
  deleteMethod: 'delete' | 'minimize'
  minimizeReason: MinimizeReason
```

- [ ] **Step 5: Use the options inside `manageComment`**

Add to the destructured `const { ... } = options` list:

```ts
    createMinimized,
    deleteMethod,
    minimizeReason,
```

Replace the `delete-on-status` block with:

```ts
  if (deleteOnStatus && deleteOnStatus === status) {
    if (existingComment) {
      if (deleteMethod === 'minimize') {
        core.info('minimizing existing comment because delete-on-status matched')
        await adapter.minimize(existingComment.nodeId, minimizeReason)
        core.setOutput('comment-minimized', 'true')
      } else {
        core.info('deleting existing comment because delete-on-status matched')
        await adapter.delete(existingComment.id)
        core.setOutput('comment-deleted', 'true')
      }
    } else {
      core.info('skipping creating comment because delete-on-status matched')
      core.setOutput('comment-created', 'false')
    }
    return
  }
```

Replace the create/update tail (from `let comment` to the end of the function) with:

```ts
  let comment: { id: number; nodeId: string } | null | undefined
  let created = false

  if (existingComment?.id) {
    if (refreshMessagePosition) {
      await adapter.delete(existingComment.id)
      comment = await adapter.create(body)
      created = true
    } else {
      comment = await adapter.update(existingComment.id, body)
    }
    core.setOutput('comment-updated', 'true')
  } else {
    comment = await adapter.create(body)
    created = true
    core.setOutput('comment-created', 'true')
  }

  if (comment) {
    core.setOutput('comment-id', comment.id)
    if (created && createMinimized) {
      await adapter.minimize(comment.nodeId, minimizeReason)
      core.setOutput('comment-minimized', 'true')
    }
  } else {
    core.setOutput('comment-created', 'false')
    core.setOutput('comment-updated', 'false')
  }
```

- [ ] **Step 6: Destructure the new inputs in `run` and add them to `commentOptions`**

Add `createMinimized`, `deleteMethod`, `minimizeReason` to the `const { ... } = await getInputs()` destructure, and to the `commentOptions` object literal:

```ts
      createMinimized,
      deleteMethod,
      minimizeReason,
```

- [ ] **Step 7: Add the proxy guard**

At the very top of the `if (proxyUrl) {` block (PR path), before the existing-comment lookup, add:

```ts
      if (createMinimized || deleteMethod === 'minimize') {
        throw new Error(
          'create-minimized and delete-method: minimize are not supported with proxy-url, which is used for fork PRs that lack the write permissions minimize requires.',
        )
      }
```

- [ ] **Step 8: Implement `minimize` and map `nodeId` in both adapters**

In the commit-target `manageComment(...)` adapter object, replace it with:

```ts
      await manageComment(
        {
          getExisting: async () => {
            const existing = await getExistingCommitComment(octokit, owner, repo, commitSha, messageId)
            return existing
              ? { id: existing.id, nodeId: existing.node_id, body: existing.body }
              : undefined
          },
          create: async (body) => {
            const c = await createCommitComment(octokit, owner, repo, commitSha, body)
            return { id: c.id, nodeId: c.node_id }
          },
          update: async (id, body) => {
            const c = await updateCommitComment(octokit, owner, repo, id, body)
            return { id: c.id, nodeId: c.node_id }
          },
          delete: (id) => deleteCommitComment(octokit, owner, repo, id),
          minimize: (nodeId, reason) => minimizeComment(octokit, nodeId, reason),
        },
        commentOptions,
      )
```

In the PR-path `manageComment(...)` adapter object (the final call), replace it with:

```ts
    await manageComment(
      {
        getExisting: async () => {
          const existing = await getExistingComment(octokit, owner, repo, issueNumber, messageId)
          return existing
            ? { id: existing.id, nodeId: existing.node_id, body: existing.body ?? undefined }
            : undefined
        },
        create: async (body) => {
          const c = await createComment(octokit, owner, repo, issueNumber, body)
          return { id: c.id, nodeId: c.node_id }
        },
        update: async (id, body) => {
          const c = await updateComment(octokit, owner, repo, id, body)
          return { id: c.id, nodeId: c.node_id }
        },
        delete: async (id) => {
          await deleteComment(octokit, owner, repo, id)
        },
        minimize: (nodeId, reason) => minimizeComment(octokit, nodeId, reason),
      },
      commentOptions,
    )
```

- [ ] **Step 9: Run the new behavior tests**

Run: `npm test -- src/action.test.ts -t "minimize comments"`
Expected: PASS (all six tests).

- [ ] **Step 10: Run the full suite + lint + build**

Run: `npm test` → all pass.
Run: `npm run check` → no errors.
Run: `npm run build` → `dist/index.js` rebuilt without error.

- [ ] **Step 11: Commit**

```bash
git add src/action.ts src/action.test.ts dist/index.js
git commit -m "feat: minimize comments via create-minimized and delete-method"
```

---

### Task 4: Documentation

**Goal:** Document the three new inputs, the new output, and the proxy limitation in `README.md`.

**Files:**
- Modify: `README.md`

**Acceptance Criteria:**
- [ ] Inputs table lists `create-minimized`, `delete-method`, `minimize-reason` with defaults.
- [ ] Outputs table lists `comment-minimized`.
- [ ] A short note explains minimize is unavailable on the proxy path and works for both PR and commit comments.

**Verify:** Visual review of `README.md`; `npm run check` (Biome does not format Markdown by default — confirm no unintended changes).

**Steps:**

- [ ] **Step 1: Add input rows**

In the inputs table (after the `delete-on-status` row near line 93), add:

```markdown
| create-minimized         | with     | Minimize (collapse) the comment immediately after it is created. Applies only on creation, not updates. Not supported with `proxy-url`.                                      | no       | false                              |
| delete-method            | with     | What to do when `delete-on-status` matches: `delete` removes the comment, `minimize` collapses it. Not supported with `proxy-url`.                                          | no       | delete                             |
| minimize-reason          | with     | Reason shown when a comment is minimized: `outdated`, `resolved`, `off-topic`, `duplicate`, `spam`, or `abuse`.                                                             | no       | outdated                           |
```

- [ ] **Step 2: Add the output row**

In the outputs table (after the `comment-updated` row near line 116), add:

```markdown
| `comment-minimized` | `"true"` if a comment was minimized, omitted otherwise.          |
```

- [ ] **Step 3: Add a short usage note**

After the "Delete on status" section (around line 572), add:

```markdown
### Minimizing comments

Instead of deleting a stale comment, you can collapse it. Set `delete-method: minimize`
together with `delete-on-status` to minimize the comment when the status matches, or set
`create-minimized: true` to post a comment that starts collapsed. Use `minimize-reason`
to control the label GitHub shows (`outdated` by default).

```yaml
- uses: mshick/add-pr-comment@v3
  with:
    message: "Heads up — this is supplementary."
    create-minimized: true
    minimize-reason: outdated
```

Minimizing uses GitHub's GraphQL API and requires write permissions, so it is **not**
available through `proxy-url` (the fork-PR path). It works for both PR/issue comments and
commit comments.
```

- [ ] **Step 4: Lint**

Run: `npm run check`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: document minimize inputs and comment-minimized output"
```

---

## Self-Review

- **Spec coverage:** create-minimized (Task 3) ✓; delete-method minimize (Task 3) ✓; minimize-reason input + classifier mapping (Task 1 parse, Task 3 wiring) ✓; proxy fail-fast (Task 3 — placed in the PR proxy branch so commit target, which ignores the proxy, can still minimize — a refinement over the spec's "config.ts" note) ✓; node_id plumbing + GraphQL helper (Task 2) ✓; comment-minimized output (Task 1 declares, Task 3 emits) ✓; commit-comment support (Task 3) ✓; refresh-message-position recreate stays minimized (Task 3, `created` flag) ✓; tests + docs ✓.
- **Placeholder scan:** none — every code/step block is concrete.
- **Type consistency:** `MinimizeReason` defined in `types.ts`, imported in `config.ts`, `minimize.ts`, `action.ts`; adapter returns `{ id, nodeId }` consistently; `minimizeComment(octokit, nodeId, classifier)` signature matches all call sites; `node_id` (snake) from REST/Octokit mapped to `nodeId` (camel) only at the adapter boundary.
- **Note on the spec's proxy location:** the spec said config.ts; the plan places the guard in the PR proxy branch instead, because `comment-target: commit` ignores `proxy-url` and minimize works fine there. This is intentional and called out for the reviewer.
