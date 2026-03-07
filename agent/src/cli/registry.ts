import { CliError, ExitCode } from './errors'
import type { CommandDefinition } from './types'

function requireEnv(name: string): void {
  if (!process.env[name]) {
    throw new CliError(`${name} not set`, 'missing_env', ExitCode.Config, { env: name })
  }
}

export const commands: CommandDefinition[] = [
  {
    name: 'copy',
    summary: 'Generate platform copy for a topic',
    usage: 'copy <brand> "<topic>" [options]',
    acceptsBrand: true,
    examples: ['phantom copy <brand> "caregiver burnout"', 'phantom copy <brand> "topic" --json'],
    preflight: () => requireEnv('GEMINI_API_KEY'),
    run: async (args: string[], ctx) => {
      const { run } = await import('../commands/copy-cmd')
      return run(args, ctx)
    }
  },
  {
    name: 'image',
    aliases: ['img'],
    summary: 'Generate a brand-consistent image for a topic',
    usage: 'image <brand> "<topic>" [options]',
    acceptsBrand: true,
    options: [
      { flag: '--pro', description: 'Use Gemini 3 Pro model' },
      { flag: '--quick', description: 'Skip moodboard selection' },
      { flag: '--volume <name>', description: 'Apply design zone overrides' },
    ],
    examples: ['phantom image <brand> "topic" --quick', 'phantom image <brand> "topic" --json'],
    preflight: () => requireEnv('GEMINI_API_KEY'),
    run: async (args: string[], ctx) => {
      const { run } = await import('../commands/image-cmd')
      return run(args, ctx)
    }
  },
  {
    name: 'poster',
    aliases: ['finals'],
    summary: 'Generate platform posters from image + headline',
    usage: 'poster <brand> --image <path> --headline "<text>" [options]',
    acceptsBrand: true,
    options: [
      { flag: '--image <path>', description: 'Path to content image' },
      { flag: '--headline "<text>"', description: 'Headline text for overlay' },
      { flag: '--volume <name>', description: 'Apply design zone overrides' },
      { flag: '--no-logo', description: 'Disable logo on posters' }
    ],
    examples: ['phantom poster <brand> --image ./selected.png --headline "Your brain is running 20 tabs"'],
    run: async (args: string[], ctx) => {
      const { run } = await import('../commands/poster-cmd')
      return run(args, ctx)
    }
  },
  {
    name: 'explore',
    aliases: ['gen', 'generate'],
    summary: 'Generate copy + image + poster + enqueue',
    usage: 'explore <brand> "<topic>" [options]',
    acceptsBrand: true,
    options: [
      { flag: '--pro', description: 'Use Gemini 3 Pro model' },
      { flag: '--quick', description: 'Skip moodboard selection' },
      { flag: '--volume <name>', description: 'Apply design zone overrides' },
      { flag: '--no-logo', description: 'Disable logo on posters' }
    ],
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
    name: 'enqueue',
    summary: 'Add generated content to the brand queue',
    usage: 'enqueue <brand> --topic "<topic>" --copy <path> --image <path>',
    acceptsBrand: true,
    options: [
      { flag: '--topic "<topic>"', description: 'Content topic' },
      { flag: '--copy <path>', description: 'Path to copy.json or copy.md' },
      { flag: '--image <path>', description: 'Path to content image' },
      { flag: '--poster-dir <path>', description: 'Directory with platform posters' },
      { flag: '--notify', description: 'Post to #content-queue on Discord with image' }
    ],
    examples: [
      'phantom enqueue <brand> --topic "burnout" --copy ./copy.json --image ./selected.png'
    ],
    run: async (args: string[], ctx) => {
      const { run } = await import('../commands/enqueue-cmd')
      return run(args, ctx)
    }
  },
  {
    name: 'post',
    aliases: ['publish'],
    summary: 'Post queued content to platforms',
    usage: 'post <brand> [options]',
    acceptsBrand: true,
    options: [
      { flag: '--platforms=twitter,linkedin', description: 'Comma-separated platform list' },
      { flag: '--all', description: 'Post to all available platforms' },
      { flag: '--id=<id>', description: 'Post a specific queue item' },
      { flag: '--dry-run', description: 'Preview what would be posted' }
    ],
    examples: ['phantom post <brand> --dry-run', 'phantom post <brand> --all'],
    run: async (args: string[], ctx) => {
      const { run } = await import('../commands/post')
      return run(args, ctx)
    }
  },
  {
    name: 'queue',
    aliases: ['q'],
    summary: 'Inspect and manage queued content items',
    usage: 'queue [list|show|notify|archive] [brand]',
    options: [
      { flag: 'list', description: 'List queue items (default)' },
      { flag: 'show <id>', description: 'Show a specific queue item' },
      { flag: 'notify <id> <brand>', description: 'Re-post item to #content-queue with image' },
      { flag: 'archive <brand>', description: 'Archive done/failed items older than 30 days' }
    ],
    examples: ['phantom queue', 'phantom queue list <brand>', 'phantom queue show gen_1234'],
    run: async (args: string[], ctx) => {
      const { run } = await import('../commands/queue')
      return run(args, ctx)
    }
  },
  {
    name: 'token',
    aliases: ['tokens'],
    summary: 'Check and refresh OAuth tokens',
    usage: 'token [check|refresh] [brand] [options]',
    options: [
      { flag: 'check', description: 'Check all token statuses (default)' },
      { flag: 'refresh', description: 'Refresh expiring tokens' },
      { flag: '--all', description: 'Force refresh all refreshable tokens' }
    ],
    examples: ['phantom token check', 'phantom token refresh givecare', 'phantom token refresh --all'],
    run: async (args: string[], ctx) => {
      const { run } = await import('../commands/token')
      return run(args, ctx)
    }
  },
  {
    name: 'brand',
    summary: 'Create or manage brand scaffolding',
    usage: 'brand init <name>',
    options: [
      { flag: 'init <name>', description: 'Create a new brand from the template' }
    ],
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
