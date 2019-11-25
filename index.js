const core = require("@actions/core");
const github = require("@actions/github");

async function run() {
  try {
    const msg = core.getInput("msg");
    const repoToken = core.getInput("repo-token");
    const allowRepeats = Boolean(core.getInput("allow-repeats") === "true");

    core.debug(`input msg: ${msg}`);
    core.debug(`input allow-repeats: ${allowRepeats}`);

    const {
      payload: {
        pull_request: { number: issueNumber },
        repository: { full_name: repoFullName }
      }
    } = github.context;

    const [owner, repo] = repoFullName.split("/");

    const octokit = new github.GitHub(repoToken);

    if (allowRepeats === false) {
      core.debug(`repeat comments are disallowed, checking for existing`);

      const { data: comments } = await octokit.issues.listComments({
        owner,
        repo,
        issue_number: issueNumber
      });

      const filteredComments = comments.filter(
        c => c.body === msg && c.user.login === "github-actions[bot]"
      );

      if (filteredComments.length) {
        core.warning(`the issue already contains this message`);
        core.setOutput("commented-created", "false");
        return;
      }
    }

    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body: msg
    });

    core.setOutput("commented-created", "true");
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
