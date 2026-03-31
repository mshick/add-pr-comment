# add-pr-comment

<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
[![All Contributors](https://img.shields.io/badge/all_contributors-9-orange.svg?style=flat-square)](#contributors-)
<!-- ALL-CONTRIBUTORS-BADGE:END -->

[![CI](https://github.com/mshick/add-pr-comment/actions/workflows/ci.yml/badge.svg)](https://github.com/mshick/add-pr-comment/actions/workflows/ci.yml)
[![Check dist/](https://github.com/mshick/add-pr-comment/actions/workflows/check-dist.yml/badge.svg)](https://github.com/mshick/add-pr-comment/actions/workflows/check-dist.yml)
[![CodeQL](https://github.com/mshick/add-pr-comment/actions/workflows/codeql.yml/badge.svg)](https://github.com/mshick/add-pr-comment/actions/workflows/codeql.yml)
[![Coverage](./badges/coverage.svg)](./badges/coverage.svg)

A GitHub Action which adds a comment to a pull request issue or commit.

This action also works on [issue](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#issues),
[issue_comment](https://docs.github.com/en/developers/webhooks-and-events/webhooks/webhook-events-and-payloads#issue_comment),
[deployment_status](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#deployment_status),
[push](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#push)
and any other event where an issue can be found directly on the payload or via a commit sha.

## Features

- Modify issues for PRs merged to main.
- By default will post "sticky" comments. If on a subsequent run the message text changes the original comment will be updated.
- Multiple sticky comments allowed by setting unique `message-id`s.
- Optional message overrides based on job status.
- Multiple posts to the same conversation optionally allowable.
- Supports a proxy for fork-based PRs. [See below](#proxy-for-fork-based-prs).
- Supports creating a message from a file path.
- Supports [file attachments](#file-attachments) via GitHub Artifacts.
- Automatic [message truncation](#message-truncation) for oversized messages (e.g., large Terraform plans).
- Supports [commit comments](#commit-comments) in addition to PR/issue comments.
- Available as a [library](#programmatic-usage) for use in custom actions and scripts.

## Usage

Note that write access needs to be granted for the pull-requests scope.

```yaml
on:
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - uses: mshick/add-pr-comment@v3
        with:
          message: |
            **Hello**
            🌏
            !
```

You can even use it on PR Issues that are related to PRs that were merged into main, for example:

```yaml
on:
  push:
    branches:
      - main

jobs:
  test:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - uses: mshick/add-pr-comment@v3
        with:
          message: |
            **Hello MAIN**
```

## Configuration options

| Input                    | Location | Description                                                                                                                                                                 | Required | Default                            |
| ------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------- |
| message                  | with     | The message you'd like displayed, supports Markdown and all valid Unicode characters.                                                                                       | maybe    |                                    |
| message-path             | with     | Path to a message you'd like displayed. Will be read and displayed just like a normal message. Supports multi-line input and globs. Multiple messages will be concatenated. | maybe    |                                    |
| message-success          | with     | A message override, printed in case of success.                                                                                                                             | no       |                                    |
| message-failure          | with     | A message override, printed in case of failure.                                                                                                                             | no       |                                    |
| message-cancelled        | with     | A message override, printed in case of cancelled.                                                                                                                           | no       |                                    |
| message-skipped          | with     | A message override, printed in case of skipped.                                                                                                                             | no       |                                    |
| status                   | with     | Required if you want to use message status overrides.                                                                                                                       | no       | {{ job.status }}                   |
| repo-owner               | with     | Owner of the repo.                                                                                                                                                          | no       | {{ github.repository_owner }}      |
| repo-name                | with     | Name of the repo.                                                                                                                                                           | no       | {{ github.event.repository.name }} |
| repo-token               | with     | Valid GitHub token, either the temporary token GitHub provides or a personal access token.                                                                                  | no       | {{ github.token }}                 |
| message-id               | with     | Message id to use when searching existing comments. If found, updates the existing (sticky comment).                                                                        | no       |                                    |
| delete-on-status         | with     | If specified and a comment exists and the status is matching the value of this option, the comment will be deleted                                                          | no       |                                    |
| refresh-message-position | with     | Should the sticky message be the last one in the PR's feed.                                                                                                                 | no       | false                              |
| allow-repeats            | with     | Boolean flag to allow identical messages to be posted each time this action is run.                                                                                         | no       | false                              |
| proxy-url                | with     | String for your proxy service URL if you'd like this to work with fork-based PRs.                                                                                           | no       |                                    |
| issue                    | with     | Optional issue number override.                                                                                                                                             | no       |                                    |
| update-only              | with     | Only update the comment if it already exists.                                                                                                                               | no       | false                              |
| GITHUB_TOKEN             | env      | Valid GitHub token, can alternatively be defined in the env.                                                                                                                | no       |                                    |
| preformatted             | with     | Treat message text as pre-formatted and place it in a codeblock                                                                                                             | no       |                                    |
| find                     | with     | Patterns to find in an existing message and replace with either `replace` text or a resolved `message`. See [Find-and-Replace](#find-and-replace) for more detail.          | no       |                                    |
| replace                  | with     | Strings to replace a found pattern with. Each new line is a new replacement, or if you only have one pattern, you can replace with a multiline string.                      | no       |                                    |
| attach-path              | with     | A file path or glob pattern for files to upload as artifacts and link in the comment. See [File Attachments](#file-attachments).                                            | no       |                                    |
| attach-name              | with     | Name for the uploaded artifact.                                                                                                                                             | no       | pr-comment-attachments             |
| attach-text              | with     | Markdown content for the attachment section. Always separated from the comment by a horizontal rule. Supports `%ARTIFACT_URL%` and `%ATTACH_NAME%` template variables.      | no       | (see [File Attachments](#file-attachments)) |
| truncate                 | with     | Truncation mode when the message exceeds the safe comment length. See [Message Truncation](#message-truncation).                                                            | no       | artifact                           |
| comment-target           | with     | Where to post the comment. Use `pr` for pull request/issue comments or `commit` for commit comments. See [Commit Comments](#commit-comments).                              | no       | pr                                 |
| commit-sha               | with     | The commit SHA to comment on when `comment-target` is `commit`. Defaults to the current commit.                                                                             | no       | {{ github.sha }}                   |

## Outputs

| Output            | Description                                                       |
| ----------------- | ----------------------------------------------------------------- |
| `comment-created` | `"true"` if a new comment was created, `"false"` otherwise.       |
| `comment-updated` | `"true"` if an existing comment was updated, `"false"` otherwise. |
| `comment-id`      | The numeric ID of the created or updated comment.                 |
| `artifact-url`    | If files were attached, the URL to download the artifact.         |
| `truncated`       | `"true"` if the message was truncated, `"false"` otherwise.      |
| `truncated-artifact-url` | If truncated in artifact mode, the URL to download the full message. |

### Using outputs in subsequent steps

```yaml
- uses: mshick/add-pr-comment@v3
  id: comment
  with:
    message: 'Hello world'

- name: Check outputs
  run: |
    echo "Comment created: ${{ steps.comment.outputs.comment-created }}"
    echo "Comment updated: ${{ steps.comment.outputs.comment-updated }}"
    echo "Comment ID: ${{ steps.comment.outputs.comment-id }}"
```

> **Tip:** By default, comments are "upsert" — a comment is created on the first run and updated on subsequent runs when matched by `message-id`. If you want this create-or-update behavior, you do not need to set `update-only`. Setting `update-only: true` skips comment creation entirely and only updates an existing comment. Use it when you specifically want no comment to appear unless one was already posted by a previous step or run.

## Advanced Uses

### Proxy for Fork-based PRs

GitHub limits `GITHUB_TOKEN` and other API access token permissions when creating a PR from a fork. This precludes adding comments when your PRs are coming from forks, which is the norm for open source projects. To work around this situation I've created a simple companion app you can deploy to Cloud Run or another host to proxy the create comment requests with a personal access token you provide.

See this issue: https://github.community/t/github-actions-are-severely-limited-on-prs/18179/4 for more details.

Check out the proxy service here: https://github.com/mshick/add-pr-comment-proxy

**Example**

```yaml
on:
  pull_request:

jobs:
  pr:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - uses: mshick/add-pr-comment@v3
        with:
          message: |
            **Howdie!**
          proxy-url: https://add-pr-comment-proxy-94idvmwyie-uc.a.run.app
```

### Status Message Overrides

You can override your messages based on your job status. This can be helpful
if you don't anticipate having the data required to create a helpful message in
case of failure, but you still want a message to be sent to the PR comment.

**Example**

```yaml
on:
  pull_request:

jobs:
  pr:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - uses: mshick/add-pr-comment@v3
        if: always()
        with:
          message: |
            **Howdie!**
          message-failure: |
            Uh oh!
```

### Multiple Message Files

Instead of directly setting the message you can also load a file with the text
of your message using `message-path`. `message-path` supports loading multiple
files and files on multiple lines, the contents of which will be concatenated.

**Example**

```yaml
on:
  pull_request:

jobs:
  pr:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - uses: mshick/add-pr-comment@v3
        if: always()
        with:
          message-path: |
            message-part-*.txt
```

### Find-and-Replace

Patterns can be matched and replaced to update comments. This could be useful
for some situations, for instance, updating a checklist comment.

Find is a regular expression passed to the [RegExp() constructor](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/RegExp). You can also
include modifiers to override the default `gi`.

**Example**

Original message:

```
[ ] Hello
[ ] World
```

Action:

```yaml
on:
  pull_request:

jobs:
  pr:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - uses: mshick/add-pr-comment@v3
        if: always()
        with:
          find: |
            \n\\[ \\]
          replace: |
            [X]
```

Final message:

```
[X] Hello
[X] World
```

Multiple find and replaces can be used:

**Example**

Original message:

```
hello world!
```

Action:

```yaml
on:
  pull_request:

jobs:
  pr:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - uses: mshick/add-pr-comment@v3
        if: always()
        with:
          find: |
            hello
            world
          replace: |
            goodnight
            moon
```

Final message:

```
goodnight moon!
```

It defaults to your resolved message (either from `message` or `message-path`) to
do a replacement:

**Example**

Original message:

```
hello

<< FILE_CONTENTS >>

world
```

Action:

```yaml
on:
  pull_request:

jobs:
  pr:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - uses: mshick/add-pr-comment@v3
        if: always()
        with:
          message-path: |
            message.txt
          find: |
            << FILE_CONTENTS >>
```

Final message:

```
hello

secret message from message.txt

world
```

### File Attachments

You can attach files to your PR comments by uploading them as GitHub Artifacts and embedding download links in the comment body. Files matching the `attach-path` glob are uploaded as a single artifact, and a markdown section with the download link is appended to your comment, separated by a horizontal rule.

> **Note:** Artifact download URLs require GitHub authentication and expire based on your repository's retention settings (default 90 days). Images will not render inline — they appear as download links. This is a GitHub platform limitation.

**Simple — attach a file with defaults**

```yaml
on:
  pull_request:

jobs:
  report:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - run: echo "Build output here" > report.txt
      - uses: mshick/add-pr-comment@v3
        with:
          message: |
            Build complete! See attached report.
          attach-path: report.txt
```

**Advanced — glob pattern, custom name, and custom text template**

```yaml
on:
  pull_request:

jobs:
  report:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - run: |
          mkdir -p coverage
          echo "line coverage: 85%" > coverage/summary.txt
          echo "<html>...</html>" > coverage/report.html
      - uses: mshick/add-pr-comment@v3
        with:
          message: |
            ## Coverage Report
            Tests passed with 85% line coverage.
          attach-path: coverage/*
          attach-name: coverage-report
          attach-text: '📎 [Download %ATTACH_NAME%](%ARTIFACT_URL%)'
```

The `attach-text` input supports two template variables:

| Variable         | Replaced with                      |
| ---------------- | ---------------------------------- |
| `%ARTIFACT_URL%` | The artifact download URL          |
| `%ATTACH_NAME%`  | The value of the `attach-name` input |

### Message Truncation

GitHub's API limits comment bodies to 65,536 characters. Messages that exceed this limit (common with large Terraform plans, verbose test output, etc.) would previously cause the action to fail with an "Argument list too long" or API error.

This action automatically truncates oversized messages to stay within a safe limit (61,440 characters, which includes a 4,096 character buffer). The `truncate` input controls what happens with the full message:

| Mode | Behavior |
| ---- | -------- |
| `artifact` (default) | The full, untruncated message is uploaded as a downloadable GitHub Artifact. The comment is truncated and a download link is appended. |
| `simple` | The comment is truncated and a notice is appended. No artifact is uploaded. |

If artifact upload fails (e.g., permissions, network issues), the action automatically falls back to simple truncation.

**Example — default artifact mode**

```yaml
on:
  pull_request:

jobs:
  plan:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - run: terraform plan -no-color > plan.txt
      - uses: mshick/add-pr-comment@v3
        with:
          message-path: plan.txt
```

If the plan output exceeds the safe limit, the comment will be truncated and end with:

> **This message was truncated.** [Download full message](https://github.com/...)

**Example — simple mode (no artifact)**

```yaml
- uses: mshick/add-pr-comment@v3
  with:
    message-path: plan.txt
    truncate: simple
```

The comment will be truncated and end with:

> **This message was truncated.**

**Using the truncation outputs**

```yaml
- uses: mshick/add-pr-comment@v3
  id: comment
  with:
    message-path: plan.txt

- name: Check if truncated
  if: steps.comment.outputs.truncated == 'true'
  run: |
    echo "Message was truncated"
    echo "Full message: ${{ steps.comment.outputs.truncated-artifact-url }}"
```

> **Tip:** For very large outputs like Terraform plans, prefer using `message-path` over the `message` input. The `message` input is passed via environment variables, which have OS-level size limits that can cause failures before the action even runs. File-based input via `message-path` avoids this entirely.

### Commit Comments

Instead of posting to a pull request or issue, you can post comments directly on a commit. This is useful for workflows triggered by `push` events or when you want feedback attached to a specific commit rather than a PR conversation.

**Example**

```yaml
on:
  push:
    branches:
      - main

jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - uses: mshick/add-pr-comment@v3
        with:
          comment-target: commit
          message: |
            Build succeeded for ${{ github.sha }}
```

You can also specify a different commit SHA:

```yaml
- uses: mshick/add-pr-comment@v3
  with:
    comment-target: commit
    commit-sha: ${{ github.event.before }}
    message: |
      Comparing changes since this commit.
```

> **Note:** Commit comments use a different GitHub API than issue/PR comments. Sticky comments (`message-id`), `update-only`, `refresh-message-position`, and `delete-on-status` all work with commit comments. The `proxy-url` option is not supported for commit comments.

> **Important:** The `commit` comment target requires that commit comments are enabled on your repository. GitHub now allows repository admins to [disable comments on individual commits](https://github.blog/changelog/2026-03-25-disable-comments-on-individual-commits/). If commit comments are disabled, this action will fail when using `comment-target: commit`.

### Bring your own issues

You can set an issue id explicitly. Helpful for cases where you want to post
to an issue but for some reason the event would not allow the id to be determined.

**Example**

> In this case `add-pr-comment` should have no problem finding the issue number
> on its own, but for demonstration purposes.

```yaml
on:
  deployment_status:

jobs:
  pr:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - id: pr
        run: |
          issue=$(gh pr list --search "${{ github.sha }}" --state open --json number --jq ".[0].number")
          echo "issue=$issue" >>$GITHUB_OUTPUT
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - uses: mshick/add-pr-comment@v3
        with:
          issue: ${{ steps.pr.outputs.issue }}
          message: |
            **Howdie!**
```

### Delete on status

This option can be used if comment needs to be removed if a status is reached.

**Example**

> Here, a comment will be added on failure, but on a subsequent run,
> if the job reaches success status, the comment will be deleted.

```yaml
on:
  pull_request:

jobs:
  pr:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - uses: mshick/add-pr-comment@v3
        if: always()
        with:
          message-failure: There was a failure
          delete-on-status: success
```

## Programmatic Usage

This package also exports its core functions as a library, so you can use them in your own custom GitHub Actions or scripts.

```bash
npm install @mshick/add-pr-comment
```

```typescript
import {
  createComment,
  getExistingComment,
  updateComment,
  deleteComment,
  createCommitComment,
  getMessage,
  truncateMessage,
  uploadAttachments,
} from '@mshick/add-pr-comment'
```

The library exports functions for managing both issue/PR comments and commit comments, file discovery, message resolution, truncation, attachments, and proxy support. Type definitions are included.

## Security

### Version Pinning

There are three ways to reference this action, from most to least secure:

1. **Commit SHA (most secure)**: `uses: mshick/add-pr-comment@ffd016c7e151d97d69d21a843022fd4cd5b96fe5` — immutable, can never change.
2. **Semver tag (recommended)**: `uses: mshick/add-pr-comment@v3.9.0` — protected by tag rulesets, cannot be moved or deleted once created.
3. **Major version tag (convenient but less secure)**: `uses: mshick/add-pr-comment@v3` — floating tag that is updated on each release to point to the latest version. While convenient, floating tags are a potential security risk as they could theoretically be re-pointed to a different commit.

For maximum security, pin to a full semver tag or commit SHA. Semver tags (e.g., `v3.9.0`) in this repository are protected by GitHub tag rulesets and cannot be modified after creation.

Releases include build provenance attestations generated by [`actions/attest-build-provenance`](https://github.com/actions/attest-build-provenance), which can be used to verify that the release was produced by the official CI pipeline.

## Contributors ✨

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://app.lizardbyte.dev"><img src="https://avatars.githubusercontent.com/u/42013603?v=4?s=100" width="100px;" alt="ReenigneArcher"/><br /><sub><b>ReenigneArcher</b></sub></a><br /><a href="https://github.com/mshick/add-pr-comment/commits?author=ReenigneArcher" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/aryella-lacerda"><img src="https://avatars.githubusercontent.com/u/28730324?v=4?s=100" width="100px;" alt="Aryella Lacerda"/><br /><sub><b>Aryella Lacerda</b></sub></a><br /><a href="https://github.com/mshick/add-pr-comment/commits?author=aryella-lacerda" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/vincent-joignie-dd"><img src="https://avatars.githubusercontent.com/u/103102299?v=4?s=100" width="100px;" alt="vincent-joignie-dd"/><br /><sub><b>vincent-joignie-dd</b></sub></a><br /><a href="https://github.com/mshick/add-pr-comment/commits?author=vincent-joignie-dd" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://ahanoff.dev"><img src="https://avatars.githubusercontent.com/u/2371703?v=4?s=100" width="100px;" alt="Akhan Zhakiyanov"/><br /><sub><b>Akhan Zhakiyanov</b></sub></a><br /><a href="https://github.com/mshick/add-pr-comment/commits?author=ahanoff" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/ahatzz11"><img src="https://avatars.githubusercontent.com/u/6256032?v=4?s=100" width="100px;" alt="Alex Hatzenbuhler"/><br /><sub><b>Alex Hatzenbuhler</b></sub></a><br /><a href="https://github.com/mshick/add-pr-comment/commits?author=ahatzz11" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://www.august8.net"><img src="https://avatars.githubusercontent.com/u/766820?v=4?s=100" width="100px;" alt="Tommy Wang"/><br /><sub><b>Tommy Wang</b></sub></a><br /><a href="https://github.com/mshick/add-pr-comment/commits?author=twang817" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/ljetten"><img src="https://avatars.githubusercontent.com/u/7528045?v=4?s=100" width="100px;" alt="Laura Jetten"/><br /><sub><b>Laura Jetten</b></sub></a><br /><a href="https://github.com/mshick/add-pr-comment/commits?author=ljetten" title="Code">💻</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/manan-jadhav-ab"><img src="https://avatars.githubusercontent.com/u/166636237?v=4?s=100" width="100px;" alt="Manan Jadhav"/><br /><sub><b>Manan Jadhav</b></sub></a><br /><a href="https://github.com/mshick/add-pr-comment/commits?author=manan-jadhav-ab" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/anne-pc"><img src="https://avatars.githubusercontent.com/u/27091643?v=4?s=100" width="100px;" alt="Jiří Majer"/><br /><sub><b>Jiří Majer</b></sub></a><br /><a href="https://github.com/mshick/add-pr-comment/commits?author=anne-pc" title="Code">💻</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!
