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
      { flag: '--no-logo', description: 'Disable logo on posters' },
      { flag: '--nano', description: 'Use Nano Banana (Gemini native) single-shot poster generation' },
      { flag: '--pixel-sort', description: 'Apply pixel sort glitch effect as post-processing' }
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
      { flag: '--no-logo', description: 'Disable logo on posters' },
      { flag: '--nano', description: 'Use Nano Banana (Gemini native) single-shot poster generation' },
      { flag: '--pixel-sort', description: 'Apply pixel sort glitch effect as post-processing' },
      { flag: '--gradient [preset]', description: 'Use mesh gradient instead of AI image (presets: blush-silk, earthy-warm, neon-glow, etc.)' },
      { flag: '--texture [style]', description: 'Use p5.brush texture instead of AI image (styles: watercolor, crosshatch, brushstroke, stipple, mixed)' },
      { flag: '--layout <name>', description: 'Force a specific layout (split, overlay, type-only, card, full-bleed)' },
    ],
    examples: [
      'phantom explore <brand> "topic"',
      'phantom explore <brand> "topic" --quick --nano --pixel-sort',
      'phantom explore <brand> "topic" --gradient=blush-silk',
      'phantom explore <brand> "topic" --texture=watercolor',
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
    name: 'review',
    summary: 'Open a visual review gallery for generated posters',
    usage: 'review [dir|latest]',
    examples: ['phantom review latest', 'phantom review ./output/2026-03-09/topic-slug/'],
    run: async (args: string[], ctx) => {
      const { run } = await import('../commands/review')
      return run(args, ctx)
    }
  },
  {
    name: 'pixel-sort',
    aliases: ['sort', 'glitch'],
    summary: 'Apply pixel sort glitch effect to an image',
    usage: 'pixel-sort <input> [output] [options]',
    options: [
      { flag: '--threshold=<n>', description: 'Brightness threshold 0-1 (default: 0.3)' },
      { flag: '--streak=<n>', description: 'Max sorted segment length in px (default: 180)' },
      { flag: '--intensity=<n>', description: 'Blend factor 0-1 (default: 0.8)' },
      { flag: '--randomness=<n>', description: 'Segment jitter 0-1 (default: 0.3)' },
    ],
    examples: [
      'phantom pixel-sort ./image.png',
      'phantom pixel-sort ./image.png ./output.png --threshold=0.2 --streak=240',
    ],
    run: async (args: string[], ctx) => {
      const { run } = await import('../commands/pixel-sort-cmd')
      return run(args, ctx)
    }
  },
  {
    name: 'texture',
    aliases: ['tex', 'brush'],
    summary: 'Generate p5.brush textured backgrounds via Pinch Tab',
    usage: 'texture <brand> [--style=<name>] [--size=<WxH>] [--seed=<n>] [--density=<level>] [--out=<path>]',
    acceptsBrand: true,
    options: [
      { flag: '--style <name>', description: 'Texture style: editorial, expressive, architectural, gestural, layered (default: editorial)' },
      { flag: '--size <WxH>', description: 'Output size (default: 1200x675)' },
      { flag: '--seed <n>', description: 'Deterministic seed for reproducibility' },
      { flag: '--density <level>', description: 'Texture density: light, moderate, heavy (default: moderate)' },
      { flag: '--out <path>', description: 'Output file path' },
      { flag: '--list', description: 'List available styles' },
    ],
    examples: [
      'phantom texture givecare --style=watercolor',
      'phantom texture givecare --style=crosshatch --density=heavy',
      'phantom texture --list',
    ],
    run: async (args: string[], ctx) => {
      const { run } = await import('../commands/texture-cmd')
      return run(args, ctx)
    }
  },
  {
    name: 'gradient',
    aliases: ['grad', 'mesh'],
    summary: 'Generate mesh gradient background images',
    usage: 'gradient <brand> [--preset=<name>] [--size=<WxH>] [--seed=<n>] [--out=<path>]',
    acceptsBrand: true,
    options: [
      { flag: '--preset <name>', description: 'Gradient preset (default: blush-silk)' },
      { flag: '--size <WxH>', description: 'Output size (default: 1200x675)' },
      { flag: '--seed <n>', description: 'Deterministic seed for grain' },
      { flag: '--from-palette', description: 'Generate from brand palette colors' },
      { flag: '--out <path>', description: 'Output file path' },
      { flag: '--list', description: 'List available presets' },
    ],
    examples: [
      'phantom gradient givecare --preset=blush-silk',
      'phantom gradient givecare --from-palette --size=1080x1350',
      'phantom gradient --list',
    ],
    run: async (args: string[], ctx) => {
      const { run } = await import('../commands/gradient-cmd')
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
