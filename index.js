const core = require("@actions/core");
const github = require("@actions/github");
const { HttpClient, Headers } = require("@actions/http-client");

const previewHeader = "application/vnd.github.groot-preview+json";

const getPulls = async (repoToken, repo, commitSha) => {
  const http = new HttpClient("http-client-add-pr-comment");

  const additionalHeaders = {
    [Headers.Accept]: previewHeader,
    [Headers.Authorization]: `token ${repoToken}`,
  };

  const body = await http.getJson(
    `https://api.github.com/repos/${repo}/commits/${commitSha}/pulls`,
    additionalHeaders
  );

  return body.result;
};

async function run() {
  try {
    const message = core.getInput("message");
    const repoToken = core.getInput("repo-token");
    const allowRepeats = Boolean(core.getInput("allow-repeats") === "true");

    core.debug(`input message: ${message}`);
    core.debug(`input allow-repeats: ${allowRepeats}`);

    const {
      payload: { pull_request: pullRequest, repository },
      sha: commitSha,
    } = github.context;

    const { full_name: repoFullName } = repository;

    let issueNumber;

    if (pullRequest && pullRequest.number) {
      issueNumber = pullRequest.number;
    } else {
      // If this is not a pull request, attempt to find a PR matching the sha
      const pulls = await getPulls(repoToken, repoFullName, commitSha);
      issueNumber = pulls.length ? pulls[0].number : null;
    }

    if (!issueNumber) {
      core.info(
        "this action only works on pull_request events or other commits associated with a pull"
      );
      core.setOutput("comment-created", "false");
      return;
    }

    const [owner, repo] = repoFullName.split("/");

    const octokit = new github.GitHub(repoToken);

    if (allowRepeats === false) {
      core.debug("repeat comments are disallowed, checking for existing");

      const { data: comments } = await octokit.issues.listComments({
        owner,
        repo,
        issue_number: issueNumber,
      });

      core.debug("DUMP FOLLOWS>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>..");

      const spacesRe = new RegExp("\\s", "g");
      const messageClean = message.replace(spacesRe, "");

      core.debug(
        JSON.stringify(comments.map((c) => c.body.replace(spacesRe, "")))
      );
      core.debug(messageClean);

      const commentExists = comments.includes(
        (c) =>
          c.body.replace(spacesRe, "") === messageClean &&
          c.user.login === "github-actions[bot]"
      );

      core.debug(`comment exists: ${commentExists}`);

      if (commentExists) {
        core.info("the issue already contains this message");
        core.setOutput("comment-created", "false");
        return;
      }
    }

    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body: message,
    });

    core.setOutput("comment-created", "true");
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
