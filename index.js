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
        pull_request: pullRequestPayload,
        repository: repositoryPayload
      }
    } = github.context;

    const { pullNumber } = pullRequestPayload;
    const { owner: repoOwner, full_name: repoFullName } = repositoryPayload;

    core.debug(`OWNER-------------------------------`);
    console.log(repoOwner);

    const { data: pr } = await octokit.pulls.get({
      owner: repoOwner,
      repo: repoFullName,
      pull_number: pullNumber
    });

    core.debug(`PR-------------------------------`);
    console.log(pr);

    core.debug(`COMMENTS-------------------------------`);
    const { data: comments } = await octokit.pulls.listComments({
      owner: repoOwner,
      repo: repoFullName,
      pull_number: pullNumber
    });

    console.log(comments);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
