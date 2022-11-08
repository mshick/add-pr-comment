# add-pr-comment

> A GitHub Action which adds a comment to a pull request's issue.

## Features

- Fast, runs in the GitHub Actions node.js runtime.
- Modify issues for PRs merged to main.
- By default will post "sticky" comments. If on a subsequent run the message text changes the original comment will be updated.
- Multiple sticky comments allowed by setting unique `message-id`s.
- Multiple posts of the same comment optionally allowable.
- Supports emoji 😂😂😂!
- Supports a proxy for fork-based PRs. [See below](#proxy-for-fork-based-prs).
- Supports creating a message from a file path.
- Optional message / status overrides.

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
      - uses: mshick/add-pr-comment@v2
        with:
          message: |
            **Hello**
            🌏
            !
          repo-token: ${{ secrets.GITHUB_TOKEN }}
          allow-repeats: false # This is the default
          message-id: 'add-pr-comment' # This is the default
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
      - uses: mshick/add-pr-comment@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          message: |
            **Hello MAIN**
```

## Configuration options

| Variable or Argument | Location | Description                                                                                          | Required | Default            |
| -------------------- | -------- | ---------------------------------------------------------------------------------------------------- | -------- | ------------------ |
| message              | with     | The message you'd like displayed, supports Markdown and all valid Unicode characters.                | maybe    |                    |
| message-path         | with     | Path to a message you'd like displayed. Will be read and displayed just like a normal message.       | maybe    |                    |
| message-success      | with     | A message override, printed in case of success.                                                      | maybe    |                    |
| message-failure      | with     | A message override, printed in case of failure.                                                      | maybe    |                    |
| message-cancelled    | with     | A message override, printed in case of cancelled.                                                    | maybe    |                    |
| status               | with     | Required if you want to use message status overrides.                                                | yes      | {{ job.status }}   |
| repo-token           | with     | Valid GitHub token, either the temporary token GitHub provides or a personal access token.           | yes      | {{ github.token }} |
| message-id           | with     | Message id to use when searching existing comments. If found, updates the existing (sticky comment). | no       |                    |
| allow-repeats        | with     | Boolean flag to allow identical messages to be posted each time this action is run.                  | no       | false              |
| proxy-url            | with     | String for your proxy service URL if you'd like this to work with fork-based PRs.                    | no       |                    |
| GITHUB_TOKEN         | env      | Valid GitHub token, can alternatively be defined in the env.                                         | no       |                    |

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
      - uses: mshick/add-pr-comment@v2
        with:
          message: |
            **Howdie!**
          proxy-url: https://add-pr-comment-proxy-94idvmwyie-uc.a.run.app
          repo-token: ${{ secrets.GITHUB_TOKEN }}
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
      - uses: mshick/add-pr-comment@v2
        with:
          if: always()
          message: |
            **Howdie!**
          message-failure: |
            Uh oh!
          repo-token: ${{ secrets.GITHUB_TOKEN }}
          status: ${{ job.status }}
```
