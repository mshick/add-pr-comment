workflow "Run Add PR Comment" {
  on = "pull_request"
  resolves = ["AddPrCommentActions"]
}

action "AddPrCommentActions" {
  uses = "./"
  secrets = [
    "GITHUB_TOKEN"
  ]
}
