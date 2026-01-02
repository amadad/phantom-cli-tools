#!/usr/bin/env npx tsx
/**
 * Phantom Loom CLI
 *
 * Commands:
 *   intel <brand>                Run intelligence pipeline (enrich → detect → extract)
 *   gen <brand> "<topic>"        Generate content (copy + image)
 *   post <brand>                 Post queued content to platforms
 *   queue                        Show queue status
 *
 * Examples:
 *   npx tsx src/cli.ts intel givecare
 *   npx tsx src/cli.ts gen givecare "caregiving burnout"
 *   npx tsx src/cli.ts post givecare --platforms=twitter,linkedin
 *   npx tsx src/cli.ts queue
 */

import { config } from 'dotenv'
import { join } from 'path'

// Load env from project root
config({ path: join(process.cwd(), '..', '.env') })

const args = process.argv.slice(2)
const command = args[0]
const commandArgs = args.slice(1)

function printUsage(): void {
  console.log(`
Phantom Loom CLI

Commands:
  intel <brand> [options]           Run intelligence pipeline
    --skip-enrich                   Skip Apify enrichment
    --skip-detect                   Skip outlier detection
    --skip-extract                  Skip hook extraction
    --dry-run                       Show what would be done

  gen <brand> "<topic>" [options]   Generate content
    --no-image                      Generate copy only
    --save-image                    Save image to output/

  post <brand> [options]            Post queued content
    --platforms=twitter,linkedin    Specific platforms
    --all                           Post to all available
    --id=<id>                       Post specific queue item
    --dry-run                       Show what would be posted

  queue [subcommand]                Queue management
    list                            List all items
    show <id>                       Show item details

Brands:
  givecare                          GiveCare brand
  scty                              SCTY brand

Environment:
  GEMINI_API_KEY                    Required for generation
  APIFY_API_TOKEN                   Required for intel enrichment
  TWITTER_<BRAND>_API_KEY           Twitter credentials
  LINKEDIN_<BRAND>_ACCESS_TOKEN     LinkedIn credentials

Examples:
  npx tsx src/cli.ts intel givecare
  npx tsx src/cli.ts intel givecare --skip-enrich
  npx tsx src/cli.ts gen givecare "caregiving burnout"
  npx tsx src/cli.ts gen givecare "self-care tips" --save-image
  npx tsx src/cli.ts post givecare --dry-run
  npx tsx src/cli.ts post givecare --platforms=twitter
  npx tsx src/cli.ts queue list
`)
}

async function main(): Promise<void> {
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printUsage()
    return
  }

  try {
    switch (command) {
      case 'intel': {
        const { run } = await import('./commands/intel')
        await run(commandArgs)
        break
      }

      case 'gen':
      case 'generate': {
        if (!process.env.GEMINI_API_KEY) {
          console.error('Error: GEMINI_API_KEY not set')
          process.exit(1)
        }
        const { run } = await import('./commands/gen')
        await run(commandArgs)
        break
      }

      case 'post':
      case 'publish': {
        const { run } = await import('./commands/post')
        await run(commandArgs)
        break
      }

      case 'queue':
      case 'q': {
        const { listQueue } = await import('./commands/post')
        listQueue()
        break
      }

      default:
        console.error(`Unknown command: ${command}`)
        console.log('Run with --help for usage')
        process.exit(1)
    }
  } catch (error: any) {
    console.error(`\nError: ${error.message}`)
    if (process.env.DEBUG) {
      console.error(error.stack)
    }
    process.exit(1)
  }
}

main()
