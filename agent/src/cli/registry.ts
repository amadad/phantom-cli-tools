import { CliError, ExitCode } from './errors'
import type { CommandDefinition } from './types'

function requireEnv(name: string): void {
  if (!process.env[name]) {
    throw new CliError(`${name} not set`, 'missing_env', ExitCode.Config, { env: name })
  }
}

export const commands: CommandDefinition[] = [
  {
    name: 'intel',
    summary: 'Run intelligence pipeline (enrich → detect → extract)',
    usage: 'intel <brand> [options]',
    acceptsBrand: true,
    options: [
      { flag: '--skip-enrich', description: 'Skip Apify enrichment' },
      { flag: '--skip-detect', description: 'Skip outlier detection' },
      { flag: '--skip-extract', description: 'Skip hook extraction' },
      { flag: '--dry-run', description: 'Show what would be done' }
    ],
    examples: ['phantom intel <brand>', 'phantom intel <brand> --skip-enrich'],
    run: async (args: string[], ctx) => {
      const { run } = await import('../commands/intel')
      return run(args, ctx)
    }
  },
  {
    name: 'copy',
    summary: 'Generate platform copy for a topic',
    usage: 'copy <brand> "<topic>" [options]',
    acceptsBrand: true,
    options: [
      { flag: '--hook "<pattern>"', description: 'Inject a specific hook pattern' }
    ],
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
      { flag: '--style <name>', description: 'Force specific style' }
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
      { flag: '--no-logo', description: 'Disable logo on posters' }
    ],
    examples: ['phantom poster <brand> --image ./selected.png --headline "Your brain is running 20 tabs"'],
    run: async (args: string[], ctx) => {
      const { run } = await import('../commands/poster-cmd')
      return run(args, ctx)
    }
  },
  {
    name: 'enqueue',
    summary: 'Add generated content to the brand queue',
    usage: 'enqueue <brand> --topic "<topic>" --copy <path> --image <path> [options]',
    acceptsBrand: true,
    options: [
      { flag: '--topic "<topic>"', description: 'Content topic' },
      { flag: '--copy <path>', description: 'Path to copy.json or copy.md' },
      { flag: '--image <path>', description: 'Path to content image' },
      { flag: '--poster-dir <path>', description: 'Directory with platform posters' },
      { flag: '--notify', description: 'Post to #content-queue on Discord with image' }
    ],
    examples: [
      'phantom enqueue <brand> --topic "burnout" --copy ./copy.json --image ./selected.png',
      'phantom enqueue <brand> --topic "burnout" --copy ./copy.json --image ./selected.png --notify'
    ],
    run: async (args: string[], ctx) => {
      const { run } = await import('../commands/enqueue-cmd')
      return run(args, ctx)
    }
  },
  {
    name: 'explore',
    aliases: ['gen', 'generate'],
    summary: 'Generate copy + images for a topic',
    usage: 'explore <brand> "<topic>" [options]',
    acceptsBrand: true,
    options: [
      { flag: '--pro', description: 'Use Gemini 3 Pro model' },
      { flag: '--quick', description: 'Skip moodboard selection' },
      { flag: '--style <name>', description: 'Force specific style' },
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
    name: 'video',
    aliases: ['short'],
    summary: '[experimental] Generate a short-form video from a brief',
    usage: 'video <brand> <brief> [options]',
    acceptsBrand: true,
    options: [
      { flag: '--dry-run', description: 'Show what would be generated' },
      { flag: '--skip-audio', description: 'Generate without voice audio' },
      { flag: '--provider=<name>', description: 'Video provider (replicate, runway, luma)' }
    ],
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
    summary: 'Inspect queued content items',
    usage: 'queue [list|show <id>] [brand]',
    options: [
      { flag: 'list', description: 'List queue items (default)' },
      { flag: 'show <id>', description: 'Show a specific queue item' },
      { flag: 'notify <id> <brand>', description: 'Re-post item to #content-queue with image' }
    ],
    examples: ['phantom queue', 'phantom queue list <brand>', 'phantom queue show gen_1234', 'phantom queue notify gen_1234 givecare'],
    run: async (args: string[], ctx) => {
      const { run } = await import('../commands/queue')
      return run(args, ctx)
    }
  },
  {
    name: 'moodboard',
    aliases: ['mood', 'grid'],
    summary: 'Generate a 3×3 image grid for fast visual selection',
    usage: 'moodboard <brand> "<topic>" [options]',
    acceptsBrand: true,
    options: [
      { flag: '--json', description: 'Output result as JSON' }
    ],
    examples: [
      'phantom moodboard givecare "caregiver burnout"',
      'phantom moodboard givecare "caregiver burnout" --json'
    ],
    preflight: () => requireEnv('GEMINI_API_KEY'),
    run: async (args: string[], ctx) => {
      const { run } = await import('../commands/moodboard-cmd')
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
  },
  {
    name: 'brief',
    summary: 'Generate a daily research digest for a brand',
    usage: 'brief <brand> [options]',
    acceptsBrand: true,
    options: [
      { flag: '--topic <text>', description: 'Focus on a specific subtopic' },
      { flag: '--channel', description: 'Post digest to Discord webhook' },
      { flag: '--dry-run', description: 'Skip saving/posting output' }
    ],
    examples: [
      'phantom brief givecare',
      'phantom brief givecare --topic "caregiver burnout"',
      'phantom brief givecare --channel'
    ],
    run: async (args: string[], ctx) => {
      const { run } = await import('../commands/brief')
      return run(args, ctx)
    }
  },
  {
    name: 'blog',
    summary: 'Generate a long-form blog post for a brand',
    usage: 'blog <brand> "<topic>" [options]',
    acceptsBrand: true,
    options: [
      { flag: '--publish', description: 'Write post to brand publish_path' },
      { flag: '--dry-run', description: 'Skip saving/publishing' }
    ],
    examples: [
      'phantom blog givecare "caregiver burnout"',
      'phantom blog givecare "caregiver burnout" --publish',
      'phantom blog givecare "caregiver burnout" --dry-run'
    ],
    preflight: () => requireEnv('GEMINI_API_KEY'),
    run: async (args: string[], ctx) => {
      const { run } = await import('../commands/blog')
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
