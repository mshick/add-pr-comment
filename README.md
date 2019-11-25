# add-pr-comment

> A GitHub Action which adds a comment to a Pull Request Issue.

## Usage

```yaml
uses: mshick/add-pr-comment@v1
with:
  message: |
    **Hello!**
    🌏
    !
  repo-token: ${{ secrets.GITHUB_TOKEN }}
  allow-repeats: false
```

## Features

- Fast, runs in the GitHub Actions node.js runtime; no Docker pull needed.
- Multiple posts of the same comment optionally allowable.
- Supports emoji 😂😂😂!
