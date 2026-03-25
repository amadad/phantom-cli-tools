import { createRuntime } from '../runtime/runtime'
import { getSocialAuthReport } from '../publish/social'

function parseFlag(args: string[], name: string): string | undefined {
  const index = args.indexOf(name)
  if (index === -1) return undefined
  return args[index + 1]
}

export function runOpsCommand(args: string[], root?: string): unknown {
  const [subcommand, nested] = args
  const runtime = createRuntime({ root })

  if (subcommand === 'health') {
    return runtime.health()
  }

  if (subcommand === 'auth' && nested === 'check') {
    const brand = parseFlag(args, '--brand')
    if (!brand) {
      throw new Error('Usage: ops auth check --brand <id>')
    }
    return getSocialAuthReport(brand)
  }

  if (subcommand === 'auth' && nested === 'refresh') {
    return { auth: 'not_configured', note: 'Token refresh is not restored yet. Current runtime reads existing env credentials.' }
  }

  if (subcommand === 'migrate') {
    return runtime.health()
  }

  throw new Error('Usage: ops <health|auth check|auth refresh|migrate>')
}
