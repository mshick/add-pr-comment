import { HttpClient } from '@actions/http-client'
import { BearerCredentialHandler } from '@actions/http-client/lib/auth'

/**
 * Used for managing http clients during either upload or download
 */
export class HttpManager {
  private clients: HttpClient[]
  private userAgent: string

  constructor(clientCount: number, userAgent: string) {
    if (clientCount < 1) {
      throw new Error('There must be at least one client')
    }
    this.userAgent = userAgent
    this.clients = new Array(clientCount).fill(createHttpClient(userAgent))
  }

  getClient(index: number): HttpClient {
    return this.clients[index]
  }

  // client disposal is necessary if a keep-alive connection is used to properly close the connection
  // for more information see: https://github.com/actions/http-client/blob/04e5ad73cd3fd1f5610a32116b0759eddf6570d2/index.ts#L292
  disposeAndReplaceClient(index: number): void {
    this.clients[index].dispose()
    this.clients[index] = createHttpClient(this.userAgent)
  }

  disposeAndReplaceAllClients(): void {
    for (const [index] of this.clients.entries()) {
      this.disposeAndReplaceClient(index)
    }
  }
}

export function getRuntimeToken(): string {
  const token = process.env['ACTIONS_RUNTIME_TOKEN']
  if (!token) {
    throw new Error('Unable to get ACTIONS_RUNTIME_TOKEN env variable')
  }
  return token
}

export function createHttpClient(userAgent: string): HttpClient {
  return new HttpClient(userAgent, [new BearerCredentialHandler(getRuntimeToken())])
}
