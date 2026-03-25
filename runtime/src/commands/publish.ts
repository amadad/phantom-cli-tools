import { createRuntime } from '../runtime/runtime'
import type { SocialPlatform } from '../domain/types'

function parsePublishArgs(args: string[]): { runId?: string; dryRun?: boolean; platforms?: SocialPlatform[] } {
  const [runId, ...rest] = args
  let dryRun = false
  let platforms: SocialPlatform[] | undefined

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index]
    if (arg === '--dry-run') {
      dryRun = true
      continue
    }

    if (arg === '--platforms') {
      const value = rest[index + 1]
      if (!value) {
        throw new Error('Usage: publish <run_id> [--platforms twitter,linkedin] [--dry-run]')
      }
      platforms = value.split(',').map((item) => item.trim()).filter(Boolean) as SocialPlatform[]
      index += 1
    }
  }

  return { runId, dryRun, platforms }
}

export async function runPublishCommand(args: string[], root?: string): Promise<unknown> {
  const { runId, dryRun, platforms } = parsePublishArgs(args)
  if (!runId) {
    throw new Error('Usage: publish <run_id> [--platforms twitter,linkedin] [--dry-run]')
  }

  const runtime = createRuntime({ root })
  return runtime.publishRun(runId, { dryRun, platforms })
}
