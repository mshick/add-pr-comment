import * as core from '@actions/core'
import { format } from 'date-fns'

const NOW_PATTERN = /%NOW(?::([^%]+))?%/g

export function replaceTemplateVariables(message: string): string {
  if (!message) return message

  const now = new Date()

  return message.replace(NOW_PATTERN, (match, formatStr?: string) => {
    if (!formatStr) {
      return now.toISOString()
    }

    try {
      return format(now, formatStr)
    } catch {
      core.warning(`Invalid date format in template: "${formatStr}", leaving as-is`)
      return match
    }
  })
}
