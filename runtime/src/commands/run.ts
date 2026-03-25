import { createRuntime } from '../runtime/runtime'

function parseWorkflowInput(args: string[]): Record<string, unknown> {
  const input: Record<string, unknown> = {}
  let i = 0

  while (i < args.length) {
    const arg = args[i]
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const next = args[i + 1]
      if (next && !next.startsWith('--')) {
        input[key] = next
        i += 2
      } else {
        input[key] = true
        i += 1
      }
      continue
    }

    i += 1
  }

  return input
}

export async function runWorkflowCommand(args: string[], root?: string): Promise<unknown> {
  const [workflow, ...rest] = args
  if (!workflow) {
    throw new Error('Usage: run <workflow> --brand <id> [--topic "..."]')
  }

  const input = parseWorkflowInput(rest)
  const brand = typeof input.brand === 'string' ? input.brand : undefined
  if (!brand) {
    throw new Error('Usage: run <workflow> --brand <id> [--topic "..."]')
  }

  delete input.brand
  const runtime = createRuntime({ root })
  return await runtime.runWorkflow({
    workflow: workflow as Parameters<typeof runtime.runWorkflow>[0]['workflow'],
    brand,
    input,
  })
}

