export interface GlobalFlags {
  help: boolean
  json: boolean
  quiet: boolean
  verbose: boolean
  brand?: string
}

export interface ParsedArgs {
  command?: string
  commandArgs: string[]
  flags: GlobalFlags
}

export interface FlagDefinition {
  name: string
  alias?: string
  type: 'boolean' | 'string'
  description: string
}

const globalFlags: FlagDefinition[] = [
  {
    name: '--help',
    alias: '-h',
    type: 'boolean',
    description: 'Show help output'
  },
  {
    name: '--json',
    type: 'boolean',
    description: 'Emit machine-readable JSON'
  },
  {
    name: '--quiet',
    alias: '-q',
    type: 'boolean',
    description: 'Suppress non-error output'
  },
  {
    name: '--verbose',
    alias: '-v',
    type: 'boolean',
    description: 'Show additional diagnostics'
  },
  {
    name: '--brand',
    type: 'string',
    description: 'Default brand for commands that accept it'
  }
]

export function getGlobalFlags(): FlagDefinition[] {
  return globalFlags
}

export function parseArgs(argv: string[]): ParsedArgs {
  const flags: GlobalFlags = {
    help: false,
    json: false,
    quiet: false,
    verbose: false,
    brand: undefined
  }

  const remaining: string[] = []

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]

    if (arg === '--') {
      remaining.push(...argv.slice(i + 1))
      break
    }

    if (arg === '--help' || arg === '-h') {
      flags.help = true
      continue
    }

    if (arg === '--json') {
      flags.json = true
      continue
    }

    if (arg === '--quiet' || arg === '-q') {
      flags.quiet = true
      continue
    }

    if (arg === '--verbose' || arg === '-v') {
      flags.verbose = true
      continue
    }

    if (arg === '--brand') {
      const value = argv[i + 1]
      if (value && !value.startsWith('-')) {
        flags.brand = value
        i += 1
        continue
      }
    }

    if (arg.startsWith('--brand=')) {
      flags.brand = arg.slice('--brand='.length)
      continue
    }

    remaining.push(arg)
  }

  const command = remaining[0]
  const commandArgs = remaining.slice(1)

  return { command, commandArgs, flags }
}
