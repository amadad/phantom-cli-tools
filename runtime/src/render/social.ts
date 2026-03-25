import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { createCanvas, Image, type CanvasRenderingContext2D } from 'canvas'
import type { BrandFoundation, SocialPlatform } from '../domain/types'
import { ensureParentDir, type RuntimePaths } from '../core/paths'

interface RenderSocialAssetsOptions {
  brand: BrandFoundation
  paths: RuntimePaths
  runId: string
  headline: string
  body: string
  sourceImagePath: string
}

const PLATFORM_SPECS: Array<{ platform: SocialPlatform; width: number; height: number; layout: 'wide' | 'square' | 'tall' }> = [
  { platform: 'facebook', width: 1200, height: 1200, layout: 'square' },
  { platform: 'instagram', width: 1080, height: 1350, layout: 'tall' },
  { platform: 'linkedin', width: 1200, height: 1200, layout: 'square' },
  { platform: 'threads', width: 1080, height: 1350, layout: 'tall' },
  { platform: 'twitter', width: 1600, height: 900, layout: 'wide' },
]

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

function drawSourceCover(
  ctx: CanvasRenderingContext2D,
  image: Image,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const scale = Math.max(width / image.width, height / image.height)
  const drawWidth = image.width * scale
  const drawHeight = image.height * scale
  const offsetX = x + (width - drawWidth) / 2
  const offsetY = y + (height - drawHeight) / 2
  ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight)
}

function drawTextBlock(
  ctx: CanvasRenderingContext2D,
  brand: BrandFoundation,
  headline: string,
  body: string,
  x: number,
  y: number,
  width: number,
  layout: 'wide' | 'square' | 'tall',
): void {
  ctx.fillStyle = brand.visual.palette.primary
  ctx.textBaseline = 'top'
  ctx.font = layout === 'wide' ? '700 68px sans-serif' : '700 72px sans-serif'

  const headlineLines = wrapText(ctx, headline, width).slice(0, layout === 'wide' ? 3 : 4)
  let currentY = y
  for (const line of headlineLines) {
    ctx.fillText(line, x, currentY)
    currentY += layout === 'wide' ? 78 : 82
  }

  currentY += 24
  ctx.globalAlpha = 0.86
  ctx.font = layout === 'wide' ? '400 30px sans-serif' : '400 34px sans-serif'
  const bodyLines = wrapText(ctx, body, width).slice(0, layout === 'wide' ? 4 : 5)
  for (const line of bodyLines) {
    ctx.fillText(line, x, currentY)
    currentY += layout === 'wide' ? 42 : 48
  }
  ctx.globalAlpha = 1

  ctx.fillStyle = brand.visual.palette.accent
  ctx.font = '700 24px sans-serif'
  ctx.fillText(brand.name.toUpperCase(), x, currentY + 24)
}

function outputPath(paths: RuntimePaths, runId: string, platform: SocialPlatform): string {
  return join(paths.artifactsDir, runId, `${platform}.png`)
}

export function renderSocialAssets(options: RenderSocialAssetsOptions): Record<SocialPlatform, string> {
  const sourceImage = new Image()
  sourceImage.src = readFileSync(options.sourceImagePath)
  const assets = {} as Record<SocialPlatform, string>

  for (const spec of PLATFORM_SPECS) {
    const canvas = createCanvas(spec.width, spec.height)
    const ctx = canvas.getContext('2d')

    ctx.fillStyle = options.brand.visual.palette.background
    ctx.fillRect(0, 0, spec.width, spec.height)

    if (spec.layout === 'wide') {
      drawSourceCover(ctx, sourceImage, spec.width * 0.45, 0, spec.width * 0.55, spec.height)
      ctx.fillStyle = options.brand.visual.palette.background
      ctx.globalAlpha = 0.94
      ctx.fillRect(0, 0, spec.width * 0.52, spec.height)
      ctx.globalAlpha = 1
      ctx.fillStyle = options.brand.visual.palette.accent
      ctx.fillRect(64, 64, 14, spec.height - 128)
      drawTextBlock(ctx, options.brand, options.headline, options.body, 116, 92, spec.width * 0.34, spec.layout)
    } else if (spec.layout === 'tall') {
      drawSourceCover(ctx, sourceImage, 0, 0, spec.width, spec.height * 0.5)
      ctx.fillStyle = options.brand.visual.palette.background
      ctx.fillRect(0, spec.height * 0.46, spec.width, spec.height * 0.54)
      ctx.fillStyle = options.brand.visual.palette.accent
      ctx.fillRect(72, spec.height * 0.5, spec.width - 144, 12)
      drawTextBlock(ctx, options.brand, options.headline, options.body, 72, spec.height * 0.56, spec.width - 144, spec.layout)
    } else {
      drawSourceCover(ctx, sourceImage, 0, 0, spec.width, spec.height)
      const overlay = ctx.createLinearGradient(0, spec.height * 0.34, 0, spec.height)
      overlay.addColorStop(0, 'rgba(0,0,0,0)')
      overlay.addColorStop(1, options.brand.visual.palette.background)
      ctx.fillStyle = overlay
      ctx.fillRect(0, 0, spec.width, spec.height)
      ctx.fillStyle = options.brand.visual.palette.background
      ctx.globalAlpha = 0.92
      ctx.fillRect(0, spec.height * 0.54, spec.width, spec.height * 0.46)
      ctx.globalAlpha = 1
      drawTextBlock(ctx, options.brand, options.headline, options.body, 72, spec.height * 0.61, spec.width - 144, spec.layout)
    }

    const path = outputPath(options.paths, options.runId, spec.platform)
    ensureParentDir(path)
    writeFileSync(path, canvas.toBuffer('image/png'))
    assets[spec.platform] = path
  }

  return assets
}
