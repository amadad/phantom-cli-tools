/**
 * GraphicLayer — brand-consistent graphic framing elements.
 *
 * Renders structural/visual elements derived purely from brand tokens:
 *   - Background fill (from tokens)
 *   - Gradient overlay (accent color at low opacity, over image zone)
 *   - Geometric accent shapes (token-driven, not hardcoded)
 *   - Logo placement
 *
 * This layer runs BEFORE TypeLayer so text always sits on top.
 */

import { createCanvas, loadImage, type CanvasRenderingContext2D } from 'canvas'
import { readFileSync, existsSync } from 'fs'
import type { BrandTokens, PixelZone } from '../types'

export interface GraphicLayerOptions {
  ctx: CanvasRenderingContext2D
  width: number
  height: number
  tokens: BrandTokens
  template: string
  background: 'light' | 'dark' | 'warm'
  imageZone: PixelZone
  textZone: PixelZone
  logoZone: PixelZone
  logoPath?: string
}

/** Parse hex color to [r, g, b] */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return [r, g, b]
}

/** Resolve background fill color from tokens + background type */
function resolveBackground(tokens: BrandTokens, bg: 'light' | 'dark' | 'warm'): string {
  if (bg === 'dark') return tokens['color.primary'] ?? '#1E1B16'
  if (bg === 'warm') return tokens['color.warm'] ?? tokens['color.background'] ?? '#FCEEE3'
  return tokens['color.background'] ?? '#FDFBF7'
}

/** Whether background is dark (affects logo/text color choices) */
function isDark(background: 'light' | 'dark' | 'warm'): boolean {
  return background === 'dark'
}

export async function drawGraphicLayer(options: GraphicLayerOptions): Promise<void> {
  const {
    ctx, width, height, tokens, template, background,
    imageZone, textZone, logoZone, logoPath,
  } = options

  const bgColor = resolveBackground(tokens, background)
  const accentColor = tokens['color.accent'] ?? '#5046E5'
  const dark = isDark(background)

  // ── 1. Background fill ──────────────────────────────────────────────────────
  ctx.fillStyle = bgColor
  ctx.fillRect(0, 0, width, height)

  // ── 2. Gradient overlay on image zone (accent → transparent, low opacity) ──
  // Gives brand-specific colour wash at the base of the image zone
  const [ar, ag, ab] = hexToRgb(accentColor)
  const grad = ctx.createLinearGradient(
    imageZone.x, imageZone.y + imageZone.height * 0.6,  // start 60% down
    imageZone.x, imageZone.y + imageZone.height         // end at bottom
  )
  grad.addColorStop(0, `rgba(${ar},${ag},${ab},0)`)
  grad.addColorStop(1, `rgba(${ar},${ag},${ab},0.22)`)
  ctx.fillStyle = grad
  ctx.fillRect(imageZone.x, imageZone.y, imageZone.width, imageZone.height)

  // ── 3. Geometric accent shape (top-left corner square in accent color) ──────
  // Size: 1.5% of canvas width, placed at image zone top-left
  const shapeSize = Math.round(width * 0.015)
  ctx.fillStyle = accentColor
  ctx.fillRect(imageZone.x, imageZone.y, shapeSize, shapeSize)

  // ── 4. Text zone background strip (for dark-bg templates: darken slightly) ──
  if (dark) {
    // Dark overlay under text for readability on light templates with overlay
    ctx.fillStyle = `rgba(0,0,0,0.15)`
    ctx.fillRect(textZone.x, textZone.y, textZone.width, textZone.height)
  } else {
    // Light templates: subtle secondary-color rule above text zone
    const secColor = tokens['color.secondary'] ?? tokens['color.primary'] ?? '#3D3929'
    const [sr, sg, sb] = hexToRgb(secColor)
    ctx.fillStyle = `rgba(${sr},${sg},${sb},0.12)`
    ctx.fillRect(textZone.x, textZone.y - 2, textZone.width, 2)
  }

  // ── 5. Logo ─────────────────────────────────────────────────────────────────
  // Resolve logo path: prefer token-defined variant, fall back to logoPath param
  const projectRoot = process.cwd().includes('agent')
    ? require('path').resolve(process.cwd(), '..')
    : process.cwd()
  const tokenLogoPath = dark
    ? tokens['logo.darkPath']
    : tokens['logo.path']
  const resolvedLogoPath = tokenLogoPath
    ? require('path').resolve(projectRoot, tokenLogoPath)
    : logoPath

  if (resolvedLogoPath && existsSync(resolvedLogoPath)) {
    try {
      if (resolvedLogoPath.endsWith('.svg')) {
        // Load SVG as-is — the correct colour variant is already baked into the file
        const svgContent = readFileSync(resolvedLogoPath, 'utf-8')
        const dataUri = `data:image/svg+xml;base64,${Buffer.from(svgContent).toString('base64')}`
        const img = await loadImage(dataUri)
        const scale = Math.min(logoZone.width / img.width, logoZone.height / img.height)
        const dw = img.width * scale
        const dh = img.height * scale
        const dx = logoZone.x // left-align within zone
        const dy = logoZone.y + (logoZone.height - dh) / 2
        ctx.drawImage(img as any, dx, dy, dw, dh)
      } else {
        const img = await loadImage(resolvedLogoPath)
        const scale = Math.min(logoZone.width / img.width, logoZone.height / img.height)
        const dw = img.width * scale
        const dh = img.height * scale
        const dx = logoZone.x
        const dy = logoZone.y + (logoZone.height - dh) / 2
        ctx.drawImage(img as any, dx, dy, dw, dh)
      }
    } catch (err: any) {
      console.warn(`[GraphicLayer] Logo draw failed: ${err.message}`)
    }
  }
}
