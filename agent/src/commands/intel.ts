/**
 * Intel command - Run social intelligence pipeline
 *
 * Usage:
 *   intel <brand> [options]
 *
 * Options:
 *   --skip-enrich    Skip Apify enrichment (use cached data)
 *   --skip-detect    Skip outlier detection
 *   --skip-extract   Skip hook extraction
 *   --dry-run        Show what would be done without doing it
 */

import { runPipeline } from '../intel/pipeline'
import { getDefaultBrand } from '../core/paths'
import type { CommandContext } from '../cli/types'

export interface IntelOptions {
  brand: string
  skipEnrich?: boolean
  skipDetect?: boolean
  skipExtract?: boolean
  dryRun?: boolean
}

export async function intel(options: IntelOptions) {
  const { brand, skipEnrich, skipDetect, skipExtract, dryRun } = options

  const result = await runPipeline({
    brand,
    skipEnrich,
    skipDetect,
    skipExtract,
    includePosts: true,
    minMultiplier: 50,
    maxAgeDays: 7,
    dryRun
  })

  if (result.errors.length > 0) {
    process.exitCode = 1
  }

  return result
}

/**
 * Parse CLI args and run
 */
export async function run(
  args: string[],
  _ctx?: CommandContext
): Promise<import('../intel/pipeline').PipelineResult> {
  const brand = args.find(a => !a.startsWith('--')) || getDefaultBrand()

  return intel({
    brand,
    skipEnrich: args.includes('--skip-enrich'),
    skipDetect: args.includes('--skip-detect'),
    skipExtract: args.includes('--skip-extract'),
    dryRun: args.includes('--dry-run')
  })
}
