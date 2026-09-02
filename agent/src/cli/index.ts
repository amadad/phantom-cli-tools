import { runBrandCommand } from '../commands/brand'
import { runInspectCommand } from '../commands/inspect'
import { runOpsCommand } from '../commands/ops'
import { runPublishCommand } from '../commands/publish'
import { runRetryCommand } from '../commands/retry'
import { runReviewCommand } from '../commands/review'
import { runWorkflowCommand } from '../commands/run'

function print(data: unknown, json: boolean): void {
  if (json) {
    process.stdout.write(`${JSON.stringify(data, null, 2)}\n`)
    return
  }

  if (typeof data === 'string') {
    console.log(data)
    return
  }

  console.log(JSON.stringify(data, null, 2))
}

function helpText(): string {
  return [
    'Loom Runtime CLI',
    '',
    'Usage:',
    '  loom <command> [options]',
    '',
    'Commands:',
    '  brand <init|show|validate> ...',
    '  run <workflow> --brand <id> ...',
    '  review <list|show|approve|reject> ...',
    '  publish <run_id>',
    '  inspect <run|artifact> ...',
    '  retry <run_id> [--from <step>]',
    '  ops <health|auth check|auth refresh|migrate>',
    '',
    'Workflows:',
    '  social.post',
    '  blog.post',
    '  outreach.touch',
    '  respond.reply',
  ].join('\n')
}

export async function runCli(argv: string[] = process.argv.slice(2)): Promise<void> {
  const json = argv.includes('--json')
  const filtered = argv.filter((arg) => arg !== '--json')
  const [command, ...args] = filtered

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    print({ status: 'ok', command: 'help', data: { help: helpText() } }, json)
    if (!json) {
      console.log(helpText())
    }
    return
  }

  let data: unknown
  switch (command) {
    case 'brand':
      data = runBrandCommand(args)
      break
    case 'run':
      data = runWorkflowCommand(args)
      break
    case 'review':
      data = runReviewCommand(args)
      break
    case 'publish':
      data = runPublishCommand(args)
      break
    case 'inspect':
      data = runInspectCommand(args)
      break
    case 'retry':
      data = runRetryCommand(args)
      break
    case 'ops':
      data = runOpsCommand(args)
      break
    default:
      throw new Error(`Unknown command: ${command}`)
  }

  if (json) {
    print({ status: 'ok', command, data }, true)
  } else {
    print(data, false)
  }
}
