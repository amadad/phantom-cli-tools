import { createRuntime } from '../runtime/runtime'

export function runPublishCommand(args: string[], root?: string): unknown {
  const [runId] = args
  if (!runId) {
    throw new Error('Usage: publish <run_id>')
  }

  const runtime = createRuntime({ root })
  return runtime.publishRun(runId)
}
