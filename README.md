# add-pr-comment

> A GitHub Action which adds a comment to a pull request's issue.

## Limitations

Due to how GitHub handles permissions in PRs coming from forks, this action is limited to PRs based on branches. See this issue: https://github.community/t/github-actions-are-severely-limited-on-prs/18179/4 for more detail.

I'm currently investigating a workaround via a simple bot you can easily deploy. More soon...

## Usage

```yaml
on:
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: mshick/add-pr-comment@v1
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
      - uses: mshick/add-pr-comment@v1
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
| message               | with     | The message you'd like displayed, supports Markdown and all valid Unicode characters                                        | yes      |         |
| repo-token            | with     | A valid GitHub token, either the temporary token GitHub provides or a personal access token                                 | maybe    |         |
| repo-token-user-login | with     | Define this to save on comment processing time when checking for repeats. GitHub's default token uses `github-actions[bot]` | no       |         |
| allow-repeats         | with     | A boolean flag to allow identical messages to be posted each time this action is run                                        | no       | false   |
| GITHUB_TOKEN          | env      | A valid GitHub token, can alternatively be defined in the env                                                               | maybe    |         |

## Features

- Fast, runs in the GitHub Actions node.js runtime; no Docker pull needed.
- Modify issues for PRs merged to master.
- Multiple posts of the same comment optionally allowable.
- Supports emoji 😂😂😂!

## Use Case

- Adding a deployed app URL to a PR issue
- Printing some sort of output to the PR issue for human-readability
