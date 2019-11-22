// entrypoint.js
const { Toolkit } = require("actions-toolkit");
const tools = new Toolkit();
const webPageTest = require("webpagetest");
const argv = tools.arguments;

const { event, payload, sha } = tools.context;

// check pre-requirements
if (!checkForMissingEnv) tools.exit.failure("Failed!");

// run the script
runAudit();

async function runAudit() {
  try {
    if (event === "push") {
      tools.log("### Action triggered! ###");

      // 1. An authenticated instance of `@octokit/rest`, a GitHub API SDK
      const octokit = tools.github;

      // initialize webPagetest
      const wpt = new webPageTest(
        process.env.WEBPAGETEST_SERVER_URL || "www.webpagetest.org",
        process.env.WEBPAGETEST_API_KEY
      );

      // 2. run tests and save results
      const webpagetestResults = await runWebPagetest(wpt);

      // 3. convert results to markdown
      const finalResultsAsMarkdown = convertToMarkdown(webpagetestResults);

      // 4. print results to as commit comment
      const { owner, repo } = {
        ...tools.context.repo,
        ref: `${payload.ref}`
      };

      await octokit.repos.createCommitComment({
        owner,
        repo,
        sha,
        body: finalResultsAsMarkdown
      });

      tools.exit.success("Succesfully run!");
    }
  } catch (error) {
    tools.log.error(`Something went wrong ${error}!`);
  }
}

/**
 * Log warnings to the console for missing environment variables
 */
function checkForMissingEnv() {
  const requiredEnvVars = [
    "HOME",
    "GITHUB_WORKFLOW",
    "GITHUB_ACTION",
    "GITHUB_ACTOR",
    "GITHUB_REPOSITORY",
    "GITHUB_EVENT_NAME",
    "GITHUB_EVENT_PATH",
    "GITHUB_WORKSPACE",
    "GITHUB_SHA",
    "GITHUB_REF",
    "GITHUB_TOKEN"
  ];

  const requiredButMissing = requiredEnvVars.filter(
    key => !process.env.hasOwnProperty(key)
  );
  if (requiredButMissing.length > 0) {
    // This isn't being run inside of a GitHub Action environment!
    const list = requiredButMissing.map(key => `- ${key}`).join("\n");
    const warning = `There are environment variables missing from this runtime.\n${list}`;
    tools.log.warn(warning);
    return false;
  } else {
    return true;
  }
}
