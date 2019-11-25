const core = require("@actions/core");
const github = require("@actions/github");

async function run() {
  try {
    const msg = core.getInput("msg");
    const repoToken = core.getInput("repo-token");

    core.debug(`Input message: ${msg}`);

    const octokit = new github.GitHub(repoToken);
    const {
      payload: {
        pull_request: pullRequestPayload
        // respository: repositoryPayload
      }
    } = github.context;

    const { data: pullRequest } = await octokit.pulls.get({
      owner: "mshick",
      repo: "add-pr-comment",
      pull_number: pullRequestPayload.number
    });

    console.log(pullRequest);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
