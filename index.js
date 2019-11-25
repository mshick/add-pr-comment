const core = require("@actions/core");
const github = require("@actions/github");

async function run() {
  try {
    const msg = core.getInput("msg");
    const repoToken = core.getInput("repo-token");
    const allowRepeats = Boolean(core.getInput("allow-repeats") === "true");

    core.debug(`msg: ${msg}`);
    core.debug(`allow-repeats: ${allowRepeats}`);

    const {
      payload: {
        pull_request: pullRequestPayload,
        repository: repositoryPayload
      }
    } = github.context;

    const { number: pullNumber } = pullRequestPayload;
    const { full_name: repoFullName } = repositoryPayload;
    const [owner, repo] = repoFullName.split("/");

    const octokit = new github.GitHub(repoToken);

    if (allowRepeats === false) {
      core.debug(`repeat comments are disallowed, checking for existing`);

      const { data: comments } = await octokit.pulls.listComments({
        owner,
        repo,
        pull_number: pullNumber
      });

      console.log(comments);
    }

    //   duplicate = coms.find { | c | c["user"]["login"] == "github-actions[bot]" && c["body"] == message }
    //   if duplicate
    // puts "The PR already contains a database change notification"
    //   exit(0)
    //   end

    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: pullNumber,
      body: msg
    });

    core.debug(`DONE`);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
