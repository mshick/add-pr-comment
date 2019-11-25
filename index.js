const core = require("@actions/core");
const github = require("@actions/github");

async function run() {
  try {
    const message = core.getInput("message");
    const repoToken = core.getInput("repo-token");
    const allowRepeats = Boolean(core.getInput("allow-repeats") === "true");

    core.debug(`input message: ${message}`);
    core.debug(`input allow-repeats: ${allowRepeats}`);

    const {
      payload: { pull_request: pullRequest, repository }
    } = github.context;

    if (!pullRequest) {
      core.error("this action only works on pull_request events");
      core.setOutput("comment-created", "false");
      return;
    }

    const { number: issueNumber } = pullRequest;
    const { full_name: repoFullName } = repository;
    const [owner, repo] = repoFullName.split("/");

    const octokit = new github.GitHub(repoToken);

    if (allowRepeats === false) {
      core.debug("repeat comments are disallowed, checking for existing");

      const { data: comments } = await octokit.issues.listComments({
        owner,
        repo,
        issue_number: issueNumber
      });

      const filteredComments = comments.filter(
        c => c.body === message && c.user.login === "github-actions[bot]"
      );

      if (filteredComments.length) {
        core.warning("the issue already contains this message");
        core.setOutput("comment-created", "false");
        return;
      }
    }

    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body: message
    });

    core.setOutput("comment-created", "true");
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
