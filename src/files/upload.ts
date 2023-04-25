import { create } from '@actions/artifact'
import * as core from '@actions/core'
import { findFilesToUpload } from './search'

export type UploadAttachmentsOptions = {
  retentionDays?: number
}

export async function uploadAttachments(
  searchPath: string,
  { retentionDays }: UploadAttachmentsOptions = {},
): Promise<void> {
  try {
    // eslint-disable-next-line no-console
    console.log('uploadAttachment', searchPath)

    const searchResult = await findFilesToUpload(searchPath)
    if (searchResult.filesToUpload.length === 0) {
      core.warning(`No files were found with the provided path: ${searchPath}.`)
    } else {
      const s = searchResult.filesToUpload.length === 1 ? '' : 's'
      core.info(
        `With the provided path, there will be ${searchResult.filesToUpload.length} file${s} uploaded`,
      )
      core.debug(`Root artifact directory is ${searchResult.rootDirectory}`)

      if (searchResult.filesToUpload.length > 10000) {
        core.warning(
          `There are over 10,000 files in this artifact, consider creating an archive before upload to improve the upload performance.`,
        )
      }

      const artifactClient = create()

      const artifactName = 'TEST_ARTIFACT'

      const uploadResponse = await artifactClient.uploadArtifact(
        artifactName,
        searchResult.filesToUpload,
        searchResult.rootDirectory,
        { retentionDays, continueOnError: false },
      )

      // eslint-disable-next-line no-console
      console.log(JSON.stringify(uploadResponse, null, 2))

      if (uploadResponse.failedItems.length > 0) {
        core.setFailed(
          `An error was encountered when uploading ${uploadResponse.artifactName}. There were ${uploadResponse.failedItems.length} items that failed to upload.`,
        )
      } else {
        core.info(`Artifact ${uploadResponse.artifactName} has been successfully uploaded!`)
      }
    }
  } catch (error) {
    core.setFailed((error as Error).message)
  }
}
