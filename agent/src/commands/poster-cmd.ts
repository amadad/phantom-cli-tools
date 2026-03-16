/**
 * Poster command - Generate final platform posters from image + headline
 *
 * Usage:
 *   poster <brand> --image <path> --headline "<text>" [--volume=<zone>] [--no-logo] [--json]
 */

import { readFileSync, existsSync, writeFileSync } from 'fs'
import { getBrandDir, join, slugify, createSessionDir } from '../core/paths'
import { extractBrandTopic } from '../cli/args'
import { generatePoster } from '../composite/poster'
import { parseVolume } from './image-cmd'
import type { AspectRatio } from '../composite/renderer/render'
import { loadBrandVisual } from '../core/visual'
import { loadBrand } from '../core/brand'
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
  const parsed = extractBrandTopic(args, ['image', 'headline', 'volume', 'eyebrow', 'layout'], ['no-logo', 'no-image', 'json', 'nano', 'pixel-sort'])
  const brand = parsed.brand
  const imagePath = parsed.flags.image
  const headline = parsed.flags.headline
  const noLogo = parsed.booleans.has('no-logo')
  const noImage = parsed.booleans.has('no-image')
  const volume = parseVolume(parsed.flags.volume)
  if (parsed.booleans.has('volume')) {
    throw new Error('Missing --volume value. Use --volume <zone>')
  }

  const nano = parsed.booleans.has('nano')
  const doPixelSort = parsed.booleans.has('pixel-sort')

  if (!nano && !noImage && !imagePath) throw new Error('Missing --image (or use --no-image for type-only). Usage: poster <brand> --image <path> --headline "<text>"')
  if (!headline) throw new Error('Missing --headline. Usage: poster <brand> --image <path> --headline "<text>"')
  if (imagePath && !existsSync(imagePath)) throw new Error(`Image not found: ${imagePath}`)

  console.log(`[poster] Brand: ${brand}${noImage ? ' (type-only)' : ''}${nano ? ' (nano)' : ''}`)
  console.log(`[poster] Headline: "${headline.slice(0, 50)}${headline.length > 50 ? '...' : ''}"`)

  const contentImage = (!noImage && imagePath) ? readFileSync(imagePath) : undefined
  const outputDir = createSessionDir(`poster-${slugify(headline, 30)}`)

  const eyebrow = parsed.flags.eyebrow
  const layout = parsed.flags.layout as import('../core/visual').LayoutName | undefined
  const outputs = await generateFinals(brand, headline, contentImage, { noLogo, outputDir, topic: headline, volume, nano, pixelSort: doPixelSort, eyebrow, layout })
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
  opts: { noLogo?: boolean; outputDir: string; topic?: string; volume?: string; seed?: string; nano?: boolean; pixelSort?: boolean; eyebrow?: string; layout?: import('../core/visual').LayoutName }
): Promise<Record<string, string>> {
  const { noLogo = false, outputDir, topic, seed, volume, nano = false, pixelSort: doPixelSort = false, eyebrow, layout: layoutOverride } = opts

  // Respect brand-level logo.social config — if false, suppress logo on all platform assets
  const brand = loadBrand(brandName) as any
  const brandSuppressesLogo = brand?.visual?.logo?.social === false
  const effectiveNoLogo = noLogo || brandSuppressesLogo

  const outputs: Record<string, string> = {}

  for (const [platform, ratio] of Object.entries(PLATFORM_RATIOS)) {
    try {
      let poster: Buffer

      if (nano) {
        const { generateNanoPoster } = await import('../composite/nano-poster')
        const result = await generateNanoPoster({
          brand: brandName,
          headline,
          topic: topic ?? headline,
          ratio,
          contentImage,
          volume,
          noLogo: effectiveNoLogo,
          eyebrow,
          pixelSortOpts: doPixelSort ? true : undefined,
        })
        poster = result.buffer
      } else {
        poster = await generatePoster({
          brand: brandName,
          headline,
          contentImage,
          ratio,
          noLogo: effectiveNoLogo,
          designZone: volume,
          topic,
          seed,
          layout: layoutOverride,
        })
      }

      const outPath = join(outputDir, `${platform}.png`)
      writeFileSync(outPath, poster)
      outputs[platform] = outPath
      console.log(`  OK ${platform}.png${effectiveNoLogo ? ' (no logo)' : ''}${nano ? ' (nano)' : ''}`)
    } catch (e: unknown) {
      console.error(`  FAIL ${platform}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return outputs
}
