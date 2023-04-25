import * as core from '@actions/core'
import * as github from '@actions/github'
import { GitHub } from '@actions/github/lib/utils'

// type ListWorkflowRunArtifacts =
// Endpoints['GET /repos/{owner}/{repo}/actions/runs/{run_id}/artifacts']

export interface WorkflowArtifactDetails {
  id: number
  name: string
  httpUrl: string
}
/*
  gets all artifacts for workflow run or from input ( for when using workflow_run_conclusion_dispatch)
  returning the id, name and most importantly the html url to the artifact
*/
export async function getWorkflowArtifactDetails(
  octokit: InstanceType<typeof GitHub>,
  owner: string,
  repo: string,
): Promise<any> {
  const checks = (await octokit.request('GET /repos/{owner}/{repo}/commits/{ref}/check-suites', {
    owner,
    repo,
    ref: github.context.payload.after,
    headers: {
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })) as any

  core.info('checks------------')
  core.info(JSON.stringify(checks, null, 2))

  const artifacts = (await octokit.request(`GET ${getArtifactUrl()}`, {
    // owner,
    // repo,
    // ref: github.context.payload.after,
    // headers: {
    //   'X-GitHub-Api-Version': '2022-11-28',
    // },
  })) as any

  core.info('artifacts------------')
  core.info(JSON.stringify(artifacts, null, 2))

  // const artifactDetails: WorkflowArtifactDetails[] = []
  // const payload = github.context.payload as any
  // core.info('context------------')
  // core.info(JSON.stringify(github.context, null, 2))

  // core.info('payload------------')
  // core.info(JSON.stringify(payload, null, 2))
  // // const payload = github.context.payload as unknown as EventPayloadMap['workflow_run']
  // const workflowRun = payload.workflow_run
  // const repoHtmlUrl = payload.repository.html_url
  // // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  // const checkSuiteNumber = workflowRun.check_suite_id!
  // const artifactsUrl = workflowRun.artifacts_url
  // const artifacts: ListWorkflowRunArtifacts['response']['data']['artifacts'] =
  //   await octokit.paginate(artifactsUrl, {
  //     per_page: 100,
  //   })

  // for (const artifact of artifacts) {
  //   const artifactDetail = {
  //     id: artifact.id,
  //     name: artifact.name,
  //     httpUrl: getArtifactUrl(repoHtmlUrl, checkSuiteNumber, artifact.id),
  //   }
  //   artifactDetails.push(artifactDetail)
  // }

  // return artifactDetails
}

// https://github.com/tonyhallett/DummyZipVsix/suites/2299172325/artifacts/48199605
// function getArtifactUrl(repoHtmlUrl: string, checkSuiteNumber: number, artifactId: number): string {
//   return `${repoHtmlUrl}/suites/${checkSuiteNumber}/artifacts/${artifactId.toString()}`
// }

function getRuntimeUrl(): string {
  const runtimeUrl = process.env['ACTIONS_RUNTIME_URL']
  if (!runtimeUrl) {
    throw new Error('Unable to get ACTIONS_RUNTIME_URL env variable')
  }
  return runtimeUrl
}

function getWorkFlowRunId(): string {
  const workFlowRunId = process.env['GITHUB_RUN_ID']
  if (!workFlowRunId) {
    throw new Error('Unable to get GITHUB_RUN_ID env variable')
  }
  return workFlowRunId
}

function getApiVersion(): string {
  return '6.0-preview'
}

function getArtifactUrl(): string {
  const artifactUrl = `${getRuntimeUrl()}_apis/pipelines/workflows/${getWorkFlowRunId()}/artifacts?api-version=${getApiVersion()}`
  return artifactUrl
}

// async function listArtifacts(): Promise<ListArtifactsResponse> {
// const artifactUrl = getArtifactUrl()

// use the first client from the httpManager, `keep-alive` is not used so the connection will close immediately
// const client = this.downloadHttpManager.getClient(0)
// const headers = getDownloadHeaders('application/json')
// const response = await retryHttpClientRequest('List Artifacts', async () =>
//   client.get(artifactUrl, headers),
// )
// const body: string = await response.readBody()
// return JSON.parse(body)
// }
