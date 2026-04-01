/**
 * Social asset renderer.
 *
 * Two-phase pipeline:
 *   1. Gemini generates art-only image (no text, no logos)
 *   2. Canvas composites text + logo on top deterministically
 *
 * Falls back to solid-color canvas when no API key is set.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { createCanvas, Image, type CanvasRenderingContext2D } from 'canvas'
import type { BrandFoundation, SocialPlatform } from '../domain/types'
import { ensureParentDir, type RuntimePaths } from '../core/paths'
import { muted } from './colors'
import { ensureFontsRegistered } from './fonts'
import { generateImage } from './gemini'

ensureFontsRegistered()

// ── Types ──

interface RenderSocialAssetsOptions {
  brand: BrandFoundation
  paths: RuntimePaths
  runId: string
  headline: string
  body: string
  cta?: string
  sourceImagePath: string
  contentType?: string
}

interface PlatformSpec {
  platform: SocialPlatform
  width: number
  height: number
  aspect: string
  layout: 'wide' | 'square' | 'tall'
}

const PLATFORM_SPECS: PlatformSpec[] = [
  { platform: 'facebook',  width: 1200, height: 1200, aspect: '1:1',  layout: 'square' },
  { platform: 'instagram', width: 1080, height: 1350, aspect: '4:5',  layout: 'tall' },
  { platform: 'linkedin',  width: 1200, height: 1200, aspect: '1:1',  layout: 'square' },
  { platform: 'threads',   width: 1080, height: 1350, aspect: '4:5',  layout: 'tall' },
  { platform: 'twitter',   width: 1600, height: 900,  aspect: '16:9', layout: 'wide' },
]

// ── Helpers ──

function resolveLogoPath(brand: BrandFoundation, brandsDir: string): string | undefined {
  if (!brand.visual.logo) return undefined
  const p = join(brandsDir, brand.id, brand.visual.logo)
  return existsSync(p) ? p : undefined
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate
    } else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

// ── Phase 1: Gemini generates art-only image ──

function buildArtPrompt(
  spec: PlatformSpec,
  brand: BrandFoundation,
  headline: string,
): string {
  // Prefer the brand's curated image_prompt over generic composition tokens
  if (brand.visual.imagePrompt) {
    const base = brand.visual.imagePrompt.replace(/\[SUBJECT\]/gi, headline)
    // Override aspect ratio to match platform
    return base
      .replace(/1:1 square/gi, `${spec.aspect} at ${spec.width}x${spec.height}`)
      + '\nIMPORTANT: No text, no words, no letters, no logos, no brand names. Background visual only.'
  }

  // Fallback: build from brand visual tokens
  const lines: string[] = []
  lines.push(`A ${spec.aspect} abstract visual at ${spec.width}x${spec.height} pixels.`)
  if (brand.visual.style) lines.push(brand.visual.style)
  if (brand.visual.composition?.length) lines.push(`Composition: ${brand.visual.composition.join(', ')}.`)
  if (brand.visual.texture?.length) lines.push(`Texture: ${brand.visual.texture.join(', ')}.`)
  lines.push(`Palette: background ${brand.visual.palette.background}, primary ${brand.visual.palette.primary}, accent ${brand.visual.palette.accent}.`)
  if (brand.visual.negative?.length) lines.push(`Avoid: ${brand.visual.negative.join('. ')}.`)
  lines.push('IMPORTANT: No text, no words, no letters, no logos, no brand names. Background visual only.')
  return lines.join('\n')
}

// ── Phase 2: Canvas composites text + logo on top ──

function compositeAsset(
  artImage: Image | undefined,
  spec: PlatformSpec,
  brand: BrandFoundation,
  headline: string,
  body: string,
  cta: string | undefined,
  logoPath: string | undefined,
): Buffer {
  const { width, height } = spec
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')
  const palette = brand.visual.palette

  // Background
  ctx.fillStyle = palette.background
  ctx.fillRect(0, 0, width, height)

  // Art image — hard split, no gradient fade
  if (artImage) {
    const imgScale = Math.max(width / artImage.width, height / artImage.height)
    const dw = artImage.width * imgScale
    const dh = artImage.height * imgScale

    if (spec.layout === 'wide') {
      // Image on right half, text gets solid left
      ctx.save()
      ctx.beginPath()
      ctx.rect(width * 0.48, 0, width * 0.52, height)
      ctx.clip()
      ctx.drawImage(artImage, (width - dw) / 2, (height - dh) / 2, dw, dh)
      ctx.restore()
    } else if (spec.layout === 'tall') {
      // Image on top half, text gets solid bottom
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, 0, width, height * 0.48)
      ctx.clip()
      ctx.drawImage(artImage, (width - dw) / 2, (height * 0.48 - dh) / 2, dw, dh)
      ctx.restore()
    } else {
      // Square: image on right
      ctx.save()
      ctx.beginPath()
      ctx.rect(width * 0.45, 0, width * 0.55, height)
      ctx.clip()
      ctx.drawImage(artImage, (width - dw) / 2, (height - dh) / 2, dw, dh)
      ctx.restore()
    }
  }

  // Text zone dimensions
  const margin = Math.round(width * 0.06)
  const textW = spec.layout === 'wide'
    ? width * 0.40
    : spec.layout === 'square'
      ? width * 0.38
      : width - margin * 2
  const textX = margin
  const textY = spec.layout === 'tall' ? height * 0.54 : margin

  // Accent bar
  ctx.fillStyle = palette.accent
  if (spec.layout === 'wide') {
    ctx.fillRect(textX, textY, 4, height - margin * 2)
  } else if (spec.layout === 'tall') {
    ctx.fillRect(textX, textY - 16, textW, 4)
  } else {
    ctx.fillRect(textX, textY + 8, 4, height * 0.5)
  }

  const headlineX = spec.layout === 'tall' ? textX : textX + 20

  // Eyebrow (brand name)
  ctx.font = '500 18px "JetBrains Mono", monospace'
  ctx.fillStyle = palette.accent
  ctx.textBaseline = 'top'
  let cursorY = textY + (spec.layout === 'tall' ? 0 : 8)
  ctx.fillText(brand.name.toUpperCase(), headlineX, cursorY)
  cursorY += 40

  // Headline
  const headSize = spec.layout === 'wide' ? 56 : spec.layout === 'square' ? 60 : 64
  ctx.font = `700 ${headSize}px "Alegreya", Georgia, serif`
  ctx.fillStyle = palette.primary
  const headlineLines = wrapText(ctx, headline, textW - 20).slice(0, 4)
  for (const line of headlineLines) {
    ctx.fillText(line, headlineX, cursorY)
    cursorY += headSize * 1.15
  }
  cursorY += 16

  // Body
  const bodySize = spec.layout === 'wide' ? 24 : 28
  ctx.font = `400 ${bodySize}px Inter, sans-serif`
  ctx.fillStyle = muted(palette.primary, palette.background, 0.7)
  const bodyLines = wrapText(ctx, body, textW - 20).slice(0, 4)
  for (const line of bodyLines) {
    ctx.fillText(line, headlineX, cursorY)
    cursorY += bodySize * 1.5
  }

  // CTA
  if (cta) {
    cursorY += 8
    ctx.font = `500 ${bodySize - 4}px Inter, sans-serif`
    ctx.fillStyle = palette.accent
    ctx.fillText(cta, headlineX, cursorY)
  }

  // Logo or brand text at bottom
  const logoY = height - margin
  if (logoPath && existsSync(logoPath)) {
    try {
      const img = new Image()
      img.src = readFileSync(logoPath)
      const logoH = 28
      const logoW = (img.width / img.height) * logoH
      ctx.globalAlpha = 0.5
      ctx.drawImage(img, headlineX, logoY - logoH, logoW, logoH)
    } finally {
      ctx.globalAlpha = 1
    }
  } else {
    ctx.font = '500 16px "JetBrains Mono", monospace'
    ctx.fillStyle = muted(palette.primary, palette.background, 0.4)
    ctx.fillText(brand.name.toUpperCase(), headlineX, logoY - 16)
  }

  return canvas.toBuffer('image/png')
}

// ── Public API ──

function outputPath(paths: RuntimePaths, runId: string, platform: SocialPlatform): string {
  return join(paths.artifactsDir, runId, `${platform}.png`)
}

export async function renderSocialAssets(options: RenderSocialAssetsOptions): Promise<Record<SocialPlatform, string>> {
  const hasApiKey = !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)
  const logoPath = resolveLogoPath(options.brand, join(options.paths.root, 'brands'))

  // Generate art image (or use source image fallback)
  let artImage: Image | undefined
  if (hasApiKey) {
    const artPrompt = buildArtPrompt(
      { platform: 'linkedin', width: 1200, height: 1200, aspect: '1:1', layout: 'square' },
      options.brand,
      options.headline,
    )
    const artBytes = await generateImage(artPrompt)
    if (artBytes) {
      artImage = new Image()
      artImage.src = artBytes
    }
  }
  if (!artImage && options.sourceImagePath && existsSync(options.sourceImagePath)) {
    artImage = new Image()
    artImage.src = readFileSync(options.sourceImagePath)
  }

  const assets = {} as Record<SocialPlatform, string>

  for (const spec of PLATFORM_SPECS) {
    const png = compositeAsset(artImage, spec, options.brand, options.headline, options.body, options.cta, logoPath)
    const path = outputPath(options.paths, options.runId, spec.platform)
    ensureParentDir(path)
    writeFileSync(path, png)
    assets[spec.platform] = path
  }

  return assets
}
