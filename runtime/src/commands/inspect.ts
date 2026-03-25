import { readFileSync } from 'fs'
import { createRuntime } from '../runtime/runtime'

export function runInspectCommand(args: string[], root?: string): unknown {
  const [subcommand, id] = args
  const runtime = createRuntime({ root })

  if (subcommand === 'run') {
    if (!id) throw new Error('Usage: inspect run <run_id>')
    return runtime.inspectRun(id)
  }

  if (subcommand === 'artifact') {
    if (!id) throw new Error('Usage: inspect artifact <artifact_path>')
    return JSON.parse(readFileSync(id, 'utf8')) as Record<string, unknown>
  }

  throw new Error('Usage: inspect <run|artifact> ...')
}

