import { discoverBrands } from '../core/paths'
import { handleCliError, CliError, ExitCode } from './errors'
import { findCommand, listCommands } from './registry'
import type { CommandDefinition, CommandContext, GlobalFlags } from './types'

interface ParsedArgs {
  command?: string
  commandArgs: string[]
  flags: GlobalFlags
}

function parseGlobalArgs(argv: string[]): ParsedArgs {
  const flags: GlobalFlags = {
    help: false,
    json: false,
    quiet: false,
    brand: undefined
  }

  const remaining: string[] = []

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]

    if (arg === '--') {
      remaining.push(...argv.slice(i + 1))
      break
    }
    if (arg === '--help' || arg === '-h') { flags.help = true; continue }
    if (arg === '--json') { flags.json = true; continue }
    if (arg === '--quiet' || arg === '-q') { flags.quiet = true; continue }
    if (arg === '--brand') {
      const value = argv[i + 1]
      if (value && !value.startsWith('-')) { flags.brand = value; i += 1; continue }
    }
    if (arg.startsWith('--brand=')) { flags.brand = arg.slice('--brand='.length); continue }

    remaining.push(arg)
  }

  return { command: remaining[0], commandArgs: remaining.slice(1), flags }
}

const INDENT = '  '

const globalFlagDefs = [
  { name: '--help, -h', description: 'Show help output' },
  { name: '--json', description: 'Emit machine-readable JSON' },
  { name: '--quiet, -q', description: 'Suppress non-error output' },
  { name: '--brand <name>', description: 'Default brand for commands that accept it' }
]

function formatGlobalHelp(commands: CommandDefinition[]): string {
  const lines: string[] = []
  lines.push('Phantom Loom CLI')
  lines.push('')
  lines.push('Usage:')
  lines.push(`${INDENT}phantom <command> [options]`)
  lines.push('')
  lines.push('Commands:')

  const sorted = [...commands].sort((a, b) => a.name.localeCompare(b.name))
  const nameWidth = Math.max(...sorted.map((c) => formatCommandName(c).length), 8)

  for (const command of sorted) {
    const name = formatCommandName(command).padEnd(nameWidth)
    lines.push(`${INDENT}${name} ${command.summary}`)
  }

  lines.push('')
  lines.push('Global Options:')
  const flagWidth = Math.max(...globalFlagDefs.map((f) => f.name.length), 10)
  for (const flag of globalFlagDefs) {
    lines.push(`${INDENT}${flag.name.padEnd(flagWidth)} ${flag.description}`)
  }

  lines.push('')
  lines.push('Run "phantom <command> --help" for command-specific options.')

  return lines.join('\n')
}

function formatCommandHelp(command: CommandDefinition): string {
  const lines: string[] = []
  lines.push(`Command: ${command.name}`)
  lines.push(command.summary)
  lines.push('')
  lines.push('Usage:')
  lines.push(`${INDENT}phantom ${command.usage}`)

  if (command.aliases && command.aliases.length > 0) {
    lines.push('')
    lines.push(`Aliases: ${command.aliases.join(', ')}`)
  }

  if (command.options && command.options.length > 0) {
    lines.push('')
    lines.push('Options:')
    const width = Math.max(...command.options.map((o) => o.flag.length), 10)
    for (const option of command.options) {
      lines.push(`${INDENT}${option.flag.padEnd(width)} ${option.description}`)
    }
  }

  if (command.examples && command.examples.length > 0) {
    lines.push('')
    lines.push('Examples:')
    for (const example of command.examples) {
      lines.push(`${INDENT}${example}`)
    }
  }

  return lines.join('\n')
}

function formatCommandName(command: CommandDefinition): string {
  if (!command.aliases || command.aliases.length === 0) return command.name
  return `${command.name} (${command.aliases.join(', ')})`
}

function printResult(data: unknown, json: boolean): void {
  if (json) {
    process.stdout.write(JSON.stringify(data, null, 2) + '\n')
  }
}

export async function runCli(argv: string[] = process.argv.slice(2)): Promise<void> {
  const parsed = parseGlobalArgs(argv)

  try {
    const { command, commandArgs, flags } = parsed
    const commands = listCommands()

    if (!command || command === 'help') {
      const topic = command === 'help' ? commandArgs[0] : undefined
      if (topic) {
        const target = findCommand(topic)
        if (!target) {
          throw new CliError(`Unknown command: ${topic}`, 'unknown_command', ExitCode.Usage)
        }
        const helpText = formatCommandHelp(target)
        if (flags.json) {
          printResult({ status: 'ok', command: 'help', data: { topic: target.name, help: helpText } }, true)
        } else {
          console.log(helpText)
        }
        return
      }

      const helpText = formatGlobalHelp(commands)
      if (flags.json) {
        printResult({ status: 'ok', command: 'help', data: { help: helpText } }, true)
      } else {
        console.log(helpText)
      }
      return
    }

    const definition = findCommand(command)
    if (!definition) {
      throw new CliError(`Unknown command: ${command}`, 'unknown_command', ExitCode.Usage)
    }

    if (flags.help) {
      const helpText = formatCommandHelp(definition)
      if (flags.json) {
        printResult({ status: 'ok', command: 'help', data: { topic: definition.name, help: helpText } }, true)
      } else {
        console.log(helpText)
      }
      return
    }

    const args = applyBrandFlag(definition, commandArgs, flags.brand)
    const context: CommandContext = { flags }

    if (definition.preflight) {
      definition.preflight(context)
    }

    const data = await definition.run(args, context)

    if (flags.json && data !== undefined) {
      printResult({ status: 'ok', command: definition.name, data }, true)
    }
  } catch (error) {
    handleCliError(error, parsed.command, parsed.flags.json)
  }
}

function applyBrandFlag(
  command: CommandDefinition,
  args: string[],
  brand?: string
): string[] {
  if (!brand || !command.acceptsBrand) {
    return args
  }

  const brands = discoverBrands()
  const hasBrand = args.some((arg) => brands.includes(arg))

  if (hasBrand) {
    return args
  }

  return [brand, ...args]
}
