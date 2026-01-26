import { CliError, ExitCode } from './errors'
import type { CommandDefinition, CommandOption } from './types'

function requireEnv(name: string): void {
  if (!process.env[name]) {
    throw new CliError(`${name} not set`, 'missing_env', ExitCode.Config, { env: name })
  }
}

function commandOptions(options: CommandOption[]): CommandOption[] {
  return options
}

export const commands: CommandDefinition[] = [
  {
    name: 'intel',
    summary: 'Run intelligence pipeline (enrich → detect → extract)',
    usage: 'intel <brand> [options]',
    acceptsBrand: true,
    options: commandOptions([
      { flag: '--skip-enrich', description: 'Skip Apify enrichment' },
      { flag: '--skip-detect', description: 'Skip outlier detection' },
      { flag: '--skip-extract', description: 'Skip hook extraction' },
      { flag: '--dry-run', description: 'Show what would be done' }
    ]),
    examples: ['phantom intel <brand>', 'phantom intel <brand> --skip-enrich'],
    run: async (args: string[], ctx) => {
      const { run } = await import('../commands/intel')
      return run(args, ctx)
    }
  },
  {
    name: 'explore',
    aliases: ['gen', 'generate'],
    summary: 'Generate copy + images for a topic',
    usage: 'explore <brand> "<topic>" [options]',
    acceptsBrand: true,
    options: commandOptions([
      { flag: '--pro', description: 'Use Gemini 3 Pro model' },
      { flag: '--quick', description: 'Skip moodboard selection' },
      { flag: '--style <name>', description: 'Force specific style' },
      { flag: '--no-logo', description: 'Disable logo on posters' }
    ]),
    examples: [
      'phantom explore <brand> "topic"',
      'phantom explore <brand> "topic" --quick'
    ],
    preflight: () => requireEnv('GEMINI_API_KEY'),
    run: async (args: string[], ctx) => {
      const { run } = await import('../commands/explore')
      return run(args, ctx)
    }
  },
  {
    name: 'video',
    aliases: ['short'],
    summary: '[experimental] Generate a short-form video from a brief',
    usage: 'video <brand> <brief> [options]',
    acceptsBrand: true,
    options: commandOptions([
      { flag: '--dry-run', description: 'Show what would be generated' },
      { flag: '--skip-audio', description: 'Generate without voice audio' },
      { flag: '--provider=<name>', description: 'Video provider (replicate, runway, luma)' }
    ]),
    examples: ['phantom video <brand> briefs/example.yml'],
    preflight: () => {
      requireEnv('REPLICATE_API_TOKEN')
      console.warn('\n⚠️  Video generation is experimental and may not work as expected.')
      console.warn('   Required: REPLICATE_API_TOKEN, CARTESIA_API_KEY\n')
    },
    run: async (args: string[], ctx) => {
      const { run } = await import('../commands/video')
      return run(args, ctx)
    }
  },
  {
    name: 'post',
    aliases: ['publish'],
    summary: 'Post queued content to platforms',
    usage: 'post <brand> [options]',
    acceptsBrand: true,
    options: commandOptions([
      { flag: '--platforms=twitter,linkedin', description: 'Comma-separated platform list' },
      { flag: '--all', description: 'Post to all available platforms' },
      { flag: '--id=<id>', description: 'Post a specific queue item' },
      { flag: '--dry-run', description: 'Preview what would be posted' }
    ]),
    examples: ['phantom post <brand> --dry-run', 'phantom post <brand> --all'],
    run: async (args: string[], ctx) => {
      const { run } = await import('../commands/post')
      return run(args, ctx)
    }
  },
  {
    name: 'queue',
    aliases: ['q'],
    summary: 'Inspect queued content items',
    usage: 'queue [list|show <id>] [brand]',
    options: commandOptions([
      { flag: 'list', description: 'List queue items (default)' },
      { flag: 'show <id>', description: 'Show a specific queue item' }
    ]),
    examples: ['phantom queue', 'phantom queue list <brand>', 'phantom queue show gen_1234'],
    run: async (args: string[], ctx) => {
      const { run } = await import('../commands/queue')
      return run(args, ctx)
    }
  },
  {
    name: 'grade',
    aliases: ['eval'],
    summary: 'Score content against the brand rubric',
    usage: 'grade <brand> "<text>"',
    acceptsBrand: true,
    examples: ['phantom grade <brand> "text to evaluate"'],
    preflight: () => requireEnv('GEMINI_API_KEY'),
    run: async (args: string[], ctx) => {
      const { run } = await import('../eval/grader')
      return run(args, ctx)
    }
  },
  {
    name: 'learn',
    aliases: ['learnings'],
    summary: 'Aggregate eval log into learnings.json',
    usage: 'learn <brand>',
    acceptsBrand: true,
    examples: ['phantom learn <brand>'],
    run: async (args: string[], ctx) => {
      const { run } = await import('../eval/learnings')
      return run(args, ctx)
    }
  },
  {
    name: 'brand',
    summary: 'Create or manage brand scaffolding',
    usage: 'brand init <name>',
    options: commandOptions([
      { flag: 'init <name>', description: 'Create a new brand from the template' }
    ]),
    examples: ['phantom brand init newbrand'],
    run: async (args: string[], ctx) => {
      const { run } = await import('../commands/brand')
      return run(args, ctx)
    }
  }
]

export function findCommand(name: string): CommandDefinition | undefined {
  const lower = name.toLowerCase()
  return commands.find((command) =>
    command.name === lower || command.aliases?.includes(lower)
  )
}

export function listCommands(): CommandDefinition[] {
  return commands
}
