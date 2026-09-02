import { createRuntime } from '../runtime/runtime'

export function runOpsCommand(args: string[], root?: string): unknown {
  const [subcommand, nested] = args
  const runtime = createRuntime({ root })

  if (subcommand === 'health') {
    return runtime.health()
  }

  if (subcommand === 'auth' && nested === 'check') {
    return { auth: 'not_configured', note: 'Auth adapters are not scaffolded yet.' }
  }

  if (subcommand === 'auth' && nested === 'refresh') {
    return { auth: 'not_configured', note: 'Auth refresh is not scaffolded yet.' }
  }

  if (subcommand === 'migrate') {
    return runtime.health()
  }

  throw new Error('Usage: ops <health|auth check|auth refresh|migrate>')
}
