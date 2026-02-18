/**
 * Poster command - Generate final platform posters from image + headline
 *
 * Usage:
 *   poster <brand> --image <path> --headline "<text>" [--no-logo] [--json]
 */

import { readFileSync, existsSync, writeFileSync } from 'fs'
import { loadBrand } from '../core/brand'
import { getBrandDir, join } from '../core/paths'
import { slugify, createSessionDir } from '../core/session'
import { parseArgs } from '../cli/args'
import { generatePoster } from '../composite/poster'
import type { BrandProfile } from '../core/types'
import type { CommandContext } from '../cli/types'

export interface PosterCommandResult {
  outputs: Record<string, string>
  logoUsed: boolean
  outputDir: string
}

export async function run(args: string[], _ctx?: CommandContext): Promise<PosterCommandResult> {
  const parsed = parseArgs(args, ['image', 'headline'])
  const brand = parsed.brand
  const imagePath = parsed.flags.image
  const headline = parsed.flags.headline
  const noLogo = parsed.booleans.has('no-logo')

  if (!imagePath) throw new Error('Missing --image. Usage: poster <brand> --image <path> --headline "<text>"')
  if (!headline) throw new Error('Missing --headline. Usage: poster <brand> --image <path> --headline "<text>"')
  if (!existsSync(imagePath)) throw new Error(`Image not found: ${imagePath}`)

  console.log(`[poster] Brand: ${brand}`)
  console.log(`[poster] Headline: "${headline.slice(0, 50)}${headline.length > 50 ? '...' : ''}"`)

  const contentImage = readFileSync(imagePath)
  const outputDir = createSessionDir(`poster-${slugify(headline, 30)}`)

  const outputs = await generateFinals(brand, headline, contentImage, { noLogo, outputDir })

  return { outputs, logoUsed: !noLogo, outputDir }
}

/**
 * Self-contained poster generation. Takes brand name, does all setup internally.
 * Used by both `poster` command and `explore`.
 */
export async function generateFinals(
  brandName: string,
  headline: string,
  contentImage: Buffer,
  opts: { noLogo?: boolean; outputDir: string }
): Promise<Record<string, string>> {
  const brandConfig = loadBrand(brandName)
  const { noLogo = false, outputDir } = opts

  const templateOverrides = brandConfig.style?.templates || (brandConfig as any).visual?.templates
  const defaultPlatforms = [
    { name: 'twitter', template: 'banner', ratio: 'landscape' as const, logo: true },
    { name: 'instagram', template: 'polaroid', ratio: 'portrait' as const, logo: false },
    { name: 'story', template: 'polaroid', ratio: 'story' as const, logo: true },
  ]
  const platforms = templateOverrides ?? defaultPlatforms

  const typography = brandConfig.style?.typography?.headline || (brandConfig as any).visual?.typography?.headline
  const brandFonts = typography ? {
    headline: { name: typography.font?.toLowerCase() || 'alegreya', weight: typography.weight || 400 }
  } : undefined

  const logoPath = resolveLogoPath(brandName, brandConfig)
  const posterStyle = resolvePosterStyle(brandConfig)

  const outputs: Record<string, string> = {}

  for (const platform of platforms) {
    try {
      const useLogo = !noLogo && platform.logo
      const poster = await generatePoster({
        template: platform.template,
        ratio: platform.ratio,
        headline,
        contentImage,
        logoPath: useLogo ? logoPath : undefined,
        fonts: brandFonts,
        style: posterStyle,
      })
      const outPath = join(outputDir, `${platform.name}.png`)
      writeFileSync(outPath, poster)
      outputs[platform.name] = outPath
      console.log(`  OK ${platform.name}.png${useLogo ? '' : ' (no logo)'}`)
    } catch (e: any) {
      console.log(`  FAIL ${platform.name}: ${e.message}`)
    }
  }

  return outputs
}

function resolveLogoPath(brandName: string, brand: BrandProfile): string | undefined {
  const logoSvg = brand.style?.logo?.svg
  if (logoSvg) return join(getBrandDir(brandName), logoSvg)

  const defaultSvg = join(getBrandDir(brandName), 'assets', 'logo.svg')
  const defaultPng = join(getBrandDir(brandName), 'assets', 'logo.png')
  if (existsSync(defaultSvg)) return defaultSvg
  if (existsSync(defaultPng)) return defaultPng
  return undefined
}

function resolvePosterStyle(brand: BrandProfile) {
  if (brand.style) return brand.style
  const vp = brand.visual?.palette
  if (!vp) return undefined
  return {
    colors: {
      dark: vp.primary || '#000000',
      light: vp.secondary || '#FFFFFF',
      accent: vp.accent || vp.primary || '#000000',
      backgrounds: {
        warm: vp.secondary || '#FFFFFF',
        cream: vp.secondary || '#FFFFFF',
        dark: vp.primary || '#000000'
      }
    },
    logo: {
      colors: {
        onLight: vp.primary || '#000000',
        onDark: vp.secondary || '#FFFFFF'
      }
    }
  }
}
