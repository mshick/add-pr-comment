# add-pr-comment

> A GitHub Action which adds a comment to a pull request's issue.

## Features

- Fast, runs in the GitHub Actions node.js runtime; no Docker pull needed.
- Modify issues for PRs merged to master.
- Multiple posts of the same comment optionally allowable.
- Supports emoji 😂😂😂!
- Supports a proxy for fork-based PRs. [See below](#proxy-for-fork-based-prs).
- Supports creating a message from a file path

## Usage

```yaml
on:
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: mshick/add-pr-comment@v2
        with:
          message: |
            **Hello**
            🌏
            !
          repo-token: ${{ secrets.GITHUB_TOKEN }}
          repo-token-user-login: 'github-actions[bot]' # The user.login for temporary GitHub tokens
          allow-repeats: false # This is the default
```

You can even use it on PR Issues that are related to PRs that were merged into master, for example:

```yaml
on:
  push:
    branches:
      - master

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: mshick/add-pr-comment@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          message: |
            **Hello MASTER**
          allow-repeats: true
```

## Configuration options

| Variable or Argument  | Location | Description                                                                                                                 | Required | Default |
| --------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------- | -------- | ------- |
| message               | with     | The message you'd like displayed, supports Markdown and all valid Unicode characters                                        | maybe    |         |
| message-path          | with     | A path to a message you'd like displayed. Will be read and displayed just like a normal message                             | maybe    |         |
| repo-token            | with     | A valid GitHub token, either the temporary token GitHub provides or a personal access token                                 | maybe    |         |
| repo-token-user-login | with     | Define this to save on comment processing time when checking for repeats. GitHub's default token uses `github-actions[bot]` | no       |         |
| allow-repeats         | with     | A boolean flag to allow identical messages to be posted each time this action is run                                        | no       | false   |
| proxy-url             | with     | A string for your proxy service URL if you'd like this to work with fork-based PRs                                          | no       |         |
| GITHUB_TOKEN          | env      | A valid GitHub token, can alternatively be defined in the env                                                               | maybe    |         |

## Proxy for Fork-based PRs

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
    steps:
      - uses: mshick/add-pr-comment@v2
        with:
          message: |
            **Howdie!**
          proxy-url: https://add-pr-comment-proxy-94idvmwyie-uc.a.run.app
          repo-token: ${{ secrets.GITHUB_TOKEN }}
```
