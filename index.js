const core = require("@actions/core");
const github = require("@actions/github");

async function run() {
  try {
    const msg = core.getInput("msg");
    const repoToken = core.getInput("repo-token");
    const allowRepeats = core.getInput("allow-repeats");

    console.log(
      `allow repeats: ${allowRepeats}, typeof ${typeof allowRepeats}`
    );

    core.debug(`Input message: ${msg}`);

    const octokit = new github.GitHub(repoToken);
    const {
      payload: {
        after: commitSha,
        pull_request: pullRequestPayload,
        repository: repositoryPayload
      }
    } = github.context;

    const { number: pullNumber } = pullRequestPayload;
    const { full_name: repoFullName } = repositoryPayload;
    const [owner, repo] = repoFullName.split("/");

    // core.debug(`OWNER-------------------------------`);
    // console.log(repoOwner);

    const { data: pr } = await octokit.pulls.get({
      owner,
      repo,
      pull_number: pullNumber
    });

    core.debug(`PR-------------------------------`);
    console.log(pr);

    core.debug(`COMMENTS-------------------------------`);
    const { data: comments } = await octokit.pulls.listComments({
      owner,
      repo,
      pull_number: pullNumber
    });

    console.log(comments);

    if (allowRepeats === false) {
      core.debug(`NOT ALLOWING REPEATS, CHECK FOR DUPES`);
    }

    //   duplicate = coms.find { | c | c["user"]["login"] == "github-actions[bot]" && c["body"] == message }
    //   if duplicate
    // puts "The PR already contains a database change notification"
    //   exit(0)
    //   end

    octokit.issues.createComment({
      owner,
      repo,
      issue_number: pullNumber,
      body: msg
    });
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
