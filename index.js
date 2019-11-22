const core = require("@actions/core");
// const github = require("@actions/github");

async function run() {
  try {
    const msg = core.getInput("msg");
    const repoToken = core.getInput("repo-token");

    core.debug(`Input message: ${msg}`);

    const octokit = new github.GitHub(repoToken);
    const context = github.context;

    console.log(context);

    // const { data: pullRequest } = await octokit.pulls.get({
    //   owner: "octokit",
    //   repo: "rest.js",
    //   pull_number: 123,
    // });

    // console.log(pullRequest);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
