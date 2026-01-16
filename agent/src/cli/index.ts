import { discoverBrands } from '../core/paths'
import { parseArgs, getGlobalFlags } from './flags'
import { handleCliError, CliError, ExitCode } from './errors'
import { createOutput, formatCommandHelp, formatGlobalHelp, overrideConsole } from './output'
import { findCommand, listCommands } from './registry'
import type { CommandDefinition, CommandContext } from './types'
import type { CommandResult } from './schemas'

export async function runCli(argv: string[] = process.argv.slice(2)): Promise<void> {
  const parsed = parseArgs(argv)
  const output = createOutput(parsed.flags)
  const restoreConsole = overrideConsole(output)

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
          output.json({
            status: 'ok',
            command: 'help',
            data: { topic: target.name, help: helpText }
          })
        } else {
          output.print(helpText)
        }
        return
      }

      const helpText = formatGlobalHelp(commands, getGlobalFlags())
      if (flags.json) {
        output.json({
          status: 'ok',
          command: 'help',
          data: { help: helpText }
        })
      } else {
        output.print(helpText)
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
        output.json({
          status: 'ok',
          command: 'help',
          data: { topic: definition.name, help: helpText }
        })
      } else {
        output.print(helpText)
      }
      return
    }

    const args = applyBrandFlag(definition, commandArgs, flags.brand)
    const context: CommandContext = { flags, output }

    if (definition.preflight) {
      definition.preflight(context)
    }

    const data = await definition.run(args, context)

    if (flags.json) {
      const result: CommandResult = {
        status: 'ok',
        command: definition.name,
        data: data === undefined ? undefined : (data as CommandResult['data'])
      }
      output.json(result)
    }
  } catch (error) {
    handleCliError(error, output, parsed.command, parsed.flags.json)
  } finally {
    restoreConsole()
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
