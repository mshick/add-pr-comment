# Update All Dependencies Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Bring every dependency to its latest major version, fixing breakage along the way.

**Architecture:** Update dependencies in order from safest/most-independent to most-complex. Each task bumps one dep (or a tightly-coupled group), then runs lint+build+test. Fix any errors before committing and moving on.

**Tech Stack:** Node 24, TypeScript, Vitest, MSW, ESLint, Prettier, GitHub Actions toolkit

**Validation command (run after every task):** `npm run lint && npm run build && npm test`

---

### Task 1: Remove unused dependencies

`@actions/artifact` is in production deps but never imported. `nock` is in devDeps but never imported (tests use MSW). Remove both.

**Step 1: Remove the packages**

```bash
npm uninstall @actions/artifact nock
```

**Step 2: Validate**

Run: `npm run lint && npm run build && npm test`
Expected: All pass, no change in behavior.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: remove unused dependencies @actions/artifact and nock"
```

---

### Task 2: Bump typescript 5.0 → 5.9

Minor version bump, should be safe.

**Step 1: Install**

```bash
npm install --save-dev typescript@latest
```

**Step 2: Validate**

Run: `npm run lint && npm run build && npm test`
Expected: All pass. Fix any new type errors if they appear.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: bump typescript to 5.9"
```

---

### Task 3: Bump @types/node 18 → latest

**Step 1: Install**

```bash
npm install --save-dev @types/node@latest
```

**Step 2: Validate**

Run: `npm run lint && npm run build && npm test`
Expected: All pass. Some type signatures may have changed — fix if needed.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: bump @types/node to latest"
```

---

### Task 4: Bump @vercel/ncc 0.36 → 0.38

**Step 1: Install**

```bash
npm install --save-dev @vercel/ncc@latest
```

**Step 2: Validate**

Run: `npm run lint && npm run build && npm test`
Expected: All pass. The bundled `dist/index.js` will be regenerated.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: bump @vercel/ncc to 0.38"
```

---

### Task 5: Bump del-cli 5 → 7

**Step 1: Install**

```bash
npm install --save-dev del-cli@latest
```

**Step 2: Validate**

Run: `npm run lint && npm run build && npm test`
Expected: All pass.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: bump del-cli to 7"
```

---

### Task 6: Bump np 7 → 11

This is only used for the `release` npm script. Not critical, but keep current.

**Step 1: Install**

```bash
npm install --save-dev np@latest
```

**Step 2: Validate**

Run: `npm run lint && npm run build && npm test`
Expected: All pass.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: bump np to 11"
```

---

### Task 7: Bump @actions/core 1.10 → 3.0

Major bump. Check for API changes in core (getInput, setOutput, setFailed, etc.).

**Step 1: Install**

```bash
npm install @actions/core@latest
```

**Step 2: Validate**

Run: `npm run lint && npm run build && npm test`
Expected: Likely passes — core APIs are generally stable. If types changed, update source accordingly.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: bump @actions/core to 3.0"
```

---

### Task 8: Bump @actions/github 5 → 9 and @octokit/types 9 → 16

These are tightly coupled — @actions/github re-exports Octokit, and @octokit/types provides the `Endpoints` type used in `types.ts` and `proxy.ts`.

**Step 1: Install**

```bash
npm install @actions/github@latest
npm install --save-dev @octokit/types@latest
```

**Step 2: Validate**

Run: `npm run lint && npm run build && npm test`

Likely issues:

- `GitHub` import from `@actions/github/lib/utils` may have moved — check `comments.ts` and `issues.ts`.
- `Endpoints` type shape may have changed in `@octokit/types` — check `types.ts` and `proxy.ts`.
- `WebhookPayload` import in test file may have changed.

Fix any import paths or type mismatches.

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: bump @actions/github to 9 and @octokit/types to 16"
```

---

### Task 9: Bump @actions/glob 0.4 → 0.6

**Step 1: Install**

```bash
npm install @actions/glob@latest
```

**Step 2: Validate**

Run: `npm run lint && npm run build && npm test`
Expected: All pass. Glob API is simple.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: bump @actions/glob to 0.6"
```

---

### Task 10: Bump @actions/http-client 2 → 4

Used in `proxy.ts` for `HttpClient`.

**Step 1: Install**

```bash
npm install @actions/http-client@latest
```

**Step 2: Validate**

Run: `npm run lint && npm run build && npm test`
Expected: All pass. `HttpClient` and `postJson` API should be stable. Fix if types changed.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: bump @actions/http-client to 4"
```

---

### Task 11: Bump vitest 0.30 → 4

Major version bump. Test APIs (`describe`, `it`, `expect`, `vi`) are stable, but config or runner behavior may differ.

**Step 1: Install**

```bash
npm install --save-dev vitest@latest
```

**Step 2: Validate**

Run: `npm run build && npm test`
Expected: Tests should pass. If vitest config format changed, update as needed. Check that top-level `await` in test file still works.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: bump vitest to 4"
```

---

### Task 12: Bump msw 1 → 2

This is a **major migration**. MSW v2 completely changed its API.

**Key changes:**

- `rest` is now `http` (import from `msw`)
- `rest.get(url, (req, res, ctx) => res(ctx.status(200), ctx.json(data)))` becomes `http.get(url, () => HttpResponse.json(data))`
- `req.json()` becomes `await request.json()` (standard Request object)
- `setupServer` import path changed to `msw/node`

**Step 1: Install**

```bash
npm install --save-dev msw@latest
```

**Step 2: Migrate test file `__tests__/add-pr-comment.test.ts`**

Replace imports:

```typescript
// Old
import { rest } from 'msw'
import { setupServer } from 'msw/node'

// New
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
```

Replace all handlers. Pattern:

```typescript
// Old
rest.post(url, async (req, res, ctx) => {
  messagePayload = await req.json<MessagePayload>()
  return res(ctx.status(200), ctx.json(postIssueCommentsResponse))
})

// New
http.post(url, async ({ request }) => {
  messagePayload = (await request.json()) as MessagePayload
  return HttpResponse.json(postIssueCommentsResponse)
})
```

Apply same pattern to all 4 handlers (post, patch, get x2).

**Step 3: Validate**

Run: `npm run build && npm test`
Expected: All 23 tests pass.

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: bump msw to 2 and migrate test handlers"
```

---

### Task 13: Bump prettier 2 → 3

Prettier 3 has minor formatting changes (trailing commas default to "all", which is already set in this project's config).

**Step 1: Install**

```bash
npm install --save-dev prettier@latest
```

**Step 2: Reformat**

```bash
npx prettier --write "src/**/*.ts" "__tests__/**/*.ts"
```

**Step 3: Validate**

Run: `npm run lint && npm run build && npm test`
Expected: All pass. Commit any formatting changes.

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: bump prettier to 3 and reformat"
```

---

### Task 14: Migrate ESLint ecosystem to v9+ with flat config

This is the most complex task. ESLint 9+ uses flat config by default. ESLint 10 drops legacy config support. The entire eslint config in `package.json` must be migrated to `eslint.config.mjs`.

**Packages to update together:**

- eslint 8 → 9 (use 9 first, not 10 — better ecosystem compat)
- @typescript-eslint/eslint-plugin 5 → 8
- @typescript-eslint/parser 5 → 8
- eslint-config-prettier 8 → 10
- eslint-plugin-prettier 4 → 5
- eslint-plugin-import 2.27 → 2.32
- eslint-import-resolver-typescript 3 → 4
- eslint-plugin-mdx 2 → 3

**Step 1: Install all ESLint ecosystem packages**

```bash
npm install --save-dev eslint@^9 @typescript-eslint/eslint-plugin@latest @typescript-eslint/parser@latest eslint-config-prettier@latest eslint-plugin-prettier@latest eslint-plugin-import@latest eslint-import-resolver-typescript@latest eslint-plugin-mdx@latest
```

**Step 2: Create `eslint.config.mjs` (flat config)**

Create a new `eslint.config.mjs` in the project root that replicates the current `eslintConfig` from `package.json`:

```javascript
import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import eslintConfigPrettier from 'eslint-config-prettier'
import eslintPluginPrettier from 'eslint-plugin-prettier/recommended'

export default tseslint.config(
  {
    ignores: ['dist/**', 'lib/**', 'node_modules/**', 'tsconfig.json'],
  },
  eslint.configs.recommended,
  {
    rules: {
      'capitalized-comments': 'off',
      'no-console': 'error',
      'no-unreachable': 'error',
    },
  },
  {
    files: ['**/*.ts'],
    extends: [...tseslint.configs.recommended],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['**/*.test.ts'],
    extends: [...tseslint.configs.recommended],
    rules: {
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  eslintConfigPrettier,
  eslintPluginPrettier,
)
```

**Step 3: Remove old config from `package.json`**

Remove the `eslintConfig` and `eslintIgnore` keys from `package.json`.

**Step 4: Remove unused ESLint plugins**

If `eslint-plugin-json-format` and `eslint-plugin-mdx` are not essential, remove them to simplify the config. Otherwise, add them to the flat config.

```bash
npm uninstall eslint-plugin-json-format eslint-plugin-mdx
```

**Step 5: Update the lint script in `package.json`**

The current lint script is `eslint src/**/*.ts`. Update to:

```json
"lint": "eslint src/"
```

**Step 6: Validate**

Run: `npm run lint && npm run build && npm test`
Fix any lint errors that appear (likely some rule name changes in @typescript-eslint v8).

**Step 7: Commit**

```bash
git add -A
git commit -m "chore: migrate eslint to v9 with flat config and bump all eslint plugins"
```

---

### Task 15: Bump eslint 9 → 10 (if compatible)

After flat config is working on ESLint 9, try bumping to 10.

**Step 1: Install**

```bash
npm install --save-dev eslint@latest
```

**Step 2: Validate**

Run: `npm run lint && npm run build && npm test`
If incompatible plugins block this, stay on ESLint 9.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: bump eslint to 10"
```

---

### Task 16: Final validation and dist rebuild

**Step 1: Clean install and full validation**

```bash
rm -rf node_modules package-lock.json
npm install
npm run lint
npm run build
npm test
```

**Step 2: Commit the rebuilt dist**

The `prepare` script runs build and stages `lib/` and `dist/`. Make sure the final bundled `dist/index.js` is committed.

```bash
git add -A
git commit -m "chore: rebuild dist with all updated dependencies"
```
