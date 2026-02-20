/**
 * Poster command - Generate final platform posters from image + headline
 *
 * Usage:
 *   poster <brand> --image <path> --headline "<text>" [--no-logo] [--json]
 */

import { readFileSync, existsSync, writeFileSync } from 'fs'
import { getBrandDir, join, slugify, createSessionDir } from '../core/paths'
import { extractBrandTopic } from '../cli/args'
import { generatePoster } from '../composite/poster'
import type { AspectRatio } from '../composite/renderer/render'
import { loadBrandVisual } from '../core/visual'
import type { CommandContext } from '../cli/types'

export interface PosterCommandResult {
  outputs: Record<string, string>
  logoUsed: boolean
  outputDir: string
}

/** Platform → aspect ratio mapping */
const PLATFORM_RATIOS: Record<string, AspectRatio> = {
  twitter: 'landscape',
  instagram: 'portrait',
  story: 'story',
}

export async function run(args: string[], _ctx?: CommandContext): Promise<PosterCommandResult> {
  const parsed = extractBrandTopic(args, ['image', 'headline'])
  const brand = parsed.brand
  const imagePath = parsed.flags.image
  const headline = parsed.flags.headline
  const noLogo = parsed.booleans.has('no-logo')
  const noImage = parsed.booleans.has('no-image')

  if (!noImage && !imagePath) throw new Error('Missing --image (or use --no-image for type-only). Usage: poster <brand> --image <path> --headline "<text>"')
  if (!headline) throw new Error('Missing --headline. Usage: poster <brand> --image <path> --headline "<text>"')
  if (imagePath && !existsSync(imagePath)) throw new Error(`Image not found: ${imagePath}`)

  console.log(`[poster] Brand: ${brand}${noImage ? ' (type-only)' : ''}`)
  console.log(`[poster] Headline: "${headline.slice(0, 50)}${headline.length > 50 ? '...' : ''}"`)

  const contentImage = (!noImage && imagePath) ? readFileSync(imagePath) : undefined
  const outputDir = createSessionDir(`poster-${slugify(headline, 30)}`)

  const outputs = await generateFinals(brand, headline, contentImage, { noLogo, outputDir, topic: headline })
  const visual = loadBrandVisual(brand)
  const logoUsed = !noLogo && [visual.logo.dark, visual.logo.light].some((path): path is string => !!path && existsSync(path))
  return { outputs, logoUsed, outputDir }
}

/**
 * Self-contained poster generation. Takes brand name, does all setup internally.
 * Used by both `poster` command and `explore`.
 */
export async function generateFinals(
  brandName: string,
  headline: string,
  contentImage: Buffer | undefined,
  opts: { noLogo?: boolean; outputDir: string; topic?: string; seed?: string }
): Promise<Record<string, string>> {
  const { noLogo = false, outputDir, topic, seed } = opts

  const outputs: Record<string, string> = {}

  for (const [platform, ratio] of Object.entries(PLATFORM_RATIOS)) {
    try {
      const poster = await generatePoster({
        brand: brandName,
        headline,
        contentImage,
        ratio,
        noLogo,
        topic,
        seed,
      })
      const outPath = join(outputDir, `${platform}.png`)
      writeFileSync(outPath, poster)
      outputs[platform] = outPath
      console.log(`  OK ${platform}.png${noLogo ? ' (no logo)' : ''}`)
    } catch (e: unknown) {
      console.log(`  FAIL ${platform}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return outputs
}
