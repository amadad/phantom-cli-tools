import { createRuntime } from '../runtime/runtime'

export async function runRetryCommand(args: string[], root?: string): Promise<unknown> {
  const [runId, ...rest] = args
  if (!runId) {
    throw new Error('Usage: retry <run_id> [--from <step>]')
  }

  const fromIndex = rest.findIndex((arg) => arg === '--from')
  const fromStep = fromIndex > -1 ? rest[fromIndex + 1] : 'draft'
  const runtime = createRuntime({ root })
  return await runtime.retryRun(runId, {
    fromStep: fromStep as Parameters<typeof runtime.retryRun>[1]['fromStep'],
  })
}

