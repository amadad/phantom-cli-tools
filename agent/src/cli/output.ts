import { format } from 'node:util'
import type { FlagDefinition, GlobalFlags } from './flags'
import type { CommandDefinition, Output } from './types'

const INDENT = '  '

function writeStdout(message: string): void {
  process.stdout.write(`${message}\n`)
}

function writeStderr(message: string): void {
  process.stderr.write(`${message}\n`)
}

export function createOutput(flags: GlobalFlags): Output {
  const muteStandard = flags.quiet || flags.json

  return {
    print(message: string) {
      if (muteStandard) return
      writeStdout(message)
    },
    info(message: string) {
      if (muteStandard) return
      writeStdout(message)
    },
    warn(message: string) {
      if (muteStandard) return
      writeStderr(message)
    },
    error(message: string) {
      if (flags.json) return
      writeStderr(message)
    },
    json(data: unknown) {
      writeStdout(JSON.stringify(data, null, 2))
    }
  }
}

export function createConsoleOutput(): Output {
  return {
    print(message: string) {
      console.log(message)
    },
    info(message: string) {
      console.log(message)
    },
    warn(message: string) {
      console.warn(message)
    },
    error(message: string) {
      console.error(message)
    },
    json(data: unknown) {
      console.log(JSON.stringify(data, null, 2))
    }
  }
}

export function overrideConsole(output: Output): () => void {
  const original = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error
  }

  console.log = (...args: unknown[]) => output.print(format(...args))
  console.info = (...args: unknown[]) => output.info(format(...args))
  console.warn = (...args: unknown[]) => output.warn(format(...args))
  console.error = (...args: unknown[]) => output.error(format(...args))

  return () => {
    console.log = original.log
    console.info = original.info
    console.warn = original.warn
    console.error = original.error
  }
}

export function formatGlobalHelp(commands: CommandDefinition[], flags: FlagDefinition[]): string {
  const lines: string[] = []
  lines.push('Phantom Loom CLI')
  lines.push('')
  lines.push('Usage:')
  lines.push(`${INDENT}phantom <command> [options]`)
  lines.push('')
  lines.push('Commands:')

  const sorted = [...commands].sort((a, b) => a.name.localeCompare(b.name))
  const nameWidth = Math.max(...sorted.map((command) => formatCommandName(command).length), 8)

  for (const command of sorted) {
    const name = formatCommandName(command).padEnd(nameWidth)
    lines.push(`${INDENT}${name} ${command.summary}`)
  }

  lines.push('')
  lines.push('Global Options:')
  const flagWidth = Math.max(...flags.map((flag) => formatFlagName(flag).length), 10)
  for (const flag of flags) {
    const flagName = formatFlagName(flag).padEnd(flagWidth)
    lines.push(`${INDENT}${flagName} ${flag.description}`)
  }

  lines.push('')
  lines.push('Run "phantom <command> --help" for command-specific options.')

  return lines.join('\n')
}

export function formatCommandHelp(command: CommandDefinition): string {
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
    const width = Math.max(...command.options.map((option) => option.flag.length), 10)
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
  if (!command.aliases || command.aliases.length === 0) {
    return command.name
  }

  return `${command.name} (${command.aliases.join(', ')})`
}

function formatFlagName(flag: FlagDefinition): string {
  return flag.alias ? `${flag.name}, ${flag.alias}` : flag.name
}
