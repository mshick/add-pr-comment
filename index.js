const core = require("@actions/core");
const github = require("@actions/github");
const { exec } = require('child_process');

async function run() {
  try {
    const message = core.getInput("message");
    const repoToken = core.getInput("repo-token");
    const allowRepeats = Boolean(core.getInput("allow-repeats") === "true");
    const { GITHUB_REPOSITORY, GITHUB_SHA } = process.env;

    core.debug(`input message: ${message}`);
    core.debug(`input allow-repeats: ${allowRepeats}`);
    const command = `curl -s -H "Accept: application/vnd.github.groot-preview+json" -H "Authorization: token ${repoToken}" https://api.github.com/repos/${ GITHUB_REPOSITORY }/commits/${ GITHUB_SHA }/pulls | jq -r '.[].number'`;
    
    exec(command, async (err, issueNumber, stderr) => {
      if (err) {
        throw err;
      }
      const [owner, repo] = GITHUB_REPOSITORY.split("/");
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
    });
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
